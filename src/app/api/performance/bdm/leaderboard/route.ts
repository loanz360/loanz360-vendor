import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/bdm/leaderboard
 * Returns leaderboard for Business Development Manager team
 */
export async function GET(request: NextRequest) {
  try {
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

    const { data: allBDMs } = await supabase
      .from('users')
      .select('id, full_name, location')
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_MANAGER')
      .eq('status', 'active')

    if (!allBDMs || allBDMs.length === 0) {
      return NextResponse.json({ leaderboard: [], currentUserRank: 0 })
    }

    const leaderboard: LeaderboardEntry[] = []

    for (const bdm of allBDMs) {
      const { data: targets } = await supabase
        .from('bdm_targets')
        .select('*')
        .eq('user_id', bdm.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      const { data: dailyMetrics } = await supabase
        .from('bdm_daily_metrics')
        .select('*')
        .eq('user_id', bdm.id)
        .gte('metric_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lt('metric_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

      if (!targets || !dailyMetrics) continue

      const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.revenue_generated || 0), 0)
      const totalLeadsConverted = dailyMetrics.reduce((sum, d) => sum + (d.leads_converted || 0), 0)

      const revenueAchievement = targets.revenue_target > 0
        ? (totalRevenue / targets.revenue_target) * 100
        : 0

      const conversionAchievement = targets.leads_converted_target > 0
        ? (totalLeadsConverted / targets.leads_converted_target) * 100
        : 0

      const averageAchievement = (revenueAchievement + conversionAchievement) / 2

      leaderboard.push({
        userId: bdm.id,
        userName: bdm.full_name,
        location: bdm.location,
        score: Math.round(averageAchievement),
        rank: 0,
        totalRevenue,
        targetRevenue: targets.revenue_target,
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
    apiLogger.error('BDM leaderboard error', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
