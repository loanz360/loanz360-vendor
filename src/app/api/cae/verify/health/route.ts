/**
 * API Route: Verification Providers Health Check
 * GET /api/cae/verify/health
 *
 * Checks the health status of all verification provider integrations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verificationService } from '@/lib/cae/verification-service'
import { apiLogger } from '@/lib/utils/logger'


interface HealthCheckResponse {
  success: boolean
  data?: {
    overall_healthy: boolean
    providers: Record<
      string,
      {
        healthy: boolean
        latency_ms: number
        error?: string
      }
    >
    checked_at: string
  }
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user (optional - can be made public for monitoring)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Allow unauthenticated access for health monitoring
    // but limit the response for non-authenticated users
    const isAuthenticated = !!user

    // Run health checks
    const healthResults = await verificationService.checkProvidersHealth()

    // Calculate overall health
    const allProviders = Object.values(healthResults)
    const healthyCount = allProviders.filter((p) => p.healthy).length
    const overallHealthy = healthyCount === allProviders.length

    // For non-authenticated users, return simplified response
    if (!isAuthenticated) {
      return NextResponse.json({
        success: true,
        data: {
          overall_healthy: overallHealthy,
          providers: {},
          checked_at: new Date().toISOString(),
        },
      } as HealthCheckResponse)
    }

    return NextResponse.json({
      success: true,
      data: {
        overall_healthy: overallHealthy,
        providers: healthResults,
        checked_at: new Date().toISOString(),
      },
    } as HealthCheckResponse)
  } catch (error) {
    apiLogger.error('Verification health check error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as HealthCheckResponse,
      { status: 500 }
    )
  }
}
