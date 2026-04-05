'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  X,
  Check,
  CheckCheck,
  AlertTriangle,
  MessageSquare,
  UserPlus,
  ArrowUpCircle,
  Clock,
  AlertCircle,
  Ticket,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import Link from 'next/link'

interface RealtimeNotificationBellProps {
  className?: string
  showConnectionStatus?: boolean
}

export default function RealtimeNotificationBell({
  className = '',
  showConnectionStatus = true
}: RealtimeNotificationBellProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotification
  } = useRealtimeNotifications({
    enabled: true,
    onNotification: (notification) => {
      // Show browser notification if supported and permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id // Prevents duplicate notifications
        })
      }

      // Play notification sound
      try {
        const audio = new Audio('/sounds/notification.mp3')
        audio.volume = 0.3
        audio.play().catch(() => { /* Notification delivery is best-effort */ }) // Ignore autoplay errors
      } catch {}
    }
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const getNotificationIcon = (type: string) => {
    const iconClass = 'w-4 h-4'
    switch (type) {
      case 'ticket_created':
        return <Ticket className={`${iconClass} text-blue-400`} />
      case 'ticket_assigned':
        return <UserPlus className={`${iconClass} text-green-400`} />
      case 'ticket_escalated':
        return <ArrowUpCircle className={`${iconClass} text-orange-400`} />
      case 'ticket_updated':
        return <AlertCircle className={`${iconClass} text-cyan-400`} />
      case 'message_received':
        return <MessageSquare className={`${iconClass} text-purple-400`} />
      case 'sla_warning':
        return <Clock className={`${iconClass} text-amber-400`} />
      case 'sla_breach':
        return <AlertTriangle className={`${iconClass} text-red-400`} />
      default:
        return <Bell className={`${iconClass} text-gray-400`} />
    }
  }

  const getNotificationPriorityBorder = (data: Record<string, unknown> | undefined) => {
    const priority = data?.priority
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500'
      case 'high':
        return 'border-l-orange-500'
      case 'normal':
        return 'border-l-amber-500'
      default:
        return 'border-l-transparent'
    }
  }

  const handleNotificationClick = (notification: { id: string; data?: Record<string, unknown> }) => {
    markAsRead(notification.id)

    // Navigate to relevant page
    const actionUrl = notification.data?.action_url
    if (actionUrl) {
      router.push(actionUrl)
    } else if (notification.data?.ticket_id && notification.data?.ticket_source) {
      router.push(`/superadmin/support-tickets/${notification.data.ticket_source}/${notification.data.ticket_id}`)
    }

    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Connection Status Indicator */}
        {showConnectionStatus && (
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
              isConnected ? 'bg-green-500' : 'bg-gray-500'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="p-4 border-b border-white/10 bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Notifications</h3>
                {/* Connection Status */}
                <span
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    isConnected
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {isConnected ? (
                    <>
                      <Wifi className="w-3 h-3" /> Live
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3" /> Offline
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all
                  </button>
                )}
                <Link
                  href="/employees/notifications/preferences"
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[450px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No notifications yet</p>
                <p className="text-gray-500 text-sm mt-1">
                  You'll see ticket updates, assignments, and alerts here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.slice(0, 20).map((notification) => (
                  <div
                    key={notification.id}
                    className={`group p-4 hover:bg-white/5 cursor-pointer transition-colors border-l-4 ${
                      getNotificationPriorityBorder(notification.data)
                    } ${!notification.read ? 'bg-white/5' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-sm ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <span className="w-2 h-2 bg-orange-500 rounded-full" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!notification.read) {
                                  markAsRead(notification.id)
                                }
                                clearNotification(notification.id)
                              }}
                              className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Dismiss"
                            >
                              <X className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-gray-500 text-xs">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          {notification.data?.ticket_number && (
                            <span className="text-xs text-orange-400/70">
                              #{notification.data.ticket_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-white/10 bg-gray-800/50">
              <Link
                href="/employees/notifications"
                className="block w-full text-center text-sm text-orange-400 hover:text-orange-300 font-medium"
                onClick={() => setIsOpen(false)}
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
