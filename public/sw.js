/**
 * LOANZ 360 Enterprise Service Worker
 * Provides offline support, intelligent caching, background sync, and push notifications
 * @version 3.0.0
 */

// Bump on caching-policy change so installed clients evict the old cache.
const APP_VERSION = '3.1.0';
const CACHE_PREFIX = 'loanz360';
const CACHE_STATIC = `${CACHE_PREFIX}-static-v${APP_VERSION}`;
const CACHE_DYNAMIC = `${CACHE_PREFIX}-dynamic-v${APP_VERSION}`;
const CACHE_API = `${CACHE_PREFIX}-api-v${APP_VERSION}`;
const CACHE_IMAGES = `${CACHE_PREFIX}-images-v${APP_VERSION}`;

// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 100;
const MAX_API_CACHE_SIZE = 50;
const MAX_IMAGE_CACHE_SIZE = 50;

// Cache expiration times (in milliseconds)
const API_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const DYNAMIC_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Public-only pre-cache. Authenticated landings removed so the edge
// middleware redirect runs on first anonymous visit.
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// API endpoints to cache (with their caching strategies)
const API_CACHE_CONFIG = {
  // High-priority APIs - cache aggressively
  highPriority: [
    /\/api\/unified-tickets/,
    /\/api\/tickets/,
    /\/api\/support-tickets/,
    /\/api\/knowledge-base/,
    /\/api\/sla/,
    /\/api\/ai-crm\/cro\/contacts/,
    /\/api\/ai-crm\/cro\/leads/,
    /\/api\/ai-crm\/cro\/positive-contacts/,
    /\/api\/ai-crm\/cro\/deals/,
    /\/api\/ai-crm\/cro\/pool-stats/,
  ],
  // Medium-priority - cache with shorter expiry
  mediumPriority: [
    /\/api\/analytics/,
    /\/api\/automation/,
    /\/api\/channels/,
    /\/api\/ai-crm\/cro\/analytics/,
    /\/api\/ai-crm\/cro\/predictions/,
    /\/api\/ai-crm\/cro\/follow-ups/,
    /\/api\/ai-crm\/cro\/loan-schema/,
    /\/api\/ai-crm\/cro\/notifications/,
    /\/api\/ai-crm\/cro\/calendar-sync/,
  ],
  // Low-priority - network first, cache fallback only
  lowPriority: [
    /\/api\/ai/,
    /\/api\/security/,
    /\/api\/ai-crm\/cro\/cam-status/,
    /\/api\/ai-crm\/cro\/document-process/,
  ],
  // Never cache
  neverCache: [
    /\/api\/auth/,
    /\/api\/login/,
    /\/api\/logout/,
    /\/api\/session/,
    /\/api\/ai-crm\/cro\/initiate-call/,
    /\/api\/ai-crm\/cro\/call-number/,
    /\/api\/public\/upload/,
  ]
};

// IndexedDB for offline queue
const DB_NAME = 'loanz360-offline';
const DB_VERSION = 1;
const STORE_PENDING = 'pending-requests';
const STORE_SYNC = 'sync-data';

/**
 * Initialize IndexedDB
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORE_SYNC)) {
        const store = db.createObjectStore(STORE_SYNC, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Save request to IndexedDB for later sync
 */
async function saveForSync(request, body) {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);

    await store.add({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      timestamp: Date.now()
    });

    // Register for background sync
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-pending');
    }
  } catch (error) {
    console.error('[SW] Failed to save for sync:', error);
  }
}

/**
 * Install event - pre-cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing LOANZ 360 Service Worker v' + APP_VERSION);

  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Pre-cache failed:', error);
      })
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith(CACHE_PREFIX) &&
                     !cacheName.includes(`v${APP_VERSION}`);
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event - intelligent caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip WebSocket connections
  if (request.url.includes('ws://') || request.url.includes('wss://')) {
    return;
  }

  // Handle different request types
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request, url));
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

/**
 * Check if request is for API
 */
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

/**
 * Check if request is for image
 */
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/i.test(url.pathname);
}

/**
 * Check if request is for static asset
 */
function isStaticAsset(url) {
  return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
         STATIC_ASSETS.includes(url.pathname);
}

/**
 * Determine API caching priority
 */
function getAPIPriority(url) {
  // Check if should never cache
  if (API_CACHE_CONFIG.neverCache.some(pattern => pattern.test(url.pathname))) {
    return 'never';
  }

  if (API_CACHE_CONFIG.highPriority.some(pattern => pattern.test(url.pathname))) {
    return 'high';
  }

  if (API_CACHE_CONFIG.mediumPriority.some(pattern => pattern.test(url.pathname))) {
    return 'medium';
  }

  if (API_CACHE_CONFIG.lowPriority.some(pattern => pattern.test(url.pathname))) {
    return 'low';
  }

  return 'default';
}

/**
 * Handle API requests with intelligent caching
 */
