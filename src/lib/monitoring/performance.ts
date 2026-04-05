/**
 * Performance Monitoring Utilities
 * Track and analyze application performance metrics
 *
 * Features:
 * - API response time tracking
 * - Database query performance
 * - Cache hit/miss rates
 * - Resource utilization
 * - Performance alerts
 */

import logger from './logger'

export interface PerformanceMetric {
  operation: string
  duration_ms: number
  timestamp: Date
  metadata?: Record<string, any>
}

export interface PerformanceStats {
  operation: string
  count: number
  avg_duration_ms: number
  min_duration_ms: number
  max_duration_ms: number
  p50_duration_ms: number
  p95_duration_ms: number
  p99_duration_ms: number
}

// In-memory storage for performance metrics (last hour)
const performanceMetrics: PerformanceMetric[] = []
const MAX_METRICS = 10000
const RETENTION_MS = 60 * 60 * 1000 // 1 hour

/**
 * Performance timer class
 */
export class PerformanceTimer {
  private startTime: number
  private operation: string
  private metadata: Record<string, any>

  constructor(operation: string, metadata: Record<string, any> = {}) {
    this.operation = operation
    this.metadata = metadata
    this.startTime = performance.now()
  }

  /**
   * End timer and record metric
   */
  end(): number {
    const endTime = performance.now()
    const duration = endTime - this.startTime

    recordMetric({
      operation: this.operation,
      duration_ms: duration,
      timestamp: new Date(),
      metadata: this.metadata,
    })

    return duration
  }

  /**
   * End timer and log if duration exceeds threshold
   */
  endWithAlert(thresholdMs: number = 1000): number {
    const duration = this.end()

    if (duration > thresholdMs) {
      logger.warn(`Slow operation detected: ${this.operation}`, {
        duration_ms: duration,
        threshold_ms: thresholdMs,
        metadata: this.metadata,
      })
    }

    return duration
  }
}

/**
 * Record a performance metric
 */
export function recordMetric(metric: PerformanceMetric): void {
  performanceMetrics.push(metric)

  // Keep only recent metrics
  if (performanceMetrics.length > MAX_METRICS) {
    performanceMetrics.splice(0, performanceMetrics.length - MAX_METRICS)
  }

  // Log slow operations
  if (metric.duration_ms > 1000) {
    logger.warn(`Slow operation: ${metric.operation}`, {
      duration_ms: metric.duration_ms,
      metadata: metric.metadata,
    })
  }
}

/**
 * Get performance statistics for an operation
 */
export function getOperationStats(operation: string): PerformanceStats | null {
  const now = Date.now()
  const metrics = performanceMetrics.filter(
    (m) =>
      m.operation === operation &&
      now - m.timestamp.getTime() < RETENTION_MS
  )

  if (metrics.length === 0) {
    return null
  }

  const durations = metrics.map((m) => m.duration_ms).sort((a, b) => a - b)
  const sum = durations.reduce((acc, d) => acc + d, 0)

  return {
    operation,
    count: durations.length,
    avg_duration_ms: Math.round(sum / durations.length),
    min_duration_ms: Math.round(durations[0]),
    max_duration_ms: Math.round(durations[durations.length - 1]),
    p50_duration_ms: Math.round(durations[Math.floor(durations.length * 0.5)]),
    p95_duration_ms: Math.round(durations[Math.floor(durations.length * 0.95)]),
    p99_duration_ms: Math.round(durations[Math.floor(durations.length * 0.99)]),
  }
}

/**
 * Get all performance statistics
 */
export function getAllStats(): PerformanceStats[] {
  const now = Date.now()
  const recentMetrics = performanceMetrics.filter(
    (m) => now - m.timestamp.getTime() < RETENTION_MS
  )

  // Group by operation
  const operations = new Set(recentMetrics.map((m) => m.operation))

  return Array.from(operations)
    .map((op) => getOperationStats(op))
    .filter((stats): stats is PerformanceStats => stats !== null)
    .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)
}

/**
 * Clear old metrics
 */
export function cleanupOldMetrics(): number {
  const now = Date.now()
  const initialLength = performanceMetrics.length

  for (let i = performanceMetrics.length - 1; i >= 0; i--) {
    if (now - performanceMetrics[i].timestamp.getTime() > RETENTION_MS) {
      performanceMetrics.splice(i, 1)
    }
  }

  const removed = initialLength - performanceMetrics.length
  if (removed > 0) {
    logger.info(`Cleaned up ${removed} old performance metrics`)
  }

  return removed
}

