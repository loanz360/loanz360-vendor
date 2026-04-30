/**
 * Notification Service
 * Core service for sending notifications via multiple channels
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'
import type { QueueNotificationParams, CreateInAppNotificationParams } from './notification-types'

// ============================================================================
// NOTIFICATION QUEUE
// ============================================================================

/**
 * Queue a notification using a template
 */
export async function queueNotification(params: QueueNotificationParams): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('queue_notification', {
    p_template_name: params.templateName,
    p_recipient_id: params.recipientId,
    p_variables: params.variables || {},
    p_scheduled_for: params.scheduledFor?.toISOString() || new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to queue notification:', error)
    return null
  }

  return data
}

/**
 * Create in-app notification directly
 */
export async function createInAppNotification(
  params: CreateInAppNotificationParams
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  const { error } = await supabase.from('in_app_notifications').insert({
    admin_id: params.adminId,
    type: params.type,
    category: params.category,
    title: params.title,
    message: params.message,
    action_url: params.actionUrl,
    action_label: params.actionLabel,
    icon: params.icon,
    color: params.color,
    metadata: params.metadata,
    expires_at: params.expiresAt?.toISOString(),
  })

  if (error) {
    console.error('Failed to create in-app notification:', error)
    return false
  }

  return true
}

// ============================================================================
// TEMPLATE RENDERING
// ============================================================================

/**
 * Render template with variables
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  let rendered = template

  // Replace {{variable}} with actual values
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, String(value))
  })

  return rendered
}

// ============================================================================
// NOTIFICATION DELIVERY
// ============================================================================

/**
 * Process notification queue (to be called by cron job or API)
 */
export async function processNotificationQueue(limit: number = 100): Promise<number> {
  const supabase = createSupabaseAdmin()

  // Get pending notifications
  const { data: notifications, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !notifications) {
    console.error('Failed to fetch notification queue:', error)
    return 0
  }

  let processedCount = 0

  for (const notification of notifications) {
    try {
      // Mark as processing
      await supabase
        .from('notification_queue')
        .update({ status: 'processing' })
        .eq('id', notification.id)

      // Send via each channel
      await sendNotificationChannels(notification)

      // Mark as sent
      await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notification.id)

      processedCount++
    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error)

      // Handle retry logic
      const newRetryCount = notification.retry_count + 1

      if (newRetryCount >= notification.max_retries) {
        // Max retries reached, mark as failed
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id)
      } else {
        // Schedule retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, newRetryCount), 3600000) // Max 1 hour
        const scheduledFor = new Date(Date.now() + retryDelay)

        await supabase
          .from('notification_queue')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            last_retry_at: new Date().toISOString(),
            scheduled_for: scheduledFor.toISOString(),
          })
          .eq('id', notification.id)
      }
    }
  }

  return processedCount
}

/**
 * Send notification via configured channels
 */
async function sendNotificationChannels(notification: unknown): Promise<void> {
  const channels = notification.channels || []

  // Send email
  if (channels.includes('email') && notification.recipient_email) {
    try {
      await sendEmail({
        to: notification.recipient_email,
        subject: notification.subject,
        html: notification.body,
      })

      await updateChannelStatus(notification.id, 'email', 'sent')
    } catch (error) {
      await updateChannelStatus(notification.id, 'email', 'failed', String(error))
    }
  }

  // Send SMS
  if (channels.includes('sms') && notification.recipient_phone && notification.sms_text) {
    try {
      await sendSMS(notification.recipient_phone, notification.sms_text)

      await updateChannelStatus(notification.id, 'sms', 'sent')
    } catch (error) {
      await updateChannelStatus(notification.id, 'sms', 'failed', String(error))
    }
  }

  // Create in-app notification
  if (channels.includes('in_app')) {
    try {
      await createInAppNotification({
        adminId: notification.recipient_id,
        type: 'info',
        category: 'system',
        title: notification.subject,
        message: notification.body,
        metadata: notification.template_variables,
      })

      await updateChannelStatus(notification.id, 'in_app', 'sent')
    } catch (error) {
      await updateChannelStatus(notification.id, 'in_app', 'failed', String(error))
    }
  }
}

/**
 * Update channel-specific status
 */
async function updateChannelStatus(
  notificationId: string,
  channel: 'email' | 'sms' | 'in_app',
  status: string,
  errorMessage?: string
): Promise<void> {
  const supabase = createSupabaseAdmin()

  const updateData: Record<string, unknown> = {
    [`${channel}_status`]: status,
  }

  if (status === 'sent') {
    updateData[`${channel}_sent_at`] = new Date().toISOString()
  }

  if (errorMessage) {
    updateData[`${channel}_error`] = errorMessage
  }

  await supabase.from('notification_queue').update(updateData).eq('id', notificationId)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send test notification
 */
export async function sendTestNotification(
  adminId: string,
  channel: 'email' | 'sms' | 'in_app'
): Promise<boolean> {
  const supabase = createSupabaseAdmin()

  // Get admin details
  const { data: admin } = await supabase.from('admins').select('*').eq('id', adminId).maybeSingle()

  if (!admin) {
    return false
  }

  try {
    if (channel === 'email' && admin.email) {
      await sendEmail({
        to: admin.email,
        subject: 'Test Notification',
        html: '<p>This is a test notification from LOANZ 360. If you received this, email notifications are working correctly!</p>',
      })
    } else if (channel === 'sms' && admin.phone) {
      await sendSMS(admin.phone, 'Test notification from LOANZ 360. SMS is working!')
    } else if (channel === 'in_app') {
      await createInAppNotification({
        adminId: admin.id,
        type: 'success',
        category: 'system',
        title: 'Test Notification',
        message: 'This is a test notification. In-app notifications are working correctly!',
        icon: '🔔',
      })
    }

    return true
  } catch (error) {
    console.error('Failed to send test notification:', error)
    return false
  }
}