async function handleAPIRequest(request, url) {
  const priority = getAPIPriority(url);

  // Never cache auth-related endpoints
  if (priority === 'never') {
    return fetch(request);
  }

  // For mutations (POST, PUT, DELETE), try network first
  if (request.method !== 'GET') {
    return handleMutationRequest(request);
  }

  // For GET requests, use stale-while-revalidate strategy
  try {
    const cache = await caches.open(CACHE_API);
    const cachedResponse = await cache.match(request);

    // Check cache expiry
    if (cachedResponse) {
      const cachedTime = cachedResponse.headers.get('sw-cached-time');
      const isExpired = cachedTime &&
        (Date.now() - parseInt(cachedTime)) > API_CACHE_EXPIRY;

      if (!isExpired) {
        // Return cached response and revalidate in background
        revalidateInBackground(request, cache);
        return cachedResponse;
      }
    }

    // Fetch from network
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone and cache with timestamp
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-time', Date.now().toString());

      const body = await responseToCache.blob();
      const cachedRes = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });

      cache.put(request, cachedRes);
      trimCache(CACHE_API, MAX_API_CACHE_SIZE);
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, checking cache:', error);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return error response
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'You are currently offline. Please check your connection.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle mutation requests (POST, PUT, DELETE)
 */
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Save for background sync
    const body = await request.clone().text();
    await saveForSync(request, body);

    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'Your request has been saved and will be synced when online.',
      queued: true
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Revalidate cache in background
 */
async function revalidateInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-time', Date.now().toString());

      const body = await networkResponse.blob();
      const cachedRes = new Response(body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });

      cache.put(request, cachedRes);
    }
  } catch (error) {
    // Silently fail - we have cached data
  }
}

/**
 * Handle image requests - cache first
 */
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(CACHE_IMAGES);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      trimCache(CACHE_IMAGES, MAX_IMAGE_CACHE_SIZE);
    }

    return networkResponse;
  } catch (error) {
    // Return placeholder image
    return new Response('', { status: 404 });
  }
}

/**
 * Handle static asset requests - cache first
 */
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return new Response('Asset unavailable', { status: 404 });
  }
}

/**
 * Handle dynamic requests — network only for navigations.
 *
 * Top-level document loads bypass cache so the edge auth middleware
 * runs on every page load and can redirect to /auth/login.
 */
async function handleDynamicRequest(request) {
  if (request.mode === 'navigate') {
    try {
      return await fetch(request);
    } catch (_error) {
      return caches.match('/offline.html');
    }
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, networkResponse.clone());
      trimCache(CACHE_DYNAMIC, MAX_DYNAMIC_CACHE_SIZE);
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Trim cache to maximum size (LRU)
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

/**
 * Background sync event
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingRequests());
  }

  if (event.tag === 'sync-tickets') {
    event.waitUntil(syncTickets());
  }
});

/**
 * Sync pending requests from IndexedDB
 */
async function syncPendingRequests() {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    const requests = await store.getAll();

    for (const pendingRequest of requests) {
      try {
        const response = await fetch(pendingRequest.url, {
          method: pendingRequest.method,
          headers: pendingRequest.headers,
          body: pendingRequest.body
        });

        if (response.ok) {
          await store.delete(pendingRequest.id);

          // Notify clients of successful sync
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_SUCCESS',
              url: pendingRequest.url
            });
          });
        }
      } catch (error) {
        console.error('[SW] Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync pending failed:', error);
  }
}

/**
 * Sync tickets specifically
 */
async function syncTickets() {
  try {
    // Fetch latest tickets and update cache
    const response = await fetch('/api/unified-tickets?limit=50');

    if (response.ok) {
      const cache = await caches.open(CACHE_API);
      const headers = new Headers(response.headers);
      headers.set('sw-cached-time', Date.now().toString());

      const body = await response.blob();
      const cachedRes = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });

      const request = new Request('/api/unified-tickets?limit=50');
      cache.put(request, cachedRes);
    }
  } catch (error) {
    console.error('[SW] Ticket sync failed:', error);
  }
}

/**
 * Push notification event
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'LOANZ 360',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View', icon: '/icons/action-view.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' }
    ],
    vibrate: [100, 50, 100],
    renotify: true,
    requireInteraction: data.priority === 'high'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  const urlToOpen = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if possible
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data?.type);

  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(event.data.urls));
      break;

    case 'GET_CACHE_STATUS':
      event.waitUntil(getCacheStatus().then(status => {
        event.source.postMessage({ type: 'CACHE_STATUS', status });
      }));
      break;

    case 'SYNC_NOW':
      event.waitUntil(syncPendingRequests());
      break;
  }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith(CACHE_PREFIX))
      .map(name => caches.delete(name))
  );
  console.log('[SW] All caches cleared');
}

/**
 * Cache specific URLs
 */
async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_DYNAMIC);
  await cache.addAll(urls);
  console.log('[SW] URLs cached:', urls.length);
}

/**
 * Get cache status
 */
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};

  for (const name of cacheNames) {
    if (name.startsWith(CACHE_PREFIX)) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      status[name] = keys.length;
    }
  }

  return status;
}

console.log('[SW] LOANZ 360 Service Worker v' + APP_VERSION + ' loaded');
