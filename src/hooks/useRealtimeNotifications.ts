'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  created_at: string
  read?: boolean
}

interface UseRealtimeNotificationsOptions {
  enabled?: boolean
  onNotification?: (notification: Notification) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { enabled = true, onNotification, onConnect, onDisconnect } = options

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource('/api/realtime/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        onConnect?.()
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case 'connected':
              break

            case 'notification':
              const notification = data.notification as Notification
              setNotifications(prev => [notification, ...prev])
              setUnreadCount(prev => prev + 1)
              onNotification?.(notification)
              break

            case 'heartbeat':
              // Connection is alive
              break

            default:
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        setError('Connection lost')
        onDisconnect?.()
        eventSource.close()

        // Reconnect after 5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabled) {
            connect()
          }
        }, 5000)
      }
    } catch (err) {
      setError('Failed to connect')
      console.error('SSE connection error:', err)
    }
  }, [enabled, onConnect, onDisconnect, onNotification])

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/realtime/notifications')
      const data = await response.json()
      if (response.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }, [])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/realtime/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notification_id: notificationId })
      })
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/realtime/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      })
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }, [])

  // Clear a notification from the list
  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      fetchNotifications()
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect, fetchNotifications])

  return {
    notifications,
    unreadCount,
    isConnected,
    error,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    refetch: fetchNotifications
  }
}

export default useRealtimeNotifications
