
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeUuid } from '@/lib/security/sanitization'

/**
 * GET /api/contests/:id/my-status
 * Get my participation status and performance in a contest
 * Access: Authenticated users with PERFORMANCE_VIEW_OWN permission (Partners)
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

    // Check permission - users can only view their own performance
    const permissionCheck = await requirePermission(user.id, Permission.PERFORMANCE_VIEW_OWN)
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
      .select(`
        id,
        contest_title,
        contest_description,
        contest_image_url,
        contest_rules,
        contest_type,
        start_date,
        end_date,
        status,
        evaluation_criteria,
        reward_details,
        winner_count,
        reward_tiers,
        enable_leaderboard,
        leaderboard_visibility,
        show_scores
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (contestError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    // Fetch my participation
    const { data: participation, error: participationError } = await adminSupabase
      .from('contest_participants')
      .select('*')
      .eq('contest_id', id)
      .eq('partner_id', user.id)
      .maybeSingle()

    if (participationError && participationError.code !== 'PGRST116') {
      logger.error(`Error fetching participation for partner ${user.id} in contest ${id}`, participationError)
      throw new Error(`Failed to fetch participation: ${participationError.message}`)
    }

    // If not participating, check eligibility
    if (!participation) {
      return NextResponse.json({
        success: true,
        data: {
          contest,
          participation: null,
          is_participant: false,
          message: 'You are not enrolled in this contest',
        },
      })
    }

    // Fetch my leaderboard position
    const { data: leaderboardEntry } = await adminSupabase
      .from('contest_leaderboard')
      .select('*')
      .eq('contest_id', id)
      .eq('partner_id', user.id)
      .maybeSingle()

    // Fetch my performance history
    const { data: performanceHistory } = await adminSupabase
      .from('contest_performance_history')
      .select('recorded_at, score_snapshot, rank_snapshot, metric_name, metric_value')
      .eq('contest_id', id)
      .eq('partner_id', user.id)
      .order('recorded_at', { ascending: true })
      .limit(100)

    // Calculate days remaining
    const now = new Date()
    const endDate = new Date(contest.end_date)
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      success: true,
      data: {
        contest,
        participation,
        leaderboard: leaderboardEntry,
        performanceHistory: performanceHistory || [],
        is_participant: true,
        days_remaining: Math.max(0, daysRemaining),
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/contests/:id/my-status', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchMyStatus' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to fetch your contest status',
      message: errorMessage,
    }, { status: 500 })
  }
}
