'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  Filter,
  RefreshCw,
} from 'lucide-react'

interface Alert {
  id: string
  type: string
  typeLabel: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  severityLabel: string
  severityColor: string
  message: string
  leadId: string
  leadCustomerName: string
  bdeId: string
  bdeName: string
  bdeAvatar: string | null
  createdAt: string
  createdAtFormatted: string
  isRead: boolean
  isResolved: boolean
}

interface AlertsSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AlertsSidebar({ isOpen, onClose }: AlertsSidebarProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'>('ACTIVE')
  const queryClient = useQueryClient()

  // Fetch alerts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bdm-alerts', severityFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (severityFilter) params.append('severity', severityFilter)
      params.append('status', statusFilter)
      params.append('limit', '50')

      const res = await fetch(`/api/bdm/team-pipeline/analytics/alerts?${params}`)
      if (!res.ok) throw new Error('Failed to fetch alerts')
      return res.json()
    },
    enabled: isOpen,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Mark alert as read
  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch('/api/bdm/team-pipeline/analytics/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'mark_read' }),
      })
      if (!res.ok) throw new Error('Failed to mark alert as read')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdm-alerts'] })
    },
  })

  // Mark alert as resolved
  const markAsResolvedMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch('/api/bdm/team-pipeline/analytics/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'mark_resolved' }),
      })
      if (!res.ok) throw new Error('Failed to mark alert as resolved')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdm-alerts'] })
    },
  })

  const alerts: Alert[] = data?.data?.alerts || []
  const summary = data?.data?.summary || {}

  const getSeverityIcon = (severity: string) => {
    const icons = {
      critical: <AlertTriangle className="w-5 h-5" />,
      high: <AlertCircle className="w-5 h-5" />,
      medium: <Info className="w-5 h-5" />,
      low: <Info className="w-5 h-5" />,
    }
    return icons[severity as keyof typeof icons] || <Info className="w-5 h-5" />
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Alerts</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.critical || 0}</p>
              <p className="text-xs opacity-90">Critical</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.high || 0}</p>
              <p className="text-xs opacity-90">High</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.medium || 0}</p>
              <p className="text-xs opacity-90">Medium</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.low || 0}</p>
              <p className="text-xs opacity-90">Low</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                statusFilter === 'ACTIVE'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('ACKNOWLEDGED')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                statusFilter === 'ACKNOWLEDGED'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Read
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                statusFilter === 'RESOLVED'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Resolved
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSeverityFilter('')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                !severityFilter
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSeverityFilter('critical')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                severityFilter === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setSeverityFilter('high')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                severityFilter === 'high'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              High
            </button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-100 rounded-lg h-24 animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <CheckCircle className="w-16 h-16 mb-4 text-green-500" />
              <p className="text-lg font-medium">No alerts</p>
              <p className="text-sm">Everything is running smoothly!</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`bg-white border-l-4 rounded-lg shadow-sm p-4 transition-all hover:shadow-md ${
                    alert.isRead ? 'opacity-60' : ''
                  }`}
                  style={{ borderLeftColor: alert.severityColor }}
                >
                  {/* Alert Header */}
                  <div className="flex items-start gap-3 mb-2">
                    <div style={{ color: alert.severityColor }}>
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-semibold uppercase px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${alert.severityColor}20`,
                            color: alert.severityColor,
                          }}
                        >
                          {alert.severityLabel}
                        </span>
                        <span className="text-xs text-gray-500">
                          {alert.typeLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  {/* Alert Details */}
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
                    <span>Lead: <span className="font-medium">{alert.leadCustomerName}</span></span>
                    <span>•</span>
                    <span>BDE: <span className="font-medium">{alert.bdeName}</span></span>
                  </div>

                  <div className="text-xs text-gray-500 mb-3">
                    {alert.createdAtFormatted}
                  </div>

                  {/* Actions */}
                  {!alert.isResolved && (
                    <div className="flex gap-2">
                      {!alert.isRead && (
                        <button
                          onClick={() => markAsReadMutation.mutate(alert.id)}
                          disabled={markAsReadMutation.isPending}
                          className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          Mark as Read
                        </button>
                      )}
                      <button
                        onClick={() => markAsResolvedMutation.mutate(alert.id)}
                        disabled={markAsResolvedMutation.isPending}
                        className="flex-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    </div>
                  )}

                  {alert.isResolved && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      <span>Resolved</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Alert badge for navbar
export function AlertsBadge({ onClick }: { onClick: () => void }) {
  const { data } = useQuery({
    queryKey: ['bdm-alerts-count'],
    queryFn: async () => {
      const res = await fetch('/api/bdm/team-pipeline/analytics/alerts?status=ACTIVE&limit=1')
      if (!res.ok) throw new Error('Failed to fetch alerts')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const unreadCount = data?.data?.summary?.critical || 0

  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <AlertTriangle className="w-6 h-6 text-gray-700" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
