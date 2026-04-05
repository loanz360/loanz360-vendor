'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Calendar, User, TrendingUp, TrendingDown, Plus, Building2, MapPin, FileText, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: string
  recipient_id: string
  title: string
  message: string
  notification_type: string
  priority: string
  sent_by_name: string
  action_url?: string
  action_label?: string
  is_read: boolean
  created_at: string
}

interface RateNotification {
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

interface NotificationDropdownProps {
  partnerType: 'ba' | 'bp' | 'cp'
}

export function NotificationDropdown({ partnerType }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [rateNotifications, setRateNotifications] = useState<RateNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [rateUnreadCount, setRateUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [selectedRateNotification, setSelectedRateNotification] = useState<RateNotification | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'rates'>('general')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Calculate total unread count
  const totalUnread = unreadCount + rateUnreadCount

  // Fetch unread notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications/inbox?filter=unread&limit=10')
      const data = await response.json()
      if (response.ok) {
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch rate change notifications
  const fetchRateNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/payout-rates')
      const data = await response.json()
      if (response.ok) {
        setRateNotifications(data.data || [])
        setRateUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('Error fetching rate notifications:', error)
    }
  }

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count')
      const data = await response.json()
      if (response.ok) {
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount()
    fetchRateNotifications()
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount()
      fetchRateNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
      fetchRateNotifications()
    }
  }, [isOpen])

  // Handle click outside to close dropdown
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

