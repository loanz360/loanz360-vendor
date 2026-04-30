/**
 * Performance Tracking Middleware
 * Automatically tracks API request performance metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import MetricsCollector from '@/lib/monitoring/performance-metrics'
import logger from '@/lib/monitoring/logger'

/**
 * Middleware to track API performance
 * Wrap API route handlers with this to automatically collect metrics
 */
export function withPerformanceTracking(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options?: {
    endpoint?: string
    trackDatabase?: boolean
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const endpoint = options?.endpoint || request.nextUrl.pathname
    const method = request.method

    let statusCode = 200
    let error: string | undefined
    let userId: string | undefined

    try {
      // Try to extract user ID from request (if authenticated)
      try {
        const authHeader = request.headers.get('authorization')
        if (authHeader) {
          // Extract user ID from token (simplified - actual implementation may vary)
          const token = authHeader.replace('Bearer ', '')
          // In real implementation, decode JWT and extract user ID
          // For now, we'll leave it undefined
        }
      } catch {
        // Ignore auth extraction errors
      }

      // Execute the handler
      const response = await handler(request)
      statusCode = response.status

      return response
    } catch (err) {
      statusCode = 500
      error = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Error in API handler', err instanceof Error ? err : undefined)
      throw err
    } finally {
      const duration = Date.now() - startTime

      // Record metric
      MetricsCollector.recordAPIMetric({
        endpoint,
        method,
        statusCode,
        duration,
        timestamp: new Date(),
        userId,
        error,
      })

      // Log performance issues
      if (duration > 5000) {
        logger.warn('Very slow API request', {
          endpoint,
          method,
          duration,
          statusCode,
        })
      }
    }
  }
}

/**
 * Extract user ID from request
 * Helper function to get authenticated user ID
 */
export async function extractUserId(request: NextRequest): Promise<string | undefined> {
  try {
    // This would integrate with your auth system
    // For Supabase, you'd decode the JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return undefined

    // Implementation depends on your auth system
    // This is a placeholder
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Performance tracking for database queries
 * Wrap Supabase query chains with this
 */
export function trackDatabaseQuery<T>(
  query: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return MetricsCollector.trackDatabaseQuery(query, queryFn)
}

/**
 * Simple decorator for class methods to track performance
 */
export function TrackPerformance(metricName?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      const name = metricName || `${target.constructor.name}.${propertyKey}`
      const startTime = performance.now()

      try {
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - startTime

        MetricsCollector.recordCustomMetric({
          name,
          value: duration,
          unit: 'ms',
          timestamp: new Date(),
        })

        return result
      } catch (error) {
        const duration = performance.now() - startTime

        MetricsCollector.recordCustomMetric({
          name,
          value: duration,
          unit: 'ms',
          timestamp: new Date(),
          tags: { error: 'true' },
        })

        throw error
      }
    }

    return descriptor
  }
}