/**
 * Measure async function performance
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const timer = new PerformanceTimer(operation, metadata)

  try {
    const result = await fn()
    timer.end()
    return result
  } catch (error) {
    timer.end()
    throw error
  }
}

/**
 * Measure sync function performance
 */
export function measureSync<T>(
  operation: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const timer = new PerformanceTimer(operation, metadata)

  try {
    const result = fn()
    timer.end()
    return result
  } catch (error) {
    timer.end()
    throw error
  }
}

/**
 * Create a performance middleware for API routes
 */
export function performanceMiddleware(operationPrefix: string) {
  return async (request: Request, handler: () => Promise<Response>): Promise<Response> => {
    const { pathname } = new URL(request.url)
    const operation = `${operationPrefix}:${pathname}`
    const timer = new PerformanceTimer(operation, {
      method: request.method,
      path: pathname,
    })

    try {
      const response = await handler()
      const duration = timer.end()

      // Add performance header
      response.headers.set('X-Response-Time', `${Math.round(duration)}ms`)

      return response
    } catch (error) {
      timer.end()
      throw error
    }
  }
}

/**
 * Get performance report
 */
export interface PerformanceReport {
  total_operations: number
  unique_operations: number
  avg_response_time_ms: number
  slowest_operations: PerformanceStats[]
  fastest_operations: PerformanceStats[]
  operations_over_1s: number
  operations_over_5s: number
  time_period_ms: number
}

export function getPerformanceReport(): PerformanceReport {
  const stats = getAllStats()
  const now = Date.now()
  const recentMetrics = performanceMetrics.filter(
    (m) => now - m.timestamp.getTime() < RETENTION_MS
  )

  const totalOps = recentMetrics.length
  const uniqueOps = stats.length
  const avgResponseTime =
    totalOps > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration_ms, 0) / totalOps
      : 0

  const slowestOps = stats.slice(0, 10)
  const fastestOps = stats.slice(-10).reverse()

  const opsOver1s = recentMetrics.filter((m) => m.duration_ms > 1000).length
  const opsOver5s = recentMetrics.filter((m) => m.duration_ms > 5000).length

  return {
    total_operations: totalOps,
    unique_operations: uniqueOps,
    avg_response_time_ms: Math.round(avgResponseTime),
    slowest_operations: slowestOps,
    fastest_operations: fastestOps,
    operations_over_1s: opsOver1s,
    operations_over_5s: opsOver5s,
    time_period_ms: RETENTION_MS,
  }
}

/**
 * Database query performance tracker
 */
export class DatabaseQueryTracker {
  private queries: Array<{
    query: string
    duration_ms: number
    timestamp: Date
  }> = []

  track(query: string, duration_ms: number): void {
    this.queries.push({
      query,
      duration_ms,
      timestamp: new Date(),
    })

    recordMetric({
      operation: 'database:query',
      duration_ms,
      timestamp: new Date(),
      metadata: { query },
    })
  }

  getSlowQueries(thresholdMs: number = 1000): typeof this.queries {
    return this.queries.filter((q) => q.duration_ms > thresholdMs)
  }

  clear(): void {
    this.queries = []
  }
}

/**
 * Cache performance tracker
 */
export interface CacheStats {
  hits: number
  misses: number
  total: number
  hit_rate: number
}

class CachePerformanceTracker {
  private hits = 0
  private misses = 0

  recordHit(): void {
    this.hits++
    recordMetric({
      operation: 'cache:hit',
      duration_ms: 0,
      timestamp: new Date(),
    })
  }

  recordMiss(): void {
    this.misses++
    recordMetric({
      operation: 'cache:miss',
      duration_ms: 0,
      timestamp: new Date(),
    })
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0

    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hit_rate: Math.round(hitRate * 100) / 100,
    }
  }

  reset(): void {
    this.hits = 0
    this.misses = 0
  }
}

export const cacheTracker = new CachePerformanceTracker()
export const dbTracker = new DatabaseQueryTracker()

// Cleanup old metrics every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldMetrics, 5 * 60 * 1000)
}
