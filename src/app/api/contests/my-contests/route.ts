
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeEnum, sanitizePaginationParams } from '@/lib/security/sanitization'

/**
 * GET /api/contests/my-contests
 * Get contests assigned to the logged-in partner
 * Access: Partners with PERFORMANCE_VIEW_OWN permission
 */
export async function GET(request: NextRequest) {
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

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.PERFORMANCE_VIEW_OWN)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Parse and sanitize query parameters
    const { searchParams } = new URL(request.url)
    const { limit, offset } = sanitizePaginationParams(
      searchParams.get('limit'),
      searchParams.get('offset')
    )

    let status: string | undefined
    if (searchParams.get('status')) {
      try {
        status = sanitizeEnum(
          searchParams.get('status')!,
          ['draft', 'scheduled', 'active', 'expired', 'disabled'],
          'Status'
        )
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid status value' },
          { status: 400 }
        )
      }
    }

    const adminSupabase = createSupabaseAdmin()

    // Get user's contest participations (excluding soft-deleted contests)
    let query = adminSupabase
      .from('contest_participants')
      .select(`
        *,
        contest:contests!inner (
          id,
          contest_title,
          contest_description,
          contest_image_url,
          contest_type,
          start_date,
          end_date,
          status,
          reward_details,
          winner_count,
          reward_tiers,
          enable_leaderboard,
          leaderboard_visibility
        )
      `, { count: 'exact' })
      .eq('partner_id', user.id)
      .is('contest.deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply status filter on contest
    if (status) {
      query = query.eq('contest.status', status)
    }

    const { data: participations, error, count } = await query

    if (error) {
      logger.error(`Error fetching contests for partner ${user.id}`, error)
      throw new Error(`Failed to fetch contests: ${error.message}`)
    }

    // Format response
    const contests = participations?.map((p) => ({
      contest: p.contest,
      participation: {
        id: p.id,
        current_score: p.current_score,
        current_rank: p.current_rank,
        last_rank: p.last_rank,
        progress_percentage: p.progress_percentage,
        participation_status: p.participation_status,
        reward_tier_achieved: p.reward_tier_achieved,
        reward_amount: p.reward_amount,
        joined_at: p.joined_at,
        last_activity_at: p.last_activity_at,
      },
    })) || []

    // Separate into active and expired
    const activeContests = contests.filter((c) => c.contest.status === 'active')
    const expiredContests = contests.filter((c) => c.contest.status === 'expired')

    return NextResponse.json({
      success: true,
      data: {
        active: activeContests,
        expired: expiredContests,
        all: contests,
      },
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/my-contests', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchMyContests' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to fetch your contests',
      message: errorMessage,
    }, { status: 500 })
  }
}
