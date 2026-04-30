/**
 * BDM Team Targets - Overall Leaderboard API
 * Returns ranked performance data for all team BDEs
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getLeaderboardHandler(req)
  })
}

async function getLeaderboardHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const metric = searchParams.get('metric') || 'overall' // overall, leads, conversions, revenue, streak

    // =====================================================
    // 3. GET TEAM BDEs
    // =====================================================

    const { data: teamBDEs, error: bdeError } = await supabase
      .from('users')
      .select('id, name, email, employee_code, avatar_url, created_at')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })

    if (bdeError) {
      apiLogger.error('Error fetching BDEs', bdeError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch team data',
        },
        { status: 500 }
      )
    }

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          leaderboard: [],
          metric,
          month,
          year,
          topPerformer: null,
          teamStats: {
            totalBDEs: 0,
            activeBDEs: 0,
            avgAchievement: 0,
            totalLeads: 0,
            totalConversions: 0,
            totalRevenue: 0,
          },
        },
        timestamp: new Date().toISOString(),
      })
    }

    const bdeIds = teamBDEs.map((bde) => bde.id)

    // =====================================================
    // 4. GET CURRENT MONTH ACHIEVEMENTS
    // =====================================================

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month, 0).getDate()
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data: achievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('bde_user_id', bdeIds)
      .gte('achievement_date', startOfMonth)
      .lte('achievement_date', endOfMonth)
      .order('achievement_date', { ascending: false })

    if (achievementsError) {
      apiLogger.error('Error fetching achievements', achievementsError)
    }

    // Get latest achievement for each BDE
    const latestAchievements = new Map()
    achievements?.forEach((achievement) => {
      if (!latestAchievements.has(achievement.bde_user_id)) {
        latestAchievements.set(achievement.bde_user_id, achievement)
      }
    })

    // =====================================================
    // 5. GET TARGETS
    // =====================================================

    const { data: targets, error: targetsError } = await supabase
      .from('team_targets')
      .select('*')
      .in('user_id', bdeIds)
      .eq('target_type', 'BDE')
      .eq('month', month)
      .eq('year', year)
      .eq('is_active', true)

    if (targetsError) {
      apiLogger.error('Error fetching targets', targetsError)
    }

    // =====================================================
    // 6. GET EARNED BADGES
    // =====================================================

    const currentMonth = `${year}-${String(month).padStart(2, '0')}`

    const { data: earnedBadges, error: badgesError } = await supabase
      .from('bde_earned_badges')
      .select(`
        bde_user_id,
        badge_id,
        earned_at,
        achievement_badges (
          badge_name,
          badge_code,
          icon,
          rarity,
          color
        )
      `)
      .in('bde_user_id', bdeIds)
      .eq('earned_in_month', currentMonth)
      .eq('is_displayed', true)

    if (badgesError) {
      apiLogger.error('Error fetching badges', badgesError)
    }

    // Group badges by BDE
    const badgesByBDE = new Map()
    earnedBadges?.forEach((eb: unknown) => {
      if (!badgesByBDE.has(eb.bde_user_id)) {
        badgesByBDE.set(eb.bde_user_id, [])
      }
      badgesByBDE.get(eb.bde_user_id).push({
        id: eb.badge_id,
        name: eb.achievement_badges?.badge_name,
        icon: eb.achievement_badges?.icon,
        rarity: eb.achievement_badges?.rarity,
        color: eb.achievement_badges?.color,
        earnedAt: eb.earned_at,
      })
    })

    // =====================================================
    // 7. BUILD LEADERBOARD DATA
    // =====================================================

    let totalTeamLeads = 0
    let totalTeamConversions = 0
    let totalTeamRevenue = 0
    let activeBDECount = 0

    const leaderboardData = teamBDEs.map((bde) => {
      const achievement = latestAchievements.get(bde.id)
      const target = targets?.find((t) => t.user_id === bde.id)
      const badges = badgesByBDE.get(bde.id) || []

      const mtdLeads = achievement?.mtd_leads_contacted || 0
      const mtdConversions = achievement?.mtd_conversions || 0
      const mtdRevenue = achievement?.mtd_revenue || 0
      const currentStreak = achievement?.current_streak || 0

      const targetLeads = target?.monthly_conversion_target ? target.monthly_conversion_target * 5 : 100
      const targetConversions = target?.monthly_conversion_target || 20
      const targetRevenue = target?.monthly_revenue_target || 5000000

      const leadsAchievement = targetLeads > 0 ? (mtdLeads / targetLeads) * 100 : 0
      const conversionsAchievement = targetConversions > 0 ? (mtdConversions / targetConversions) * 100 : 0
      const revenueAchievement = targetRevenue > 0 ? (mtdRevenue / targetRevenue) * 100 : 0
      const overallAchievement = (leadsAchievement + conversionsAchievement + revenueAchievement) / 3

      // Calculate performance status
      let status: 'exceeding' | 'on_track' | 'at_risk' | 'behind' = 'behind'
      if (overallAchievement >= 100) status = 'exceeding'
      else if (overallAchievement >= 70) status = 'on_track'
      else if (overallAchievement >= 50) status = 'at_risk'

      // Calculate grade
      let grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' = 'F'
      if (overallAchievement >= 95) grade = 'A+'
      else if (overallAchievement >= 90) grade = 'A'
      else if (overallAchievement >= 85) grade = 'B+'
      else if (overallAchievement >= 80) grade = 'B'
      else if (overallAchievement >= 75) grade = 'C+'
      else if (overallAchievement >= 70) grade = 'C'
      else if (overallAchievement >= 60) grade = 'D'

      // Conversion rate
      const conversionRate = mtdLeads > 0 ? (mtdConversions / mtdLeads) * 100 : 0

      // Update team totals
      totalTeamLeads += mtdLeads
      totalTeamConversions += mtdConversions
      totalTeamRevenue += mtdRevenue
      if (achievement) activeBDECount++

      // Sort badges by rarity (legendary > epic > rare > common)
      const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 }
      badges.sort((a, b) => {
        const aRarity = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0
        const bRarity = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0
        return bRarity - aRarity
      })

      return {
        bdeId: bde.id,
        bdeName: bde.name,
        employeeCode: bde.employee_code,
        email: bde.email,
        avatarUrl: bde.avatar_url,
        joinedAt: bde.created_at,
        metrics: {
          leadsContacted: mtdLeads,
          conversions: mtdConversions,
          revenue: mtdRevenue,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          currentStreak,
        },
        targets: {
          leadsContacted: targetLeads,
          conversions: targetConversions,
          revenue: targetRevenue,
        },
        achievement: {
          leadsAchievement: parseFloat(leadsAchievement.toFixed(2)),
          conversionsAchievement: parseFloat(conversionsAchievement.toFixed(2)),
          revenueAchievement: parseFloat(revenueAchievement.toFixed(2)),
          overallAchievement: parseFloat(overallAchievement.toFixed(2)),
        },
        status,
        grade,
        badges: badges.slice(0, 5), // Show top 5 badges
        totalBadges: badges.length,
        // Scores for sorting
        scores: {
          overall: overallAchievement,
          leads: mtdLeads,
          conversions: mtdConversions,
          revenue: mtdRevenue,
          streak: currentStreak,
        },
      }
    })

    // =====================================================
    // 8. SORT LEADERBOARD BY SELECTED METRIC
    // =====================================================

    switch (metric) {
      case 'leads':
        leaderboardData.sort((a, b) => b.scores.leads - a.scores.leads)
        break
      case 'conversions':
        leaderboardData.sort((a, b) => b.scores.conversions - a.scores.conversions)
        break
      case 'revenue':
        leaderboardData.sort((a, b) => b.scores.revenue - a.scores.revenue)
        break
      case 'streak':
        leaderboardData.sort((a, b) => b.scores.streak - a.scores.streak)
        break
      case 'overall':
      default:
        leaderboardData.sort((a, b) => b.scores.overall - a.scores.overall)
        break
    }

    // Add rank to each entry
    const rankedLeaderboard = leaderboardData.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isTopPerformer: index === 0,
      movement: 0, // TODO: Calculate from previous month data
    }))

    // =====================================================
    // 9. CALCULATE TEAM STATISTICS
    // =====================================================

    const avgAchievement = leaderboardData.length > 0
      ? leaderboardData.reduce((sum, entry) => sum + entry.scores.overall, 0) / leaderboardData.length
      : 0

    const topPerformer = rankedLeaderboard[0] || null

    const teamStats = {
      totalBDEs: teamBDEs.length,
      activeBDEs: activeBDECount,
      avgAchievement: parseFloat(avgAchievement.toFixed(2)),
      totalLeads: totalTeamLeads,
      totalConversions: totalTeamConversions,
      totalRevenue: totalTeamRevenue,
    }

    // =====================================================
    // 10. GET PREVIOUS MONTH DATA FOR TRENDS
    // =====================================================

    const lastMonth = month === 1 ? 12 : month - 1
    const lastMonthYear = month === 1 ? year - 1 : year
    const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`
    const lastMonthDays = new Date(lastMonthYear, lastMonth, 0).getDate()
    const lastMonthEnd = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-${String(lastMonthDays).padStart(2, '0')}`

    const { data: lastMonthData } = await supabase
      .from('bde_daily_achievements')
      .select('bde_user_id, mtd_leads_contacted, mtd_conversions, mtd_revenue')
      .in('bde_user_id', bdeIds)
      .gte('achievement_date', lastMonthStart)
      .lte('achievement_date', lastMonthEnd)
      .order('achievement_date', { ascending: false })

    // Get latest achievement from last month for each BDE
    const lastMonthAchievements = new Map()
    lastMonthData?.forEach((achievement) => {
      if (!lastMonthAchievements.has(achievement.bde_user_id)) {
        lastMonthAchievements.set(achievement.bde_user_id, achievement)
      }
    })

    // Calculate month-over-month trends
    const leaderboardWithTrends = rankedLeaderboard.map((entry) => {
      const lastMonth = lastMonthAchievements.get(entry.bdeId)
      const lastMonthLeads = lastMonth?.mtd_leads_contacted || 0
      const lastMonthConversions = lastMonth?.mtd_conversions || 0
      const lastMonthRevenue = lastMonth?.mtd_revenue || 0

      const leadsTrend = lastMonthLeads > 0
        ? parseFloat((((entry.metrics.leadsContacted - lastMonthLeads) / lastMonthLeads) * 100).toFixed(2))
        : 0
      const conversionsTrend = lastMonthConversions > 0
        ? parseFloat((((entry.metrics.conversions - lastMonthConversions) / lastMonthConversions) * 100).toFixed(2))
        : 0
      const revenueTrend = lastMonthRevenue > 0
        ? parseFloat((((entry.metrics.revenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(2))
        : 0

      return {
        ...entry,
        trends: {
          leads: leadsTrend,
          conversions: conversionsTrend,
          revenue: revenueTrend,
          overall: parseFloat(((leadsTrend + conversionsTrend + revenueTrend) / 3).toFixed(2)),
        },
      }
    })

    // =====================================================
    // 11. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: leaderboardWithTrends,
        metric,
        month,
        year,
        topPerformer: topPerformer ? {
          bdeId: topPerformer.bdeId,
          name: topPerformer.bdeName,
          employeeCode: topPerformer.employeeCode,
          achievement: topPerformer.achievement.overallAchievement,
          grade: topPerformer.grade,
          badges: topPerformer.badges,
        } : null,
        teamStats,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getLeaderboardHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
