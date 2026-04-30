/**
 * Automated Performance Metrics System
 * Collects, tracks, and reports system performance metrics
 */

import logger from './logger'

// =====================================================
// TYPES
// =====================================================

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: Date
  tags?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface APIMetric {
  endpoint: string
  method: string
  statusCode: number
  duration: number
  timestamp: Date
  userId?: string
  error?: string
}

export interface DatabaseMetric {
  query: string
  duration: number
  timestamp: Date
  rowCount?: number
  cached?: boolean
}

export interface BusinessMetric {
  metric: string
  value: number
  period: 'daily' | 'weekly' | 'monthly'
  timestamp: Date
  dimension?: Record<string, string>
}

export interface MetricsSummary {
  period: {
    start: Date
    end: Date
  }
  api: {
    totalRequests: number
    avgResponseTime: number
    errorRate: number
    slowestEndpoints: Array<{ endpoint: string; avgDuration: number }>
  }
  database: {
    totalQueries: number
    avgQueryTime: number
    cacheHitRate: number
  }
  business: {
    activeIncentives: number
    totalClaims: number
    approvalRate: number
    avgProcessingTime: number
  }
}

// =====================================================
// METRICS COLLECTOR
// =====================================================

export class MetricsCollector {
  private static apiMetrics: APIMetric[] = []
  private static dbMetrics: DatabaseMetric[] = []
  private static businessMetrics: BusinessMetric[] = []
  private static customMetrics: PerformanceMetric[] = []

  private static readonly MAX_METRICS_IN_MEMORY = 10000
  private static readonly FLUSH_INTERVAL_MS = 60000 // 1 minute

  // Auto-flush timer
  private static flushTimer: NodeJS.Timeout | null = null

  /**
   * Initialize metrics collection
   */
  static initialize() {
    // Start auto-flush
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => {
        this.flushMetrics()
      }, this.FLUSH_INTERVAL_MS)
    }

    logger.info('Performance metrics collector initialized')
  }

  /**
   * Record API request metric
   */
  static recordAPIMetric(metric: APIMetric) {
    this.apiMetrics.push(metric)

    // Log slow requests
    if (metric.duration > 3000) {
      logger.warn('Slow API request detected', {
        endpoint: metric.endpoint,
        duration: metric.duration,
        statusCode: metric.statusCode,
      })
    }

    this.checkFlush()
  }

  /**
   * Record database query metric
   */
  static recordDatabaseMetric(metric: DatabaseMetric) {
    this.dbMetrics.push(metric)

    // Log slow queries
    if (metric.duration > 1000) {
      logger.warn('Slow database query detected', {
        query: metric.query.substring(0, 100),
        duration: metric.duration,
        rowCount: metric.rowCount,
      })
    }

    this.checkFlush()
  }

  /**
   * Record business metric
   */
  static recordBusinessMetric(metric: BusinessMetric) {
    this.businessMetrics.push(metric)
    this.checkFlush()
  }

  /**
   * Record custom performance metric
   */
  static recordCustomMetric(metric: PerformanceMetric) {
    this.customMetrics.push(metric)
    this.checkFlush()
  }

  /**
   * Track API request performance
   */
  static async trackAPIRequest<T>(
    endpoint: string,
    method: string,
    handler: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const startTime = Date.now()
    let statusCode = 200
    let error: string | undefined

    try {
      const result = await handler()
      return result
    } catch (err) {
      statusCode = 500
      error = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      const duration = Date.now() - startTime

      this.recordAPIMetric({
        endpoint,
        method,
        statusCode,
        duration,
        timestamp: new Date(),
        userId,
        error,
      })
    }
  }

  /**
   * Track database query performance
   */
  static async trackDatabaseQuery<T>(
    query: string,
    handler: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await handler()
      const duration = Date.now() - startTime

      this.recordDatabaseMetric({
        query,
        duration,
        timestamp: new Date(),
        rowCount: Array.isArray(result) ? result.length : undefined,
      })

      return result
    } catch (err) {
      const duration = Date.now() - startTime

      this.recordDatabaseMetric({
        query,
        duration,
        timestamp: new Date(),
      })

      throw err
    }
  }

  /**
   * Get metrics summary for a time period
   */
  static getSummary(startDate: Date, endDate: Date): MetricsSummary {
    const apiMetricsInPeriod = this.apiMetrics.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    )

    const dbMetricsInPeriod = this.dbMetrics.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    )

    // Calculate API metrics
    const totalRequests = apiMetricsInPeriod.length
    const avgResponseTime =
      totalRequests > 0
        ? apiMetricsInPeriod.reduce((sum, m) => sum + m.duration, 0) / totalRequests
        : 0

    const errorCount = apiMetricsInPeriod.filter(m => m.statusCode >= 400).length
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

    // Find slowest endpoints
    const endpointDurations = new Map<string, { total: number; count: number }>()
    apiMetricsInPeriod.forEach(m => {
      const key = `${m.method} ${m.endpoint}`
      const existing = endpointDurations.get(key) || { total: 0, count: 0 }
      endpointDurations.set(key, {
        total: existing.total + m.duration,
        count: existing.count + 1,
      })
    })

    const slowestEndpoints = Array.from(endpointDurations.entries())
      .map(([endpoint, { total, count }]) => ({
        endpoint,
        avgDuration: total / count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10)

    // Calculate DB metrics
    const totalQueries = dbMetricsInPeriod.length
    const avgQueryTime =
      totalQueries > 0
        ? dbMetricsInPeriod.reduce((sum, m) => sum + m.duration, 0) / totalQueries
        : 0

    const cachedQueries = dbMetricsInPeriod.filter(m => m.cached).length
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0

    // Business metrics (placeholder - would come from actual business data)
    const businessMetricsInPeriod = this.businessMetrics.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    )

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      api: {
        totalRequests,
        avgResponseTime,
        errorRate,
        slowestEndpoints,
      },
      database: {
        totalQueries,
        avgQueryTime,
        cacheHitRate,
      },
      business: {
        activeIncentives: this.getBusinessMetricValue(businessMetricsInPeriod, 'active_incentives'),
        totalClaims: this.getBusinessMetricValue(businessMetricsInPeriod, 'total_claims'),
        approvalRate: this.getBusinessMetricValue(businessMetricsInPeriod, 'approval_rate'),
        avgProcessingTime: this.getBusinessMetricValue(businessMetricsInPeriod, 'avg_processing_time'),
      },
    }
  }

  /**
   * Get latest value for a business metric
   */
  private static getBusinessMetricValue(metrics: BusinessMetric[], metricName: string): number {
    const metric = metrics.filter(m => m.metric === metricName).sort((a, b) =>
      b.timestamp.getTime() - a.timestamp.getTime()
    )[0]

    return metric?.value || 0
  }

  /**
   * Flush metrics to storage/monitoring system
   */
  private static async flushMetrics() {
    if (
      this.apiMetrics.length === 0 &&
      this.dbMetrics.length === 0 &&
      this.businessMetrics.length === 0 &&
      this.customMetrics.length === 0
    ) {
      return
    }

    try {
      // In production, send to monitoring service (Datadog, New Relic, etc.)
      // For now, log summary
      const summary = this.getSummary(
        new Date(Date.now() - this.FLUSH_INTERVAL_MS),
        new Date()
      )

      logger.info('Performance metrics summary', summary)

      // Store in database (optional)
      // await this.storeMetrics()

      // Clear metrics from memory
      this.apiMetrics = []
      this.dbMetrics = []
      this.businessMetrics = []
      this.customMetrics = []
    } catch (error) {
      logger.error('Error flushing metrics', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Check if we should flush metrics
   */
  private static checkFlush() {
    const totalMetrics =
      this.apiMetrics.length +
      this.dbMetrics.length +
      this.businessMetrics.length +
      this.customMetrics.length

    if (totalMetrics >= this.MAX_METRICS_IN_MEMORY) {
      this.flushMetrics()
    }
  }

  /**
   * Get current metrics count
   */
  static getMetricsCount() {
    return {
      api: this.apiMetrics.length,
      database: this.dbMetrics.length,
      business: this.businessMetrics.length,
      custom: this.customMetrics.length,
      total:
        this.apiMetrics.length +
        this.dbMetrics.length +
        this.businessMetrics.length +
        this.customMetrics.length,
    }
  }

  /**
   * Cleanup and stop metrics collection
   */
  static cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    this.flushMetrics()
    logger.info('Performance metrics collector stopped')
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Measure execution time of a function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await fn()
    const duration = performance.now() - startTime

    MetricsCollector.recordCustomMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      tags,
    })

    return result
  } catch (error) {
    const duration = performance.now() - startTime

    MetricsCollector.recordCustomMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      tags: { ...tags, error: 'true' },
    })

    throw error
  }
}

