'use client'

// ============================================================================
// PWA Service Worker Registration & Utilities
// ============================================================================

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onError?: (error: Error) => void
  onOffline?: () => void
  onOnline?: () => void
}

let registration: ServiceWorkerRegistration | null = null
let updateAvailable = false

/**
 * Register the service worker
 */
export async function registerServiceWorker(config: ServiceWorkerConfig = {}): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })


    // Check for updates
    registration.onupdatefound = () => {
      const installingWorker = registration!.installing

      if (installingWorker) {
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New update available
              updateAvailable = true
              config.onUpdate?.(registration!)
            } else {
              // Content cached for offline
              config.onSuccess?.(registration!)
            }
          }
        }
      }
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {

      if (event.data.type === 'SYNC_SUCCESS') {
        // Dispatch custom event for components to listen to
        window.dispatchEvent(new CustomEvent('sw-sync-success', {
          detail: event.data
        }))
      }

      if (event.data.type === 'CACHE_STATUS') {
        window.dispatchEvent(new CustomEvent('sw-cache-status', {
          detail: event.data.status
        }))
      }
    })

    // Network status listeners
    window.addEventListener('online', () => {
      config.onOnline?.()
      triggerSync()
    })

    window.addEventListener('offline', () => {
      config.onOffline?.()
    })

    return registration
  } catch (error) {
    console.error('[PWA] Registration failed:', error)
    config.onError?.(error as Error)
    return null
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!registration) return false

  try {
    const result = await registration.unregister()
    return result
  } catch (error) {
    console.error('[PWA] Unregistration failed:', error)
    return false
  }
}

/**
 * Check if an update is available
 */
export function isUpdateAvailable(): boolean {
  return updateAvailable
}

/**
 * Apply pending update (reload with new SW)
 */
export function applyUpdate(): void {
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }
}

/**
 * Clear all caches
 */
export async function clearCaches(): Promise<void> {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
  }

  // Also clear using Cache API directly
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(name => caches.delete(name)))
}

/**
 * Get cache status
 */
export function getCacheStatus(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'GET_CACHE_STATUS' })
  }
}

/**
 * Trigger background sync
 */
export async function triggerSync(): Promise<void> {
  if (registration?.sync) {
    try {
      await (registration.sync as any).register('sync-pending')
    } catch (error) {
      console.error('[PWA] Background sync failed:', error)
    }
  }

  // Also send message to SW
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SYNC_NOW' })
  }
}

/**
 * Pre-cache specific URLs
 */
export function precacheUrls(urls: string[]): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      urls
    })
  }
}

// ============================================================================
// Push Notifications
// ============================================================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'PushManager' in window && 'Notification' in window
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }

  return await Notification.requestPermission()
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!registration || !VAPID_PUBLIC_KEY) {
    console.error('[PWA] No registration or VAPID key')
    return null
  }

  try {
    const permission = await requestNotificationPermission()

    if (permission !== 'granted') {
      return null
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    return subscription
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error)
    return null
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!registration) return false

  try {
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      return true
    }

    return false
  } catch (error) {
    console.error('[PWA] Push unsubscription failed:', error)
    return false
  }
}

/**
 * Get current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!registration) return null

  try {
    return await registration.pushManager.getSubscription()
  } catch (error) {
    return null
  }
}

/**
 * Show a local notification
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!registration) return

  await registration.showNotification(title, {
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    ...options
  })
}

// ============================================================================
// Install Prompt
// ============================================================================

let deferredPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Initialize install prompt listener
 */
export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent

    window.dispatchEvent(new CustomEvent('pwa-install-available'))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null

    window.dispatchEvent(new CustomEvent('pwa-installed'))
  })
}

/**
 * Check if install is available
 */
export function isInstallAvailable(): boolean {
  return deferredPrompt !== null
}

/**
 * Prompt user to install
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!deferredPrompt) return null

  try {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null

    return outcome
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error)
    return null
  }
}

/**
 * Check if app is installed (standalone mode)
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false

  // Check display-mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  // iOS Safari standalone check
  if ((navigator as any).standalone === true) {
    return true
  }

  return false
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * Get storage usage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    }
  } catch (error) {
    return null
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    return false
  }

  try {
    return await navigator.storage.persist()
  } catch (error) {
    return false
  }
}

/**
 * Check if storage is persistent
 */
export async function isStoragePersistent(): Promise<boolean> {
  if (!('storage' in navigator) || !('persisted' in navigator.storage)) {
    return false
  }

  try {
    return await navigator.storage.persisted()
  } catch (error) {
    return false
  }
}
