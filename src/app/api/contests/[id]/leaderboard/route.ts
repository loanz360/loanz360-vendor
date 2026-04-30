
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission, isPartner } from '@/lib/auth/rbac'
import { sanitizeUuid, sanitizePaginationParams } from '@/lib/security/sanitization'
import { getCachedLeaderboard, setCachedLeaderboard, invalidateContestCache } from '@/lib/cache/redis-client'

/**
 * GET /api/contests/:id/leaderboard
 * Get contest leaderboard with rankings
 * Access: Authenticated users with LEADERBOARD_VIEW_ALL or LEADERBOARD_VIEW_OWN permission
 */
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

    // Check if user is partner (determines what they can see)
    const userIsPartner = await isPartner(user.id)

    // Check permissions
    // Partners can view leaderboards (may be restricted by visibility settings)
    // Admins get full access to all leaderboards
    const requiredPermission = userIsPartner
      ? Permission.LEADERBOARD_VIEW_OWN
      : Permission.LEADERBOARD_VIEW_ALL

    const permissionCheck = await requirePermission(user.id, requiredPermission)
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
    const subrole = searchParams.get('subrole')

    // Use admin client for data fetching
    const adminSupabase = createSupabaseAdmin()

    // Check if contest exists and leaderboard is enabled
    const { data: contest, error: contestError } = await adminSupabase
      .from('contests')
      .select('id, contest_title, enable_leaderboard, leaderboard_visibility, show_scores')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (contestError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    if (!contest.enable_leaderboard) {
      return NextResponse.json({ success: false, error: 'Leaderboard is disabled for this contest' }, { status: 403 })
    }

    // Handle private leaderboard - partners can only see their own entry
    if (contest.leaderboard_visibility === 'private' && userIsPartner) {
      const { data: ownEntry, error: ownError } = await adminSupabase
        .from('contest_leaderboard')
        .select(`
          *,
          partner:auth.users!contest_leaderboard_partner_id_fkey (
            id,
            email
          )
        `)
        .eq('contest_id', id)
        .eq('partner_id', user.id)
        .maybeSingle()

      if (ownError && ownError.code !== 'PGRST116') {
        logger.error(`Error fetching own leaderboard entry ${id}`, ownError)
        throw ownError
      }

      return NextResponse.json({
        success: true,
        data: {
          contest: {
            id: contest.id,
            title: contest.contest_title,
          },
          leaderboard: ownEntry ? [ownEntry] : [],
          visibility: 'private',
          pagination: {
            total: ownEntry ? 1 : 0,
            limit,
            offset: 0,
            hasMore: false,
          },
        },
      })
    }

    // Try to get from cache first (only for public leaderboards)
    const cachedLeaderboard = await getCachedLeaderboard(id, limit)
    if (cachedLeaderboard && offset === 0) {
      logger.info(`Cache HIT for leaderboard: ${id}`)
      return NextResponse.json({
        success: true,
        data: cachedLeaderboard,
        cached: true,
      })
    }

    logger.info(`Cache MISS for leaderboard: ${id}`)

    // Build leaderboard query for public/rank_only visibility
    let query = adminSupabase
      .from('contest_leaderboard')
      .select(`
        *,
        partner:auth.users!contest_leaderboard_partner_id_fkey (
          id,
          email
        )
      `, { count: 'exact' })
      .eq('contest_id', id)
      .order('current_rank', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: leaderboard, error, count } = await query

    if (error) {
      logger.error(`Error fetching leaderboard for contest ${id}`, error)
      throw new Error(`Failed to fetch leaderboard: ${error.message}`)
    }

    // Format response based on visibility settings
    let formattedLeaderboard = leaderboard || []

    if (contest.leaderboard_visibility === 'rank_only' || !contest.show_scores) {
      // Hide scores, only show ranks
      formattedLeaderboard = formattedLeaderboard.map((entry) => ({
        ...entry,
        total_score: null,
        score_breakdown: null,
      }))
    }

    const responseData = {
      contest: {
        id: contest.id,
        title: contest.contest_title,
      },
      leaderboard: formattedLeaderboard,
      visibility: contest.leaderboard_visibility,
      showScores: contest.show_scores,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    }

    // Cache the leaderboard (only first page)
    if (offset === 0) {
      await setCachedLeaderboard(id, limit, responseData)
      logger.info(`Cached leaderboard for contest: ${id}`)
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/:id/leaderboard', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchLeaderboard' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to fetch leaderboard',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * POST /api/contests/:id/leaderboard/refresh
 * Manually trigger leaderboard refresh
 * Access: Users with LEADERBOARD_REFRESH permission (Admins only)
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
    const permissionCheck = await requirePermission(user.id, Permission.LEADERBOARD_REFRESH)
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

    // Only allow refresh for active contests
    if (contest.status !== 'active') {
      return NextResponse.json(
        { error: 'Can only refresh leaderboard for active contests' },
        { status: 400 }
      )
    }

    // Call the database function to update leaderboard
    const { error: refreshError } = await adminSupabase.rpc('update_contest_leaderboard', {
      p_contest_id: id,
    })

    if (refreshError) {
      logger.error(`Error refreshing leaderboard for contest ${id}`, refreshError)
      throw new Error(`Failed to refresh leaderboard: ${refreshError.message}`)
    }

    // Invalidate cache after refresh
    await invalidateContestCache(id)
    logger.info(`Invalidated cache for contest: ${id}`)

    // Log audit event
    const { logContestAction, ContestAuditAction, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')
    await logContestAction({
      contest_id: id,
      action: ContestAuditAction.LEADERBOARD_REFRESHED,
      changed_by: user.id,
      metadata: {
        contest_title: contest.contest_title,
      },
      ip_address: getClientIp(request),
      user_agent: getUserAgent(request),
    })

    logger.info(`Leaderboard refreshed for contest ${id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Leaderboard refreshed successfully',
    })
  } catch (error) {
    logger.error('Error in POST /api/contests/:id/leaderboard/refresh', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'refreshLeaderboard' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to refresh leaderboard',
      message: errorMessage,
    }, { status: 500 })
  }
}
