import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/cpm/leaderboard
 * Returns leaderboard for Channel Partner Manager team
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

    const { data: allCPMs } = await supabase
      .from('users')
      .select('id, full_name, location')
      .eq('sub_role', 'CHANNEL_PARTNER_MANAGER')
      .eq('status', 'active')

    if (!allCPMs || allCPMs.length === 0) {
      return NextResponse.json({ leaderboard: [], currentUserRank: 0, totalParticipants: 0 })
    }

    const leaderboard: LeaderboardEntry[] = []

    // Try to get leaderboard data - handle gracefully if tables don't exist
    try {
      for (const cpm of allCPMs) {
        let targets = null
        let dailyMetrics: any[] = []

        try {
          const { data, error } = await supabase
            .from('cpm_targets')
            .select('*')
            .eq('user_id', cpm.id)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .maybeSingle()

          if (!error) targets = data
        } catch (e) {
          // Table doesn't exist
        }

        try {
          const { data, error } = await supabase
            .from('cpm_daily_metrics')
            .select('*')
            .eq('user_id', cpm.id)
            .gte('metric_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
            .lt('metric_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

          if (!error && data) dailyMetrics = data
        } catch (e) {
          // Table doesn't exist
        }

        // Use default targets if none found
        const defaultTargets = {
          partner_revenue_target: 3000000,
          active_partners_target: 30,
        }
        const effectiveTargets = targets || defaultTargets

        const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.partner_revenue_generated || 0), 0)
        const latestMetric = dailyMetrics.length > 0 ? dailyMetrics[dailyMetrics.length - 1] : null
        const activePartners = latestMetric?.active_partners_count || 0

        const revenueAchievement = effectiveTargets.partner_revenue_target > 0
          ? (totalRevenue / effectiveTargets.partner_revenue_target) * 100
          : 0

        const partnersAchievement = effectiveTargets.active_partners_target > 0
          ? (activePartners / effectiveTargets.active_partners_target) * 100
          : 0

        const averageAchievement = (revenueAchievement + partnersAchievement) / 2

        leaderboard.push({
          userId: cpm.id,
          userName: cpm.full_name,
          location: cpm.location,
          score: Math.round(averageAchievement),
          rank: 0,
          totalRevenue,
          targetRevenue: effectiveTargets.partner_revenue_target,
          achievementPercentage: Math.round(averageAchievement),
        })
      }
    } catch (e) {
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
    apiLogger.error('CPM leaderboard error', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
