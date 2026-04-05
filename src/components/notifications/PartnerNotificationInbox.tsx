'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Mail,
  Archive,
  Trash2,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  ExternalLink,
  CheckCircle2,
  Circle,
  Filter,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

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
  is_archived: boolean
  read_at?: string
  created_at: string
  is_pinned: boolean
}

interface PartnerNotificationInboxProps {
  portalName: string // "Business Associate", "Business Partner", "Channel Partner"
}

export function PartnerNotificationInbox({ portalName }: PartnerNotificationInboxProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Pagination state
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [filter, page, debouncedSearch])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)

      const offset = (page - 1) * limit
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
      const response = await fetch(`/api/notifications/inbox?filter=${filter}&limit=${limit}&offset=${offset}${searchParam}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load notifications')
      }

      setNotifications(data.notifications || [])
      setTotal(data.total || 0)
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

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

  const markAsRead = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      })

      if (response.ok) {
        setNotifications(notifications.map(n =>
          n.recipient_id === recipientId ? { ...n, is_read: true } : n
        ))
        await fetchUnreadCount()
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const markAsUnread = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: false })
      })

      if (response.ok) {
        setNotifications(notifications.map(n =>
          n.recipient_id === recipientId ? { ...n, is_read: false } : n
        ))
        await fetchUnreadCount()
      }
    } catch (error) {
      console.error('Error marking as unread:', error)
    }
  }

  const archiveNotification = async (recipientId: string) => {
    try {
      await fetch(`/api/notifications/${recipientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true })
      })
      fetchNotifications()
      fetchUnreadCount()
      setSelectedNotification(null)
    } catch (error) {
      console.error('Error archiving notification:', error)
    }
  }

  const deleteNotification = async (recipientId: string) => {
    try {
      await fetch(`/api/notifications/${recipientId}`, { method: 'DELETE' })
      fetchNotifications()
      fetchUnreadCount()
      setSelectedNotification(null)
    } catch (error) {
      console.error('Error deleting notification:', error)
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

  const getCategoryColor = (type: string) => {
    const colors: Record<string, string> = {
      announcement: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      alert: 'bg-red-500/20 text-red-400 border-red-500/50',
      update: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      reminder: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      celebration: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
      system_update: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
      offer: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      custom: 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
    return colors[type] || colors.custom
  }

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification)
    if (!notification.is_read) {
      markAsRead(notification.recipient_id)
    }
  }

  const formatDate = (dateString: string) => {
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

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-poppins">
            <Bell className="w-8 h-8 text-orange-500" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-orange-500 text-white text-sm px-3 py-1 rounded-full font-semibold">
                {unreadCount} New
              </span>
            )}
          </h1>
          <p className="text-gray-400 mt-2">Stay updated with important announcements and updates</p>
        </div>

        <button
          onClick={fetchNotifications}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="search"
          placeholder="Search notifications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-900 text-white pl-12 pr-4 py-3 rounded-lg border border-gray-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-3 bg-gray-900 p-2 rounded-lg">
        <Filter className="w-5 h-5 text-gray-400 ml-2" />
        <button
          onClick={() => { setFilter('all'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
            filter === 'all'
              ? 'bg-orange-500 text-white shadow-lg'
              : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          All
        </button>
        <button
          onClick={() => { setFilter('unread'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
            filter === 'unread'
              ? 'bg-orange-500 text-white shadow-lg'
              : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Circle className="w-4 h-4" fill="currentColor" />
          Unread
          {unreadCount > 0 && filter !== 'unread' && (
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setFilter('read'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
            filter === 'read'
              ? 'bg-orange-500 text-white shadow-lg'
              : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Read
        </button>
        <button
          onClick={() => { setFilter('archived'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
            filter === 'archived'
              ? 'bg-orange-500 text-white shadow-lg'
              : 'bg-transparent text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Archive className="w-4 h-4" />
          Archived
        </button>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Error Loading Notifications</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-900 rounded-lg">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <p className="text-gray-400">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 rounded-lg p-16 text-center"
        >
          <Bell className="w-20 h-20 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2 font-poppins">No Notifications Yet</h3>
          <p className="text-gray-400 text-sm">
            {filter === 'unread' && 'All caught up! No unread notifications.'}
            {filter === 'read' && 'No read notifications found.'}
            {filter === 'archived' && 'No archived notifications.'}
            {filter === 'all' && searchTerm && `No notifications found for "${searchTerm}".`}
            {filter === 'all' && !searchTerm && "You'll see important updates and announcements here."}
          </p>
        </motion.div>
      ) : (
        <>
          {/* Notifications Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notifications List */}
            <div className="lg:col-span-1 space-y-3 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence>
                {notifications.map((notification, index) => (
                  <motion.div
                    key={notification.recipient_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleNotificationClick(notification)}
                    className={`bg-gray-900 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-800 hover:shadow-lg ${
                      !notification.is_read ? 'border-l-4 border-l-orange-500' : 'border-l-4 border-l-transparent'
                    } ${selectedNotification?.recipient_id === notification.recipient_id ? 'ring-2 ring-orange-500 shadow-lg shadow-orange-500/20' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{getTypeIcon(notification.notification_type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-1">
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0"></div>
                            )}
                            <p className="text-white font-semibold text-sm truncate">
                              {notification.title}
                            </p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs line-clamp-2 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(notification.priority)}`}>
                            {notification.priority.toUpperCase()}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(notification.notification_type)}`}>
                            {notification.notification_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-gray-500 text-xs ml-auto">
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Notification Detail View */}
            <div className="lg:col-span-2">
              {selectedNotification ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900 rounded-lg p-6 space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-gray-800">
                    <div className="flex items-start gap-4 flex-1">
                      <span className="text-5xl">{getTypeIcon(selectedNotification.notification_type)}</span>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-3 font-poppins">
                          {selectedNotification.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>From: <span className="text-white font-medium">{selectedNotification.sent_by_name}</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(selectedNotification.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${getPriorityColor(selectedNotification.priority)}`}>
                            {selectedNotification.priority.toUpperCase()} PRIORITY
                          </span>
                          <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${getCategoryColor(selectedNotification.notification_type)}`}>
                            {selectedNotification.notification_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNotification.is_read ? (
                        <button
                          onClick={() => markAsUnread(selectedNotification.recipient_id)}
                          className="p-2 hover:bg-orange-500/20 rounded-lg transition-colors group"
                          title="Mark as unread"
                        >
                          <Circle className="w-5 h-5 text-gray-400 group-hover:text-orange-400" />
                        </button>
                      ) : (
                        <button
                          onClick={() => markAsRead(selectedNotification.recipient_id)}
                          className="p-2 hover:bg-green-500/20 rounded-lg transition-colors group"
                          title="Mark as read"
                        >
                          <CheckCircle2 className="w-5 h-5 text-gray-400 group-hover:text-green-400" />
                        </button>
                      )}
                      <button
                        onClick={() => archiveNotification(selectedNotification.recipient_id)}
                        className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors group"
                        title="Archive"
                      >
                        <Archive className="w-5 h-5 text-gray-400 group-hover:text-blue-400" />
                      </button>
                      <button
                        onClick={() => deleteNotification(selectedNotification.recipient_id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="bg-black/30 rounded-lg p-6 border border-gray-800">
                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed text-base">
                      {selectedNotification.message}
                    </p>
                  </div>

                  {/* Action Button */}
                  {selectedNotification.action_url && (
                    <div className="pt-4 border-t border-gray-800">
                      <a
                        href={selectedNotification.action_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-all font-semibold shadow-lg hover:shadow-orange-500/50"
                      >
                        {selectedNotification.action_label || 'View Details'}
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-gray-900 rounded-lg p-12 text-center h-full flex items-center justify-center min-h-[500px]"
                >
                  <div>
                    <Mail className="w-20 h-20 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">Select a notification to view details</p>
                    <p className="text-gray-500 text-sm mt-2">Click on any notification from the list</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg">
              <div className="text-sm text-gray-400">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} notifications
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          page === pageNum
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #FF6700;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ff8533;
        }
      `}</style>
    </div>
  )
}
