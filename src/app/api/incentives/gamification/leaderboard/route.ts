
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/incentives/gamification/leaderboard
 * Fetch leaderboard data for gamification
 * Returns top performers and user's rank
 * Access: All authenticated employees
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch leaderboard data
    const { data: leaderboard, error: leaderboardError } = await supabase
      .rpc('get_incentive_leaderboard', { result_limit: limit })

    if (leaderboardError) {
      logger.error('Error fetching leaderboard:', leaderboardError)
      throw leaderboardError
    }

    // Get user's rank
    const { data: userRank, error: rankError } = await supabase
      .rpc('get_user_incentive_rank', { user_uuid: user.id })

    if (rankError) {
      logger.error('Error fetching user rank:', rankError)
    }

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard || [],
      userRank: userRank ? userRank[0] : null,
    })
  } catch (error) {
    logger.error('Error in GET /api/incentives/gamification/leaderboard', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
