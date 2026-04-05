'use client'

/**
 * Activity Feed Component
 * Real-time activity log with filtering
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type Activity,
  formatTimeAgo,
  getSeverityColor,
  getActionIcon,
} from '@/lib/analytics/admin-analytics'

interface ActivityFeedProps {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  adminId?: string
  actionType?: string
  severity?: string
}

export default function ActivityFeed({
  limit = 50,
  autoRefresh = true,
  refreshInterval = 30000,
  adminId,
  actionType,
  severity,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: '0',
      })

      if (adminId) params.append('adminId', adminId)
      if (actionType) params.append('actionType', actionType)
      if (severity) params.append('severity', severity)

      const response = await fetch(`/api/admin-management/activity-feed?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch activities')
      }

      setActivities(data.activities || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activities')
    } finally {
      setLoading(false)
    }
  }, [limit, adminId, actionType, severity])

  useEffect(() => {
    fetchActivities()

    if (autoRefresh) {
      const interval = setInterval(fetchActivities, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchActivities, autoRefresh, refreshInterval])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 h-20 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
        {error}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        No activities found
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  const severityColor = getSeverityColor(activity.severity)
  const icon = getActionIcon(activity.action_type)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">
              {activity.admin_name || 'System'}
            </span>
            <span className={`text-sm ${severityColor}`}>
              {activity.action_type.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {activity.admin_email && (
              <span className="mr-3">{activity.admin_email}</span>
            )}
            {activity.ip_address && (
              <span className="text-gray-400">IP: {activity.ip_address}</span>
            )}
          </div>
          {activity.details && Object.keys(activity.details).length > 0 && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded p-2 mt-2">
              {JSON.stringify(activity.details, null, 2)}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {formatTimeAgo(activity.created_at)}
        </div>
      </div>
    </div>
  )
}