  // Mark notification as read and remove from list
  const markAsRead = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      })

      if (response.ok) {
        // Remove from local list
        setNotifications(prev => prev.filter(n => n.recipient_id !== recipientId))
        // Update count
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  // Handle notification click - show modal then mark as read
  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification)
  }

  // Handle rate notification click
  const handleRateNotificationClick = (notification: RateNotification) => {
    setSelectedRateNotification(notification)
    if (!notification.is_read) {
      markRateAsRead(notification.id)
    }
  }

  // Mark rate notification as read
  const markRateAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications/payout-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, action: 'read' })
      })
      setRateNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      setRateUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking rate notification as read:', error)
    }
  }

  // Dismiss rate notification
  const dismissRateNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/notifications/payout-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, action: 'dismiss' })
      })
      setRateNotifications(prev => prev.filter(n => n.id !== notificationId))
      const notification = rateNotifications.find(n => n.id === notificationId)
      if (notification && !notification.is_read) {
        setRateUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error dismissing rate notification:', error)
    }
  }

  // Close modal and mark as read
  const closeModal = () => {
    if (selectedNotification) {
      markAsRead(selectedNotification.recipient_id)
      setSelectedNotification(null)
    }
  }

  // Close rate notification modal
  const closeRateModal = () => {
    setSelectedRateNotification(null)
  }

  // Get icon for rate notification type
  const getRateNotificationIcon = (type: string) => {
    switch (type) {
      case 'rate_increase':
        return <TrendingUp className="w-5 h-5 text-green-400" />
      case 'rate_decrease':
        return <TrendingDown className="w-5 h-5 text-red-400" />
      case 'new_rate':
        return <Plus className="w-5 h-5 text-blue-400" />
      default:
        return <Bell className="w-5 h-5 text-orange-400" />
    }
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      announcement: '📢',
      alert: '⚠️',
      update: '🔄',
      reminder: '⏰',
      celebration: '🎉',
      system_update: '⚙️',
      offer: '🎁',
      custom: '📝'
    }
    return icons[type] || '📬'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500/20 text-red-400 border-red-500/50',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      normal: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      low: 'bg-green-500/20 text-green-400 border-green-500/50'
    }
    return colors[priority] || colors.normal
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bell Icon Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/30"
          title={totalUnread > 0 ? `${totalUnread} unread notification${totalUnread > 1 ? 's' : ''}` : 'Notifications'}
        >
          <Bell className="w-5 h-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 font-semibold animate-pulse">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-96 bg-gray-900/95 backdrop-blur-lg rounded-lg shadow-2xl border border-gray-700/50 overflow-hidden z-50"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold font-poppins">Notifications</h3>
                    {totalUnread > 0 && (
                      <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        {totalUnread}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-gray-800/50 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === 'general'
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>General</span>
                    {unreadCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        activeTab === 'general' ? 'bg-white/20' : 'bg-orange-500/50'
                      }`}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('rates')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === 'rates'
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Rate Changes</span>
                    {rateUnreadCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        activeTab === 'rates' ? 'bg-white/20' : 'bg-green-500/50'
                      }`}>
                        {rateUnreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {activeTab === 'general' ? (
                  // General Notifications Tab
                  loading ? (
                    <div className="p-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                      <p className="text-gray-400 text-sm mt-2">Loading...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No unread notifications</p>
                      <p className="text-gray-500 text-xs mt-1">You&apos;re all caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {notifications.map((notification) => (
                        <motion.div
                          key={notification.recipient_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          onClick={() => handleNotificationClick(notification)}
                          className="px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors group"
                        >
                          <div className="flex gap-3">
                            <span className="text-2xl flex-shrink-0">{getTypeIcon(notification.notification_type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-medium text-sm line-clamp-1 group-hover:text-orange-400 transition-colors font-poppins">
                                  {notification.title}
                                </h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap ${getPriorityColor(notification.priority)}`}>
                                  {notification.priority.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-gray-500 text-xs">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {notification.sent_by_name}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatTimeAgo(notification.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )
                ) : (
                  // Rate Change Notifications Tab
                  rateNotifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No rate change alerts</p>
                      <p className="text-gray-500 text-xs mt-1">You&apos;ll be notified when commission rates change</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {rateNotifications.map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          onClick={() => handleRateNotificationClick(notification)}
                          className={`px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors group relative ${
                            !notification.is_read ? 'bg-gray-800/30' : ''
                          }`}
                        >
                          {/* Dismiss button */}
                          <button
                            onClick={(e) => dismissRateNotification(notification.id, e)}
                            className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all"
                          >
                            <X className="w-3 h-3 text-gray-400" />
                          </button>

                          <div className="flex gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getRateNotificationIcon(notification.notification_type)}
                            </div>
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-medium text-sm line-clamp-1 group-hover:text-orange-400 transition-colors font-poppins ${
                                  notification.is_read ? 'text-gray-400' : 'text-white'
                                }`}>
                                  {notification.title}
                                </h4>
                                {!notification.is_read && (
                                  <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                                )}
                              </div>

                              {/* Rate Details Tags */}
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-white/10 rounded text-gray-400 text-[10px]">
                                  <Building2 className="w-2.5 h-2.5 mr-1" />
                                  {notification.bank_name}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-white/10 rounded text-gray-400 text-[10px]">
                                  <MapPin className="w-2.5 h-2.5 mr-1" />
                                  {notification.location}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-white/10 rounded text-gray-400 text-[10px]">
                                  <FileText className="w-2.5 h-2.5 mr-1" />
                                  {notification.loan_type}
                                </span>
                              </div>

                              {/* Rate Change */}
                              {notification.old_percentage !== null && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                                  <span className="text-gray-500">{notification.old_percentage}%</span>
                                  <ArrowRight className="w-3 h-3 text-gray-600" />
                                  <span className={notification.notification_type === 'rate_increase' ? 'text-green-400' : 'text-red-400'}>
                                    {notification.new_percentage}%
                                  </span>
                                  {notification.percentage_change !== null && (
                                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                                      notification.percentage_change > 0
                                        ? 'bg-green-900/50 text-green-400'
                                        : 'bg-red-900/50 text-red-400'
                                    }`}>
                                      {notification.percentage_change > 0 ? '+' : ''}{notification.percentage_change}%
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Time */}
                              <div className="mt-1.5 text-[10px] text-gray-500">
                                {formatTimeAgo(notification.created_at)}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Footer */}
              {((activeTab === 'general' && notifications.length > 0) || (activeTab === 'rates' && rateNotifications.length > 0)) && (
                <div className="px-4 py-3 border-t border-gray-700/50">
                  <a
                    href={activeTab === 'general' ? `/partners/${partnerType}/notifications` : `/partners/${partnerType}/payout-grid`}
                    onClick={() => setIsOpen(false)}
                    className="block text-center text-orange-500 hover:text-orange-400 text-sm font-medium transition-colors"
                  >
                    {activeTab === 'general' ? 'View All Notifications' : 'View Payout Grid'}
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notification Detail Modal */}
      <AnimatePresence>
        {selectedNotification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gray-900 px-6 py-4 border-b border-gray-800 flex items-start justify-between z-10">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-4xl">{getTypeIcon(selectedNotification.notification_type)}</span>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-2 font-poppins">
                      {selectedNotification.title}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>From: <span className="text-white font-medium">{selectedNotification.sent_by_name}</span></span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(selectedNotification.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${getPriorityColor(selectedNotification.priority)}`}>
                    {selectedNotification.priority.toUpperCase()} PRIORITY
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/50 font-semibold">
                    {selectedNotification.notification_type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div className="bg-black/30 rounded-lg p-6 border border-gray-800">
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {selectedNotification.message}
                  </p>
                </div>

                {selectedNotification.action_url && (
                  <div className="mt-6">
                    <a
                      href={selectedNotification.action_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeModal}
                      className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-all font-semibold shadow-lg hover:shadow-orange-500/50"
                    >
                      {selectedNotification.action_label || 'View Details'}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-900 px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rate Notification Detail Modal */}
      <AnimatePresence>
        {selectedRateNotification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={closeRateModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 max-w-lg w-full"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-800 flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getRateNotificationIcon(selectedRateNotification.notification_type)}
                  <div className="flex-1">
                    <h2 className="text-lg font-bold font-poppins text-white">
                      {selectedRateNotification.title}
                    </h2>
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(selectedRateNotification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeRateModal}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-5">
                {/* Rate Details */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <Building2 className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500 uppercase">Bank</p>
                    <p className="text-sm text-white font-medium truncate">{selectedRateNotification.bank_name}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <MapPin className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500 uppercase">Location</p>
                    <p className="text-sm text-white font-medium truncate">{selectedRateNotification.location}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <FileText className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500 uppercase">Loan Type</p>
                    <p className="text-sm text-white font-medium truncate">{selectedRateNotification.loan_type}</p>
                  </div>
                </div>

                {/* Rate Change Display */}
                {selectedRateNotification.old_percentage !== null && (
                  <div className={`rounded-lg p-4 mb-4 ${
                    selectedRateNotification.notification_type === 'rate_increase'
                      ? 'bg-green-900/30 border border-green-500/30'
                      : 'bg-red-900/30 border border-red-500/30'
                  }`}>
                    <p className="text-gray-400 text-xs mb-2">Commission Rate Change</p>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-400">{selectedRateNotification.old_percentage}%</p>
                        <p className="text-[10px] text-gray-500">Previous</p>
                      </div>
                      <ArrowRight className={`w-6 h-6 ${
                        selectedRateNotification.notification_type === 'rate_increase' ? 'text-green-400' : 'text-red-400'
                      }`} />
                      <div className="text-center">
                        <p className={`text-2xl font-bold ${
                          selectedRateNotification.notification_type === 'rate_increase' ? 'text-green-400' : 'text-red-400'
                        }`}>{selectedRateNotification.new_percentage}%</p>
                        <p className="text-[10px] text-gray-500">New Rate</p>
                      </div>
                      {selectedRateNotification.percentage_change !== null && (
                        <div className={`px-3 py-1 rounded-lg ${
                          selectedRateNotification.percentage_change > 0
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          <p className="text-lg font-bold">
                            {selectedRateNotification.percentage_change > 0 ? '+' : ''}{selectedRateNotification.percentage_change}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* New Rate Display (for new_rate type) */}
                {selectedRateNotification.notification_type === 'new_rate' && selectedRateNotification.old_percentage === null && (
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4 text-center">
                    <p className="text-gray-400 text-xs mb-2">New Commission Rate</p>
                    <p className="text-3xl font-bold text-blue-400">{selectedRateNotification.new_percentage}%</p>
                  </div>
                )}

                {/* Message */}
                <div className="bg-black/30 rounded-lg p-4 border border-gray-800">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {selectedRateNotification.message}
                  </p>
                </div>

                {/* Effective Date */}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>Effective from:</span>
                  </div>
                  <span className="text-white font-medium">
                    {new Date(selectedRateNotification.effective_from).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
                <a
                  href={`/partners/${partnerType}/payout-grid`}
                  onClick={closeRateModal}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  View Payout Grid
                </a>
                <button
                  onClick={closeRateModal}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FF6700;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ff8533;
        }
      `}</style>
    </>
  )
}
