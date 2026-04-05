// Push Notification Service Worker
// Handles push notification events and click actions

const CACHE_NAME = 'loanz360-push-v1';

// Handle push events
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    const notification = data.notification || data;

    const options = {
      body: notification.body || 'New notification',
      icon: notification.icon || '/icons/icon-192x192.png',
      badge: notification.badge || '/icons/badge-72x72.png',
      image: notification.image,
      tag: notification.tag || 'default',
      data: notification.data || {},
      actions: notification.actions || [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: notification.requireInteraction || false,
      renotify: notification.renotify || false,
      silent: notification.silent || false,
      vibrate: notification.vibrate || [200, 100, 200],
      timestamp: Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(notification.title || 'LOANZ360', options)
    );
  } catch (error) {
    console.error('Error processing push event:', error);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'dismiss') {
    // Track dismissal
    if (data.notification_id) {
      fetch('/api/notifications/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: data.notification_id,
          action: 'dismissed'
        })
      }).catch(() => {});
    }
    return;
  }

  // Default action or 'open' action
  const urlToOpen = data.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Track click
        if (data.notification_id) {
          fetch('/api/notifications/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notification_id: data.notification_id,
              action: 'clicked'
            })
          }).catch(() => {});
        }

        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data
            });
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};

  if (data.notification_id) {
    fetch('/api/notifications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notification_id: data.notification_id,
        action: 'closed'
      })
    }).catch(() => {});
  }
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(self.VAPID_PUBLIC_KEY)
    })
    .then((subscription) => {
      return fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });
    })
  );
});

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  if (!base64String) return new Uint8Array();

  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Install event
self.addEventListener('install', (event) => {
  console.log('Push Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Push Service Worker activated');
  event.waitUntil(clients.claim());
});
