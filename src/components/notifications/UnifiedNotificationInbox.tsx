'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/auth-context'
import DOMPurify from 'dompurify'
import {
  getPriorityBorderColor,
  getPriorityIcon,
  shouldFlashNotification,
} from '@/lib/notifications/notification-types'
import { STATUS_COLORS, CARD_COLORS } from '@/lib/constants/theme'
import {
  Bell,
  Filter,
  Mail,
  MailOpen,
  Archive,
  Trash2,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  ExternalLink,
  Search,
  X,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings
} from 'lucide-react'

export interface Notification {
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
  starred?: boolean
  read_at?: string
  created_at: string
  is_pinned: boolean
}

interface UnifiedNotificationInboxProps {
  portalType?: 'employee' | 'partner' | 'customer' | 'superadmin'
  showStatistics?: boolean
  showSearch?: boolean
  showBulkActions?: boolean
  pageSize?: number
  userSubRole?: string
}

// Role-specific quick filters for Accounts Executive
const ACCOUNTS_QUICK_FILTERS = [
  { key: 'all_types', label: 'All Types', icon: '📋' },
  { key: 'payout', label: 'Payout Approvals', icon: '💰', types: ['payout_processed', 'claim_approved', 'claim_rejected'] },
  { key: 'incentive', label: 'Incentives', icon: '🎯', types: ['incentive_assigned', 'target_updated'] },
  { key: 'compliance', label: 'Compliance', icon: '🔒', types: ['security', 'system'] },
  { key: 'hr', label: 'HR & Payroll', icon: '📄', types: ['payroll', 'leave', 'attendance'] },
]

// Pagination constants
const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// Properly typed icon mapping
const TYPE_ICONS: Record<string, string> = {
  announcement: '\uD83D\uDCE2',
  alert: '\u26A0\uFE0F',
  update: '\uD83D\uDCE2',
  reminder: '\u23F0',
  celebration: '\uD83C\uDF89',
  custom: '\uD83D\uDCDD',
  incentive_assigned: '\uD83C\uDFAF',
  target_updated: '\uD83D\uDCCA',
  claim_approved: '\u2705',
  claim_rejected: '\u274C',
  payout_processed: '\uD83D\uDCB0',
  system: '\u2699\uFE0F',
  security: '\uD83D\uDD12',
  leave: '\uD83C\uDFD6\uFE0F',
  attendance: '\uD83D\uDCCB',
  payroll: '\uD83D\uDCB5',
  task: '\u2611\uFE0F',
  document: '\uD83D\uDCC4',
}

// Priority text labels for accessibility (alongside color indicators)
const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  normal: 'Normal',
  low: 'Low',
}

