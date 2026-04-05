/**
 * Analytics Utilities
 * Helper functions for analytics calculations in BDM module
 */

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}

/**
 * Calculate growth rate
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Calculate average
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Calculate median
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = calculateAverage(values)
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2))
  const avgSquareDiff = calculateAverage(squareDiffs)
  return Math.sqrt(avgSquareDiff)
}

/**
 * Calculate variance
 */
export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const avg = calculateAverage(values)
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2))
  return calculateAverage(squareDiffs)
}

/**
 * Calculate percentile
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (percentile / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/**
 * Calculate trend (linear regression slope)
 */
export function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0
  const n = values.length
  const indices = Array.from({ length: n }, (_, i) => i)
  const sumX = indices.reduce((sum, x) => sum + x, 0)
  const sumY = values.reduce((sum, y) => sum + y, 0)
  const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0)
  const sumXX = indices.reduce((sum, x) => sum + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  return slope
}

/**
 * Classify trend
 */
export function classifyTrend(slope: number): 'increasing' | 'decreasing' | 'stable' {
  if (Math.abs(slope) < 0.1) return 'stable'
  return slope > 0 ? 'increasing' : 'decreasing'
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], window: number): number[] {
  if (values.length < window) return []
  const result: number[] = []
  for (let i = window - 1; i < values.length; i++) {
    const windowValues = values.slice(i - window + 1, i + 1)
    result.push(calculateAverage(windowValues))
  }
  return result
}

/**
 * Calculate cumulative sum
 */
export function calculateCumulativeSum(values: number[]): number[] {
  const result: number[] = []
  let sum = 0
  for (const value of values) {
    sum += value
    result.push(sum)
  }
  return result
}

/**
 * Calculate YoY growth
 */
export function calculateYoYGrowth(current: number, previousYear: number): number {
  return calculateGrowthRate(current, previousYear)
}

/**
 * Calculate MoM growth
 */
export function calculateMoMGrowth(current: number, previousMonth: number): number {
  return calculateGrowthRate(current, previousMonth)
}

/**
 * Calculate compound growth rate (CAGR)
 */
export function calculateCAGR(initial: number, final: number, periods: number): number {
  if (initial === 0 || periods === 0) return 0
  return (Math.pow(final / initial, 1 / periods) - 1) * 100
}

/**
 * Normalize values to 0-100 scale
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return values.map(() => 50)
  return values.map((v) => ((v - min) / (max - min)) * 100)
}

/**
 * Calculate z-score
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

/**
 * Identify outliers using IQR method
 */
export function identifyOutliers(values: number[]): { outliers: number[]; indices: number[] } {
  if (values.length < 4) return { outliers: [], indices: [] }
  const q1 = calculatePercentile(values, 25)
  const q3 = calculatePercentile(values, 75)
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  const outliers: number[] = []
  const indices: number[] = []
  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value)
      indices.push(index)
    }
  })
  return { outliers, indices }
}

/**
 * Calculate correlation coefficient
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0
  const n = x.length
  const meanX = calculateAverage(x)
  const meanY = calculateAverage(y)
  let numerator = 0
  let denomX = 0
  let denomY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  if (denomX === 0 || denomY === 0) return 0
  return numerator / Math.sqrt(denomX * denomY)
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN')
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`
  }
  return `₹${value.toLocaleString('en-IN')}`
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Calculate achievement grade
 */
export function calculateGrade(achievementRate: number): string {
  if (achievementRate >= 100) return 'A+'
  if (achievementRate >= 90) return 'A'
  if (achievementRate >= 80) return 'B+'
  if (achievementRate >= 70) return 'B'
  if (achievementRate >= 60) return 'C'
  if (achievementRate >= 50) return 'D'
  return 'F'
}

/**
 * Get performance status
 */
export function getPerformanceStatus(
  achievementRate: number
): 'excellent' | 'good' | 'average' | 'poor' | 'critical' {
  if (achievementRate >= 100) return 'excellent'
  if (achievementRate >= 80) return 'good'
  if (achievementRate >= 60) return 'average'
  if (achievementRate >= 40) return 'poor'
  return 'critical'
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'excellent':
      return 'green'
    case 'good':
      return 'blue'
    case 'average':
      return 'yellow'
    case 'poor':
      return 'orange'
    case 'critical':
      return 'red'
    default:
      return 'gray'
  }
}
