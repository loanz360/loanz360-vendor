import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dsm/leaderboard
 * Returns leaderboard for Direct Sales Manager team
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const { data: allDSMs } = await supabase
      .from('users')
      .select('id, full_name, location')
      .eq('sub_role', 'DIRECT_SALES_MANAGER')
      .eq('status', 'active')

    if (!allDSMs || allDSMs.length === 0) {
      return NextResponse.json({ leaderboard: [], currentUserRank: 0 })
    }

    const leaderboard: LeaderboardEntry[] = []

    for (const dsm of allDSMs) {
      const { data: targets } = await supabase
        .from('dsm_targets')
        .select('*')
        .eq('user_id', dsm.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      const { data: dailyMetrics } = await supabase
        .from('dsm_daily_metrics')
        .select('*')
        .eq('user_id', dsm.id)
        .gte('metric_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lt('metric_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

      if (!targets || !dailyMetrics) continue

      const totalTeamRevenue = dailyMetrics.reduce((sum, d) => sum + (d.team_revenue_generated || 0), 0)
      const individualRevenue = dailyMetrics.reduce((sum, d) => sum + (d.individual_revenue_generated || 0), 0)

      const teamRevenueAchievement = targets.team_revenue_target > 0
        ? (totalTeamRevenue / targets.team_revenue_target) * 100
        : 0

      const individualRevenueAchievement = targets.individual_revenue_target > 0
        ? (individualRevenue / targets.individual_revenue_target) * 100
        : 0

      const averageAchievement = (teamRevenueAchievement + individualRevenueAchievement) / 2

      leaderboard.push({
        userId: dsm.id,
        userName: dsm.full_name,
        location: dsm.location,
        score: Math.round(averageAchievement),
        rank: 0,
        totalRevenue: totalTeamRevenue,
        targetRevenue: targets.team_revenue_target,
        achievementPercentage: Math.round(averageAchievement),
      })
    }

    leaderboard.sort((a, b) => b.score - a.score)
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1
    })

    const currentUserRank = leaderboard.findIndex(e => e.userId === user.id) + 1

    return NextResponse.json({
      leaderboard,
      currentUserRank,
      totalParticipants: leaderboard.length,
    })
  } catch (error) {
    apiLogger.error('DSM leaderboard error', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
