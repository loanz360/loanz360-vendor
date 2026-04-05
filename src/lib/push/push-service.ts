// Web Push Notification Service
// Handles push notification subscriptions and sending
// This file should only be used on the server side

import 'server-only'
import webpush from 'web-push'

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@loanz360.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface PushSubscription {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  tag?: string
  data?: {
    url?: string
    notification_id?: string
    action?: string
    [key: string]: any
  }
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  requireInteraction?: boolean
  renotify?: boolean
  silent?: boolean
  vibrate?: number[]
}

export interface SendPushResult {
  success: boolean
  subscription_id?: string
  error?: string
  statusCode?: number
}

/**
 * Send push notification to a single subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return {
      success: false,
      error: 'VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY'
    }
  }

  try {
    const notificationPayload = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/badge-72x72.png',
        image: payload.image,
        tag: payload.tag || 'default',
        data: payload.data,
        actions: payload.actions,
        requireInteraction: payload.requireInteraction || false,
        renotify: payload.renotify || false,
        silent: payload.silent || false,
        vibrate: payload.vibrate || [200, 100, 200]
      }
    })

    const result = await webpush.sendNotification(subscription, notificationPayload, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: 'normal'
    })

    return {
      success: true,
      statusCode: result.statusCode
    }
  } catch (error: unknown) {
    console.error('Push notification error:', error)

    // Handle subscription expiration
    if (error.statusCode === 410 || error.statusCode === 404) {
      return {
        success: false,
        error: 'Subscription expired or invalid',
        statusCode: error.statusCode
      }
    }

    return {
      success: false,
      error: error.message,
      statusCode: error.statusCode
    }
  }
}

/**
 * Send push notifications to multiple subscriptions
 */
export async function sendBulkPushNotifications(
  subscriptions: Array<{ id: string; subscription: PushSubscription }>,
  payload: PushNotificationPayload
): Promise<{
  successful: number
  failed: number
  expired: string[]
  results: SendPushResult[]
}> {
  const results: SendPushResult[] = []
  const expired: string[] = []

  for (const { id, subscription } of subscriptions) {
    const result = await sendPushNotification(subscription, payload)
    results.push({ ...result, subscription_id: id })

    if (result.statusCode === 410 || result.statusCode === 404) {
      expired.push(id)
    }
  }

  return {
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    expired,
    results
  }
}

/**
 * Validate a push subscription
 */
export function validateSubscription(subscription: any): subscription is PushSubscription {
  return (
    subscription &&
    typeof subscription.endpoint === 'string' &&
    subscription.keys &&
    typeof subscription.keys.p256dh === 'string' &&
    typeof subscription.keys.auth === 'string'
  )
}

/**
 * Generate VAPID keys (run once to generate keys for .env)
 */
export function generateVAPIDKeys(): { publicKey: string; privateKey: string } {
  const keys = webpush.generateVAPIDKeys()
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey
  }
}

/**
 * Get public VAPID key for client-side subscription
 */
export function getPublicVAPIDKey(): string | undefined {
  return vapidPublicKey
}
