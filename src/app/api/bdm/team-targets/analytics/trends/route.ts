/**
 * BDM Team Targets - Analytics Trends API
 * Returns historical performance trends for team or individual BDE
 * Shows month-over-month trends, growth rates, and patterns
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
    return await getAnalyticsTrendsHandler(req)
  })
}

async function getAnalyticsTrendsHandler(request: NextRequest) {
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
    const bdeId = searchParams.get('bdeId') // Optional - specific BDE
    const months = parseInt(searchParams.get('months') || '6') // Default: last 6 months
    const metric = searchParams.get('metric') || 'all' // conversions, revenue, leads, all

    // Validate months parameter
    if (months < 1 || months > 24) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid months parameter. Must be between 1 and 24',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 3. VERIFY BDE ACCESS (if bdeId provided)
    // =====================================================

    if (bdeId) {
      const { data: bdeData, error: bdeError } = await supabase
        .from('users')
        .select('id, name, manager_id')
        .eq('id', bdeId)
        .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (bdeError || !bdeData) {
        return NextResponse.json(
          {
            success: false,
            error: 'BDE not found',
          },
          { status: 404 }
        )
      }

      // Verify the BDE reports to this BDM
      if (bdeData.manager_id !== bdmUserId && !auth.isSuperAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: This BDE does not report to you',
          },
          { status: 403 }
        )
      }
    }

    // =====================================================
    // 4. GET TEAM BDEs (if no specific bdeId)
    // =====================================================

    let teamBDEIds: string[] = []
    if (!bdeId) {
      const { data: teamBDEs } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', bdmUserId)
        .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
        .eq('status', 'ACTIVE')

      teamBDEIds = teamBDEs?.map((bde) => bde.id) || []

      if (teamBDEIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            trends: [],
            summary: {},
          },
          timestamp: new Date().toISOString(),
        })
      }
    }

    // =====================================================
    // 5. CALCULATE DATE RANGE
    // =====================================================

    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1

    const monthPeriods: Array<{ month: number; year: number }> = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1)
      monthPeriods.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      })
    }

    // =====================================================
    // 6. FETCH MONTHLY SUMMARIES
    // =====================================================

    const monthlySummaries = []

    for (const period of monthPeriods) {
      // Build query
      let query = supabase.rpc('get_bdm_monthly_overview', {
        p_bdm_user_id: bdmUserId,
        p_month: period.month,
        p_year: period.year,
      })

      const { data: overview, error: overviewError } = await query.maybeSingle()

      if (overviewError) {
        apiLogger.error('Error fetching monthly overview', overviewError)
        continue
      }

      // If specific BDE, filter their data
      if (bdeId) {
        const bdePerformance = overview.bde_performance?.find((bde: any) => bde.bde_id === bdeId)
        if (bdePerformance) {
          monthlySummaries.push({
            month: period.month,
            year: period.year,
            period: `${period.year}-${period.month.toString().padStart(2, '0')}`,
            metrics: {
              leadsContacted: bdePerformance.leads_contacted || 0,
              conversions: bdePerformance.conversions || 0,
              revenue: bdePerformance.revenue || 0,
              conversionRate: bdePerformance.conversion_rate || 0,
            },
            targets: {
              conversions: bdePerformance.target_conversions || 0,
              revenue: bdePerformance.target_revenue || 0,
            },
            achievement: {
              conversions: bdePerformance.achievement_conversions || 0,
              revenue: bdePerformance.achievement_revenue || 0,
            },
          })
        }
      } else {
        // Team aggregate
        monthlySummaries.push({
          month: period.month,
          year: period.year,
          period: `${period.year}-${period.month.toString().padStart(2, '0')}`,
          metrics: {
            leadsContacted: overview.total_leads_contacted || 0,
            conversions: overview.total_conversions || 0,
            revenue: overview.total_revenue || 0,
            conversionRate: overview.team_conversion_rate || 0,
          },
          targets: {
            conversions: overview.target_conversions || 0,
            revenue: overview.target_revenue || 0,
          },
          achievement: {
            conversions: overview.achievement_conversions || 0,
            revenue: overview.achievement_revenue || 0,
          },
        })
      }
    }

    // =====================================================
    // 7. CALCULATE TRENDS AND GROWTH RATES
    // =====================================================

    const trends = monthlySummaries.map((month, index) => {
      const previousMonth = index > 0 ? monthlySummaries[index - 1] : null

      const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return ((current - previous) / previous) * 100
      }

      return {
        ...month,
        growth: previousMonth
          ? {
              leadsContacted: calculateGrowth(month.metrics.leadsContacted, previousMonth.metrics.leadsContacted),
              conversions: calculateGrowth(month.metrics.conversions, previousMonth.metrics.conversions),
              revenue: calculateGrowth(month.metrics.revenue, previousMonth.metrics.revenue),
              conversionRate: month.metrics.conversionRate - previousMonth.metrics.conversionRate,
            }
          : null,
      }
    })

    // =====================================================
    // 8. CALCULATE SUMMARY STATISTICS
    // =====================================================

    const totalMonths = trends.length
    const averages = {
      leadsContacted:
        totalMonths > 0 ? trends.reduce((sum, t) => sum + t.metrics.leadsContacted, 0) / totalMonths : 0,
      conversions: totalMonths > 0 ? trends.reduce((sum, t) => sum + t.metrics.conversions, 0) / totalMonths : 0,
      revenue: totalMonths > 0 ? trends.reduce((sum, t) => sum + t.metrics.revenue, 0) / totalMonths : 0,
      conversionRate:
        totalMonths > 0 ? trends.reduce((sum, t) => sum + t.metrics.conversionRate, 0) / totalMonths : 0,
      achievementConversions:
        totalMonths > 0 ? trends.reduce((sum, t) => sum + t.achievement.conversions, 0) / totalMonths : 0,
      achievementRevenue:
        totalMonths > 0 ? trends.reduce((sum, t) => sum + t.achievement.revenue, 0) / totalMonths : 0,
    }

    // Calculate overall growth (first month to last month)
    const overallGrowth =
      trends.length >= 2
        ? {
            leadsContacted:
              ((trends[trends.length - 1].metrics.leadsContacted - trends[0].metrics.leadsContacted) /
                trends[0].metrics.leadsContacted) *
              100,
            conversions:
              ((trends[trends.length - 1].metrics.conversions - trends[0].metrics.conversions) /
                trends[0].metrics.conversions) *
              100,
            revenue:
              ((trends[trends.length - 1].metrics.revenue - trends[0].metrics.revenue) / trends[0].metrics.revenue) *
              100,
          }
        : null

    // Find best and worst performing months
    const bestMonth = trends.reduce((best, current) =>
      current.metrics.conversions > best.metrics.conversions ? current : best
    )
    const worstMonth = trends.reduce((worst, current) =>
      current.metrics.conversions < worst.metrics.conversions ? current : worst
    )

    // Calculate consistency (standard deviation of achievement rates)
    const achievementRates = trends.map((t) => t.achievement.conversions)
    const avgAchievement = achievementRates.reduce((sum, rate) => sum + rate, 0) / achievementRates.length
    const variance =
      achievementRates.reduce((sum, rate) => sum + Math.pow(rate - avgAchievement, 2), 0) / achievementRates.length
    const consistency = Math.sqrt(variance)

    // =====================================================
    // 9. IDENTIFY PATTERNS
    // =====================================================

    const patterns = {
      improvingTrend: trends.filter((t, i) => i > 0 && t.growth && t.growth.conversions > 0).length > totalMonths / 2,
      decliningTrend: trends.filter((t, i) => i > 0 && t.growth && t.growth.conversions < 0).length > totalMonths / 2,
      consistentPerformer: consistency < 10, // Low variance = consistent
      volatile: consistency > 25, // High variance = volatile
      recentImprovement:
        trends.length >= 3 &&
        trends.slice(-3).every((t, i) => i === 0 || (t.growth && t.growth.conversions > 0)),
    }

    // =====================================================
    // 10. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        trends,
        summary: {
          totalMonths,
          averages,
          overallGrowth,
          bestMonth: {
            period: bestMonth.period,
            conversions: bestMonth.metrics.conversions,
            revenue: bestMonth.metrics.revenue,
          },
          worstMonth: {
            period: worstMonth.period,
            conversions: worstMonth.metrics.conversions,
            revenue: worstMonth.metrics.revenue,
          },
          consistency: {
            score: consistency,
            rating: consistency < 10 ? 'excellent' : consistency < 20 ? 'good' : consistency < 30 ? 'fair' : 'poor',
          },
          patterns,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getAnalyticsTrendsHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
