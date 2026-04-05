/**
 * BDM Team Targets - Overview Summary API
 * Returns team summary cards for the monthly overview dashboard
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
    return await getTeamSummaryHandler(req)
  })
}

async function getTeamSummaryHandler(request: NextRequest) {
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
      .select('id, name')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

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

    const bdeIds = teamBDEs?.map((bde) => bde.id) || []

    if (bdeIds.length === 0) {
      // No team members, return empty summary
      return NextResponse.json({
        success: true,
        data: {
          teamAchievementRate: {
            id: 'team_achievement',
            title: 'Team Achievement Rate',
            value: 0,
            target: 100,
            achievement: 0,
            trend: {
              direction: 'stable' as const,
              percentage: 0,
              comparison: 'vs last month',
            },
            color: '#3B82F6',
            icon: '📊',
            subtitle: '0 BDEs on track',
          },
          totalLeadsContacted: {
            id: 'total_leads',
            title: 'Total Leads Contacted (MTD)',
            value: 0,
            target: 0,
            achievement: 0,
            trend: {
              direction: 'stable' as const,
              percentage: 0,
              comparison: 'vs last month',
            },
            color: '#8B5CF6',
            icon: '📞',
          },
          totalConversions: {
            id: 'total_conversions',
            title: 'Total Conversions (MTD)',
            value: 0,
            target: 0,
            achievement: 0,
            trend: {
              direction: 'stable' as const,
              percentage: 0,
              comparison: 'vs last month',
            },
            color: '#10B981',
            icon: '✅',
          },
          totalRevenue: {
            id: 'total_revenue',
            title: 'Total Revenue Generated (MTD)',
            value: 0,
            target: 0,
            achievement: 0,
            trend: {
              direction: 'stable' as const,
              percentage: 0,
              comparison: 'vs last month',
            },
            color: '#F59E0B',
            icon: '💰',
          },
          avgConversionRate: {
            id: 'avg_conversion',
            title: 'Average Conversion Rate',
            value: 0,
            target: 12,
            achievement: 0,
            trend: {
              direction: 'stable' as const,
              percentage: 0,
              comparison: 'vs target',
            },
            color: '#10B981',
            icon: '🎯',
            subtitle: 'Team average',
          },
          atRiskBDEs: {
            id: 'at_risk',
            title: 'At-Risk BDEs',
            value: 0,
            achievement: 0,
            trend: {
              direction: 'stable' as const,
              percentage: 0,
              comparison: 'vs last month',
            },
            color: '#EF4444',
            icon: '⚠️',
            subtitle: 'Action required',
          },
        },
        timestamp: new Date().toISOString(),
      })
    }

    // =====================================================
    // 4. GET CURRENT MONTH ACHIEVEMENTS
    // =====================================================

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

    // Get daily achievements for current month
    const { data: dailyAchievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('bde_user_id, mtd_leads_contacted, mtd_conversions, mtd_revenue')
      .in('bde_user_id', bdeIds)
      .gte('achievement_date', startOfMonth)
      .lte('achievement_date', endOfMonth)
      .order('achievement_date', { ascending: false })

    if (achievementsError) {
      apiLogger.error('Error fetching achievements', achievementsError)
    }

    // Get latest achievement for each BDE
    const latestAchievements = new Map()
    dailyAchievements?.forEach((achievement) => {
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
    // 6. CALCULATE AGGREGATES
    // =====================================================

    let totalLeadsContacted = 0
    let totalConversions = 0
    let totalRevenue = 0
    let totalLeadsTarget = 0
    let totalConversionsTarget = 0
    let totalRevenueTarget = 0
    let achievementRates: number[] = []
    let atRiskCount = 0

    bdeIds.forEach((bdeId) => {
      const achievement = latestAchievements.get(bdeId)
      const target = targets?.find((t) => t.user_id === bdeId)

      const leads = achievement?.mtd_leads_contacted || 0
      const conversions = achievement?.mtd_conversions || 0
      const revenue = achievement?.mtd_revenue || 0

      const leadsTarget = target?.monthly_conversion_target ? target.monthly_conversion_target * 5 : 100 // Assume 5 leads per conversion
      const conversionsTarget = target?.monthly_conversion_target || 20
      const revenueTarget = target?.monthly_revenue_target || 5000000

      totalLeadsContacted += leads
      totalConversions += conversions
      totalRevenue += revenue
      totalLeadsTarget += leadsTarget
      totalConversionsTarget += conversionsTarget
      totalRevenueTarget += revenueTarget

      // Calculate individual achievement rate
      const leadRate = leadsTarget > 0 ? (leads / leadsTarget) * 100 : 0
      const convRate = conversionsTarget > 0 ? (conversions / conversionsTarget) * 100 : 0
      const revRate = revenueTarget > 0 ? (revenue / revenueTarget) * 100 : 0
      const overallRate = (leadRate + convRate + revRate) / 3

      achievementRates.push(overallRate)

      // Count at-risk BDEs (< 70% achievement)
      if (overallRate < 70) {
        atRiskCount++
      }
    })

    const teamAchievementRate = achievementRates.length > 0
      ? achievementRates.reduce((sum, rate) => sum + rate, 0) / achievementRates.length
      : 0

    const leadsAchievement = totalLeadsTarget > 0 ? (totalLeadsContacted / totalLeadsTarget) * 100 : 0
    const conversionsAchievement = totalConversionsTarget > 0 ? (totalConversions / totalConversionsTarget) * 100 : 0
    const revenueAchievement = totalRevenueTarget > 0 ? (totalRevenue / totalRevenueTarget) * 100 : 0
    const avgConversionRate = totalLeadsContacted > 0 ? (totalConversions / totalLeadsContacted) * 100 : 0
    const onTrackCount = bdeIds.length - atRiskCount

    // =====================================================
    // 7. GET LAST MONTH DATA FOR TRENDS
    // =====================================================

    const lastMonth = month === 1 ? 12 : month - 1
    const lastMonthYear = month === 1 ? year - 1 : year
    const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`
    const lastMonthEnd = new Date(lastMonthYear, lastMonth, 0).toISOString().split('T')[0]

    const { data: lastMonthData } = await supabase
      .from('bde_daily_achievements')
      .select('mtd_leads_contacted, mtd_conversions, mtd_revenue')
      .in('bde_user_id', bdeIds)
      .gte('achievement_date', lastMonthStart)
      .lte('achievement_date', lastMonthEnd)
      .order('achievement_date', { ascending: false })
      .limit(bdeIds.length)

    let lastMonthLeads = 0
    let lastMonthConversions = 0
    let lastMonthRevenue = 0

    lastMonthData?.forEach((data) => {
      lastMonthLeads += data.mtd_leads_contacted || 0
      lastMonthConversions += data.mtd_conversions || 0
      lastMonthRevenue += data.mtd_revenue || 0
    })

    const leadsTrend = lastMonthLeads > 0 ? ((totalLeadsContacted - lastMonthLeads) / lastMonthLeads) * 100 : 0
    const conversionsTrend = lastMonthConversions > 0 ? ((totalConversions - lastMonthConversions) / lastMonthConversions) * 100 : 0
    const revenueTrend = lastMonthRevenue > 0 ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0

    // =====================================================
    // 8. BUILD RESPONSE
    // =====================================================

    const summary = {
      teamAchievementRate: {
        id: 'team_achievement',
        title: 'Team Achievement Rate',
        value: Math.round(teamAchievementRate),
        target: 100,
        achievement: teamAchievementRate,
        trend: {
          direction: (teamAchievementRate >= 100 ? 'up' : teamAchievementRate >= 70 ? 'stable' : 'down') as 'up' | 'down' | 'stable',
          percentage: Math.abs(teamAchievementRate - 100),
          comparison: 'vs target',
        },
        color: '#3B82F6',
        icon: '📊',
        subtitle: `${onTrackCount}/${bdeIds.length} BDEs on track`,
      },
      totalLeadsContacted: {
        id: 'total_leads',
        title: 'Total Leads Contacted (MTD)',
        value: totalLeadsContacted,
        target: totalLeadsTarget,
        achievement: leadsAchievement,
        trend: {
          direction: (leadsTrend > 0 ? 'up' : leadsTrend < 0 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
          percentage: Math.abs(Math.round(leadsTrend)),
          comparison: 'vs last month',
        },
        color: '#8B5CF6',
        icon: '📞',
      },
      totalConversions: {
        id: 'total_conversions',
        title: 'Total Conversions (MTD)',
        value: totalConversions,
        target: totalConversionsTarget,
        achievement: conversionsAchievement,
        trend: {
          direction: (conversionsTrend > 0 ? 'up' : conversionsTrend < 0 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
          percentage: Math.abs(Math.round(conversionsTrend)),
          comparison: 'vs last month',
        },
        color: '#10B981',
        icon: '✅',
      },
      totalRevenue: {
        id: 'total_revenue',
        title: 'Total Revenue Generated (MTD)',
        value: totalRevenue,
        target: totalRevenueTarget,
        achievement: revenueAchievement,
        trend: {
          direction: (revenueTrend > 0 ? 'up' : revenueTrend < 0 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
          percentage: Math.abs(Math.round(revenueTrend)),
          comparison: 'vs last month',
        },
        color: '#F59E0B',
        icon: '💰',
      },
      avgConversionRate: {
        id: 'avg_conversion',
        title: 'Average Conversion Rate',
        value: avgConversionRate.toFixed(2),
        target: 12,
        achievement: (avgConversionRate / 12) * 100,
        trend: {
          direction: (avgConversionRate >= 12 ? 'up' : 'stable') as 'up' | 'down' | 'stable',
          percentage: Math.abs(avgConversionRate - 12),
          comparison: 'vs target',
        },
        color: '#10B981',
        icon: '🎯',
        subtitle: 'Team average',
      },
      atRiskBDEs: {
        id: 'at_risk',
        title: 'At-Risk BDEs',
        value: atRiskCount,
        achievement: atRiskCount > 0 ? ((bdeIds.length - atRiskCount) / bdeIds.length) * 100 : 100,
        trend: {
          direction: (atRiskCount === 0 ? 'up' : atRiskCount <= 2 ? 'stable' : 'down') as 'up' | 'down' | 'stable',
          percentage: 0,
          comparison: 'Action required',
        },
        color: '#EF4444',
        icon: '⚠️',
        subtitle: atRiskCount > 0 ? 'Immediate action needed' : 'All on track',
      },
    }

    return NextResponse.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getTeamSummaryHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
