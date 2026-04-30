
/**
 * Cron Job: Collect Performance Metrics
 * Endpoint: /api/cron/collect-metrics
 * Schedule: Every hour
 *
 * Vercel Cron: Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/collect-metrics",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import MetricsCollector, { recordDailyMetrics } from '@/lib/monitoring/performance-metrics'
import logger from '@/lib/monitoring/logger'

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'dev-secret'

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Collect all performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    if (!verifyCronSecret(request)) {
      logger.warn('Unauthorized cron job attempt')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const startTime = Date.now()

    // Collect business metrics
    await recordDailyMetrics(supabase)

    // Collect system health metrics
    await collectSystemMetrics(supabase)

    // Get current metrics summary
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const summary = MetricsCollector.getSummary(oneHourAgo, now)

    // Store metrics in database (optional)
    await storeMetricsInDatabase(supabase, summary)

    const duration = Date.now() - startTime

    logger.info('Metrics collection completed', {
      duration,
      summary: {
        api_requests: summary.api.totalRequests,
        db_queries: summary.database.totalQueries,
        error_rate: summary.api.errorRate,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Metrics collected successfully',
      duration,
      summary: {
        period: summary.period,
        api: {
          totalRequests: summary.api.totalRequests,
          avgResponseTime: Math.round(summary.api.avgResponseTime),
          errorRate: summary.api.errorRate.toFixed(2) + '%',
        },
        database: {
          totalQueries: summary.database.totalQueries,
          avgQueryTime: Math.round(summary.database.avgQueryTime),
          cacheHitRate: summary.database.cacheHitRate.toFixed(2) + '%',
        },
        business: summary.business,
      },
    })
  } catch (error) {
    logger.error('Error in metrics collection cron', error instanceof Error ? error : undefined)

    return NextResponse.json(
      {
        error: 'Metrics collection failed',
      },
      { status: 500 }
    )
  }
}

/**
 * Collect system health metrics
 */
async function collectSystemMetrics(supabase: unknown) {
  try {
    // Database connection health
    const { error: pingError } = await supabase.from('incentives').select('id').limit(1)

    MetricsCollector.recordCustomMetric({
      name: 'database_health',
      value: pingError ? 0 : 1,
      unit: 'boolean',
      timestamp: new Date(),
      tags: {
        status: pingError ? 'unhealthy' : 'healthy',
      },
    })

    // Memory usage (Node.js)
    if (typeof process !== 'undefined') {
      const memUsage = process.memoryUsage()

      MetricsCollector.recordCustomMetric({
        name: 'memory_usage_heap',
        value: memUsage.heapUsed / 1024 / 1024, // MB
        unit: 'MB',
        timestamp: new Date(),
      })

      MetricsCollector.recordCustomMetric({
        name: 'memory_usage_rss',
        value: memUsage.rss / 1024 / 1024, // MB
        unit: 'MB',
        timestamp: new Date(),
      })
    }

    // Count of active users (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: activeUsers } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('last_sign_in_at', oneHourAgo)

    MetricsCollector.recordBusinessMetric({
      metric: 'active_users_hourly',
      value: activeUsers || 0,
      period: 'daily',
      timestamp: new Date(),
    })
  } catch (error) {
    logger.error('Error collecting system metrics', error instanceof Error ? error : undefined)
  }
}

/**
 * Store metrics in database for historical tracking
 */
async function storeMetricsInDatabase(supabase: unknown, summary: unknown) {
  try {
    // Check if metrics table exists (optional feature)
    const { error: tableError } = await supabase
      .from('system_performance_metrics')
      .select('id')
      .limit(1)

    if (tableError) {
      // Table doesn't exist - skip storage
      logger.info('Metrics table not found, skipping database storage')
      return
    }

    // Store summary in database
    await supabase.from('system_performance_metrics').insert({
      period_start: summary.period.start,
      period_end: summary.period.end,
      total_api_requests: summary.api.totalRequests,
      avg_response_time: summary.api.avgResponseTime,
      error_rate: summary.api.errorRate,
      total_db_queries: summary.database.totalQueries,
      avg_query_time: summary.database.avgQueryTime,
      cache_hit_rate: summary.database.cacheHitRate,
      active_incentives: summary.business.activeIncentives,
      total_claims: summary.business.totalClaims,
      approval_rate: summary.business.approvalRate,
      slowest_endpoints: summary.api.slowestEndpoints,
      created_at: new Date().toISOString(),
    })

    logger.info('Metrics stored in database')
  } catch (error) {
    // Non-critical error - just log it
    logger.warn('Failed to store metrics in database', {
      error: 'Internal server error',
    })
  }
}

/**
 * Manual trigger for testing (POST)
 */
export async function POST(request: NextRequest) {
  // Same logic as GET, but with different auth check
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Allow manual trigger from authenticated admin users
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (employee?.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  // Run the collection
  return GET(request)
}
