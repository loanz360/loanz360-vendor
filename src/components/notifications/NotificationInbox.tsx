'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  Search,
  Filter,
  Star,
  Archive,
  Trash2,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  MessageSquare
} from 'lucide-react'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription'
import { useAuth } from '@/lib/auth/auth-context'
import { toast } from 'sonner'
interface Notification {
  id: string
  title: string
  message: string
  message_html?: string
  notification_type: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_read: boolean
  starred: boolean
  is_archived: boolean
  image_url?: string
  thumbnail_url?: string
  attachments?: unknown[]
  allow_replies: boolean
  reply_count: number
  action_url?: string
  action_label?: string
  sent_by_name?: string
  created_at: string
  valid_until?: string
  snoozed_until?: string
}

interface NotificationInboxProps {
  onNotificationClick?: (notification: Notification) => void
}

export default function NotificationInbox({ onNotificationClick }: NotificationInboxProps) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'starred' | 'archived'>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Real-time subscription
  const { isSubscribed } = useNotificationSubscription({
    userId: user?.id,
    enabled: !!user?.id,
    onNewNotification: (notification) => {

      // Add to beginning of notifications list
      setNotifications((prev) => [notification, ...prev])

      // Show subtle toast
      toast(`New: ${notification.title}`, {
        duration: 3000,
        icon: '📬'
      })
    },
    onNotificationUpdate: (notification) => {

      // Update the notification in the list
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? notification : n))
      )
    },
    onNotificationDelete: (notificationId) => {

      // Remove from list
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    }
  })

  // Fetch notifications
  useEffect(() => {
    if (user?.id) {
      fetchNotifications()
    }
  }, [user?.id])

  // Apply filters
  useEffect(() => {
    let filtered = [...notifications]

    // Filter by type
    if (filterType === 'unread') {
      filtered = filtered.filter(n => !n.is_read)
    } else if (filterType === 'starred') {
      filtered = filtered.filter(n => n.starred)
    } else if (filterType === 'archived') {
      filtered = filtered.filter(n => n.is_archived)
    } else {
      // 'all' - exclude archived by default
      filtered = filtered.filter(n => !n.is_archived)
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter(n => n.priority === filterPriority)
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        n =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query) ||
          n.sent_by_name?.toLowerCase().includes(query)
      )
    }

    setFilteredNotifications(filtered)
  }, [notifications, filterType, filterPriority, searchQuery])

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch notifications')
      }

      setNotifications(data.notifications || [])
    } catch (err: unknown) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      })

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      )
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleToggleStar = async (id: string, currentStarred: boolean) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !currentStarred })
      })

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, starred: !currentStarred } : n))
      )
    } catch (error) {
      console.error('Error toggling star:', error)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true })
      })

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_archived: true } : n))
      )
    } catch (error) {
      console.error('Error archiving:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-400 bg-red-500/20'
      case 'high':
        return 'text-orange-400 bg-orange-500/20'
      case 'normal':
        return 'text-blue-400 bg-blue-500/20'
      case 'low':
        return 'text-gray-400 bg-gray-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="w-4 h-4" />
      case 'reminder':
        return <Clock className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read && !n.is_archived).length

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-8 h-8 text-orange-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold font-poppins">Notifications</h2>
            <p className="text-sm text-gray-400">
              {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'unread'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Unread ({notifications.filter(n => !n.is_read && !n.is_archived).length})
            </button>
            <button
              onClick={() => setFilterType('starred')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'starred'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Starred
            </button>
            <button
              onClick={() => setFilterType('archived')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'archived'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              Archived
            </button>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading notifications...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Notifications List */}
      {!loading && !error && filteredNotifications.length === 0 && (
        <div className="text-center py-12 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg">
          <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No notifications found</p>
        </div>
      )}

      {!loading && !error && filteredNotifications.length > 0 && (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 hover:border-orange-500/50 transition-all group cursor-pointer ${
                !notification.is_read ? 'bg-orange-500/5' : ''
              }`}
              onClick={() => {
                if (!notification.is_read) {
                  handleMarkAsRead(notification.id)
                }
                if (onNotificationClick) {
                  onNotificationClick(notification)
                }
              }}
            >
              <div className="flex gap-4">
                {/* Thumbnail/Icon */}
                <div className="flex-shrink-0">
                  {notification.thumbnail_url ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden">
                      <Image
                        src={notification.thumbnail_url}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getPriorityColor(notification.priority)}`}>
                      {getTypeIcon(notification.notification_type)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                        )}
                        <h3 className="font-semibold truncate font-poppins">
                          {notification.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {notification.message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStar(notification.id, notification.starred)
                        }}
                        className="p-2 hover:bg-white/10 rounded transition-colors"
                        title={notification.starred ? 'Unstar' : 'Star'}
                      >
                        <Star className={`w-4 h-4 ${notification.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>

                      {!notification.is_archived && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleArchive(notification.id)
                          }}
                          className="p-2 hover:bg-white/10 rounded transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {notification.sent_by_name && (
                      <span>From: {notification.sent_by_name}</span>
                    )}
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                    {notification.allow_replies && notification.reply_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-orange-400">
                          <MessageSquare className="w-3 h-3" />
                          {notification.reply_count} {notification.reply_count === 1 ? 'reply' : 'replies'}
                        </span>
                      </>
                    )}
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs ${getPriorityColor(notification.priority)}`}>
                      {notification.priority}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