/**
 * Create performance timer
 */
export class PerformanceTimer {
  private startTime: number
  private name: string
  private tags: Record<string, string>

  constructor(name: string, tags: Record<string, string> = {}) {
    this.name = name
    this.tags = tags
    this.startTime = performance.now()
  }

  /**
   * Stop timer and record metric
   */
  stop(metadata?: Record<string, unknown>) {
    const duration = performance.now() - this.startTime

    MetricsCollector.recordCustomMetric({
      name: this.name,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      tags: this.tags,
      metadata,
    })

    return duration
  }

  /**
   * Get elapsed time without stopping
   */
  getElapsed(): number {
    return performance.now() - this.startTime
  }
}

// =====================================================
// BUSINESS METRICS HELPERS
// =====================================================

/**
 * Record daily business metrics
 */
export async function recordDailyMetrics(supabase: unknown) {
  try {
    // Active incentives
    const { count: activeIncentives } = await supabase
      .from('incentives')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    MetricsCollector.recordBusinessMetric({
      metric: 'active_incentives',
      value: activeIncentives || 0,
      period: 'daily',
      timestamp: new Date(),
    })

    // Total claims
    const { count: totalClaims } = await supabase
      .from('incentive_claims')
      .select('*', { count: 'exact', head: true })
      .gte('claimed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    MetricsCollector.recordBusinessMetric({
      metric: 'total_claims',
      value: totalClaims || 0,
      period: 'daily',
      timestamp: new Date(),
    })

    // Approval rate
    const { count: approvedClaims } = await supabase
      .from('incentive_claims')
      .select('*', { count: 'exact', head: true })
      .eq('claim_status', 'approved')
      .gte('reviewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const approvalRate = totalClaims > 0 ? (approvedClaims / totalClaims) * 100 : 0

    MetricsCollector.recordBusinessMetric({
      metric: 'approval_rate',
      value: approvalRate,
      period: 'daily',
      timestamp: new Date(),
    })

    logger.info('Daily business metrics recorded')
  } catch (error) {
    logger.error('Error recording business metrics', error instanceof Error ? error : undefined)
  }
}

// Initialize on module load
if (typeof window === 'undefined') {
  // Only initialize on server-side
  MetricsCollector.initialize()
}

export default MetricsCollector
