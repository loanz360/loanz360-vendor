
/**
 * Health Check Endpoint
 *
 * This endpoint is used by load balancers, monitoring systems, and DevOps tools
 * to verify application health and readiness.
 *
 * Usage:
 * - Load Balancer: Check if instance is ready to receive traffic
 * - Monitoring: Uptime monitoring (Datadog, New Relic, etc.)
 * - CI/CD: Post-deployment verification
 *
 * Endpoints:
 * GET /api/health - Basic health check
 * GET /api/health/live - Liveness probe (is app running?)
 * GET /api/health/ready - Readiness probe (is app ready to serve traffic?)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Basic Health Check
 * Returns 200 if application is running
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const { searchParams } = new URL(request.url)
  const check = searchParams.get('check') || 'basic'

  switch (check) {
    case 'live':
      return await livenessProbe()
    case 'ready':
      return await readinessProbe()
    default:
      return await basicHealthCheck()
  }
}

/**
 * Basic Health Check
 * Always returns 200 if app is running
 */
async function basicHealthCheck() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'loanz360',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
    { status: 200 }
  )
}

/**
 * Liveness Probe
 * Checks if the application is alive (not deadlocked)
 * Returns 200 if alive, 503 if dead
 */
async function livenessProbe() {
  try {
    // Basic checks - is the process responsive?
    const timestamp = new Date().toISOString()

    return NextResponse.json(
      {
        status: 'alive',
        timestamp,
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'dead',
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}

/**
 * Readiness Probe
 * Checks if the application is ready to serve traffic
 * Verifies critical dependencies (database, etc.)
 * Returns 200 if ready, 503 if not ready
 */
async function readinessProbe() {
  const checks: {
    name: string
    status: 'healthy' | 'unhealthy'
    responseTime?: number
    error?: string
  }[] = []

  let overallStatus: 'ready' | 'not_ready' = 'ready'

  // Check 1: Database connectivity
  const dbCheck = await checkDatabase()
  checks.push(dbCheck)
  if (dbCheck.status === 'unhealthy') {
    overallStatus = 'not_ready'
  }

  // Check 2: Environment variables
  const envCheck = checkEnvironmentVariables()
  checks.push(envCheck)
  if (envCheck.status === 'unhealthy') {
    overallStatus = 'not_ready'
  }

  // Check 3: Critical services (can add more)
  // - Redis connection
  // - External API availability
  // - File storage access

  const statusCode = overallStatus === 'ready' ? 200 : 503

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      service: 'loanz360',
      version: process.env.npm_package_version || '1.0.0',
    },
    { status: statusCode }
  )
}

/**
 * Check Database Connectivity
 */
async function checkDatabase(): Promise<{
  name: string
  status: 'healthy' | 'unhealthy'
  responseTime?: number
  error?: string
}> {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Simple query to check database connection
    const { error } = await supabase.from('users').select('id').limit(1).maybeSingle()

    const responseTime = Date.now() - startTime

    if (error && !error.message.includes('multiple')) {
      // Error, but not the "no rows" error
      return {
        name: 'database',
        status: 'unhealthy',
        error: 'Database query failed',
        responseTime,
      }
    }

    return {
      name: 'database',
      status: 'healthy',
      responseTime,
    }
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      error: 'Internal server error',
      responseTime: Date.now() - startTime,
    }
  }
}

/**
 * Check Critical Environment Variables
 */
function checkEnvironmentVariables(): {
  name: string
  status: 'healthy' | 'unhealthy'
  error?: string
} {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'JWT_SECRET',
    'ENCRYPTION_MASTER_KEY',
  ]

  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar])

  if (missing.length > 0) {
    return {
      name: 'environment',
      status: 'unhealthy',
      error: `Missing environment variables: ${missing.join(', ')}`,
    }
  }

  return {
    name: 'environment',
    status: 'healthy',
  }
}

/**
 * Example Response Formats:
 *
 * GET /api/health
 * {
 *   "status": "healthy",
 *   "timestamp": "2025-10-05T10:30:00.000Z",
 *   "service": "loanz360",
 *   "version": "1.0.0",
 *   "environment": "production"
 * }
 *
 * GET /api/health?check=ready
 * {
 *   "status": "ready",
 *   "timestamp": "2025-10-05T10:30:00.000Z",
 *   "checks": [
 *     {
 *       "name": "database",
 *       "status": "healthy",
 *       "responseTime": 45
 *     },
 *     {
 *       "name": "environment",
 *       "status": "healthy"
 *     }
 *   ],
 *   "service": "loanz360",
 *   "version": "1.0.0"
 * }
 */
