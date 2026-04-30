/**
 * Web Push Notifications System
 * Client-side push notification helpers
 * Note: Server-side push sending is handled in @/lib/push/push-service.ts
 */

// ===================================
// TYPE DEFINITIONS
// ===================================

export interface PushSubscriptionData {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: PushAction[];
  requireInteraction?: boolean;
  url?: string;
}

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

// ===================================
// NOTIFICATION TEMPLATES
// ===================================

export const PushNotificationTemplates = {
  incentiveLaunched: (incentiveTitle: string, rewardAmount: number): PushNotification => ({
    title: 'New Incentive Launched!',
    body: `${incentiveTitle} - Win up to Rs.${rewardAmount.toLocaleString()}`,
    tag: 'incentive-launch',
    icon: '/icon-192.png',
    data: { type: 'incentive-launch' },
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Later' },
    ],
    url: '/employees/incentives',
  }),

  achievementUnlocked: (achievementName: string, points: number): PushNotification => ({
    title: 'Achievement Unlocked!',
    body: `You've earned "${achievementName}" (+${points} points)`,
    tag: 'achievement',
    icon: '/icon-192.png',
    data: { type: 'achievement' },
    requireInteraction: true,
    url: '/employees/incentives?tab=achievements',
  }),

  progressMilestone: (progress: number, incentiveTitle: string): PushNotification => ({
    title: `${progress}% Complete!`,
    body: `Great progress on "${incentiveTitle}"`,
    tag: 'progress',
    icon: '/icon-192.png',
    data: { type: 'progress', progress },
    url: '/employees/incentives',
  }),

  claimApproved: (amount: number): PushNotification => ({
    title: 'Claim Approved!',
    body: `Your incentive claim of Rs.${amount.toLocaleString()} has been approved`,
    tag: 'claim-approved',
    icon: '/icon-192.png',
    data: { type: 'claim-approved', amount },
    requireInteraction: true,
    url: '/employees/incentives?tab=claims',
  }),

  tierPromotion: (newTier: string): PushNotification => ({
    title: 'Tier Promotion!',
    body: `Congratulations! You've been promoted to ${newTier} tier`,
    tag: 'tier-promotion',
    icon: '/icon-192.png',
    data: { type: 'tier-promotion', tier: newTier },
    requireInteraction: true,
    url: '/employees/incentives?tab=analytics',
  }),

  leaderboardRank: (rank: number): PushNotification => ({
    title: `You're Rank #${rank}!`,
    body: 'Keep up the great work to reach the top!',
    tag: 'leaderboard',
    icon: '/icon-192.png',
    data: { type: 'leaderboard', rank },
    url: '/employees/incentives?tab=analytics',
  }),
};

// ===================================
// CLIENT-SIDE HELPERS
// ===================================

/**
 * Request notification permission (client-side)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.error('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Get push subscription (client-side)
 */
export async function getPushSubscription(): Promise<PushSubscriptionData | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return null;
    }

    const json = subscription.toJSON();

    return {
      userId: '', // Will be set by caller
      endpoint: json.endpoint!,
      keys: {
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
      },
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
}

/**
 * Subscribe to push via API (client-side)
 */
export async function subscribeToPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('Push notifications not supported');
    return false;
  }

  try {
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      return false;
    }

    // Get VAPID public key from API
    const vapidResponse = await fetch('/api/notifications/push/subscribe');
    const vapidData = await vapidResponse.json();

    if (!vapidData.publicKey) {
      console.error('VAPID public key not available');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
    });

    const json = subscription.toJSON();

    // Send subscription to server
    const response = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: json,
        device_name: navigator.userAgent,
        device_type: 'web'
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}

/**
 * Unsubscribe from push (client-side)
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return true;
    }

    await subscription.unsubscribe();

    // Notify server
    await fetch(`/api/notifications/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
      method: 'DELETE'
    });

    return true;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default {
  PushNotificationTemplates,
  requestNotificationPermission,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
};
