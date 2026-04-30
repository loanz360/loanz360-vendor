/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - UTILITY FUNCTIONS
 * ============================================================================
 * Helper functions for calculations, formatting, and data transformations
 * ============================================================================
 */

import type { PerformanceGrade, TrendDirection, DayStatus } from '@/types/bdm-team-targets'

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

export function formatCurrency(amount: number, compact: boolean = false): string {
  if (compact) {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`
    }
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num)
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(dateString)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// ============================================================================
// CALCULATION UTILITIES
// ============================================================================

export function calculateAchievementPercentage(actual: number, target: number): number {
  if (target === 0) return actual > 0 ? 100 : 0
  return Math.round((actual / target) * 100)
}

export function calculateGrade(achievementPercentage: number): PerformanceGrade {
  if (achievementPercentage >= 95) return 'A+'
  if (achievementPercentage >= 90) return 'A'
  if (achievementPercentage >= 85) return 'B+'
  if (achievementPercentage >= 80) return 'B'
  if (achievementPercentage >= 75) return 'C+'
  if (achievementPercentage >= 70) return 'C'
  if (achievementPercentage >= 60) return 'D'
  return 'F'
}

export function calculateTrend(current: number, previous: number): {
  direction: TrendDirection
  percentage: number
} {
  if (previous === 0) {
    return {
      direction: current > 0 ? 'up' : 'stable',
      percentage: current > 0 ? 100 : 0,
    }
  }

  const change = ((current - previous) / previous) * 100

  return {
    direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
    percentage: Math.abs(Math.round(change)),
  }
}

export function calculateDayStatus(achievementPercentage: number): DayStatus {
  if (achievementPercentage >= 120) return 'exceeded'
  if (achievementPercentage >= 100) return 'met'
  if (achievementPercentage >= 70) return 'partial'
  if (achievementPercentage > 0) return 'missed'
  return 'no_activity'
}

export function calculatePerformanceStatus(achievementPercentage: number, daysRemaining: number): 'exceeding' | 'on_track' | 'at_risk' | 'behind' {
  if (achievementPercentage >= 100) return 'exceeding'

  // Calculate if on track based on time elapsed
  const currentDay = new Date().getDate()
  const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const expectedProgress = (currentDay / totalDays) * 100

  if (achievementPercentage >= expectedProgress - 5) return 'on_track'
  if (achievementPercentage >= expectedProgress - 15) return 'at_risk'
  return 'behind'
}

export function calculateConversionRate(conversions: number, leads: number): number {
  if (leads === 0) return 0
  return Math.round((conversions / leads) * 100 * 10) / 10 // One decimal
}

export function calculateProjection(
  currentValue: number,
  currentDay: number,
  totalDays: number,
  historicalAverage?: number
): {
  projected: number
  optimistic: number
  pessimistic: number
  confidence: number
} {
  if (currentDay === 0) {
    return {
      projected: historicalAverage || 0,
      optimistic: (historicalAverage || 0) * 1.2,
      pessimistic: (historicalAverage || 0) * 0.8,
      confidence: 30,
    }
  }

  const dailyAvg = currentValue / currentDay
  const projected = Math.round(dailyAvg * totalDays)

  // Confidence increases as we get more data
  const confidence = Math.min(95, 30 + (currentDay / totalDays) * 65)

  // Optimistic/pessimistic based on confidence
  const variance = 1 - (confidence / 200) // Lower confidence = higher variance
  const optimistic = Math.round(projected * (1 + variance))
  const pessimistic = Math.round(projected * (1 - variance))

  return {
    projected,
    optimistic,
    pessimistic,
    confidence: Math.round(confidence),
  }
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export function getStatusColor(status: 'exceeding' | 'on_track' | 'at_risk' | 'behind'): {
  text: string
  bg: string
  border: string
} {
  const colors = {
    exceeding: {
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
    },
    on_track: {
      text: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    at_risk: {
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
    },
    behind: {
      text: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
  }
  return colors[status]
}

export function getGradeColor(grade: PerformanceGrade): {
  text: string
  bg: string
} {
  const colors: Record<PerformanceGrade, { text: string; bg: string }> = {
    'A+': { text: 'text-green-700', bg: 'bg-green-100' },
    'A': { text: 'text-green-600', bg: 'bg-green-50' },
    'B+': { text: 'text-blue-700', bg: 'bg-blue-100' },
    'B': { text: 'text-blue-600', bg: 'bg-blue-50' },
    'C+': { text: 'text-yellow-700', bg: 'bg-yellow-100' },
    'C': { text: 'text-yellow-600', bg: 'bg-yellow-50' },
    'D': { text: 'text-orange-700', bg: 'bg-orange-100' },
    'F': { text: 'text-red-700', bg: 'bg-red-100' },
  }
  return colors[grade]
}

export function getAchievementColor(percentage: number): {
  text: string
  bg: string
  bar: string
} {
  if (percentage >= 100) {
    return {
      text: 'text-green-700',
      bg: 'bg-green-50',
      bar: 'bg-green-500',
    }
  } else if (percentage >= 80) {
    return {
      text: 'text-blue-700',
      bg: 'bg-blue-50',
      bar: 'bg-blue-500',
    }
  } else if (percentage >= 60) {
    return {
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      bar: 'bg-yellow-500',
    }
  } else {
    return {
      text: 'text-red-700',
      bg: 'bg-red-50',
      bar: 'bg-red-500',
    }
  }
}

export function getDayStatusColor(status: DayStatus): {
  bg: string
  border: string
  text: string
} {
  const colors: Record<DayStatus, { bg: string; border: string; text: string }> = {
    exceeded: {
      bg: 'bg-green-100',
      border: 'border-green-300',
      text: 'text-green-800',
    },
    met: {
      bg: 'bg-blue-100',
      border: 'border-blue-300',
      text: 'text-blue-800',
    },
    partial: {
      bg: 'bg-yellow-100',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
    },
    missed: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-800',
    },
    no_activity: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-500',
    },
  }
  return colors[status]
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1] || 'Unknown'
}

export function getDayOfWeek(dateString: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const date = new Date(dateString)
  return days[date.getDay()]
}

export function isWeekend(dateString: string): boolean {
  const date = new Date(dateString)
  const day = date.getDay()
  return day === 0 || day === 6
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

export function getCurrentMonthInfo(): {
  month: number
  year: number
  currentDay: number
  totalDays: number
  daysRemaining: number
} {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const currentDay = now.getDate()
  const totalDays = getDaysInMonth(month, year)
  const daysRemaining = totalDays - currentDay

  return {
    month,
    year,
    currentDay,
    totalDays,
    daysRemaining,
  }
}

// ============================================================================
// RANKING UTILITIES
// ============================================================================

export function getRankBadge(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export function getRankSuffix(rank: number): string {
  const j = rank % 10
  const k = rank % 100
  if (j === 1 && k !== 11) return `${rank}st`
  if (j === 2 && k !== 12) return `${rank}nd`
  if (j === 3 && k !== 13) return `${rank}rd`
  return `${rank}th`
}

export function calculatePercentile(rank: number, total: number): number {
  if (total === 0) return 0
  return Math.round((1 - (rank - 1) / total) * 100)
}

// ============================================================================
// STATISTICS UTILITIES
// ============================================================================

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = calculateMean(values)
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const variance = calculateMean(squaredDiffs)
  return Math.sqrt(variance)
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export function isValidMonth(month: number): boolean {
  return month >= 1 && month <= 12
}

export function isValidYear(year: number): boolean {
  const currentYear = new Date().getFullYear()
  return year >= 2020 && year <= currentYear + 1
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ============================================================================
// INSIGHT GENERATION UTILITIES
// ============================================================================

export function generateTrendMessage(
  metric: string,
  current: number,
  previous: number
): string {
  const trend = calculateTrend(current, previous)
  const direction = trend.direction === 'up' ? 'increased' : trend.direction === 'down' ? 'decreased' : 'remained stable'

  if (trend.direction === 'stable') {
    return `${metric} ${direction}`
  }

  return `${metric} ${direction} by ${trend.percentage}%`
}

export function generateStatusMessage(
  status: 'exceeding' | 'on_track' | 'at_risk' | 'behind',
  metric: string = 'target'
): string {
  const messages = {
    exceeding: `Exceeding ${metric}! 🎉`,
    on_track: `On track to meet ${metric}`,
    at_risk: `At risk of missing ${metric} ⚠️`,
    behind: `Behind ${metric} - action needed`,
  }
  return messages[status]
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export function generateFileName(
  prefix: string,
  format: 'excel' | 'pdf' | 'csv',
  month: number,
  year: number
): string {
  const monthName = getMonthName(month)
  const timestamp = new Date().getTime()
  const extension = format === 'excel' ? 'xlsx' : format
  return `${prefix}_${monthName}_${year}_${timestamp}.${extension}`
}

export function convertToCSV(data: unknown[], headers: string[]): string {
  const csvRows = []

  // Add headers
  csvRows.push(headers.join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      const escaped = ('' + value).replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

// ============================================================================
// ADDITIONAL ALIAS EXPORTS (for backwards compatibility)
// ============================================================================

export function validateMonth(month: number): boolean {
  return isValidMonth(month)
}

export function validateYear(year: number): boolean {
  return isValidYear(year)
}

export function getStatusFromAchievement(achievementPercentage: number): 'exceeding' | 'on_track' | 'at_risk' | 'behind' {
  const now = new Date()
  const currentDay = now.getDate()
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = totalDays - currentDay
  return calculatePerformanceStatus(achievementPercentage, daysRemaining)
}

export function calculateProjectedValue(
  currentValue: number,
  currentDay: number,
  totalDays: number
): number {
  if (currentDay === 0) return 0
  const dailyAvg = currentValue / currentDay
  return Math.round(dailyAvg * totalDays)
}
