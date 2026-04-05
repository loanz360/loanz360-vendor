'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import {
  registerServiceWorker,
  isUpdateAvailable,
  applyUpdate,
  isInstallAvailable,
  promptInstall,
  isAppInstalled,
  initInstallPrompt,
  getStorageEstimate,
  isPushSupported,
  subscribeToPush,
  getPushSubscription,
  showNotification,
  triggerSync
} from '@/lib/pwa'

interface PWAContextType {
  isOnline: boolean
  isInstalled: boolean
  canInstall: boolean
  hasUpdate: boolean
  isLoading: boolean
  storageUsage: { usage: number; quota: number } | null
  pushSubscription: PushSubscription | null
  pushSupported: boolean

  // Actions
  install: () => Promise<'accepted' | 'dismissed' | null>
  update: () => void
  subscribePush: () => Promise<boolean>
  sendNotification: (title: string, options?: NotificationOptions) => Promise<void>
  sync: () => Promise<void>
}

const PWAContext = createContext<PWAContextType | null>(null)

export function usePWA() {
  const context = useContext(PWAContext)
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider')
  }
  return context
}

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [hasUpdate, setHasUpdate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null)
  const [pushSupported, setPushSupported] = useState(false)

  // Initialize PWA
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)

      try {
        // Check initial states
        setIsOnline(navigator.onLine)
        setIsInstalled(isAppInstalled())
        setPushSupported(isPushSupported())

        // Initialize install prompt listener
        initInstallPrompt()

        // Register service worker
        await registerServiceWorker({
          onUpdate: () => setHasUpdate(true),
          onSuccess: () => console.log('[PWA] Ready for offline use'),
          onOnline: () => setIsOnline(true),
          onOffline: () => setIsOnline(false)
        })

        // Get storage estimate
        const estimate = await getStorageEstimate()
        setStorageUsage(estimate)

        // Check push subscription
        const subscription = await getPushSubscription()
        setPushSubscription(subscription)
      } catch (error) {
        console.error('[PWA] Initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()

    // Listen for install available event
    const handleInstallAvailable = () => setCanInstall(true)
    const handleInstalled = () => {
      setCanInstall(false)
      setIsInstalled(true)
    }

    window.addEventListener('pwa-install-available', handleInstallAvailable)
    window.addEventListener('pwa-installed', handleInstalled)
    window.addEventListener('online', () => setIsOnline(true))
    window.addEventListener('offline', () => setIsOnline(false))

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable)
      window.removeEventListener('pwa-installed', handleInstalled)
      window.removeEventListener('online', () => setIsOnline(true))
      window.removeEventListener('offline', () => setIsOnline(false))
    }
  }, [])

  // Update isUpdateAvailable periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setHasUpdate(isUpdateAvailable())
      setCanInstall(isInstallAvailable())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Actions
  const install = useCallback(async () => {
    const result = await promptInstall()
    if (result === 'accepted') {
      setCanInstall(false)
      setIsInstalled(true)
    }
    return result
  }, [])

  const update = useCallback(() => {
    applyUpdate()
  }, [])

  const subscribePush = useCallback(async () => {
    const subscription = await subscribeToPush()
    setPushSubscription(subscription)
    return subscription !== null
  }, [])

  const sendNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    await showNotification(title, options)
  }, [])

  const sync = useCallback(async () => {
    await triggerSync()
  }, [])

  const value: PWAContextType = {
    isOnline,
    isInstalled,
    canInstall,
    hasUpdate,
    isLoading,
    storageUsage,
    pushSubscription,
    pushSupported,
    install,
    update,
    subscribePush,
    sendNotification,
    sync
  }

  return (
    <PWAContext.Provider value={value}>
      {children}
    </PWAContext.Provider>
  )
}

// ============================================================================
// PWA UI Components
// ============================================================================

/**
 * Offline indicator banner
 */
export function OfflineBanner() {
  const { isOnline } = usePWA()

  if (isOnline) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-amber-500 text-white py-2 px-4 text-center z-50 animate-slide-up">
      <div className="flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 4.243a1 1 0 110-1.414" />
        </svg>
        <span className="font-medium">You are offline. Some features may be limited.</span>
      </div>
    </div>
  )
}

/**
 * Update available toast
 */
export function UpdateToast() {
  const { hasUpdate, update } = usePWA()
  const [dismissed, setDismissed] = useState(false)

  if (!hasUpdate || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-4 z-50 max-w-sm animate-slide-up">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div className="flex-1">
          <h4 className="font-semibold">Update Available</h4>
          <p className="text-sm text-blue-100 mt-1">A new version is ready. Refresh to update.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={update}
              className="bg-white text-blue-600 px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-blue-100 px-3 py-1.5 text-sm hover:text-white transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Install prompt
 */
export function InstallPrompt() {
  const { canInstall, install, isInstalled } = usePWA()
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  if (!canInstall || dismissed || isInstalled) return null

  const handleInstall = async () => {
    setInstalling(true)
    await install()
    setInstalling(false)
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-xl border p-4 z-50 max-w-sm animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          L
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">Install LOANZ 360</h4>
          <p className="text-sm text-gray-600 mt-1">
            Add to your home screen for quick access and offline support.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {installing ? 'Installing...' : 'Install'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-600 px-4 py-2 text-sm hover:text-gray-900 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Network status indicator (small badge)
 */
export function NetworkStatusBadge() {
  const { isOnline } = usePWA()

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}
      />
      <span className="text-xs text-gray-500">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

/**
 * Storage usage indicator
 */
export function StorageIndicator() {
  const { storageUsage } = usePWA()

  if (!storageUsage) return null

  const usagePercent = (storageUsage.usage / storageUsage.quota) * 100
  const usageMB = (storageUsage.usage / (1024 * 1024)).toFixed(1)
  const quotaMB = (storageUsage.quota / (1024 * 1024)).toFixed(0)

  return (
    <div className="text-xs text-gray-500">
      <div className="flex items-center justify-between mb-1">
        <span>Storage</span>
        <span>{usageMB} / {quotaMB} MB</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${usagePercent > 80 ? 'bg-amber-500' : 'bg-blue-600'}`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
    </div>
  )
}
