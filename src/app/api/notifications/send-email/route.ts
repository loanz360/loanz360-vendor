import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { generateEmailHtml, generatePlainTextEmail } from '@/lib/email/templates/notification-email'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      notification_id: z.string().uuid(),


      recipient_ids: z.array(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { notification_id, recipient_ids } = body

    if (!notification_id) {
      return NextResponse.json({ success: false, error: 'Notification ID is required' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      apiLogger.error('[Email] RESEND_API_KEY not configured')
      return NextResponse.json({ success: false, error: 'Email service not configured - Set RESEND_API_KEY in .env' }, { status: 500 })
    }

    // Initialize Resend client
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Fetch notification details
    const { data: notification, error: notifError } = await supabase
      .from('system_notifications')
      .select(`
        *,
        sent_by:users!system_notifications_sent_by_fkey(full_name, email)
      `)
      .eq('id', notification_id)
      .maybeSingle()

    if (notifError || !notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 })
    }

    // Fetch recipients
    let recipientsQuery = supabase
      .from('notification_recipients')
      .select(`
        user_id,
        user_type,
        users!notification_recipients_user_id_fkey(
          id,
          email,
          full_name
        )
      `)
      .eq('notification_id', notification_id)

    if (recipient_ids && recipient_ids.length > 0) {
      recipientsQuery = recipientsQuery.in('user_id', recipient_ids)
    }

    const { data: recipients, error: recipientsError } = await recipientsQuery

    if (recipientsError || !recipients || recipients.length === 0) {
      return NextResponse.json({ success: false, error: 'No recipients found' }, { status: 404 })
    }

    // Prepare email data
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const notificationUrl = `${baseUrl}/notifications/${notification_id}`
    const senderName = notification.sent_by?.full_name || 'LOANZ 360'

    // Sanitize HTML content before rendering to prevent XSS
    const sanitizedMessageHtml = notification.message_html
      ? sanitizeHtml(notification.message_html)
      : null

    // Generate HTML email
    const htmlContent = generateEmailHtml({
      title: notification.title,
      message: notification.message,
      messageHtml: sanitizedMessageHtml,
      senderName,
      imageUrl: notification.image_url,
      actionUrl: notification.action_url,
      actionLabel: notification.action_label,
      priority: notification.priority,
      notificationUrl
    })

    // Generate plain text
    const textContent = generatePlainTextEmail({
      title: notification.title,
      message: notification.message,
      senderName,
      priority: notification.priority,
      actionUrl: notification.action_url,
      actionLabel: notification.action_label,
      notificationUrl
    })

    // Send emails
    const emailPromises = recipients
      .filter(r => r.users && r.users.email)
      .map(async (recipient) => {
        try {
          const result = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'LOANZ 360 <notifications@loanz360.com>',
            to: recipient.users.email,
            subject: `[${notification.priority.toUpperCase()}] ${notification.title}`,
            html: htmlContent,
            text: textContent,
            headers: { 'X-Entity-Ref-ID': notification_id },
            tags: [
              { name: 'category', value: 'notification' },
              { name: 'priority', value: notification.priority }
            ]
          })

          return {
            user_id: recipient.user_id,
            email: recipient.users.email,
            success: true,
            email_id: result.data?.id
          }
        } catch (error: unknown) {
          return {
            user_id: recipient.user_id,
            email: recipient.users.email,
            success: false,
            error: 'Internal server error'
          }
        }
      })

    const results = await Promise.allSettled(emailPromises)
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    // Log delivery
    const deliveryLogs = results
      .filter(r => r.status === 'fulfilled')
      .map((r: PromiseFulfilledResult<{ user_id: string; email: string; success: boolean; email_id?: string; error?: string }>) => ({
        notification_id,
        user_id: r.value.user_id,
        channel: 'email',
        status: r.value.success ? 'sent' : 'failed',
        external_id: r.value.email_id,
        external_provider: 'resend',
        recipient_email: r.value.email,
        error_message: r.value.error,
        sent_at: new Date().toISOString()
      }))

    if (deliveryLogs.length > 0) {
      await supabase.from('notification_delivery_log').insert(deliveryLogs)
    }

    return NextResponse.json({
      success: true,
      message: `Emails sent: ${successful} successful, ${failed} failed`,
      sent_count: successful,
      failed_count: failed
    })

  } catch (error: unknown) {
    apiLogger.error('[Email] Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