export default function UnifiedNotificationInbox({
  portalType = 'employee',
  showStatistics = true,
  showSearch = true,
  showBulkActions = true,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  userSubRole
}: UnifiedNotificationInboxProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all') // 'all', 'unread', 'important', 'archived'
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionMode, setBulkActionMode] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // ENH-N1: Role-specific category filter
  const [categoryFilter, setCategoryFilter] = useState('all_types')
  const isAccountsRole = userSubRole?.toUpperCase()?.includes('ACCOUNTS')

  // ENH-N3: Notification sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true)

  // AbortController ref for cancelling in-flight fetch requests
  const abortControllerRef = useRef<AbortController | null>(null)
  const countAbortControllerRef = useRef<AbortController | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [totalCount, setTotalCount] = useState(0)
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [totalImportantCount, setTotalImportantCount] = useState(0)
  const [totalArchivedCount, setTotalArchivedCount] = useState(0)

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
      setCurrentPage(1) // Reset to first page on search
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch notifications when filter, search, category, or page changes
  useEffect(() => {
    fetchNotifications()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, searchQuery, currentPage, pageSize, categoryFilter, fetchNotifications])

  // Fetch notification counts separately for accurate statistics
  useEffect(() => {
    fetchNotificationCounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchNotificationCounts])

  // Real-time notification subscription with proper cleanup and race condition prevention
  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let isSubscribed = false
    let isMounted = true

    const channelName = `notifications-inbox:${user.id}`

    const setupSubscription = async () => {
      try {
        const existingChannel = supabase.channel(channelName)
        if (existingChannel) {
          await supabase.removeChannel(existingChannel).catch(() => {})
        }

        await new Promise(resolve => setTimeout(resolve, 100))

        if (!isMounted) return

        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notification_recipients',
              filter: `user_id=eq.${user.id}`
            },
            async () => {
              if (isMounted && isSubscribed) {
                await fetchNotifications()
                await fetchNotificationCounts()
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notification_recipients',
              filter: `user_id=eq.${user.id}`
            },
            async (payload) => {
              if (isMounted && isSubscribed) {
                setNotifications(prev =>
                  prev.map(n =>
                    n.recipient_id === payload.new.id
                      ? { ...n, is_read: payload.new.is_read, is_archived: payload.new.is_archived, starred: payload.new.starred }
                      : n
                  )
                )
                await fetchNotificationCounts()
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              isSubscribed = true
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              if (isMounted) {
                setTimeout(() => {
                  if (isMounted) setupSubscription()
                }, 5000)
              }
            }
          })
      } catch (error) {
        console.error('[Realtime] Error setting up subscription:', error)
        if (isMounted) {
          setTimeout(() => {
            if (isMounted) setupSubscription()
          }, 5000)
        }
      }
    }

    setupSubscription()

    return () => {
      isMounted = false
      isSubscribed = false

      if (channel) {
        supabase.removeChannel(channel).catch(() => {})
      }
    }
  }, [user?.id])

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      countAbortControllerRef.current?.abort()
    }
  }, [])

  // Fetch accurate notification counts from dedicated API
  const fetchNotificationCounts = useCallback(async () => {
    try {
      // Abort previous count request
      countAbortControllerRef.current?.abort()
      const controller = new AbortController()
      countAbortControllerRef.current = controller

      const response = await fetch('/api/notifications/count', { signal: controller.signal })
      if (response.ok) {
        const data = await response.json()
        setTotalUnreadCount(data.unread || 0)
        setTotalImportantCount(data.important || 0)
        setTotalArchivedCount(data.archived || 0)
        setTotalCount(data.total || 0)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Error fetching notification counts:', err)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      // Abort previous request to prevent race conditions
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)

      // Calculate offset for pagination
      const offset = (currentPage - 1) * pageSize

      // Build query string with pagination parameters
      const params = new URLSearchParams({
        filter,
        limit: pageSize.toString(),
        offset: offset.toString()
      })

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      // ENH-N1: Apply role-specific category type filter
      if (categoryFilter !== 'all_types') {
        const activeQuickFilter = ACCOUNTS_QUICK_FILTERS.find(f => f.key === categoryFilter)
        if (activeQuickFilter?.types) {
          params.append('type', activeQuickFilter.types.join(','))
        }
      }

      const response = await fetch(`/api/notifications/inbox?${params.toString()}`, {
        signal: controller.signal
      })
      const data = await response.json()

      // Clear error on successful fetch
      setError(null)

      // Set notifications (API always returns array, even if empty)
      setNotifications(data.notifications || [])

      // Update total count from response if available
      if (data.total !== undefined) {
        setTotalCount(data.total)
      }

      // Don't show error for info messages (system being set up)
      if (data.error && !data.info) {
        setError(data.error)
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Error fetching notifications:', err)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [filter, searchQuery, currentPage, pageSize, categoryFilter])

  // Calculate pagination values
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      setSelectedIds(new Set())
      setSelectedNotification(null) // Clear selection when changing pages
    }
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
    setSelectedIds(new Set())
    setSelectedNotification(null)
  }

  const markAsRead = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_read: true })
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n =>
          n.recipient_id === recipientId ? { ...n, is_read: true } : n
        ))
        // Update counts after marking as read
        await fetchNotificationCounts()
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const markAsUnread = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: false })
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n =>
          n.recipient_id === recipientId ? { ...n, is_read: false } : n
        ))
        if (selectedNotification?.recipient_id === recipientId) {
          setSelectedNotification(prev => prev ? { ...prev, is_read: false } : null)
        }
        // Update counts after marking as unread
        await fetchNotificationCounts()
      }
    } catch (error) {
      console.error('Error marking as unread:', error)
    }
  }

  const toggleStar = async (recipientId: string) => {
    const notification = notifications.find(n => n.recipient_id === recipientId)
    if (!notification) return

    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ starred: !notification.starred })
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n =>
          n.recipient_id === recipientId ? { ...n, starred: !notification.starred } : n
        ))
      }
    } catch (error) {
      console.error('Error toggling star:', error)
    }
  }

  const archiveNotification = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_archived: true })
      })

      if (response.ok) {
        await fetchNotifications()
        await fetchNotificationCounts()
      }
    } catch (error) {
      console.error('Error archiving notification:', error)
    }
  }

  const deleteNotification = async (recipientId: string) => {
    try {
      const response = await fetch(`/api/notifications/${recipientId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchNotifications()
        await fetchNotificationCounts()
        setSelectedNotification(null)
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Refresh notifications list and counts
        await Promise.all([fetchNotifications(), fetchNotificationCounts()])
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(notifications.map(n => n.recipient_id)))
    }
  }

  const toggleSelect = (recipientId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(recipientId)) {
      newSelected.delete(recipientId)
    } else {
      newSelected.add(recipientId)
    }
    setSelectedIds(newSelected)
  }

  const bulkMarkAsRead = async () => {
    setBulkLoading(true)
    setBulkError(null)
    try {
      const promises = Array.from(selectedIds).map(id => markAsRead(id))
      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkActionMode(false)
      await fetchNotificationCounts()
    } catch (err) {
      setBulkError('Failed to mark selected notifications as read')
    } finally {
      setBulkLoading(false)
    }
  }

  const bulkArchive = async () => {
    setBulkLoading(true)
    setBulkError(null)
    try {
      const promises = Array.from(selectedIds).map(id => archiveNotification(id))
      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkActionMode(false)
      await fetchNotificationCounts()
    } catch (err) {
      setBulkError('Failed to archive selected notifications')
    } finally {
      setBulkLoading(false)
    }
  }

  const bulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} notification(s)?`)) return
    setBulkLoading(true)
    setBulkError(null)
    try {
      const promises = Array.from(selectedIds).map(id => deleteNotification(id))
      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkActionMode(false)
      await fetchNotificationCounts()
    } catch (err) {
      setBulkError('Failed to delete selected notifications')
    } finally {
      setBulkLoading(false)
    }
  }

  const getTypeIcon = (type: string): string => {
    return TYPE_ICONS[type] || '\uD83D\uDCEC'
  }

  const getPriorityColor = (priority: string): string => {
    // Use STATUS_COLORS from theme for consistency
    const colorMap: Record<string, string> = {
      urgent: STATUS_COLORS.urgent,
      high: STATUS_COLORS.high,
      medium: STATUS_COLORS.normal,
      normal: STATUS_COLORS.normal,
      low: STATUS_COLORS.low,
    }
    return colorMap[priority] || colorMap.normal
  }

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification)
    if (!notification.is_read) {
      markAsRead(notification.recipient_id)
    }
  }

  // Sanitize notification message to prevent XSS
  const sanitizeMessage = (message: string): string => {
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(message, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    }
    return message.replace(/<[^>]*>/g, '')
  }

  // Safe date formatting with null check
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Unknown date'
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return 'Invalid date'
    }
  }

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Unknown date'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 font-poppins">
            <Bell className="w-8 h-8 text-orange-400" />
            Notifications
          </h1>
          <p className="text-gray-400 mt-1">Stay updated with important announcements</p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {showBulkActions && (
            <button
              onClick={() => setBulkActionMode(!bulkActionMode)}
              aria-label={bulkActionMode ? 'Cancel bulk selection' : 'Enable bulk selection'}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                bulkActionMode
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {bulkActionMode ? 'Cancel' : 'Select'}
            </button>
          )}
          <button
            onClick={markAllAsRead}
            aria-label="Mark all notifications as read"
            className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <MailOpen className="w-4 h-4" />
            Mark All Read
          </button>
          <button
            onClick={() => router.push('/employees/notifications/preferences')}
            aria-label="Notification preferences"
            className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {bulkActionMode && selectedIds.size > 0 && (
        <div className={`${CARD_COLORS.primary.bg} border ${CARD_COLORS.primary.border} rounded-lg p-4 flex items-center justify-between`}>
          <p className="text-orange-300">
            {selectedIds.size} notification{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
          {bulkError && (
            <p className="text-red-400 text-sm">{bulkError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={bulkMarkAsRead}
              disabled={bulkLoading}
              aria-label="Mark selected as read"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition-colors text-sm disabled:opacity-50 flex items-center gap-1"
            >
              {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              Mark as Read
            </button>
            <button
              onClick={bulkArchive}
              disabled={bulkLoading}
              aria-label="Archive selected notifications"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition-colors text-sm disabled:opacity-50 flex items-center gap-1"
            >
              {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              Archive
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkLoading}
              aria-label="Delete selected notifications"
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors text-sm disabled:opacity-50 flex items-center gap-1"
            >
              {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation - Using accurate counts from API */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setFilter('all'); setCurrentPage(1); setSelectedNotification(null); }}
            aria-label="Show all notifications"
            className={`flex-1 px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              filter === 'all'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Mail className="w-4 h-4" />
            Inbox
          </button>
          <button
            onClick={() => { setFilter('unread'); setCurrentPage(1); setSelectedNotification(null); }}
            aria-label={`Show unread notifications (${totalUnreadCount})`}
            className={`flex-1 px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              filter === 'unread'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bell className="w-4 h-4" />
            Unread
            {totalUnreadCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 rounded-full text-xs text-white">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setFilter('important'); setCurrentPage(1); setSelectedNotification(null); }}
            aria-label={`Show important notifications (${totalImportantCount})`}
            className={`flex-1 px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              filter === 'important'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Important
            {totalImportantCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 rounded-full text-xs text-white">
                {totalImportantCount > 99 ? '99+' : totalImportantCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setFilter('archived'); setCurrentPage(1); setSelectedNotification(null); }}
            aria-label="Show archived notifications"
            className={`flex-1 px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              filter === 'archived'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Archive className="w-4 h-4" />
            Archived
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="relative">
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg px-4 py-3">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search notifications by title or message..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
              aria-label="Search notifications"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-400 mt-2">
              {loading
                ? 'Searching...'
                : notifications.length === 0
                  ? `No results found for "${searchQuery}"`
                  : `Found ${notifications.length} result${notifications.length !== 1 ? 's' : ''} for "${searchQuery}"`
              }
            </p>
          )}
        </div>
      )}

      {/* ENH-N1: Accounts Executive Quick Category Filters */}
      {isAccountsRole && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {ACCOUNTS_QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              onClick={() => { setCategoryFilter(qf.key); setCurrentPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                categoryFilter === qf.key
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
              aria-label={`Filter by ${qf.label}`}
            >
              <span>{qf.icon}</span>
              {qf.label}
            </button>
          ))}

          {/* ENH-N3: Notification Sound Toggle */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-500'
              }`}
              aria-label={soundEnabled ? 'Mute notification sounds' : 'Enable notification sounds'}
              title={soundEnabled ? 'Sound On' : 'Sound Off'}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards - Using CARD_COLORS from theme */}
      {showStatistics && !searchQuery && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${CARD_COLORS.info.bg} border ${CARD_COLORS.info.border} rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total</p>
                <p className={`text-2xl font-bold ${CARD_COLORS.info.text} mt-1`}>
                  {totalCount.toLocaleString()}
                </p>
              </div>
              <Mail className={`w-8 h-8 ${CARD_COLORS.info.icon}`} />
            </div>
          </div>

          <div className={`${CARD_COLORS.primary.bg} border ${CARD_COLORS.primary.border} rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Unread</p>
                <p className={`text-2xl font-bold ${CARD_COLORS.primary.text} mt-1`}>
                  {totalUnreadCount.toLocaleString()}
                </p>
              </div>
              <Bell className={`w-8 h-8 ${CARD_COLORS.primary.icon}`} />
            </div>
          </div>

          <div className={`${CARD_COLORS.danger.bg} border ${CARD_COLORS.danger.border} rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Important</p>
                <p className={`text-2xl font-bold ${CARD_COLORS.danger.text} mt-1`}>
                  {totalImportantCount.toLocaleString()}
                </p>
              </div>
              <AlertCircle className={`w-8 h-8 ${CARD_COLORS.danger.icon}`} />
            </div>
          </div>

          <div className={`${CARD_COLORS.purple.bg} border ${CARD_COLORS.purple.border} rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Archived</p>
                <p className={`text-2xl font-bold ${CARD_COLORS.purple.text} mt-1`}>
                  {totalArchivedCount.toLocaleString()}
                </p>
              </div>
              <Archive className={`w-8 h-8 ${CARD_COLORS.purple.icon}`} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className={`${CARD_COLORS.danger.bg} border ${CARD_COLORS.danger.border} rounded-lg p-4 flex items-start gap-3`}>
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-full" />
                    <div className="flex gap-2">
                      <div className="h-5 bg-white/10 rounded w-16" />
                      <div className="h-5 bg-white/10 rounded w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 animate-pulse min-h-[500px]">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-full" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-white/10 rounded w-2/3" />
                  <div className="h-4 bg-white/10 rounded w-1/2" />
                </div>
              </div>
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="h-4 bg-white/10 rounded w-full" />
                <div className="h-4 bg-white/10 rounded w-5/6" />
                <div className="h-4 bg-white/10 rounded w-4/6" />
              </div>
            </div>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-12 text-center">
          <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">
            {searchQuery ? `No results found for "${searchQuery}"` : 'No notifications yet'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {searchQuery
              ? 'Try a different search term'
              : "You'll see important updates and announcements here"
            }
          </p>
        </div>
      ) : (
        <>
        {/* ENH-N6: Daily Digest Summary for Accounts Executive */}
        {isAccountsRole && !searchQuery && filter === 'all' && (
          <div className={`${CARD_COLORS.primary.bg} border ${CARD_COLORS.primary.border} rounded-lg p-4 mb-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-white font-medium text-sm">Today&apos;s Summary</p>
                  <p className="text-gray-400 text-xs">
                    {totalUnreadCount} unread &bull; {totalImportantCount} important &bull; {notifications.filter(n => ['payout_processed', 'claim_approved', 'incentive_assigned'].includes(n.notification_type)).length} payout-related
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {totalUnreadCount > 5 && (
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                    Action Required
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications List */}
          <div className="lg:col-span-1 space-y-2 max-h-[700px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#FF6700 #1a1a1a' }}>
            {bulkActionMode && (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-3 flex items-center gap-2 mb-2">
                <button
                  onClick={toggleSelectAll}
                  aria-label={selectedIds.size === notifications.length ? 'Deselect all' : 'Select all'}
                  aria-checked={selectedIds.size === notifications.length}
                  role="checkbox"
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {selectedIds.size === notifications.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  Select All
                </button>
              </div>
            )}

            {notifications.map((notification) => {
              const priority = notification.priority || 'normal'
              const isUrgent = shouldFlashNotification(priority as 'urgent' | 'high' | 'normal' | 'low')
              const isSelected = selectedIds.has(notification.recipient_id)

              return (
                <div
                  key={notification.recipient_id}
                  className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer transition-all hover:bg-white/10 ${
                    getPriorityBorderColor(priority as 'urgent' | 'high' | 'normal' | 'low')
                  } ${
                    selectedNotification?.recipient_id === notification.recipient_id
                      ? 'bg-white/10 ring-2 ring-orange-500/50'
                      : ''
                  } ${isUrgent ? 'animate-urgent-flash' : ''} ${
                    isSelected ? 'ring-2 ring-orange-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {bulkActionMode && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelect(notification.recipient_id)
                        }}
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`Select notification: ${notification.title}`}
                        className="flex-shrink-0 pt-1 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-orange-500" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    )}
                    <div
                      onClick={() => !bulkActionMode && handleNotificationClick(notification)}
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <span className="text-2xl">{getTypeIcon(notification.notification_type)}</span>
                        {priority !== 'normal' && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${getPriorityColor(priority)}`}
                            title={`Priority: ${PRIORITY_LABELS[priority] || priority}`}
                          >
                            {PRIORITY_LABELS[priority] || priority}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full" aria-label="Unread"></div>
                          )}
                          {notification.starred && (
                            <span className="text-yellow-400" aria-label="Starred">&#11088;</span>
                          )}
                          <p className="text-white font-medium text-sm truncate">{notification.title}</p>
                        </div>
                        <p className="text-gray-400 text-xs truncate">{sanitizeMessage(notification.message)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(notification.priority)}`}>
                            {(PRIORITY_LABELS[notification.priority] || notification.priority).toUpperCase()}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Notification Detail */}
          <div className="lg:col-span-2">
            {selectedNotification ? (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-4xl">{getTypeIcon(selectedNotification.notification_type)}</span>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold mb-2 font-poppins">{selectedNotification.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>From: {selectedNotification.sent_by_name || 'System'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDateTime(selectedNotification.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedNotification.is_read ? (
                      <button
                        onClick={() => markAsUnread(selectedNotification.recipient_id)}
                        className="p-2 hover:bg-orange-500/10 rounded-lg transition-colors"
                        aria-label="Mark as unread"
                        title="Mark as unread"
                      >
                        <Mail className="w-5 h-5 text-gray-400" />
                      </button>
                    ) : (
                      <button
                        onClick={() => markAsRead(selectedNotification.recipient_id)}
                        className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        <MailOpen className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleStar(selectedNotification.recipient_id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      aria-label={selectedNotification.starred ? 'Remove star' : 'Add star'}
                      title={selectedNotification.starred ? 'Unstar' : 'Star'}
                    >
                      <span className="text-xl">{selectedNotification.starred ? '\u2B50' : '\u2606'}</span>
                    </button>
                    <button
                      onClick={() => archiveNotification(selectedNotification.recipient_id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      aria-label="Archive notification"
                      title="Archive"
                    >
                      <Archive className="w-5 h-5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteNotification(selectedNotification.recipient_id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      aria-label="Delete notification"
                      title="Archive and remove from view"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {sanitizeMessage(selectedNotification.message)}
                  </p>
                </div>

                {selectedNotification.action_url && (
                  <div className="border-t border-white/10 pt-4">
                    <a
                      href={selectedNotification.action_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                      {selectedNotification.action_label || 'View Details'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* ENH-N2: Inline Approval Actions for Payout Notifications */}
                {isAccountsRole && ['payout_processed', 'claim_approved', 'claim_rejected', 'incentive_assigned'].includes(selectedNotification.notification_type) && (
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-sm text-gray-500 mb-3">Quick Actions</p>
                    <div className="flex items-center gap-3">
                      {selectedNotification.action_url && (
                        <button
                          onClick={() => router.push(selectedNotification.action_url!)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <CheckSquare className="w-4 h-4" />
                          Review & Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (selectedNotification.action_url) {
                            router.push(selectedNotification.action_url)
                          }
                        }}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Full Details
                      </button>
                    </div>
                  </div>
                )}

                {/* ENH-N5: Compliance Acknowledgement for Security/System Notifications */}
                {['security', 'system', 'compliance'].includes(selectedNotification.notification_type) && selectedNotification.priority === 'urgent' && (
                  <div className="border-t border-white/10 pt-4">
                    <div className={`${CARD_COLORS.warning?.bg || 'bg-yellow-500/10'} border ${CARD_COLORS.warning?.border || 'border-yellow-500/30'} rounded-lg p-4`}>
                      <p className="text-yellow-400 text-sm font-medium mb-2">Compliance Notice</p>
                      <p className="text-gray-400 text-xs mb-3">This notification requires acknowledgement for audit compliance.</p>
                      <button
                        onClick={() => {
                          markAsRead(selectedNotification.recipient_id)
                          // Could extend to call a dedicated acknowledge API
                        }}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Acknowledge & Confirm
                      </button>
                    </div>
                  </div>
                )}

                {/* ENH-N7: SLA Indicator for Time-Sensitive Notifications */}
                {selectedNotification.notification_type === 'payout_processed' && (
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-orange-400" />
                      <span className="text-gray-400">
                        Received: {formatDateTime(selectedNotification.created_at)}
                      </span>
                      {(() => {
                        const createdAt = new Date(selectedNotification.created_at)
                        const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
                        const slaHours = 48
                        const remaining = Math.max(0, slaHours - hoursElapsed)
                        const isOverdue = remaining === 0
                        return (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isOverdue ? 'bg-red-500/20 text-red-400' :
                            remaining < 12 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {isOverdue ? 'SLA Overdue' : `${Math.round(remaining)}h remaining`}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-12 text-center h-full flex items-center justify-center min-h-[500px]">
                <div>
                  <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a notification to view details</p>
                  <p className="text-gray-500 text-sm mt-2">Click on any notification from the list</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            {/* Results Info */}
            <div className="flex items-center gap-4">
              <p className="text-gray-400 text-sm">
                Showing <span className="text-white font-medium">{startIndex}</span> to{' '}
                <span className="text-white font-medium">{endIndex}</span> of{' '}
                <span className="text-white font-medium">{totalCount.toLocaleString()}</span> notifications
              </p>

              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <label htmlFor="page-size-select" className="text-gray-400 text-sm">Per page:</label>
                <select
                  id="page-size-select"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-black/50 text-white text-sm px-2 py-1 rounded border border-white/10 focus:border-orange-500 focus:outline-none"
                  aria-label="Notifications per page"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="First page"
              >
                First
              </button>

              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (page === 1 || page === totalPages) return true
                    if (Math.abs(page - currentPage) <= 1) return true
                    return false
                  })
                  .map((page, index, arr) => {
                    const showEllipsisBefore = index > 0 && page - arr[index - 1] > 1

                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsisBefore && (
                          <span className="text-gray-500 px-2">...</span>
                        )}
                        <button
                          onClick={() => goToPage(page)}
                          aria-label={`Page ${page}`}
                          aria-current={currentPage === page ? 'page' : undefined}
                          className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-orange-500 text-white'
                              : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    )
                  })}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="Last page"
              >
                Last
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  fetchNotifications()
                  fetchNotificationCounts()
                }}
                disabled={loading}
                className="ml-2 p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50"
                aria-label="Refresh notifications"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
