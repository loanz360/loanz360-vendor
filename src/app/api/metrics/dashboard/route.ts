
/**
 * Metrics Dashboard API
 * Endpoint: /api/metrics/dashboard
 * Access: SuperAdmin only
 *
 * Provides real-time performance metrics and system health data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import MetricsCollector from '@/lib/monitoring/performance-metrics'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/metrics/dashboard
 * Fetch metrics dashboard data
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authentication & authorization
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (employee?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: SuperAdmin access required' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '1h' // 1h, 24h, 7d, 30d

    // Calculate time range
    const endDate = new Date()
    const startDate = getStartDate(period)

    // Get metrics summary
    const summary = MetricsCollector.getSummary(startDate, endDate)

    // Get current metrics count
    const metricsCount = MetricsCollector.getMetricsCount()

    // Fetch historical metrics from database (if available)
    const historicalMetrics = await fetchHistoricalMetrics(supabase, startDate, endDate)

    // Calculate system health score
    const healthScore = calculateHealthScore(summary)

    return NextResponse.json({
      success: true,
      data: {
        period: {
          label: period,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary,
        metricsCount,
        historical: historicalMetrics,
        health: {
          score: healthScore,
          status: getHealthStatus(healthScore),
          issues: detectIssues(summary),
        },
      },
    })
  } catch (error) {
    logger.error('Error fetching metrics dashboard', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to fetch metrics dashboard' },
      { status: 500 }
    )
  }
}

/**
 * Calculate start date based on period
 */
function getStartDate(period: string): Date {
  const now = Date.now()

  switch (period) {
    case '1h':
      return new Date(now - 60 * 60 * 1000)
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now - 60 * 60 * 1000)
  }
}

/**
 * Fetch historical metrics from database
 */
async function fetchHistoricalMetrics(supabase: any, startDate: Date, endDate: Date) {
  try {
    const { data, error } = await supabase
      .from('system_performance_metrics')
      .select('*')
      .gte('period_start', startDate.toISOString())
      .lte('period_end', endDate.toISOString())
      .order('period_start', { ascending: true })
      .limit(100)

    if (error) {
      logger.warn('Error fetching historical metrics', error)
      return []
    }

    return data || []
  } catch (error) {
    logger.warn('Historical metrics table not found')
    return []
  }
}

/**
 * Calculate overall system health score (0-100)
 */
function calculateHealthScore(summary: any): number {
  let score = 100

  // Deduct for high error rate
  if (summary.api.errorRate > 5) {
    score -= Math.min(30, summary.api.errorRate * 3)
  }

  // Deduct for slow API responses
  if (summary.api.avgResponseTime > 1000) {
    score -= Math.min(20, (summary.api.avgResponseTime - 1000) / 100)
  }

  // Deduct for slow database queries
  if (summary.database.avgQueryTime > 500) {
    score -= Math.min(20, (summary.database.avgQueryTime - 500) / 50)
  }

  // Deduct for low cache hit rate
  if (summary.database.cacheHitRate < 50) {
    score -= 15
  }

  return Math.max(0, Math.round(score))
}

/**
 * Get health status from score
 */
function getHealthStatus(score: number): string {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 60) return 'fair'
  if (score >= 40) return 'poor'
  return 'critical'
}

/**
 * Detect performance issues
 */
function detectIssues(summary: any): Array<{ type: string; severity: string; message: string }> {
  const issues: Array<{ type: string; severity: string; message: string }> = []

  // High error rate
  if (summary.api.errorRate > 5) {
    issues.push({
      type: 'high_error_rate',
      severity: summary.api.errorRate > 10 ? 'critical' : 'warning',
      message: `Error rate is ${summary.api.errorRate.toFixed(2)}% (threshold: 5%)`,
    })
  }

  // Slow API responses
  if (summary.api.avgResponseTime > 1000) {
    issues.push({
      type: 'slow_api',
      severity: summary.api.avgResponseTime > 3000 ? 'critical' : 'warning',
      message: `Average API response time is ${Math.round(summary.api.avgResponseTime)}ms (threshold: 1000ms)`,
    })
  }

  // Slow database queries
  if (summary.database.avgQueryTime > 500) {
    issues.push({
      type: 'slow_queries',
      severity: summary.database.avgQueryTime > 1000 ? 'critical' : 'warning',
      message: `Average database query time is ${Math.round(summary.database.avgQueryTime)}ms (threshold: 500ms)`,
    })
  }

  // Low cache hit rate
  if (summary.database.cacheHitRate < 50) {
    issues.push({
      type: 'low_cache_hit_rate',
      severity: 'info',
      message: `Cache hit rate is ${summary.database.cacheHitRate.toFixed(2)}% (recommended: >70%)`,
    })
  }

  // Check slowest endpoints
  if (summary.api.slowestEndpoints.length > 0) {
    const slowest = summary.api.slowestEndpoints[0]
    if (slowest.avgDuration > 2000) {
      issues.push({
        type: 'slow_endpoint',
        severity: 'warning',
        message: `Slowest endpoint: ${slowest.endpoint} (${Math.round(slowest.avgDuration)}ms)`,
      })
    }
  }

  return issues
}
