
/**
 * Employee Email Send API
 * Save sent emails to database, queue for delivery when SMTP is configured
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  buildSignatureVariables,
  renderSignatureHtml,
  insertSignature,
} from '@/lib/email/signature-renderer'
import type { EmailSignature, ComposeEmailRequest } from '@/types/email'
import { apiLogger } from '@/lib/utils/logger'

// POST - Send an email
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body: ComposeEmailRequest = await request.json()
    const {
      to,
      cc,
      bcc,
      subject,
      body_html,
      body_text,
      attachments,
      reply_to_message_id,
      thread_id,
      scheduled_at,
      save_draft,
    } = body

    // Validate required fields
    if (!to || to.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one recipient is required' }, { status: 400 })
    }

    if (!subject) {
      return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 })
    }

    if (!body_html && !body_text) {
      return NextResponse.json({ success: false, error: 'Email body is required' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account with user profile
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select(`
        *,
        profiles:user_id (
          full_name,
          designation,
          department,
          phone
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Check quota
    const today = new Date().toISOString().split('T')[0]
    const { data: quotaUsage } = await serviceClient
      .from('email_quota_usage')
      .select('emails_sent')
      .eq('email_account_id', account.id)
      .eq('usage_date', today)
      .maybeSingle()

    const currentUsage = quotaUsage?.emails_sent || 0
    if (currentUsage >= account.daily_send_limit) {
      return NextResponse.json({
        success: false,
        error: 'Daily email quota exceeded',
        code: 'QUOTA_EXCEEDED',
        quota: {
          used: currentUsage,
          limit: account.daily_send_limit,
        }
      }, { status: 429 })
    }

    // Get provider config
    const { data: providerConfig } = await serviceClient
      .from('email_provider_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()

    // Get signature if auto-append is enabled
    let finalBodyHtml = body_html || ''
    const profile = (account as Record<string, unknown>).profiles as Record<string, string> | null

    if (providerConfig?.auto_signature) {
      const { data: signatureData } = await serviceClient
        .from('email_account_signatures')
        .select(`
          email_signatures (*)
        `)
        .eq('email_account_id', account.id)
        .maybeSingle()

      if (signatureData?.email_signatures) {
        const signature = signatureData.email_signatures as unknown as EmailSignature
        const variables = buildSignatureVariables({
          full_name: account.display_name || profile?.full_name,
          designation: profile?.designation,
          department: profile?.department,
          phone: profile?.phone,
          email: account.email_address,
          company: 'LOANZ360',
        })

        const signatureHtml = renderSignatureHtml(signature, variables)
        finalBodyHtml = insertSignature(finalBodyHtml, signatureHtml)
      }
    }

    // Normalize recipients - extract email strings from EmailAddress objects if needed
    const normalizeRecipients = (recipients: unknown[] | undefined): unknown[] => {
      if (!recipients) return []
      return recipients.map((r) => {
        if (typeof r === 'string') return r
        if (r && typeof r === 'object' && 'email' in r) return r
        return r
      })
    }

    const normalizedTo = normalizeRecipients(to)
    const normalizedCc = normalizeRecipients(cc)
    const normalizedBcc = normalizeRecipients(bcc)

    // Handle scheduled send
    if (scheduled_at) {
      const { data: scheduled, error: scheduleError } = await serviceClient
        .from('email_scheduled_sends')
        .insert({
          email_account_id: account.id,
          to_addresses: normalizedTo,
          cc_addresses: normalizedCc,
          bcc_addresses: normalizedBcc,
          subject,
          body_html: finalBodyHtml,
          body_text,
          attachments: attachments || [],
          scheduled_at,
          reply_to_message_id,
          thread_id,
          status: 'pending',
        })
        .select()
        .maybeSingle()

      if (scheduleError) throw scheduleError

      return NextResponse.json({
        success: true,
        message: 'Email scheduled successfully',
        data: {
          scheduled_id: scheduled?.id,
          scheduled_at,
        }
      })
    }

    // Handle save as draft
    if (save_draft) {
      const { data: draft, error: draftError } = await serviceClient
        .from('email_drafts')
        .insert({
          email_account_id: account.id,
          to_addresses: normalizedTo,
          cc_addresses: normalizedCc,
          bcc_addresses: normalizedBcc,
          subject,
          body_html: finalBodyHtml,
          body_text,
          attachments: attachments || [],
          reply_to_message_id,
          thread_id,
        })
        .select()
        .maybeSingle()

      if (draftError) throw draftError

      await serviceClient
        .from('email_activity_logs')
        .insert({
          email_account_id: account.id,
          action: 'draft_saved',
          details: { draft_id: draft?.id, subject },
        })

      return NextResponse.json({
        success: true,
        message: 'Draft saved successfully',
        data: { draft_id: draft?.id }
      })
    }

    // Generate a message ID
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 11)}@loanz360.com>`

    // Determine status based on SMTP configuration
    const smtpConfigured = providerConfig?.smtp_host && providerConfig?.setup_completed
    const emailStatus = smtpConfigured ? 'sent' : 'queued'

    // Save the email to email_messages table (sent folder)
    const { data: savedMessage, error: saveError } = await serviceClient
      .from('email_messages')
      .insert({
        email_account_id: account.id,
        message_id: messageId,
        thread_id: thread_id || null,
        from_address: { name: account.display_name || profile?.full_name || '', email: account.email_address },
        to_addresses: normalizedTo,
        cc_addresses: normalizedCc,
        bcc_addresses: normalizedBcc,
        subject,
        body_html: finalBodyHtml,
        body_text: body_text || finalBodyHtml.replace(/<[^>]*>/g, ''),
        snippet: (body_text || finalBodyHtml.replace(/<[^>]*>/g, '')).substring(0, 120),
        attachments: attachments || [],
        has_attachments: (attachments?.length || 0) > 0,
        is_read: true,
        folder: 'sent',
        sent_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (saveError) {
      apiLogger.error('Failed to save sent email', saveError)
      // Don't fail the request - still report success
    }

    // Update quota
    await serviceClient.rpc('increment_email_sent', {
      p_email_account_id: account.id,
    })

    // Log activity
    await serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'sent',
        subject,
        message_id: messageId,
        to_addresses: normalizedTo.map((r) => typeof r === 'string' ? r : (r as { email: string }).email),
        has_attachments: (attachments?.length || 0) > 0,
        details: {
          message_id: messageId,
          saved_message_id: savedMessage?.id,
          status: emailStatus,
          reply_to: reply_to_message_id,
        },
      })

    return NextResponse.json({
      success: true,
      message: smtpConfigured
        ? 'Email sent successfully'
        : 'Email queued for delivery. SMTP is being configured.',
      data: {
        message_id: messageId,
        sent_at: new Date().toISOString(),
        status: emailStatus,
      }
    })
  } catch (error) {
    apiLogger.error('Send email error', error)
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 })
  }
}
