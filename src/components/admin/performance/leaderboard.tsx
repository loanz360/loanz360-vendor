'use client'

/**
 * Performance Leaderboard Component
 * Shows top performers ranked by selected metric
 */

import { useState, useEffect } from 'react'
import {
  type LeaderboardEntry,
  type MetricType,
  type PeriodType,
  METRIC_TYPES,
  getMetricDisplayName,
  formatMetricValue,
  getTrendIcon,
  getTrendColor,
} from '@/lib/performance/performance-analytics'

interface LeaderboardProps {
  limit?: number
  defaultMetric?: MetricType
  defaultPeriod?: PeriodType
  highlightAdminId?: string
}

export default function Leaderboard({
  limit = 10,
  defaultMetric = 'productivity_score',
  defaultPeriod = '7d',
  highlightAdminId,
}: LeaderboardProps) {
  const [metric, setMetric] = useState<MetricType>(defaultMetric)
  const [period, setPeriod] = useState<PeriodType>(defaultPeriod)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard()
  }, [metric, period, limit])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/admin-management/performance/leaderboard?metric=${metric}&period=${period}&limit=${limit}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch leaderboard')
      }

      setLeaderboard(data.leaderboard || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Top Performers</h3>
        <div className="flex gap-2">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {Object.entries(METRIC_TYPES).map(([key, value]) => (
              <option key={value} value={value}>
                {getMetricDisplayName(value)}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="24h">Today</option>
            <option value="7d">This Week</option>
            <option value="30d">This Month</option>
            <option value="90d">This Quarter</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 h-16 rounded-lg" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && leaderboard.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No data available for this period
        </div>
      )}

      {!loading && !error && leaderboard.length > 0 && (
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <LeaderboardRow
              key={entry.admin_id}
              entry={entry}
              metric={metric}
              isHighlighted={entry.admin_id === highlightAdminId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  metric: MetricType
  isHighlighted?: boolean
}

function LeaderboardRow({ entry, metric, isHighlighted = false }: LeaderboardRowProps) {
  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-300'
    if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-300'
    return 'bg-white text-gray-600 border-gray-200'
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return ''
  }

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border ${
        isHighlighted
          ? 'bg-blue-50 border-blue-300'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      } transition-colors`}
    >
      {/* Rank */}
      <div
        className={`w-12 h-12 flex items-center justify-center rounded-full border font-semibold ${getRankBadgeColor(
          entry.rank
        )}`}
      >
        {getRankIcon(entry.rank) || entry.rank}
      </div>

      {/* Admin Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{entry.admin_name}</div>
        <div className="text-sm text-gray-600 truncate">{entry.admin_email}</div>
      </div>

      {/* Score */}
      <div className="text-right">
        <div className="text-lg font-bold text-gray-900">
          {formatMetricValue(metric, entry.score)}
        </div>
        {entry.change_percent !== 0 && (
          <div className={`text-sm ${getTrendColor(entry.trend)}`}>
            {getTrendIcon(entry.trend)}{' '}
            {Math.abs(entry.change_percent).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}
