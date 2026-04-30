/**
 * Activity Card Component
 *
 * Displays individual activity log entries with severity indicators, color coding, and detailed information
 */

'use client'

import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  User,
  Shield,
  Users,
  UserCheck,
  Store,
  Building,
  Clock,
  MapPin,
  Monitor,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

export interface Activity {
  id: string
  activity_type: string
  severity_level: 'critical' | 'high' | 'medium' | 'low'
  user_type: string
  user_full_name?: string
  user_email?: string
  user_role?: string
  action_performed: string
  entity_type?: string
  entity_id?: string
  entity_name?: string
  description: string
  changes_json?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }
  ip_address?: string
  location?: string
  created_at: string
  status: 'active' | 'acknowledged' | 'resolved'
  time_ago: string
}

interface ActivityCardProps {
  activity: Activity
  onStatusChange?: (activityId: string, newStatus: 'active' | 'acknowledged' | 'resolved') => void
  showStatusActions?: boolean
}

export function ActivityCard({ activity, onStatusChange, showStatusActions = true }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  // Severity configuration
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      label: 'CRITICAL'
    },
    high: {
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      label: 'HIGH'
    },
    medium: {
      icon: Info,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      label: 'MEDIUM'
    },
    low: {
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      label: 'LOW'
    }
  }

  // User type icons
  const userTypeIcons: Record<string, unknown> = {
    superadmin: Shield,
    admin: Shield,
    employee: Users,
    partner: UserCheck,
    customer: User,
    vendor: Store,
    system: Building
  }

  const config = severityConfig[activity.severity_level]
  const SeverityIcon = config.icon
  const UserTypeIcon = userTypeIcons[activity.user_type] || User

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} backdrop-blur-sm overflow-hidden transition-all duration-200 hover:shadow-lg`}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Severity Indicator */}
          <div className="flex items-start gap-3 flex-1">
            <div className={`mt-1 p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
              <SeverityIcon className={`w-5 h-5 ${config.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Activity Title */}
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-white truncate">
                  {activity.description}
                </h3>
                <span className={`text-xs font-bold ${config.color} px-2 py-0.5 rounded-full bg-black/30`}>
                  {config.label}
                </span>
              </div>

              {/* User Information */}
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <UserTypeIcon className="w-4 h-4" />
                <span className="font-medium text-gray-300">
                  {activity.user_full_name || activity.user_email || 'Unknown User'}
                </span>
                <span className="text-gray-500">•</span>
                <span className="capitalize">{activity.user_type}</span>
                {activity.user_role && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="uppercase text-xs">{activity.user_role}</span>
                  </>
                )}
              </div>

              {/* Entity Information (if available) */}
              {activity.entity_type && (
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="capitalize">{activity.entity_type}:</span>
                  <span className="text-gray-300 font-medium">{activity.entity_name || activity.entity_id}</span>
                </div>
              )}

              {/* Timestamp and Location */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{activity.time_ago}</span>
                </div>
                {activity.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{activity.location}</span>
                  </div>
                )}
                {activity.ip_address && (
                  <div className="flex items-center gap-1">
                    <Monitor className="w-3 h-3" />
                    <span>{activity.ip_address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            activity.status === 'resolved'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : activity.status === 'acknowledged'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {activity.status.toUpperCase()}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        {(activity.changes_json || showStatusActions) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Show More Details</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-white/10 bg-black/20 p-4">
          {/* Changes Information */}
          {activity.changes_json && (activity.changes_json.before || activity.changes_json.after) && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-white mb-2">Changes Made:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activity.changes_json.before && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-red-400 mb-2">Before:</p>
                    <pre className="text-xs text-gray-300 overflow-auto max-h-40">
                      {JSON.stringify(activity.changes_json.before, null, 2)}
                    </pre>
                  </div>
                )}
                {activity.changes_json.after && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-400 mb-2">After:</p>
                    <pre className="text-xs text-gray-300 overflow-auto max-h-40">
                      {JSON.stringify(activity.changes_json.after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Type and Timestamp */}
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Action Type:</span>
              <span className="ml-2 text-gray-300 font-medium capitalize">
                {activity.activity_type.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Performed:</span>
              <span className="ml-2 text-gray-300 font-medium capitalize">
                {activity.action_performed}
              </span>
            </div>
          </div>

          {/* Status Actions (for Super Admin) */}
          {showStatusActions && onStatusChange && activity.status !== 'resolved' && (
            <div className="flex gap-2 pt-3 border-t border-white/10">
              {activity.status === 'active' && (
                <button
                  onClick={() => onStatusChange(activity.id, 'acknowledged')}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors"
                >
                  Mark as Acknowledged
                </button>
              )}
              {(activity.status === 'active' || activity.status === 'acknowledged') && (
                <button
                  onClick={() => onStatusChange(activity.id, 'resolved')}
                  className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors"
                >
                  Mark as Resolved
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
