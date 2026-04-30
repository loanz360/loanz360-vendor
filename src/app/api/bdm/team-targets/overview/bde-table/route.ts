/**
 * BDM Team Targets - BDE Performance Table API
 * Returns detailed performance table data for all team BDEs
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getBDETableHandler(req)
  })
}

async function getBDETableHandler(request: NextRequest) {
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

    // =====================================================
    // 3. GET TEAM BDEs
    // =====================================================

    const { data: teamBDEs, error: bdeError } = await supabase
      .from('users')
      .select('id, name, email, employee_code, created_at')
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
          bdes: [],
          totals: {
            leadsContacted: 0,
            conversions: 0,
            revenue: 0,
            targetLeads: 0,
            targetConversions: 0,
            targetRevenue: 0,
          },
        },
        timestamp: new Date().toISOString(),
      })
    }

    const bdeIds = teamBDEs.map((bde) => bde.id)

    // =====================================================
    // 4. GET LATEST ACHIEVEMENTS FOR CURRENT MONTH
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
          rarity
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
    earnedBadges?.forEach((eb: any) => {
      if (!badgesByBDE.has(eb.bde_user_id)) {
        badgesByBDE.set(eb.bde_user_id, [])
      }
      badgesByBDE.get(eb.bde_user_id).push({
        id: eb.badge_id,
        name: eb.achievement_badges?.badge_name,
        icon: eb.achievement_badges?.icon,
        rarity: eb.achievement_badges?.rarity,
        earnedAt: eb.earned_at,
      })
    })

    // =====================================================
    // 7. BUILD BDE PERFORMANCE DATA
    // =====================================================

    let totalLeadsContacted = 0
    let totalConversions = 0
    let totalRevenue = 0
    let totalTargetLeads = 0
    let totalTargetConversions = 0
    let totalTargetRevenue = 0

    const bdePerformanceData = teamBDEs.map((bde) => {
      const achievement = latestAchievements.get(bde.id)
      const target = targets?.find((t) => t.user_id === bde.id)
      const badges = badgesByBDE.get(bde.id) || []

      const mtdLeads = achievement?.mtd_leads_contacted || 0
      const mtdConversions = achievement?.mtd_conversions || 0
      const mtdRevenue = achievement?.mtd_revenue || 0

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

      // Current streak
      const currentStreak = achievement?.current_streak || 0

      // Update totals
      totalLeadsContacted += mtdLeads
      totalConversions += mtdConversions
      totalRevenue += mtdRevenue
      totalTargetLeads += targetLeads
      totalTargetConversions += targetConversions
      totalTargetRevenue += targetRevenue

      return {
        bdeId: bde.id,
        bdeName: bde.name,
        employeeCode: bde.employee_code,
        email: bde.email,
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
        badges: badges.slice(0, 3), // Show top 3 badges
        totalBadges: badges.length,
        lastActivityDate: achievement?.achievement_date || null,
      }
    })

    // Sort by overall achievement (descending)
    bdePerformanceData.sort((a, b) => b.achievement.overallAchievement - a.achievement.overallAchievement)

    // =====================================================
    // 8. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        bdes: bdePerformanceData,
        totals: {
          leadsContacted: totalLeadsContacted,
          conversions: totalConversions,
          revenue: totalRevenue,
          targetLeads: totalTargetLeads,
          targetConversions: totalTargetConversions,
          targetRevenue: totalTargetRevenue,
          leadsAchievement: totalTargetLeads > 0 ? parseFloat(((totalLeadsContacted / totalTargetLeads) * 100).toFixed(2)) : 0,
          conversionsAchievement: totalTargetConversions > 0 ? parseFloat(((totalConversions / totalTargetConversions) * 100).toFixed(2)) : 0,
          revenueAchievement: totalTargetRevenue > 0 ? parseFloat(((totalRevenue / totalTargetRevenue) * 100).toFixed(2)) : 0,
        },
        month,
        year,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getBDETableHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
