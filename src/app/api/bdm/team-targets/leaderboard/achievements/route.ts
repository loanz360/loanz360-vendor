/**
 * BDM Team Targets - Team Achievements API
 * Returns team-wide achievements, streaks, milestones, and records
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getTeamAchievementsHandler(req)
  })
}

async function getTeamAchievementsHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // Get team BDEs
    const { data: teamBDEs } = await supabase
      .from('users')
      .select('id, name, employee_code')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { badges: [], streaks: [], milestones: [], records: [] },
        timestamp: new Date().toISOString(),
      })
    }

    const teamBDEIds = teamBDEs.map((bde) => bde.id)

    // Fetch badges earned
    const { data: badges } = await supabase
      .from('bde_earned_badges')
      .select(
        `
        id, earned_at, user_id,
        achievement_badges(badge_name, badge_code, icon, color, rarity, category, points),
        users!bde_earned_badges_user_id_fkey(name, employee_code)
      `
      )
      .in('user_id', teamBDEIds)
      .eq('earned_for_month', month)
      .eq('earned_for_year', year)
      .order('earned_at', { ascending: false })

    // Fetch daily achievements for streak calculation
    const { data: achievements } = await supabase
      .from('bde_daily_achievements')
      .select('user_id, activity_date, achievement_status, current_streak')
      .in('user_id', teamBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    // Calculate streaks
    const streaks = teamBDEs.map((bde) => {
      const bdeAchievements = achievements?.filter((a) => a.user_id === bde.id) || []
      const currentStreak = bdeAchievements.length > 0 ? Math.max(...bdeAchievements.map((a) => a.current_streak || 0)) : 0

      return {
        bdeId: bde.id,
        bdeName: bde.name,
        currentStreak,
        type: currentStreak >= 10 ? 'legendary' : currentStreak >= 7 ? 'epic' : currentStreak >= 5 ? 'rare' : 'common',
      }
    }).filter(s => s.currentStreak > 0).sort((a, b) => b.currentStreak - a.currentStreak)

    // Milestone achievements
    const milestones = []
    badges?.forEach((badge) => {
      const badgeInfo = badge.achievement_badges as any
      if (badgeInfo?.category === 'milestone') {
        milestones.push({
          bdeName: (badge.users as any)?.name || 'Unknown',
          badgeName: badgeInfo.badge_name,
          icon: badgeInfo.icon,
          earnedAt: badge.earned_at,
        })
      }
    })

    // Team records
    const { data: dailyData } = await supabase
      .from('bde_daily_achievements')
      .select('user_id, conversions, revenue_generated, leads_contacted')
      .in('user_id', teamBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    const bestConversionDay = dailyData && dailyData.length > 0
      ? dailyData.reduce((max, d) => d.conversions > max.conversions ? d : max)
      : null

    const bestRevenueDay = dailyData && dailyData.length > 0
      ? dailyData.reduce((max, d) => (d.revenue_generated || 0) > (max.revenue_generated || 0) ? d : max)
      : null

    const records = []
    if (bestConversionDay) {
      const bde = teamBDEs.find(b => b.id === bestConversionDay.user_id)
      records.push({
        type: 'conversions',
        bdeName: bde?.name || 'Unknown',
        value: bestConversionDay.conversions,
        displayValue: `${bestConversionDay.conversions} conversions`,
        icon: '🏆',
      })
    }
    if (bestRevenueDay) {
      const bde = teamBDEs.find(b => b.id === bestRevenueDay.user_id)
      records.push({
        type: 'revenue',
        bdeName: bde?.name || 'Unknown',
        value: bestRevenueDay.revenue_generated,
        displayValue: `₹${((bestRevenueDay.revenue_generated || 0) / 100000).toFixed(2)}L`,
        icon: '💎',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        badges: badges?.map(b => ({
          bdeName: (b.users as any)?.name,
          badge: (b.achievement_badges as any),
          earnedAt: b.earned_at,
        })) || [],
        streaks: streaks.slice(0, 10),
        milestones,
        records,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getTeamAchievementsHandler', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
