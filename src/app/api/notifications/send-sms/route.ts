
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gatewayService } from '@/lib/providers/gateway-service'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notification_id, recipient_ids, phone_numbers, message, template_id, entity_id } = body

    // Direct send mode (phone numbers provided)
    if (phone_numbers && phone_numbers.length > 0) {
      const results = []
      for (const phone of phone_numbers) {
        const result = await gatewayService.sendSMS({
          to: phone,
          message: message || body.content,
          template_id,
          entity_id
        })
        results.push({ phone, ...result })
      }

      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      return NextResponse.json({
        success: successful > 0,
        message: `SMS sent: ${successful} successful, ${failed} failed`,
        sent_count: successful,
        failed_count: failed,
        results
      })
    }

    // Notification-based send mode
    if (!notification_id) {
      return NextResponse.json({ success: false, error: 'notification_id or phone_numbers is required' }, { status: 400 })
    }

    // Fetch notification details
    const { data: notification, error: notifError } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('id', notification_id)
      .maybeSingle()

    if (notifError || !notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 })
    }

    // Fetch recipients with phone numbers
    let recipientsQuery = supabase
      .from('notification_recipients')
      .select(`
        user_id,
        user_type,
        users!notification_recipients_user_id_fkey(
          id,
          phone,
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

    // Prepare SMS content (160 char limit for single SMS)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const notificationUrl = `${baseUrl}/notifications/${notification_id}`

    // Truncate message to fit SMS limit
    const maxMessageLength = 100 // Leave room for title and link
    const truncatedMessage = notification.message.length > maxMessageLength
      ? notification.message.substring(0, maxMessageLength) + '...'
      : notification.message

    const smsBody = `[LOANZ360] ${notification.title}\n${truncatedMessage}\nView: ${notificationUrl}`

    // Send SMS to all recipients with phone numbers
    const smsPromises = recipients
      .filter((r) => r.users && r.users.phone)
      .map(async (recipient) => {
        try {
          // Format phone number (ensure it starts with country code)
          let phone = recipient.users.phone
          if (!phone.startsWith('+')) {
            // Assume Indian number if no country code
            phone = `+91${phone.replace(/^0+/, '')}`
          }

          const result = await gatewayService.sendSMS({
            to: phone,
            message: smsBody,
            template_id,
            entity_id
          })

          return {
            user_id: recipient.user_id,
            phone: recipient.users.phone,
            success: result.success,
            message_id: result.message_id,
            provider: result.provider,
            error: result.error
          }
        } catch (error: unknown) {
          apiLogger.error('[SMS] Failed to send', {
            recipient: recipient.users.phone,
            error: 'Internal server error'
          })

          return {
            user_id: recipient.user_id,
            phone: recipient.users.phone,
            success: false,
            error: 'Internal server error'
          }
        }
      })

    const results = await Promise.all(smsPromises)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    // Log SMS delivery
    const deliveryLogs = results.map((r) => ({
      notification_id,
      user_id: r.user_id,
      channel: 'sms',
      status: r.success ? 'sent' : 'failed',
      external_id: r.message_id,
      provider: r.provider,
      error_message: r.error,
      sent_at: new Date().toISOString()
    }))

    if (deliveryLogs.length > 0) {
      await supabase.from('notification_delivery_log').insert(deliveryLogs)
    }

    return NextResponse.json({
      success: successful > 0,
      message: `SMS sent: ${successful} successful, ${failed} failed`,
      sent_count: successful,
      failed_count: failed,
      results
    })

  } catch (error: unknown) {
    apiLogger.error('[SMS] Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
