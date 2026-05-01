/**
 * API Performance Monitoring
 * Tracks response times and slow queries for observability.
 */

interface PerformanceEntry {
  route: string
  method: string
  duration: number
  status: number
  requestId: string
  timestamp: string
}

const SLOW_THRESHOLD_MS = 2000

export function trackApiPerformance(entry: PerformanceEntry): void {
  if (entry.duration > SLOW_THRESHOLD_MS) {
    console.warn('[SLOW_API]', {
      ...entry,
      alert: `Response took ${entry.duration}ms (threshold: ${SLOW_THRESHOLD_MS}ms)`,
    })
  }
}

export function measureAsync<T>(
  fn: () => Promise<T>,
  label: string
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now()
  return fn().then(result => ({
    result,
    durationMs: Date.now() - start,
  }))
}
