/**
 * Performance Analytics Library
 * Types and utilities for admin performance tracking
 */

import { z } from 'zod'

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

export const performanceMetricsSchema = z.object({
  id: z.string().uuid().optional(),
  admin_id: z.string().uuid(),
  metric_date: z.string(),

  // Response metrics
  avg_response_time_minutes: z.number().default(0),
  first_response_time_minutes: z.number().default(0),

  // Completion metrics
  tasks_assigned: z.number().default(0),
  tasks_completed: z.number().default(0),
  tasks_pending: z.number().default(0),
  completion_rate: z.number().default(0),

  // Activity metrics
  total_actions: z.number().default(0),
  login_count: z.number().default(0),
  active_hours: z.number().default(0),

  // Quality metrics
  error_count: z.number().default(0),
  rework_count: z.number().default(0),
  quality_score: z.number().default(100),

  // Overall score
  productivity_score: z.number().default(0),

  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>

export const performanceTrendSchema = z.object({
  date: z.string(),
  value: z.number(),
  team_average: z.number(),
})

export type PerformanceTrend = z.infer<typeof performanceTrendSchema>

export const leaderboardEntrySchema = z.object({
  rank: z.number(),
  admin_id: z.string().uuid(),
  admin_name: z.string(),
  admin_email: z.string(),
  score: z.number(),
  trend: z.enum(['up', 'down', 'stable']),
  change_percent: z.number(),
})

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>

export interface TeamSummary {
  averageProductivityScore: number
  averageCompletionRate: number
  averageQualityScore: number
  averageActiveHours: number
  totalActions: number
  activeAdmins: number
  topPerformerScore: number
  lowPerformerScore: number
  scoreDistribution: {
    excellent: number // >= 80
    good: number // 60-79
    average: number // 40-59
    poor: number // < 40
  }
}

export interface PerformanceProfile {
  currentMetrics: {
    productivityScore: number
    completionRate: number
    qualityScore: number
    activeHours: number
    totalActions: number
  }
  comparison: {
    productivityVsTeam: number
    completionVsTeam: number
    qualityVsTeam: number
  }
  ranking: {
    currentRank: number
    totalAdmins: number
    percentile: number
  }
  performance: {
    bestDayScore: number
    worstDayScore: number
    consistency: 'high' | 'medium' | 'low'
  }
}

// ============================================================================
// METRIC TYPES
// ============================================================================

export const METRIC_TYPES = {
  PRODUCTIVITY: 'productivity_score',
  COMPLETION: 'completion_rate',
  QUALITY: 'quality_score',
  RESPONSE_TIME: 'response_time',
  ACTIVITY: 'activity_volume',
  ACTIVE_HOURS: 'active_hours',
} as const

export type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES]

export const PERIOD_TYPES = {
  DAY: '24h',
  WEEK: '7d',
  MONTH: '30d',
  QUARTER: '90d',
} as const

export type PeriodType = (typeof PERIOD_TYPES)[keyof typeof PERIOD_TYPES]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get metric display name
 */
export function getMetricDisplayName(metric: MetricType): string {
  const names: Record<string, string> = {
    productivity_score: 'Productivity Score',
    completion_rate: 'Completion Rate',
    quality_score: 'Quality Score',
    response_time: 'Response Time',
    activity_volume: 'Activity Volume',
    active_hours: 'Active Hours',
  }
  return names[metric] || metric
}

/**
 * Get metric unit
 */
export function getMetricUnit(metric: MetricType): string {
  const units: Record<string, string> = {
    productivity_score: 'pts',
    completion_rate: '%',
    quality_score: 'pts',
    response_time: 'min',
    activity_volume: 'actions',
    active_hours: 'hrs',
  }
  return units[metric] || ''
}

/**
 * Format metric value with unit
 */
export function formatMetricValue(metric: MetricType, value: number): string {
  const unit = getMetricUnit(metric)

  if (metric === 'completion_rate') {
    return `${value.toFixed(1)}%`
  }

  if (metric === 'response_time') {
    if (value < 60) {
      return `${Math.round(value)} min`
    }
    return `${(value / 60).toFixed(1)} hrs`
  }

  if (metric === 'active_hours') {
    return `${value.toFixed(1)} hrs`
  }

  return `${Math.round(value)} ${unit}`
}

/**
 * Get score color class based on value
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

/**
 * Get score badge color
 */
export function getScoreBadgeColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 border-green-300'
  if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-300'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  return 'bg-red-100 text-red-800 border-red-300'
}

