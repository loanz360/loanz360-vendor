import { parseBody } from '@/lib/utils/parse-body'

// Push Notification Send API
// POST: Send push notifications to users

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendPushNotification,
  sendBulkPushNotifications,
  validateSubscription,
  PushNotificationPayload
} from '@/lib/push/push-service'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      notification_id,
      user_ids,
      title,
      body: messageBody,
      icon,
      image,
      url,
      data,
      actions,
      requireInteraction
    } = body

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'title and body are required' },
        { status: 400 }
      )
    }

    // Build payload
    const payload: PushNotificationPayload = {
      title,
      body: messageBody,
      icon,
      image,
      data: {
        url: url || '/notifications',
        notification_id,
        ...data
      },
      actions,
      requireInteraction
    }

    // Get push subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('id, user_id, subscription, created_at')
      .eq('is_active', true)

    if (user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids)
    } else if (notification_id) {
      // Get users from notification recipients
      const { data: recipients } = await supabase
        .from('notification_recipients')
        .select('user_id')
        .eq('notification_id', notification_id)

      if (recipients && recipients.length > 0) {
        const recipientUserIds = recipients.map(r => r.user_id)
        query = query.in('user_id', recipientUserIds)
      }
    }

    const { data: subscriptions, error: subError } = await query

    if (subError) {
      apiLogger.error('Error fetching subscriptions', subError)
      return NextResponse.json({ success: false, error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No push subscriptions found for the specified users',
        sent_count: 0,
        failed_count: 0
      })
    }

    // Validate and prepare subscriptions
    const validSubscriptions = subscriptions
      .filter(sub => validateSubscription(sub.subscription))
      .map(sub => ({
        id: sub.id,
        user_id: sub.user_id,
        subscription: sub.subscription
      }))

    if (validSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid push subscriptions found',
        sent_count: 0,
        failed_count: 0
      })
    }

    // Send notifications
    const result = await sendBulkPushNotifications(
      validSubscriptions.map(s => ({ id: s.id, subscription: s.subscription })),
      payload
    )

    // Deactivate expired subscriptions
    if (result.expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .in('id', result.expired)
    }

    // Log delivery
    const deliveryLogs = validSubscriptions.map((sub, index) => ({
      notification_id,
      user_id: sub.user_id,
      channel: 'push',
      status: result.results[index]?.success ? 'sent' : 'failed',
      error_message: result.results[index]?.error,
      sent_at: new Date().toISOString()
    }))

    if (deliveryLogs.length > 0 && notification_id) {
      await supabase.from('notification_delivery_log').insert(deliveryLogs)
    }

    return NextResponse.json({
      success: result.successful > 0,
      message: `Push sent: ${result.successful} successful, ${result.failed} failed`,
      sent_count: result.successful,
      failed_count: result.failed,
      expired_count: result.expired.length
    })

  } catch (error: unknown) {
    apiLogger.error('Push send error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
