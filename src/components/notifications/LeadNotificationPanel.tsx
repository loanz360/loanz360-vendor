'use client'

/**
 * Lead Notification Panel
 *
 * A specialized notification panel for lead-related events
 * Shows real-time updates for lead status changes, assignments, etc.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  FileText,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface LeadNotification {
  id: string
  lead_id: string
  lead_number: string
  notification_type: string
  customer_name: string
  customer_mobile: string
  customer_email?: string
  partner_id?: string
  employee_id?: string
  bde_id?: string
  channels_attempted: string[]
  channels_succeeded: string[]
  result: {
    success: boolean
    channels: {
      email?: { sent: boolean; error?: string }
      sms?: { sent: boolean; error?: string }
      in_app?: { sent: boolean; error?: string }
      whatsapp?: { sent: boolean; error?: string }
    }
  }
  created_at: string
}

interface LeadNotificationPanelProps {
  userId?: string
  userType?: 'partner' | 'employee' | 'customer' | 'admin'
  maxItems?: number
  showFilters?: boolean
  onNotificationClick?: (notification: LeadNotification) => void
}

const NOTIFICATION_TYPE_CONFIG: Record<string, {
  icon: React.ElementType
  color: string
  bgColor: string
  label: string
}> = {
  LEAD_CREATED: {
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'Lead Created'
  },
  LEAD_ASSIGNED: {
    icon: UserCheck,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'Lead Assigned'
  },
  LEAD_STATUS_CHANGED: {
    icon: TrendingUp,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    label: 'Status Updated'
  },
  LEAD_CONTACTED: {
    icon: Bell,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    label: 'Customer Contacted'
  },
  DOCUMENTS_REQUESTED: {
    icon: FileText,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    label: 'Documents Requested'
  },
  DOCUMENTS_RECEIVED: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'Documents Received'
  },
  CAM_GENERATED: {
    icon: FileText,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    label: 'CAM Generated'
  },
  LEAD_APPROVED: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Lead Approved'
  },
  LEAD_REJECTED: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    label: 'Lead Rejected'
  },
  LEAD_DISBURSED: {
    icon: TrendingUp,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'Loan Disbursed'
  },
  FOLLOW_UP_REMINDER: {
    icon: Clock,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    label: 'Follow-up Reminder'
  },
  LEAD_ESCALATED: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    label: 'Lead Escalated'
  },
  REFERRAL_BONUS: {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Referral Bonus'
  }
}

export default function LeadNotificationPanel({
  userId,
  userType = 'admin',
  maxItems = 10,
  showFilters = true,
  onNotificationClick
}: LeadNotificationPanelProps) {
  const [notifications, setNotifications] = useState<LeadNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchNotifications()
    setupRealtimeSubscription()
  }, [userId, filter])

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('lead_notification_logs')
        .select('id, lead_id, lead_number, customer_name, notification_type, message, status, partner_id, employee_id, bde_id, created_at')
        .order('created_at', { ascending: false })
        .limit(maxItems)

      // Apply user-specific filter
      if (userId && userType === 'partner') {
        query = query.eq('partner_id', userId)
      } else if (userId && userType === 'employee') {
        query = query.or(`employee_id.eq.${userId},bde_id.eq.${userId}`)
      }

      // Apply notification type filter
      if (filter !== 'all') {
        query = query.eq('notification_type', filter)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching lead notifications:', err)
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const supabase = createClient()

    const channel = supabase
      .channel(`lead-notifications-${userId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead_notification_logs'
        },
        (payload) => {
          const newNotification = payload.new as LeadNotification

          // Filter by user if userId provided
          if (userId) {
            if (userType === 'partner' && newNotification.partner_id !== userId) return
            if (userType === 'employee' &&
                newNotification.employee_id !== userId &&
                newNotification.bde_id !== userId) return
          }

          // Filter by notification type if filter is set
          if (filter !== 'all' && newNotification.notification_type !== filter) return

          // Add new notification to the top
          setNotifications(prev => [newNotification, ...prev.slice(0, maxItems - 1)])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchNotifications()
    setIsRefreshing(false)
  }

  const getNotificationConfig = (type: string) => {
    return NOTIFICATION_TYPE_CONFIG[type] || {
      icon: Bell,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      label: type
    }
  }

  const getChannelStatus = (notification: LeadNotification) => {
    const channels = notification.result?.channels || {}
    const statuses: { channel: string; success: boolean }[] = []

    if (channels.sms) {
      statuses.push({ channel: 'SMS', success: channels.sms.sent })
    }
    if (channels.email) {
      statuses.push({ channel: 'Email', success: channels.email.sent })
    }
    if (channels.in_app) {
      statuses.push({ channel: 'In-App', success: channels.in_app.sent })
    }
    if (channels.whatsapp) {
      statuses.push({ channel: 'WhatsApp', success: channels.whatsapp.sent })
    }

    return statuses
  }

  if (loading && notifications.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-center py-8 text-red-400">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Lead Notifications</h3>
            <p className="text-xs text-gray-400">{notifications.length} recent notifications</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showFilters && (
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white pr-8 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="all">All Types</option>
                <option value="LEAD_CREATED">Created</option>
                <option value="LEAD_ASSIGNED">Assigned</option>
                <option value="LEAD_STATUS_CHANGED">Status Changed</option>
                <option value="LEAD_APPROVED">Approved</option>
                <option value="LEAD_DISBURSED">Disbursed</option>
                <option value="LEAD_REJECTED">Rejected</option>
                <option value="FOLLOW_UP_REMINDER">Reminders</option>
              </select>
              <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[500px] overflow-y-auto">
        <AnimatePresence>
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No notifications yet</p>
              <p className="text-gray-500 text-sm mt-1">Lead notifications will appear here</p>
            </div>
          ) : (
            notifications.map((notification, index) => {
              const config = getNotificationConfig(notification.notification_type)
              const IconComponent = config.icon
              const channelStatuses = getChannelStatus(notification)

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onNotificationClick?.(notification)}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <p className="text-white font-medium text-sm mb-1 truncate">
                          {notification.customer_name}
                        </p>
                        <p className="text-gray-400 text-xs mb-2">
                          Lead #{notification.lead_number}
                        </p>

                        {/* Channel Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {channelStatuses.map((status, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                status.success
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {status.channel}: {status.success ? 'Sent' : 'Failed'}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-white/10">
          <Link
            href="/notifications"
            className="flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium py-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            View all notifications
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
