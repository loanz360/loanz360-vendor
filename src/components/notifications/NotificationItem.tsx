'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import {
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Upload,
  Bell,
  Award,
  Trophy,
} from 'lucide-react'

export interface Notification {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  message: string
  is_read: boolean
  created_at: string
  action_url?: string
  action_label?: string
  data?: Record<string, unknown>
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead?: (id: string) => void
  onArchive?: (id: string) => void
  compact?: boolean
}

const notificationIcons: Record<string, React.ElementType> = {
  incentive_assigned: Target,
  target_updated: TrendingUp,
  progress_milestone: Trophy,
  incentive_achieved: Award,
  incentive_expiring: AlertCircle,
  incentive_expired: XCircle,
  claim_approved: CheckCircle,
  claim_rejected: XCircle,
  claim_pending_review: AlertCircle,
  payout_processed: DollarSign,
  bulk_upload_completed: Upload,
  bulk_upload_failed: AlertCircle,
  system_announcement: Bell,
  performance_alert: TrendingUp,
  leaderboard_update: Trophy,
}

const priorityColors = {
  low: 'text-gray-400',
  medium: 'text-blue-400',
  high: 'text-yellow-400',
  urgent: 'text-red-400',
}

const priorityBgColors = {
  low: 'bg-gray-500/20',
  medium: 'bg-blue-500/20',
  high: 'bg-yellow-500/20',
  urgent: 'bg-red-500/20',
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onArchive,
  compact = false,
}: NotificationItemProps) {
  const Icon = notificationIcons[notification.type] || Bell
  const priorityColor = priorityColors[notification.priority]
  const priorityBgColor = priorityBgColors[notification.priority]

  const content = (
    <div
      className={`
        ${compact ? 'p-3' : 'p-4'}
        ${notification.is_read ? 'bg-gray-900/30' : 'bg-gray-800/50'}
        ${priorityBgColor}
        border border-gray-700/50 rounded-lg
        hover:bg-gray-800/70 transition-colors cursor-pointer
        group
      `}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${priorityColor}`}>
          <Icon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h4 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-white font-poppins`}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
            )}
          </div>

          {/* Message */}
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-300 mt-1 line-clamp-2`}>
            {notification.message}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.is_read && onMarkAsRead && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onMarkAsRead(notification.id)
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Mark read
                </button>
              )}
              {onArchive && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onArchive(notification.id)
                  }}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // If there's an action URL, wrap in Link
  if (notification.action_url) {
    return (
      <Link href={notification.action_url} className="block">
        {content}
      </Link>
    )
  }

  return content
}
