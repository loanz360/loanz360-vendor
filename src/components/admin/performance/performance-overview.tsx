'use client'

/**
 * Performance Overview Component
 * Displays current performance metrics and scores
 */

import { useState, useEffect } from 'react'
import {
  type PerformanceProfile,
  getScoreColor,
  getScoreBadgeColor,
  getScoreLabel,
  getPercentileBadge,
  getConsistencyLabel,
  getConsistencyColor,
} from '@/lib/performance/performance-analytics'

interface PerformanceOverviewProps {
  adminId: string
  period?: string
}

export default function PerformanceOverview({
  adminId,
  period = '30d',
}: PerformanceOverviewProps) {
  const [profile, setProfile] = useState<PerformanceProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [adminId, period])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/admin-management/performance/profile?adminId=${adminId}&period=${period}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch profile')
      }

      setProfile(data.profile)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 h-40 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
        {error || 'No data available'}
      </div>
    )
  }

  const { currentMetrics, comparison, ranking, performance } = profile

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Productivity Score</h3>
            <p className="text-sm text-gray-600">Current performance rating</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getScoreBadgeColor(
              currentMetrics.productivityScore
            )}`}
          >
            {getScoreLabel(currentMetrics.productivityScore)}
          </span>
        </div>

        <div className="flex items-end gap-4 mb-4">
          <div className={`text-5xl font-bold ${getScoreColor(currentMetrics.productivityScore)}`}>
            {Math.round(currentMetrics.productivityScore)}
          </div>
          <div className="text-sm text-gray-600 mb-2">/ 100</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <MetricItem
            label="vs Team Average"
            value={comparison.productivityVsTeam}
            suffix="pts"
            showTrend
          />
          <MetricItem label="Ranking" value={`#${ranking.currentRank}`} suffix="" />
          <MetricItem
            label="Percentile"
            value={getPercentileBadge(ranking.percentile)}
            suffix=""
          />
          <MetricItem
            label="Consistency"
            value={getConsistencyLabel(performance.consistency)}
            suffix=""
            valueColor={getConsistencyColor(performance.consistency)}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Quality Score"
          value={currentMetrics.qualityScore}
          comparison={comparison.qualityVsTeam}
          unit="pts"
        />
        <MetricCard
          title="Completion Rate"
          value={currentMetrics.completionRate}
          comparison={comparison.completionVsTeam}
          unit="%"
        />
        <MetricCard
          title="Active Hours"
          value={currentMetrics.activeHours}
          unit="hrs"
          subtitle={`${currentMetrics.totalActions} total actions`}
        />
      </div>

      {/* Performance Range */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Range</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Worst Day</span>
              <span className="font-medium">{performance.worstDayScore}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                style={{ width: `${performance.bestDayScore}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-gray-800"
                style={{ left: `${performance.worstDayScore}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-gray-800"
                style={{ left: `${performance.bestDayScore}%` }}
              />
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">Best Day</span>
              <span className="font-medium">{performance.bestDayScore}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MetricItemProps {
  label: string
  value: string | number
  suffix: string
  showTrend?: boolean
  valueColor?: string
}

function MetricItem({ label, value, suffix, showTrend = false, valueColor }: MetricItemProps) {
  const numValue = typeof value === 'number' ? value : 0
  const displayValue = typeof value === 'string' ? value : `${numValue}${suffix}`

  return (
    <div>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${valueColor || ''}`}>
        {showTrend && typeof value === 'number' && (
          <span className={numValue >= 0 ? 'text-green-600' : 'text-red-600'}>
            {numValue >= 0 ? '+' : ''}
          </span>
        )}
        {displayValue}
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: number
  comparison?: number
  unit: string
  subtitle?: string
}

function MetricCard({ title, value, comparison, unit, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {value.toFixed(1)}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </div>
      {comparison !== undefined && (
        <div
          className={`text-sm ${
            comparison >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {comparison >= 0 ? '+' : ''}
          {comparison.toFixed(1)} vs team
        </div>
      )}
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}