/**
 * Get score label
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Average'
  return 'Needs Improvement'
}

/**
 * Get trend icon
 */
export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  const icons = {
    up: '↑',
    down: '↓',
    stable: '→',
  }
  return icons[trend]
}

/**
 * Get trend color
 */
export function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  const colors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-600',
  }
  return colors[trend]
}

/**
 * Calculate performance trend from data points
 */
export function calculateTrend(
  current: number,
  previous: number
): 'up' | 'down' | 'stable' {
  if (current > previous * 1.05) return 'up'
  if (current < previous * 0.95) return 'down'
  return 'stable'
}

/**
 * Calculate change percentage
 */
export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Get period display name
 */
export function getPeriodDisplayName(period: PeriodType): string {
  const names: Record<string, string> = {
    '24h': 'Today',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
  }
  return names[period] || period
}

/**
 * Get date range from period
 */
export function getDateRangeFromPeriod(period: PeriodType): {
  startDate: Date
  endDate: Date
} {
  const endDate = new Date()
  const startDate = new Date()

  switch (period) {
    case '24h':
      startDate.setDate(startDate.getDate() - 1)
      break
    case '7d':
      startDate.setDate(startDate.getDate() - 7)
      break
    case '30d':
      startDate.setDate(startDate.getDate() - 30)
      break
    case '90d':
      startDate.setDate(startDate.getDate() - 90)
      break
  }

  return { startDate, endDate }
}

/**
 * Calculate percentile ranking
 */
export function calculatePercentile(rank: number, total: number): number {
  if (total === 0) return 0
  return Math.round(((total - rank + 1) / total) * 100)
}

/**
 * Get percentile badge
 */
export function getPercentileBadge(percentile: number): string {
  if (percentile >= 90) return 'Top 10%'
  if (percentile >= 75) return 'Top 25%'
  if (percentile >= 50) return 'Top 50%'
  return `${percentile}th percentile`
}

/**
 * Format consistency level
 */
export function getConsistencyLabel(consistency: 'high' | 'medium' | 'low'): string {
  const labels = {
    high: 'Highly Consistent',
    medium: 'Moderately Consistent',
    low: 'Variable Performance',
  }
  return labels[consistency]
}

/**
 * Get consistency color
 */
export function getConsistencyColor(consistency: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'text-green-600',
    medium: 'text-blue-600',
    low: 'text-yellow-600',
  }
  return colors[consistency]
}

/**
 * Calculate average from metrics array
 */
export function calculateAverage(metrics: PerformanceMetrics[], key: keyof PerformanceMetrics): number {
  if (metrics.length === 0) return 0
  const sum = metrics.reduce((acc, m) => acc + (Number(m[key]) || 0), 0)
  return sum / metrics.length
}

/**
 * Find best day from metrics
 */
export function findBestDay(metrics: PerformanceMetrics[]): PerformanceMetrics | null {
  if (metrics.length === 0) return null
  return metrics.reduce((best, current) =>
    current.productivity_score > best.productivity_score ? current : best
  )
}

/**
 * Find worst day from metrics
 */
export function findWorstDay(metrics: PerformanceMetrics[]): PerformanceMetrics | null {
  if (metrics.length === 0) return null
  return metrics.reduce((worst, current) =>
    current.productivity_score < worst.productivity_score ? current : worst
  )
}
