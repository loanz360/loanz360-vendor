import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Employee Email Single Message API
 * Get, update, delete individual email from database
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get single email message
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id, email_address')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Fetch the actual email from database
    const { data: message, error: messageError } = await serviceClient
      .from('email_messages')
      .select('*')
      .eq('id', id)
      .eq('email_account_id', account.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (messageError) {
      if (messageError.code === '42P01' || messageError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Email system is being set up. Please check back later.',
          code: 'EMAIL_NOT_CONFIGURED',
        }, { status: 503 })
      }
      throw messageError
    }

    if (!message) {
      return NextResponse.json({ success: false, error: 'Email not found' }, { status: 404 })
    }

    // Mark as read if not already
    if (!message.is_read) {
      await serviceClient
        .from('email_messages')
        .update({ is_read: true })
        .eq('id', id)
    }

    // Transform to frontend format
    const email = {
      id: message.id,
      message_id: message.message_id || `<${message.id}@loanz360.com>`,
      thread_id: message.thread_id,
      from: message.from_address || { name: '', email: '' },
      to: message.to_addresses || [],
      cc: message.cc_addresses || [],
      bcc: message.bcc_addresses || [],
      reply_to: message.reply_to_address,
      subject: message.subject || '(No subject)',
      date: message.received_at || message.sent_at || message.created_at,
      body_html: message.body_html || '',
      body_text: message.body_text || '',
      snippet: message.snippet || '',
      is_read: true,
      is_starred: message.is_starred,
      has_attachments: message.has_attachments,
      attachments: (message.attachments || []).map((att: Record<string, unknown>) => ({
        id: att.id || att.filename,
        filename: att.filename,
        size: att.size || 0,
        content_type: att.content_type || att.mime_type || 'application/octet-stream',
        download_url: att.download_url || `/api/email/attachments?message_id=${id}&attachment_id=${att.id}`,
      })),
      labels: message.labels || [],
      folder: message.folder,
      headers: message.headers || {},
    }

    // Log view activity (fire and forget)
    serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'read',
        details: { message_id: id },
      })
      .then(() => {})

    return NextResponse.json({ success: true, data: email })
  } catch (error) {
    apiLogger.error('Get email error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update message (star, read status, move)
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      is_read: z.boolean().optional(),


      is_starred: z.boolean().optional(),


      folder: z.string().optional(),


      labels: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { is_read, is_starred, folder, labels } = body

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (is_read !== undefined) updates.is_read = is_read
    if (is_starred !== undefined) updates.is_starred = is_starred
    if (folder !== undefined) updates.folder = folder
    if (labels !== undefined) updates.labels = labels

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    // Update the message in the database
    const { error: updateError } = await serviceClient
      .from('email_messages')
      .update(updates)
      .eq('id', id)
      .eq('email_account_id', account.id)

    if (updateError) {
      if (updateError.code === '42P01' || updateError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Email system is being set up.',
          code: 'EMAIL_NOT_CONFIGURED',
        }, { status: 503 })
      }
      throw updateError
    }

    // Log the action (fire and forget)
    const actions: string[] = []
    if (is_read !== undefined) actions.push(is_read ? 'read' : 'unread')
    if (is_starred !== undefined) actions.push(is_starred ? 'starred' : 'unstarred')
    if (folder) actions.push('archived')
    if (labels) actions.push('settings_changed')

    for (const action of actions) {
      serviceClient
        .from('email_activity_logs')
        .insert({
          email_account_id: account.id,
          action,
          details: { message_id: id, ...updates },
        })
        .then(() => {})
    }

    return NextResponse.json({
      success: true,
      message: 'Message updated successfully',
    })
  } catch (error) {
    apiLogger.error('Update email error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Soft-delete message (move to trash or permanently delete)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    if (permanent) {
      // Permanently delete
      const { error: deleteError } = await serviceClient
        .from('email_messages')
        .delete()
        .eq('id', id)
        .eq('email_account_id', account.id)

      if (deleteError) throw deleteError
    } else {
      // Soft delete - move to trash
      const { error: updateError } = await serviceClient
        .from('email_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          folder: 'trash',
        })
        .eq('id', id)
        .eq('email_account_id', account.id)

      if (updateError) throw updateError
    }

    // Log the action
    serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'deleted',
        details: { message_id: id, permanent },
      })
      .then(() => {})

    return NextResponse.json({
      success: true,
      message: permanent ? 'Message permanently deleted' : 'Message moved to trash',
    })
  } catch (error) {
    apiLogger.error('Delete email error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
