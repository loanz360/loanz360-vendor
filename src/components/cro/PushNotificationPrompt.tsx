'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'

/**
 * Auto-prompts CRO to enable push notifications on first visit.
 * Shows only once — stores "prompted" flag in localStorage.
 * If permission already granted, registers service worker silently.
 */
export default function PushNotificationPrompt() {
  const [show, setShow] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    // Only run in browser with Notification API support
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return
    }

    const currentPermission = Notification.permission
    setPermissionState(currentPermission)

    // Already granted — ensure service worker is registered silently
    if (currentPermission === 'granted') {
      registerServiceWorker()
      return
    }

    // Already denied — nothing we can do
    if (currentPermission === 'denied') {
      return
    }

    // Default — check if we already prompted
    const prompted = localStorage.getItem('cro_push_prompted')
    if (!prompted) {
      // Small delay so it doesn't flash immediately on page load
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')

      // Subscribe to push if not already subscribed
      const existingSub = await registration.pushManager.getSubscription()
      if (!existingSub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (vapidKey) {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          })

          // Save subscription to server
          await fetch('/api/notifications/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
          }).catch(() => { /* Notification delivery is best-effort */ })
        }
      }
    } catch (err) {
      console.warn('Service worker registration failed:', err)
    }
  }

  const handleEnable = async () => {
    localStorage.setItem('cro_push_prompted', 'true')

    try {
      const permission = await Notification.requestPermission()
      setPermissionState(permission)

      if (permission === 'granted') {
        await registerServiceWorker()
      }
    } catch {
      // Permission request failed
    }

    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('cro_push_prompted', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-gray-900 border border-orange-500/30 rounded-xl p-4 shadow-2xl shadow-orange-500/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">Enable Notifications</h3>
            <p className="text-gray-400 text-xs mt-1">
              Get instant reminders for follow-ups, new leads, and important updates. Never miss a call!
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Enable Now
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
