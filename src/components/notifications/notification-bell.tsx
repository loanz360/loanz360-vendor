'use client'

/**
 * Notification Bell Component
 * Displays unread count and dropdown with recent notifications
 */

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InAppNotification } from '@/lib/notifications/notification-types'
import {
  formatTimeAgo,
  getNotificationIcon,
  getCategoryIcon,
  getNotificationTypeBg,
  getPriorityBorderColor,
  getPriorityBadgeStyles,
  getPriorityIcon,
  shouldFlashNotification,
} from '@/lib/notifications/notification-types'

interface NotificationBellProps {
  adminId: string
  soundEnabled?: boolean
}

export default function NotificationBell({ adminId, soundEnabled = true }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`/api/notifications/unread-count?adminId=${adminId}`)
      const data = await response.json()

      if (data.success) {
        const newCount = data.count || 0

        // Play sound if new notifications and sound enabled
        if (soundEnabled && newCount > prevCountRef.current) {
          playNotificationSound()
        }

        prevCountRef.current = newCount
        setUnreadCount(newCount)
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  // Fetch recent notifications
  const fetchNotifications = async () => {
    if (loading) return

    setLoading(true)
    try {
      const response = await fetch(`/api/notifications?adminId=${adminId}&limit=10&page=1`)
      const data = await response.json()

      if (data.success) {
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, adminId }),
      })

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, adminId }),
      })

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {
        // Ignore errors (browser may block autoplay)
      })
    } catch (error) {
      // Ignore sound errors
    }
  }

  // Real-time subscription for unread count with polling fallback
  useEffect(() => {
    if (!adminId) return

    const supabase = createClient()
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    let isSubscribed = false
    let pollingInterval: ReturnType<typeof setInterval> | null = null

    // Start polling fallback (runs when real-time is not connected)
    const startPolling = () => {
      if (pollingInterval) return
      pollingInterval = setInterval(() => {
        if (!isSubscribed) {
          fetchUnreadCount()
        }
      }, 30000) // Poll every 30 seconds when real-time is down
    }

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

    // Initial fetch
    fetchUnreadCount()

    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to notification_recipients changes for this user
        channel = supabase
          .channel(`bell:${adminId}:${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'notification_recipients',
              filter: `user_id=eq.${adminId}`
            },
            async (payload) => {
              if (!isSubscribed) return

              // Fetch updated count immediately
              await fetchUnreadCount()

              // If it's a new notification (INSERT) and unread, play sound
              if (payload.eventType === 'INSERT' && payload.new && !payload.new.is_read) {
                if (soundEnabled) {
                  playNotificationSound()
                }

                // Add bell shake animation
                const bellIcon = document.querySelector('.notification-bell-icon')
                if (bellIcon) {
                  bellIcon.classList.add('animate-bell-ring')
                  setTimeout(() => {
                    bellIcon.classList.remove('animate-bell-ring')
                  }, 1000)
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              isSubscribed = true
              stopPolling() // Real-time working, stop polling
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              isSubscribed = false
              startPolling() // Fallback to polling
            }
          })
      } catch (error) {
        console.error('[Bell Realtime] Subscription error:', error)
        startPolling() // Fallback to polling on error
      }
    }

    setupRealtimeSubscription()
    // Start polling as safety net until real-time connects
    startPolling()

    // Cleanup
    return () => {
      isSubscribed = false
      stopPolling()
      if (channel) {
        supabase.removeChannel(channel).catch(() => { /* Notification delivery is best-effort */ })
      }
    }
  }, [adminId, soundEnabled])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6 notification-bell-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead(notification.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <a
                href="/notifications"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface NotificationItemProps {
  notification: InAppNotification
  onRead: () => void
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.is_read) {
      onRead()
    }

    if (notification.action_url) {
      window.location.href = notification.action_url
    }
  }

  const priority = notification.priority || 'normal'
  const isUrgent = shouldFlashNotification(priority)

  return (
    <div
      onClick={handleClick}
      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
        !notification.is_read ? 'bg-blue-50' : ''
      } ${getPriorityBorderColor(priority)} ${isUrgent ? 'animate-urgent-flash' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon with Priority */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="text-2xl">
            {notification.icon || getCategoryIcon(notification.category)}
          </div>
          {priority !== 'normal' && (
            <span className="text-sm" title={`Priority: ${priority}`}>
              {getPriorityIcon(priority)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </h4>
              {priority !== 'normal' && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityBadgeStyles(priority)}`}>
                  {priority.toUpperCase()}
                </span>
              )}
            </div>
            {!notification.is_read && (
              <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
            )}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{notification.message}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{formatTimeAgo(notification.created_at)}</span>
            <span>•</span>
            <span className="capitalize">{notification.category}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
