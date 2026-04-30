import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * API Route: CAE Provider Health Status
 * GET /api/cae/health - Get health status of all providers
 * POST /api/cae/health - Trigger manual health check
 */

import { NextRequest, NextResponse } from 'next/server'
import { healthMonitor, ProviderHealthStatus } from '@/lib/cae/health-monitor'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { auditLogger } from '@/lib/cae/security'
import { apiLogger } from '@/lib/utils/logger'


interface HealthResponse {
  success: boolean
  data?: {
    providers: ProviderHealthStatus[]
    overall_status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
    checked_at: string
  }
  error?: string
}

/**
 * GET - Get current health status
 * BUG FIX #7: Added comprehensive audit logging
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const minutes = parseInt(searchParams.get('minutes') || '15')
    const providerKey = searchParams.get('provider')

    // Get health status
    let statuses: ProviderHealthStatus[]

    if (providerKey) {
      const status = await healthMonitor.getProviderStatus(providerKey, minutes)
      statuses = status ? [status] : []
    } else {
      statuses = await healthMonitor.getHealthStatus(minutes)
    }

    // Determine overall status
    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY'

    if (statuses.some(s => s.status === 'DOWN' || s.status === 'TIMEOUT')) {
      overallStatus = 'DOWN'
    } else if (statuses.some(s => s.status === 'DEGRADED')) {
      overallStatus = 'DEGRADED'
    }

    // BUG FIX #7: Log API access
    auditLogger.logAPIRequest({
      method: 'GET',
      path: '/api/cae/health',
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      status: 200,
      responseTime: Date.now() - startTime,
      requestBody: { minutes, providerKey },
    })

    return NextResponse.json({
      success: true,
      data: {
        providers: statuses,
        overall_status: overallStatus,
        checked_at: new Date().toISOString(),
      },
    } as HealthResponse)
  } catch (error) {
    apiLogger.error('Health check error', error)

    // BUG FIX #7: Log API error
    auditLogger.logAPIRequest({
      method: 'GET',
      path: '/api/cae/health',
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      status: 500,
      responseTime: Date.now() - startTime,
      error: 'Internal server error',
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as HealthResponse,
      { status: 500 }
    )
  }
}

/**
 * POST - Trigger manual health check
 * BUG FIX #7: Added comprehensive audit logging
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Apply rate limiting (stricter for manual checks)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const bodySchema = z.object({

      provider: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr.catch(() => ({}))
    const providerKey = body.provider


    // Run health check
    let results
    if (providerKey) {
      const result = await healthMonitor.checkProvider(providerKey)
      results = [result]

      // BUG FIX #7: Log individual health check
      auditLogger.logHealthCheck({
        providerId: providerKey,
        providerKey: providerKey,
        checkType: 'MANUAL',
        status: result.status,
        responseTime: result.response_time_ms,
        error: result.error_message,
      })
    } else {
      results = await healthMonitor.checkAllProviders()

      // BUG FIX #7: Log health checks for all providers
      results.forEach(result => {
        auditLogger.logHealthCheck({
          providerId: result.provider_key,
          providerKey: result.provider_key,
          checkType: 'MANUAL',
          status: result.status,
          responseTime: result.response_time_ms,
          error: result.error_message,
        })
      })
    }

    // Convert to ProviderHealthStatus format
    const statuses: ProviderHealthStatus[] = results.map(r => ({
      provider_key: r.provider_key,
      status: r.status,
      last_checked: new Date().toISOString(),
      response_time_ms: r.response_time_ms,
      success_rate: r.status === 'HEALTHY' ? 100 : 0,
      error_message: r.error_message,
    }))

    // Determine overall status
    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY'

    if (statuses.some(s => s.status === 'DOWN' || s.status === 'TIMEOUT')) {
      overallStatus = 'DOWN'
    } else if (statuses.some(s => s.status === 'DEGRADED')) {
      overallStatus = 'DEGRADED'
    }

    // BUG FIX #7: Log API success
    auditLogger.logAPIRequest({
      method: 'POST',
      path: '/api/cae/health',
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      status: 200,
      responseTime: Date.now() - startTime,
      requestBody: body,
    })

    return NextResponse.json({
      success: true,
      data: {
        providers: statuses,
        overall_status: overallStatus,
        checked_at: new Date().toISOString(),
      },
    } as HealthResponse)
  } catch (error) {
    apiLogger.error('Manual health check error', error)

    // BUG FIX #7: Log API error
    auditLogger.logAPIRequest({
      method: 'POST',
      path: '/api/cae/health',
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      status: 500,
      responseTime: Date.now() - startTime,
      error: 'Internal server error',
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as HealthResponse,
      { status: 500 }
    )
  }
}
