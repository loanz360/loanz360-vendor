'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface FollowupReminder {
  id: string
  scheduled_at: string
  purpose: string
  customer_name?: string
  lead_id?: string
}

const NOTIFICATION_LEAD_MINUTES = 15
const CHECK_INTERVAL_MS = 60_000 // Check every minute
const NOTIFIED_KEY = 'cro_notified_followups'

function getNotifiedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(NOTIFIED_KEY)
    if (!stored) return new Set()
    const parsed = JSON.parse(stored) as { ids: string[]; date: string }
    // Clear old notifications (from previous days)
    if (parsed.date !== new Date().toISOString().split('T')[0]) {
      localStorage.removeItem(NOTIFIED_KEY)
      return new Set()
    }
    return new Set(parsed.ids)
  } catch {
    return new Set()
  }
}

function markNotified(id: string): void {
  const existing = getNotifiedIds()
  existing.add(id)
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify({
    ids: Array.from(existing),
    date: new Date().toISOString().split('T')[0],
  }))
}

export function useFollowupNotifications(enabled: boolean = true) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') {
      setPermissionState('granted')
      return true
    }
    if (Notification.permission === 'denied') {
      setPermissionState('denied')
      return false
    }
    const result = await Notification.requestPermission()
    setPermissionState(result)
    return result === 'granted'
  }, [])

  const showNotification = useCallback((followup: FollowupReminder) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const scheduledTime = new Date(followup.scheduled_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    const notification = new Notification('Follow-up Reminder', {
      body: `${followup.purpose || 'Scheduled follow-up'} with ${followup.customer_name || 'customer'} at ${scheduledTime}`,
      icon: '/favicon.ico',
      tag: `followup-${followup.id}`,
      requireInteraction: true,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    // Auto-close after 30 seconds
    setTimeout(() => notification.close(), 30_000)
  }, [])

  const checkFollowups = useCallback(async () => {
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return

    try {
      const now = new Date()
      const checkUntil = new Date(now.getTime() + NOTIFICATION_LEAD_MINUTES * 60_000)
      const notifiedIds = getNotifiedIds()

      const res = await fetch(
        `/api/cro/followups-upcoming?until=${checkUntil.toISOString()}`
      )

      if (!res.ok) return

      const data = await res.json()
      if (!data.success || !data.data) return

      for (const followup of data.data as FollowupReminder[]) {
        if (notifiedIds.has(followup.id)) continue
        const scheduledTime = new Date(followup.scheduled_at).getTime()
        const minutesUntil = (scheduledTime - now.getTime()) / 60_000

        // Notify if within 15 minutes and not yet notified
        if (minutesUntil > 0 && minutesUntil <= NOTIFICATION_LEAD_MINUTES) {
          showNotification(followup)
          markNotified(followup.id)
        }
      }
    } catch {
      // Silent fail — notifications are non-critical
    }
  }, [showNotification])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    // Set initial permission state
    if ('Notification' in window) {
      setPermissionState(Notification.permission)
    }

    // Request permission on mount
    requestPermission().then((granted) => {
      if (granted) {
        // Initial check
        checkFollowups()
        // Set up interval
        intervalRef.current = setInterval(checkFollowups, CHECK_INTERVAL_MS)
      }
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, requestPermission, checkFollowups])

  return {
    permissionState,
    requestPermission,
  }
}
