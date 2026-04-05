'use client'

/**
 * Admin Activity Dashboard Component
 * Complete dashboard with stats, charts, and activity feed
 */

import { useState, useEffect, useCallback } from 'react'
import type { DashboardStats, LoginTrend } from '@/lib/analytics/admin-analytics'
import LoginTrendChart from './charts/login-trend-chart'
import RoleDistributionChart from './charts/role-distribution-chart'
import ActivityTypeChart from './charts/activity-type-chart'
import ActivityFeed from './activity-feed'

type TimeRange = '24h' | '7d' | '30d' | '90d'

export default function AdminActivityDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trends, setTrends] = useState<LoginTrend[]>([])
  const [healthScore, setHealthScore] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin-management/analytics?timeRange=${timeRange}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch dashboard data')
      }

      setStats(data.stats)
      setTrends(data.trends || [])
      setHealthScore(data.healthScore || 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchDashboardData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/admin-management/analytics?timeRange=${timeRange}`)
      const data = await response.json()

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `admin-analytics-${timeRange}-${new Date().toISOString()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 h-32 rounded-lg" />
            ))}
          </div>
          <div className="bg-gray-100 h-96 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-600">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Dashboard</h2>
          <p className="text-gray-600">Monitor admin activity and system health</p>
        </div>
        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Export
          </button>
        </div>
      </div>

      {/* Health Score */}
      {healthScore > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">System Health Score</h3>
            <span className={`text-3xl font-bold ${
              healthScore >= 80 ? 'text-green-600' :
              healthScore >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {healthScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                healthScore >= 80 ? 'bg-green-600' :
                healthScore >= 60 ? 'bg-yellow-600' :
                'bg-red-600'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Admins"
              value={stats.adminStats.total}
              subtitle={`${stats.adminStats.active} active`}
              color="blue"
            />
            <StatCard
              title="Total Actions"
              value={stats.activityStats.totalActions}
              subtitle={`${stats.activityStats.uniqueAdmins} unique admins`}
              color="green"
            />
            <StatCard
              title="Failed Logins (24h)"
              value={stats.securityStats.failedLogins24h}
              subtitle={`${stats.securityStats.lockedAccounts} locked accounts`}
              color="red"
            />
            <StatCard
              title="Active Sessions"
              value={stats.sessionStats.activeSessions}
              subtitle={`${stats.sessionStats.uniqueAdmins} unique admins`}
              color="purple"
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Login Trends</h3>
              <LoginTrendChart data={trends} />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Role Distribution</h3>
              <RoleDistributionChart data={stats.roleDistribution} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Activity by Type</h3>
            <ActivityTypeChart data={stats.activityStats.byType} />
          </div>
        </>
      )}

      {/* Activity Feed */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
        <ActivityFeed limit={20} autoRefresh={true} refreshInterval={30000} />
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  subtitle: string
  color: 'blue' | 'green' | 'red' | 'purple'
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className={`${colorClasses[color]} border border-current border-opacity-20 rounded-lg p-6`}>
      <div className="text-sm font-medium opacity-80 mb-1">{title}</div>
      <div className="text-3xl font-bold mb-1">{value.toLocaleString()}</div>
      <div className="text-sm opacity-70">{subtitle}</div>
    </div>
  )
}
