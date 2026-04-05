'use client'

import { useState, useEffect, useCallback } from 'react'

interface PendingUpdatesStats {
  total_in_progress: number
  needs_update: number
  critical: number
  high: number
  normal: number
}

interface UseDealUpdateReminderOptions {
  enabled?: boolean
  checkInterval?: number // in milliseconds
  autoShowModal?: boolean
  showNotification?: boolean
}

interface UseDealUpdateReminderReturn {
  showReminderModal: boolean
  setShowReminderModal: (show: boolean) => void
  pendingCount: number
  stats: PendingUpdatesStats | null
  loading: boolean
  checkForUpdates: () => Promise<void>
  hasCriticalUpdates: boolean
}

export function useDealUpdateReminder(
  options: UseDealUpdateReminderOptions = {}
): UseDealUpdateReminderReturn {
  const {
    enabled = true,
    checkInterval = 5 * 60 * 1000, // 5 minutes default
    autoShowModal = true,
    showNotification = true
  } = options

  const [showReminderModal, setShowReminderModal] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [stats, setStats] = useState<PendingUpdatesStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkForUpdates = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      const response = await fetch('/api/ai-crm/bde/deals/pending-updates?hours=3')
      const data = await response.json()

      if (data.success && data.data) {
        const newStats = data.data.stats
        const newCount = newStats?.needs_update || 0

        setStats(newStats)
        setPendingCount(newCount)
        setLastCheck(new Date())

        // Auto show modal if there are pending updates
        if (autoShowModal && newCount > 0) {
          // Only show if not already shown or if critical updates appeared
          if (!showReminderModal || (newStats.critical > 0 && stats?.critical === 0)) {
            setShowReminderModal(true)

            // Show browser notification if enabled
            if (showNotification && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                showBrowserNotification(newCount, newStats.critical)
              } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission()
                if (permission === 'granted') {
                  showBrowserNotification(newCount, newStats.critical)
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for pending updates:', error)
    } finally {
      setLoading(false)
    }
  }, [enabled, autoShowModal, showNotification, showReminderModal, stats?.critical])

  const showBrowserNotification = (count: number, criticalCount: number) => {
    const title = criticalCount > 0
      ? `${criticalCount} Critical Deal Update${criticalCount > 1 ? 's' : ''} Required!`
      : `${count} Deal Update${count > 1 ? 's' : ''} Required`

    const body = criticalCount > 0
      ? `You have ${criticalCount} critical deal${criticalCount > 1 ? 's' : ''} that need immediate attention.`
      : `Your deals need to be updated every 3 hours.`

    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'deal-update-reminder',
        requireInteraction: criticalCount > 0
      })
    } catch (e) {
      console.error('Error showing notification:', e)
    }
  }

  // Initial check on mount
  useEffect(() => {
    if (enabled) {
      checkForUpdates()
    }
  }, [enabled])

  // Periodic checks
  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(checkForUpdates, checkInterval)
    return () => clearInterval(interval)
  }, [enabled, checkInterval, checkForUpdates])

  // Check when tab becomes visible
  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only check if last check was more than 1 minute ago
        if (!lastCheck || Date.now() - lastCheck.getTime() > 60000) {
          checkForUpdates()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, lastCheck, checkForUpdates])

  return {
    showReminderModal,
    setShowReminderModal,
    pendingCount,
    stats,
    loading,
    checkForUpdates,
    hasCriticalUpdates: (stats?.critical || 0) > 0
  }
}

export default useDealUpdateReminder
