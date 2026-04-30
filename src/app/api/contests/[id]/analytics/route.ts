
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeUuid } from '@/lib/security/sanitization'

/**
 * GET /api/contests/:id/analytics
 * Get contest analytics and statistics
 * Access: Users with ANALYTICS_VIEW_ALL permission (Admins, HR Managers, Contest Managers)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
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

    // Sanitize and validate ID
    const { id } = params
    try {
      sanitizeUuid(id)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      )
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.ANALYTICS_VIEW_ALL)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    const adminSupabase = createSupabaseAdmin()

    // Fetch contest details
    const { data: contest, error: contestError } = await adminSupabase
      .from('contests')
      .select('id, contest_title, start_date, end_date, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (contestError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    // Fetch analytics data
    const { data: analytics, error: analyticsError } = await adminSupabase
      .from('contest_analytics')
      .select('*')
      .eq('contest_id', id)
      .maybeSingle()

    if (analyticsError && analyticsError.code !== 'PGRST116') {
      logger.error(`Error fetching analytics for contest ${id}`, analyticsError)
      throw new Error(`Failed to fetch analytics: ${analyticsError.message}`)
    }

    // If no analytics record exists, calculate it
    if (!analytics) {
      const { error: calcError } = await adminSupabase.rpc('calculate_contest_analytics', {
        p_contest_id: id
      })

      if (calcError) {
        logger.error(`Error calculating analytics for contest ${id}`, calcError)
        // Continue with default analytics instead of failing
      }

      // Fetch again
      const { data: newAnalytics } = await adminSupabase
        .from('contest_analytics')
        .select('*')
        .eq('contest_id', id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        data: {
          contest,
          analytics: newAnalytics || getDefaultAnalytics(),
        },
      })
    }

    // Fetch top performers
    const { data: topPerformers } = await adminSupabase
      .from('contest_leaderboard')
      .select(`
        current_rank,
        total_score,
        partner:auth.users!contest_leaderboard_partner_id_fkey (
          id,
          email
        )
      `)
      .eq('contest_id', id)
      .order('current_rank', { ascending: true })
      .limit(10)

    // Fetch performance trends
    const { data: performanceHistory } = await adminSupabase
      .from('contest_performance_history')
      .select('recorded_at, metric_name, metric_value')
      .eq('contest_id', id)
      .order('recorded_at', { ascending: true })
      .limit(100)

    return NextResponse.json({
      success: true,
      data: {
        contest,
        analytics,
        topPerformers: topPerformers || [],
        performanceHistory: performanceHistory || [],
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/:id/analytics', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchContestAnalytics' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to fetch analytics',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * POST /api/contests/:id/analytics/refresh
 * Manually trigger analytics recalculation
 * Access: Users with ANALYTICS_REFRESH permission (Admins only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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

    // Sanitize and validate ID
    const { id } = params
    try {
      sanitizeUuid(id)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      )
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.ANALYTICS_REFRESH)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    const adminSupabase = createSupabaseAdmin()

    // Check if contest exists
    const { data: contest, error: fetchError } = await adminSupabase
      .from('contests')
      .select('id, contest_title, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    // Call the database function to recalculate analytics
    const { error: refreshError } = await adminSupabase.rpc('calculate_contest_analytics', {
      p_contest_id: id,
    })

    if (refreshError) {
      logger.error(`Error refreshing analytics for contest ${id}`, refreshError)
      throw new Error(`Failed to refresh analytics: ${refreshError.message}`)
    }

    // Log audit event
    const { logContestAction, ContestAuditAction, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')
    await logContestAction({
      contest_id: id,
      action: ContestAuditAction.ANALYTICS_REFRESHED,
      changed_by: user.id,
      metadata: {
        contest_title: contest.contest_title,
      },
      ip_address: getClientIp(request),
      user_agent: getUserAgent(request),
    })

    logger.info(`Analytics refreshed for contest ${id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Analytics refreshed successfully',
    })
  } catch (error) {
    logger.error('Error in POST /api/contests/:id/analytics/refresh', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'refreshAnalytics' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to refresh analytics',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * Helper: Get default analytics structure
 */
function getDefaultAnalytics() {
  return {
    total_eligible_partners: 0,
    total_active_participants: 0,
    participation_rate: 0,
    avg_score: 0,
    median_score: 0,
    highest_score: 0,
    lowest_score: 0,
    total_activities: 0,
    avg_activities_per_partner: 0,
    geography_breakdown: {},
    subrole_breakdown: {},
  }
}
