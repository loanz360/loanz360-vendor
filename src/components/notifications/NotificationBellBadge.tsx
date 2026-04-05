'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription'
import { toast } from 'sonner'
interface Notification {
  id: string
  title: string
  message: string
  notification_type: string
  priority: string
  is_read: boolean
  created_at: string
  thumbnail_url?: string
}

interface NotificationBellBadgeProps {
  onClick?: () => void
  userId?: string // Optional userId prop for Super Admin portal
}

export default function NotificationBellBadge({ onClick, userId }: NotificationBellBadgeProps) {
  // userId is passed directly from the parent component (for Super Admin)
  // or fetched from AuthProvider (for regular portals)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Real-time subscription
  const { isSubscribed } = useNotificationSubscription({
    userId: userId,
    enabled: !!userId,
    onNewNotification: (notification) => {
      console.log('[Bell] New notification received:', notification)

      // Add to notifications list
      setNotifications((prev) => [notification, ...prev.slice(0, 4)])

      // Increment unread count
      setUnreadCount((prev) => prev + 1)

      // Show toast notification
      toast.success(`New notification: ${notification.title}`, {
        duration: 4000,
        icon: '🔔'
      })

      // Play notification sound (optional)
      try {
        const audio = new Audio('/notification.mp3')
        audio.volume = 0.5
        audio.play().catch(err => console.log('Audio play failed:', err))
      } catch (err) {
        console.log('Audio not available:', err)
      }
    },
    onNotificationUpdate: (notification) => {
      console.log('[Bell] Notification updated:', notification)

      // Update in list if exists
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? notification : n))
      )

      // Recalculate unread count
      fetchUnreadCount()
    }
  })

  useEffect(() => {
    if (userId) {
      fetchUnreadCount()
    }
  }, [userId])

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications?limit=5&is_read=false')
      const data = await response.json()

      if (data.success) {
        const notifications = data.data || []
        setUnreadCount(data.pagination?.total || notifications.length)
        setNotifications(notifications)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  const fetchRecentNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications?limit=5')
      const data = await response.json()

      if (data.success) {
        setNotifications(data.data || [])
        // Fetch unread count separately
        const countRes = await fetch('/api/notifications?limit=1&is_read=false')
        const countData = await countRes.json()
        setUnreadCount(countData.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBellClick = () => {
    if (onClick) {
      onClick()
    } else {
      setShowDropdown(!showDropdown)
      if (!showDropdown && notifications.length === 0) {
        fetchRecentNotifications()
      }
    }
  }

  const handleMarkAsRead = async (id: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      })

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleMarkAllAsRead = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      // Mark all unread notifications as read
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)

      await Promise.all(
        unreadIds.map(id =>
          fetch(`/api/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true })
          })
        )
      )

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500'
      case 'high':
        return 'border-orange-500'
      default:
        return 'border-white/10'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={handleBellClick}
        className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-400 hover:text-white transition-colors" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-black/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h3 className="font-semibold font-poppins">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="Mark all as read"
                >
                  <Check className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          )}

          {/* Notifications List */}
          {!loading && notifications.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No notifications</p>
            </div>
          )}

          {!loading && notifications.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={`/notifications/${notification.id}`}
                  className={`block p-4 border-b border-white/10 hover:bg-white/5 transition-colors ${
                    !notification.is_read ? 'bg-orange-500/5' : ''
                  } ${getPriorityColor(notification.priority)}`}
                  onClick={() => setShowDropdown(false)}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail or Status Dot */}
                    <div className="flex-shrink-0 pt-1">
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm mb-1 line-clamp-1">
                        {notification.title}
                      </p>
                      <p className="text-gray-400 text-xs line-clamp-2 mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-gray-500 text-xs">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true
                          })}
                        </p>
                        {!notification.is_read && (
                          <button
                            onClick={(e) => handleMarkAsRead(notification.id, e)}
                            className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Footer */}
          {!loading && notifications.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <Link
                href="/notifications"
                className="block w-full text-center text-orange-400 hover:text-orange-300 text-sm font-medium py-2 hover:bg-white/5 rounded transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
