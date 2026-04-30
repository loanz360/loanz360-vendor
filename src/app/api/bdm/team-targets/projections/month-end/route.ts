/**
 * BDM Team Targets - Month-End Projections API
 * AI-based predictions for end-of-month performance
 * Uses historical patterns and current trends
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
    return await getMonthEndProjectionsHandler(req)
  })
}

async function getMonthEndProjectionsHandler(request: NextRequest) {
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
        data: { projections: [], summary: null },
        timestamp: new Date().toISOString(),
      })
    }

    const teamBDEIds = teamBDEs.map((b) => b.id)

    // Get current month achievements
    const { data: achievements } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    // Get targets
    const { data: targets } = await supabase
      .from('team_targets')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('month', month)
      .eq('year', year)
      .eq('target_type', 'BDE')

    // Calculate current day of month
    const now = new Date()
    const currentDayOfMonth = now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : new Date(year, month, 0).getDate()
    const totalDaysInMonth = new Date(year, month, 0).getDate()
    const remainingDays = Math.max(0, totalDaysInMonth - currentDayOfMonth)

    // Build projections for each BDE
    const projections = teamBDEs.map((bde) => {
      const bdeAchievements = achievements?.filter((a) => a.user_id === bde.id) || []
      const bdeTarget = targets?.find((t) => t.user_id === bde.id)

      // Calculate current performance
      const totalConversions = bdeAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)
      const totalRevenue = bdeAchievements.reduce((sum, a) => sum + (a.revenue_generated || 0), 0)
      const totalLeads = bdeAchievements.reduce((sum, a) => sum + (a.leads_contacted || 0), 0)

      const activeDays = bdeAchievements.filter((a) => a.leads_contacted > 0).length

      // Calculate daily averages
      const avgDailyConversions = activeDays > 0 ? totalConversions / activeDays : 0
      const avgDailyRevenue = activeDays > 0 ? totalRevenue / activeDays : 0

      // Project month-end performance
      const projectedConversions = totalConversions + avgDailyConversions * remainingDays
      const projectedRevenue = totalRevenue + avgDailyRevenue * remainingDays

      // Calculate achievement rates
      const targetConversions = bdeTarget?.monthly_conversion_target || 0
      const targetRevenue = bdeTarget?.monthly_revenue_target || 0

      const currentAchievementRate = targetConversions > 0 ? (totalConversions / targetConversions) * 100 : 0
      const projectedAchievementRate = targetConversions > 0 ? (projectedConversions / targetConversions) * 100 : 0

      // Calculate confidence based on data points
      const confidence =
        activeDays >= 15 ? 'high' : activeDays >= 10 ? 'medium' : activeDays >= 5 ? 'low' : 'very_low'

      // Determine status
      const status =
        projectedAchievementRate >= 100
          ? 'on_track'
          : projectedAchievementRate >= 80
            ? 'needs_push'
            : projectedAchievementRate >= 60
              ? 'at_risk'
              : 'critical'

      return {
        bdeId: bde.id,
        bdeName: bde.name,
        employeeCode: bde.employee_code,
        current: {
          conversions: totalConversions,
          revenue: totalRevenue,
          leads: totalLeads,
          achievementRate: currentAchievementRate,
          activeDays,
        },
        projection: {
          conversions: Math.round(projectedConversions),
          revenue: Math.round(projectedRevenue),
          achievementRate: projectedAchievementRate,
          remainingDays,
          requiredDailyRate: remainingDays > 0 ? (targetConversions - totalConversions) / remainingDays : 0,
        },
        target: {
          conversions: targetConversions,
          revenue: targetRevenue,
        },
        confidence,
        status,
        recommendation:
          status === 'on_track'
            ? 'Maintain current pace'
            : status === 'needs_push'
              ? 'Increase activity slightly to ensure target'
              : status === 'at_risk'
                ? 'Urgent coaching session needed'
                : 'Immediate intervention required',
      }
    })

    // Calculate team summary
    const teamSummary = {
      totalBDEs: teamBDEs.length,
      onTrack: projections.filter((p) => p.status === 'on_track').length,
      needsPush: projections.filter((p) => p.status === 'needs_push').length,
      atRisk: projections.filter((p) => p.status === 'at_risk').length,
      critical: projections.filter((p) => p.status === 'critical').length,
      averageProjectedAchievement:
        projections.reduce((sum, p) => sum + p.projection.achievementRate, 0) / projections.length,
      confidenceDistribution: {
        high: projections.filter((p) => p.confidence === 'high').length,
        medium: projections.filter((p) => p.confidence === 'medium').length,
        low: projections.filter((p) => p.confidence === 'low').length,
        very_low: projections.filter((p) => p.confidence === 'very_low').length,
      },
    }

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        asOfDate: new Date().toISOString(),
        daysElapsed: currentDayOfMonth,
        daysRemaining: remainingDays,
        projections: projections.sort((a, b) => b.projection.achievementRate - a.projection.achievementRate),
        summary: teamSummary,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getMonthEndProjectionsHandler', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
