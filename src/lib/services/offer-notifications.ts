/**
 * Offer Notifications Service
 *
 * Handles sending notifications for offer-related events such as:
 * - Approval/rejection of offers
 * - New offer creation
 * - Offer expiration warnings
 * - Share notifications
 *
 * This service abstracts the notification delivery mechanism,
 * allowing for easy integration with various notification channels:
 * - In-app notifications (stored in database)
 * - Email notifications (via email service)
 * - Push notifications (via web push or FCM)
 * - SMS notifications (via SMS gateway)
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export type NotificationType =
  | 'offer_approved'
  | 'offer_rejected'
  | 'offer_created'
  | 'offer_expiring'
  | 'offer_expired'
  | 'offer_shared'
  | 'offer_viewed'

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms'

export interface NotificationPayload {
  type: NotificationType
  recipientId: string
  offerId?: string
  offerTitle?: string
  message: string
  metadata?: Record<string, unknown>
  channels?: NotificationChannel[]
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

interface NotificationResult {
  success: boolean
  notificationId?: string
  error?: string
  channelResults?: Record<NotificationChannel, boolean>
}

// Notification templates
const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; template: string }> = {
  offer_approved: {
    title: 'Offer Approved',
    template: 'Your offer "{offerTitle}" has been approved and is now live.',
  },
  offer_rejected: {
    title: 'Offer Rejected',
    template: 'Your offer "{offerTitle}" has been rejected. Reason: {reason}',
  },
  offer_created: {
    title: 'New Offer Created',
    template: 'A new offer "{offerTitle}" has been created and is pending review.',
  },
  offer_expiring: {
    title: 'Offer Expiring Soon',
    template: 'Your offer "{offerTitle}" will expire in {days} days.',
  },
  offer_expired: {
    title: 'Offer Expired',
    template: 'Your offer "{offerTitle}" has expired.',
  },
  offer_shared: {
    title: 'Offer Shared',
    template: '{sharedBy} shared an offer "{offerTitle}" with you.',
  },
  offer_viewed: {
    title: 'Offer Viewed',
    template: 'Your shared offer "{offerTitle}" was viewed by a customer.',
  },
}

/**
 * Send a notification through configured channels
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const notificationLogger = logger
  const channels = payload.channels || ['in_app']
  const channelResults: Record<NotificationChannel, boolean> = {
    in_app: false,
    email: false,
    push: false,
    sms: false,
  }

  try {
    // Always store in-app notification
    if (channels.includes('in_app')) {
      channelResults.in_app = await storeInAppNotification(payload)
    }

    // Send email notification if enabled
    if (channels.includes('email')) {
      channelResults.email = await sendEmailNotification(payload)
    }

    // Send push notification if enabled
    if (channels.includes('push')) {
      channelResults.push = await sendPushNotification(payload)
    }

    // Send SMS notification if enabled
    if (channels.includes('sms')) {
      channelResults.sms = await sendSmsNotification(payload)
    }

    // Check if at least one channel succeeded
    const anySuccess = Object.values(channelResults).some((v) => v)

    if (anySuccess) {
      notificationLogger.info('Notification sent successfully', {
        type: payload.type,
        recipientId: payload.recipientId,
        channels: channelResults,
      })
    } else {
      notificationLogger.warn('All notification channels failed', {
        type: payload.type,
        recipientId: payload.recipientId,
      })
    }

    return {
      success: anySuccess,
      channelResults,
    }
  } catch (error) {
    notificationLogger.error('Failed to send notification', error as Error, {
      type: payload.type,
      recipientId: payload.recipientId,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      channelResults,
    }
  }
}

/**
 * Store notification in database for in-app display
 */
async function storeInAppNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()
    const template = NOTIFICATION_TEMPLATES[payload.type]

    // Format message using template
    let message = payload.message || template.template
    if (payload.offerTitle) {
      message = message.replace('{offerTitle}', payload.offerTitle)
    }
    if (payload.metadata) {
      Object.entries(payload.metadata).forEach(([key, value]) => {
        message = message.replace(`{${key}}`, String(value))
      })
    }

    const { error } = await supabase.from('notifications').insert({
      user_id: payload.recipientId,
      type: payload.type,
      title: template.title,
      message,
      offer_id: payload.offerId,
      metadata: payload.metadata,
      priority: payload.priority || 'normal',
      is_read: false,
      created_at: new Date().toISOString(),
    })

    if (error) {
      logger.warn('Failed to store in-app notification', { error: error.message })
      return false
    }

    return true
  } catch (error) {
    logger.warn('Exception storing in-app notification', { error })
    return false
  }
}

