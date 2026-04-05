'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  X,
  TrendingUp,
  TrendingDown,
  Plus,
  Clock,
  CheckCheck,
  ArrowRight,
  Building2,
  MapPin,
  FileText,
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  notification_type: 'rate_increase' | 'rate_decrease' | 'new_rate' | 'rate_expiring' | 'conditions_changed'
  bank_name: string
  location: string
  loan_type: string
  old_percentage: number | null
  new_percentage: number
  percentage_change: number | null
  effective_from: string
  effective_to: string | null
  title: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_read: boolean
  read_at: string | null
  is_dismissed: boolean
  created_at: string
}

interface RateChangeNotificationsProps {
  partnerType: 'BA' | 'BP' | 'CP'
}

export default function RateChangeNotifications({ partnerType }: RateChangeNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/notifications/payout-rates?include_read=${showAll}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch notifications')
      }

      setNotifications(data.data || [])
      setUnreadCount(data.unread_count || 0)
      setError(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [showAll])

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchNotifications()

    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/payout-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, action: 'read' })
      })

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/payout-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true, action: 'read' })
      })

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  // Dismiss notification
  const dismissNotification = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/payout-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, action: 'dismiss' })
      })

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId)
        return notification && !notification.is_read ? Math.max(0, prev - 1) : prev
      })
    } catch (err) {
      console.error('Error dismissing notification:', err)
    }
  }

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'rate_increase':
        return <TrendingUp className="w-5 h-5 text-green-400" />
      case 'rate_decrease':
        return <TrendingDown className="w-5 h-5 text-red-400" />
      case 'new_rate':
        return <Plus className="w-5 h-5 text-blue-400" />
      case 'rate_expiring':
        return <Clock className="w-5 h-5 text-yellow-400" />
      default:
        return <AlertCircle className="w-5 h-5 text-orange-400" />
    }
  }

  // Get background color based on priority
  const getPriorityStyles = (priority: string, isRead: boolean) => {
    if (isRead) {
      return 'bg-white/5'
    }

    switch (priority) {
      case 'urgent':
        return 'bg-red-900/30 border-red-500/30'
      case 'high':
        return 'bg-green-900/30 border-green-500/30'
      default:
        return 'bg-blue-900/30 border-blue-500/30'
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      const hours = Math.floor(diffHours)
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else if (diffHours < 48) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs
                       font-bold rounded-full min-w-[18px] h-[18px] flex items-center
                       justify-center px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-hidden
                       bg-gray-900 rounded-xl border border-white/10 shadow-xl z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-orange-900/20 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-orange-400" />
                  <h3 className="font-semibold text-white">Rate Change Alerts</h3>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center space-x-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <div className="mt-3 flex items-center space-x-2">
                <button
                  onClick={() => setShowAll(false)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    !showAll
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setShowAll(true)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    showAll
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-[380px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                  <span className="ml-2 text-gray-400 text-sm">Loading...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 text-sm">{error}</p>
                  <button
                    onClick={fetchNotifications}
                    className="mt-2 text-xs text-orange-400 hover:text-orange-300"
                  >
                    Try again
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No notifications</p>
                  <p className="text-gray-500 text-xs mt-1">
                    You&apos;ll be notified when commission rates change
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-4 relative group cursor-pointer transition-colors
                                  hover:bg-white/5 ${getPriorityStyles(notification.priority, notification.is_read)}`}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                    >
                      {/* Dismiss button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dismissNotification(notification.id)
                        }}
                        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100
                                   hover:bg-white/10 transition-opacity"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>

                      {/* Content */}
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.notification_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className={`text-sm font-medium ${notification.is_read ? 'text-gray-400' : 'text-white'}`}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                            )}
                          </div>

                          {/* Rate Details */}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 bg-white/10 rounded text-gray-300">
                              <Building2 className="w-3 h-3 mr-1" />
                              {notification.bank_name}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 bg-white/10 rounded text-gray-300">
                              <MapPin className="w-3 h-3 mr-1" />
                              {notification.location}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 bg-white/10 rounded text-gray-300">
                              <FileText className="w-3 h-3 mr-1" />
                              {notification.loan_type}
                            </span>
                          </div>

                          {/* Rate Change Info */}
                          {notification.old_percentage !== null && (
                            <div className="mt-2 flex items-center space-x-2 text-sm">
                              <span className="text-gray-400">{notification.old_percentage}%</span>
                              <ArrowRight className="w-3 h-3 text-gray-500" />
                              <span className={notification.notification_type === 'rate_increase' ? 'text-green-400' : 'text-red-400'}>
                                {notification.new_percentage}%
                              </span>
                              {notification.percentage_change !== null && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  notification.percentage_change > 0
                                    ? 'bg-green-900/50 text-green-400'
                                    : 'bg-red-900/50 text-red-400'
                                }`}>
                                  {notification.percentage_change > 0 ? '+' : ''}{notification.percentage_change}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Effective Date & Time */}
                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Effective: {new Date(notification.effective_from).toLocaleDateString('en-IN')}
                            </span>
                            <span>{formatDate(notification.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-white/5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-orange-400 hover:text-orange-300 hover:bg-white/5"
                  onClick={() => {
                    // Navigate to full notifications page
                    window.location.href = `/${partnerType.toLowerCase()}/notifications`
                  }}
                >
                  View all notifications
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
