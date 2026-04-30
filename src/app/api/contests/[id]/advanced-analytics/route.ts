
/**
 * GET /api/contests/:id/advanced-analytics
 * Get advanced analytics for a contest
 * Includes trends, predictions, and insights
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeUuid } from '@/lib/security/sanitization'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import logger from '@/lib/monitoring/logger'
import {
  getComprehensiveAnalytics,
  getContestTrends,
  getLeaderboardChanges,
  getScoreDistribution,
  getPredictiveAnalytics,
} from '@/lib/analytics/contest-analytics'
import {
  getCachedAnalytics,
  setCachedAnalytics,
  CACHE_TTL,
} from '@/lib/cache/redis-client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Validate contest ID
    const { id } = params
    try {
      sanitizeUuid(id)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      )
    }

    // Check permission (admins only for advanced analytics)
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_VIEW)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const analysisType = searchParams.get('type') || 'comprehensive'

    // Try to get from cache
    const cacheKey = `${id}:${analysisType}`
    const cachedAnalytics = await getCachedAnalytics(cacheKey)

    if (cachedAnalytics) {
      logger.info(`Cache HIT for advanced analytics: ${cacheKey}`)
      return NextResponse.json({
        success: true,
        data: cachedAnalytics,
        cached: true,
      })
    }

    logger.info(`Cache MISS for advanced analytics: ${cacheKey}`)

    // Fetch analytics based on type
    let analyticsData

    switch (analysisType) {
      case 'trends':
        analyticsData = await getContestTrends(id)
        break

      case 'leaderboard-changes':
        analyticsData = await getLeaderboardChanges(id)
        break

      case 'score-distribution':
        analyticsData = await getScoreDistribution(id)
        break

      case 'predictions':
        analyticsData = await getPredictiveAnalytics(id)
        break

      case 'comprehensive':
      default:
        analyticsData = await getComprehensiveAnalytics(id)
        break
    }

    // Cache the result
    await setCachedAnalytics(cacheKey, analyticsData)
    logger.info(`Cached advanced analytics: ${cacheKey}`)

    return NextResponse.json({
      success: true,
      data: analyticsData,
      analysis_type: analysisType,
      cached: false,
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/:id/advanced-analytics', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to fetch advanced analytics',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