/**
 * Send email notification
 * TODO: Integrate with email service (SendGrid, Resend, etc.)
 */
async function sendEmailNotification(payload: NotificationPayload): Promise<boolean> {
  // Placeholder for email integration
  // Example integration:
  // const emailService = await import('@/lib/services/email')
  // return emailService.sendEmail({
  //   to: recipientEmail,
  //   subject: NOTIFICATION_TEMPLATES[payload.type].title,
  //   body: payload.message,
  // })

  logger.debug('Email notification would be sent', {
    type: payload.type,
    recipientId: payload.recipientId,
  })

  // Return false until email service is integrated
  return false
}

/**
 * Send push notification
 * TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
 */
async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  // Placeholder for push notification integration
  // Example integration:
  // const pushService = await import('@/lib/services/push')
  // return pushService.sendPush({
  //   userId: payload.recipientId,
  //   title: NOTIFICATION_TEMPLATES[payload.type].title,
  //   body: payload.message,
  // })

  logger.debug('Push notification would be sent', {
    type: payload.type,
    recipientId: payload.recipientId,
  })

  // Return false until push service is integrated
  return false
}

/**
 * Send SMS notification
 * TODO: Integrate with SMS service (Twilio, MSG91, etc.)
 */
async function sendSmsNotification(payload: NotificationPayload): Promise<boolean> {
  // Placeholder for SMS integration
  // Example integration:
  // const smsService = await import('@/lib/services/sms')
  // return smsService.sendSms({
  //   userId: payload.recipientId,
  //   message: payload.message,
  // })

  logger.debug('SMS notification would be sent', {
    type: payload.type,
    recipientId: payload.recipientId,
  })

  // Return false until SMS service is integrated
  return false
}

// ===== Convenience functions for common notification scenarios =====

/**
 * Send approval notification
 */
export async function sendApprovalNotification(
  offerId: string,
  offerTitle: string,
  recipientId: string,
  approvedBy: string
): Promise<NotificationResult> {
  return sendNotification({
    type: 'offer_approved',
    recipientId,
    offerId,
    offerTitle,
    message: `Your offer "${offerTitle}" has been approved and is now live.`,
    metadata: { approvedBy },
    channels: ['in_app', 'email'],
    priority: 'normal',
  })
}

/**
 * Send rejection notification
 */
export async function sendRejectionNotification(
  offerId: string,
  offerTitle: string,
  recipientId: string,
  rejectedBy: string,
  reason: string
): Promise<NotificationResult> {
  return sendNotification({
    type: 'offer_rejected',
    recipientId,
    offerId,
    offerTitle,
    message: `Your offer "${offerTitle}" has been rejected. Reason: ${reason}`,
    metadata: { rejectedBy, reason },
    channels: ['in_app', 'email'],
    priority: 'high',
  })
}

/**
 * Send offer expiration warning
 */
export async function sendExpirationWarning(
  offerId: string,
  offerTitle: string,
  recipientId: string,
  daysRemaining: number
): Promise<NotificationResult> {
  return sendNotification({
    type: 'offer_expiring',
    recipientId,
    offerId,
    offerTitle,
    message: `Your offer "${offerTitle}" will expire in ${daysRemaining} days.`,
    metadata: { days: daysRemaining },
    channels: ['in_app'],
    priority: daysRemaining <= 1 ? 'high' : 'normal',
  })
}

/**
 * Send share notification
 */
export async function sendShareNotification(
  offerId: string,
  offerTitle: string,
  recipientId: string,
  sharedBy: string,
  sharedByName: string
): Promise<NotificationResult> {
  return sendNotification({
    type: 'offer_shared',
    recipientId,
    offerId,
    offerTitle,
    message: `${sharedByName} shared an offer "${offerTitle}" with you.`,
    metadata: { sharedBy, sharedByName },
    channels: ['in_app'],
    priority: 'low',
  })
}

export default {
  sendNotification,
  sendApprovalNotification,
  sendRejectionNotification,
  sendExpirationWarning,
  sendShareNotification,
}
