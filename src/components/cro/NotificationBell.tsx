'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Phone,
  Users,
  Clock,
  MessageSquare,
  TrendingUp,
  Info,
  CheckCheck,
  X,
} from 'lucide-react'
import { useCRONotifications, type CRONotification } from '@/hooks/useCRONotifications'

// ── Icon mapping per notification type ──────────────────────────────────────────

const TYPE_CONFIG: Record<
  CRONotification['type'],
  { icon: React.ElementType; color: string; bg: string }
> = {
  new_lead: {
    icon: TrendingUp,
    color: 'text-orange-400',
    bg: 'bg-orange-500/15',
  },
  new_contact: {
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
  },
  followup_due: {
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  chat_message: {
    icon: MessageSquare,
    color: 'text-green-400',
    bg: 'bg-green-500/15',
  },
  deal_update: {
    icon: Phone,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
  },
  system: {
    icon: Info,
    color: 'text-gray-400',
    bg: 'bg-gray-500/15',
  },
}

// ── Relative time helper ────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

// ── Single notification row ─────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
  onClick,
}: {
  notification: CRONotification
  onRead: (id: string) => void
  onClick: (n: CRONotification) => void
}) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system
  const Icon = config.icon

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 border-b border-white/5 last:border-b-0 ${
        notification.read ? 'bg-gray-900/40' : 'bg-white/[0.03]'
      }`}
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${config.bg}`}
      >
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-tight truncate ${
              notification.read ? 'text-gray-400 font-normal' : 'text-gray-100 font-medium'
            }`}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-orange-500" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <span className="text-[11px] text-gray-600 mt-1 inline-block">
          {relativeTime(notification.created_at)}
        </span>
      </div>
    </button>
  )
}

// ── Main NotificationBell component ─────────────────────────────────────────────

export default function NotificationBell() {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useCRONotifications()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKey)
    }
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  const handleNotificationClick = (n: CRONotification) => {
    if (!n.read) markAsRead(n.id)
    if (n.actionUrl) {
      router.push(n.actionUrl)
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-gray-300" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            {/* Pulse ring */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-40 animate-ping" />
            {/* Badge number */}
            <span className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-100">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[11px] font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-orange-400 hover:text-orange-300 hover:bg-white/5 rounded-lg transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">No notifications yet</p>
                  <p className="text-xs text-gray-600 mt-1">
                    You&apos;ll be notified about leads, follow-ups, and more.
                  </p>
                </div>
              ) : (
                notifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onClick={handleNotificationClick}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-white/10 px-4 py-2.5">
                <button
                  onClick={() => {
                    router.push('/employees/cro/notifications')
                    setIsOpen(false)
                  }}
                  className="w-full text-center text-xs text-orange-400 hover:text-orange-300 font-medium py-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
