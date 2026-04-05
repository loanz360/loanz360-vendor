export const dynamic = 'force-dynamic'

/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - BDE DETAILS API
 * ============================================================================
 * Endpoint: GET /api/bdm/team-performance/bde-details
 * Purpose: Fetch detailed performance data for individual BDE
 * Returns: BDE header, daily trends, funnel, activities, coaching insights
 * ============================================================================
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type {
  BDEDetailResponse,
  BDEDetailHeader,
  DailyPerformanceTrend,
  ConversionFunnelStage,
  DailyActivityRow,
  CoachingInsight,
} from '@/types/bdm-team-performance'
import {
  calculateAchievementPercentage,
  calculateGrade,
  formatCurrency,
  getGradeColor,
  getStatusFromAchievement,
  calculateProjectedValue,
  getDaysInMonth,
  getCurrentMonthInfo,
  validateMonth,
  validateYear,
} from '@/lib/bdm/team-performance-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // =========================================================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // =========================================================================

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get BDM info
    const { data: bdmUser, error: bdmError } = await supabase
      .from('users')
      .select('id, name, email, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (bdmError || !bdmUser || bdmUser.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Access denied. BDM role required.' },
        { status: 403 }
      )
    }

    // =========================================================================
    // 2. PARSE QUERY PARAMETERS
    // =========================================================================

    const { searchParams } = new URL(request.url)
    const bdeId = searchParams.get('bdeId')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    if (!bdeId) {
      return NextResponse.json(
        { success: false, error: 'BDE ID is required' },
        { status: 400 }
      )
    }

    const currentMonthInfo = getCurrentMonthInfo()
    const month = monthParam ? parseInt(monthParam) : currentMonthInfo.month
    const year = yearParam ? parseInt(yearParam) : currentMonthInfo.year

    if (!validateMonth(month) || !validateYear(year)) {
      return NextResponse.json(
        { success: false, error: 'Invalid month or year' },
        { status: 400 }
      )
    }

    // =========================================================================
    // 3. VERIFY BDE IS IN THIS BDM'S TEAM
    // =========================================================================

    const { data: bdeUser, error: bdeError } = await supabase
      .from('users')
      .select('id, name, email, employee_code, sub_role, manager_id')
      .eq('id', bdeId)
      .maybeSingle()

    if (bdeError || !bdeUser) {
      return NextResponse.json(
        { success: false, error: 'BDE not found' },
        { status: 404 }
      )
    }

    if (bdeUser.manager_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'This BDE is not in your team' },
        { status: 403 }
      )
    }

    // =========================================================================
    // 4. FETCH BDE TARGETS
    // =========================================================================

    const { data: targets, error: targetsError } = await supabase
      .from('bdm_targets')
      .select('*')
      .eq('bde_user_id', bdeId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    if (targetsError || !targets) {
      return NextResponse.json(
        {
          success: false,
          error: 'No targets found for this BDE in the specified month',
        },
        { status: 404 }
      )
    }

    // =========================================================================
    // 5. FETCH DAILY ACHIEVEMENTS
    // =========================================================================

    const daysInMonth = getDaysInMonth(month, year)
    const { data: dailyAchievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('bde_user_id', bdeId)
      .eq('month', month)
      .eq('year', year)
      .order('day', { ascending: true })

    if (achievementsError) {
      apiLogger.error('Error fetching daily achievements', achievementsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch daily achievements' },
        { status: 500 }
      )
    }

    const achievements = dailyAchievements || []

    // =========================================================================
    // 6. CALCULATE MTD TOTALS
    // =========================================================================

    const mtdTotals = achievements.reduce(
      (acc, day) => ({
        conversions: acc.conversions + (day.conversions || 0),
        revenue: acc.revenue + (day.revenue || 0),
        disbursal: acc.disbursal + (day.disbursal || 0),
        leads: acc.leads + (day.leads_generated || 0),
        calls: acc.calls + (day.calls_made || 0),
        meetings: acc.meetings + (day.meetings_conducted || 0),
      }),
      { conversions: 0, revenue: 0, disbursal: 0, leads: 0, calls: 0, meetings: 0 }
    )

    // =========================================================================
    // 7. BUILD BDE DETAIL HEADER
    // =========================================================================

    const conversionAchievement = calculateAchievementPercentage(
      mtdTotals.conversions,
      targets.conversions_target || 0
    )
    const revenueAchievement = calculateAchievementPercentage(
      mtdTotals.revenue,
      targets.revenue_target || 0
    )
    const overallAchievement = Math.round((conversionAchievement + revenueAchievement) / 2)

    const header: BDEDetailHeader = {
      bdeId: bdeUser.id,
      bdeName: bdeUser.name || 'Unknown',
      employeeCode: bdeUser.employee_code || 'N/A',
      email: bdeUser.email || '',
      month,
      year,
      currentDay: currentMonthInfo.month === month && currentMonthInfo.year === year
        ? currentMonthInfo.currentDay
        : daysInMonth,
      totalDays: daysInMonth,
      status: getStatusFromAchievement(overallAchievement),
      overallAchievement,
      grade: calculateGrade(overallAchievement),
      gradeColor: getGradeColor(calculateGrade(overallAchievement)),
      metrics: {
        conversions: {
          actual: mtdTotals.conversions,
          target: targets.conversions_target || 0,
          achievement: conversionAchievement,
          projected: calculateProjectedValue(
            mtdTotals.conversions,
            currentMonthInfo.month === month && currentMonthInfo.year === year
              ? currentMonthInfo.currentDay
              : daysInMonth,
            daysInMonth
          ),
        },
        revenue: {
          actual: mtdTotals.revenue,
          target: targets.revenue_target || 0,
          achievement: revenueAchievement,
          projected: calculateProjectedValue(
            mtdTotals.revenue,
            currentMonthInfo.month === month && currentMonthInfo.year === year
              ? currentMonthInfo.currentDay
              : daysInMonth,
            daysInMonth
          ),
        },
        disbursal: {
          actual: mtdTotals.disbursal,
          target: targets.disbursal_target || 0,
          achievement: calculateAchievementPercentage(
            mtdTotals.disbursal,
            targets.disbursal_target || 0
          ),
        },
        conversionRate: {
          value: mtdTotals.leads > 0 ? (mtdTotals.conversions / mtdTotals.leads) * 100 : 0,
          status: mtdTotals.leads > 0 && mtdTotals.conversions / mtdTotals.leads >= 0.15
            ? 'good'
            : 'needs_improvement',
        },
      },
    }

    // =========================================================================
    // 8. BUILD DAILY PERFORMANCE TRENDS
    // =========================================================================

    const dailyTrends: DailyPerformanceTrend[] = []
    const dailyConversionTarget = (targets.conversions_target || 0) / daysInMonth
    const dailyRevenueTarget = (targets.revenue_target || 0) / daysInMonth

    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = achievements.find((a) => a.day === day)

      dailyTrends.push({
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        conversions: {
          actual: dayData?.conversions || 0,
          target: dailyConversionTarget,
          achievement: calculateAchievementPercentage(
            dayData?.conversions || 0,
            dailyConversionTarget
          ),
        },
        revenue: {
          actual: dayData?.revenue || 0,
          target: dailyRevenueTarget,
          achievement: calculateAchievementPercentage(dayData?.revenue || 0, dailyRevenueTarget),
        },
        disbursal: dayData?.disbursal || 0,
        leads: dayData?.leads_generated || 0,
        calls: dayData?.calls_made || 0,
        meetings: dayData?.meetings_conducted || 0,
        isWeekend: new Date(year, month - 1, day).getDay() === 0 || new Date(year, month - 1, day).getDay() === 6,
        isFutureDate: currentMonthInfo.month === month &&
          currentMonthInfo.year === year &&
          day > currentMonthInfo.currentDay,
      })
    }

    // =========================================================================
    // 9. BUILD CONVERSION FUNNEL
    // =========================================================================

    const funnelStages: ConversionFunnelStage[] = [
      {
        id: 'leads',
        stageName: 'Leads Generated',
        count: mtdTotals.leads,
        percentage: 100,
        color: 'bg-blue-500',
        dropoffRate: 0,
      },
      {
        id: 'calls',
        stageName: 'Calls Made',
        count: mtdTotals.calls,
        percentage: mtdTotals.leads > 0 ? (mtdTotals.calls / mtdTotals.leads) * 100 : 0,
        color: 'bg-cyan-500',
        dropoffRate: mtdTotals.leads > 0
          ? 100 - (mtdTotals.calls / mtdTotals.leads) * 100
          : 0,
      },
      {
        id: 'meetings',
        stageName: 'Meetings Conducted',
        count: mtdTotals.meetings,
        percentage: mtdTotals.leads > 0 ? (mtdTotals.meetings / mtdTotals.leads) * 100 : 0,
        color: 'bg-green-500',
        dropoffRate: mtdTotals.calls > 0
          ? 100 - (mtdTotals.meetings / mtdTotals.calls) * 100
          : 0,
      },
      {
        id: 'conversions',
        stageName: 'Conversions',
        count: mtdTotals.conversions,
        percentage: mtdTotals.leads > 0 ? (mtdTotals.conversions / mtdTotals.leads) * 100 : 0,
        color: 'bg-purple-500',
        dropoffRate: mtdTotals.meetings > 0
          ? 100 - (mtdTotals.conversions / mtdTotals.meetings) * 100
          : 0,
      },
      {
        id: 'revenue',
        stageName: 'Revenue',
        count: mtdTotals.revenue,
        percentage: 100,
        color: 'bg-pink-500',
        dropoffRate: 0,
        formattedValue: formatCurrency(mtdTotals.revenue, true),
      },
    ]

    // =========================================================================
    // 10. BUILD DAILY ACTIVITY TABLE
    // =========================================================================

    const dailyActivities: DailyActivityRow[] = achievements
      .map((day) => ({
        day: day.day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`,
        dayOfWeek: new Date(year, month - 1, day.day).toLocaleDateString('en-US', {
          weekday: 'short',
        }),
        conversions: day.conversions || 0,
        revenue: day.revenue || 0,
        disbursal: day.disbursal || 0,
        leads: day.leads_generated || 0,
        calls: day.calls_made || 0,
        meetings: day.meetings_conducted || 0,
        conversionRate: (day.leads_generated || 0) > 0
          ? ((day.conversions || 0) / (day.leads_generated || 0)) * 100
          : 0,
        achievementStatus: getStatusFromAchievement(
          calculateAchievementPercentage(day.conversions || 0, dailyConversionTarget)
        ),
      }))
      .reverse() // Show most recent first

    // =========================================================================
    // 11. GENERATE COACHING INSIGHTS
    // =========================================================================

    const coachingInsights: CoachingInsight[] = []

    // Insight 1: Overall Performance
    if (overallAchievement >= 100) {
      coachingInsights.push({
        id: 'perf-excellent',
        type: 'strength',
        category: 'performance',
        title: 'Exceeding Targets',
        description: `${bdeUser.name} is performing exceptionally well, achieving ${overallAchievement}% of targets.`,
        priority: 'low',
        actionItems: ['Recognize and share best practices with the team', 'Consider increasing targets for next month'],
        icon: 'Trophy',
      })
    } else if (overallAchievement < 70) {
      coachingInsights.push({
        id: 'perf-concern',
        type: 'alert',
        category: 'performance',
        title: 'Below Target Performance',
        description: `${bdeUser.name} is at ${overallAchievement}% achievement. Immediate intervention needed.`,
        priority: 'high',
        actionItems: [
          'Schedule 1-on-1 coaching session',
          'Review daily activities and identify blockers',
          'Provide additional training or support',
        ],
        icon: 'AlertTriangle',
      })
    }

    // Insight 2: Conversion Rate
    const conversionRate = mtdTotals.leads > 0 ? (mtdTotals.conversions / mtdTotals.leads) * 100 : 0
    if (conversionRate < 10 && mtdTotals.leads > 20) {
      coachingInsights.push({
        id: 'conv-rate-low',
        type: 'recommendation',
        category: 'efficiency',
        title: 'Low Conversion Rate',
        description: `Conversion rate is ${conversionRate.toFixed(1)}%. Focus on lead quality and closing techniques.`,
        priority: 'medium',
        actionItems: [
          'Review lead qualification process',
          'Provide sales training on closing techniques',
          'Analyze lost deals to identify patterns',
        ],
        icon: 'Lightbulb',
      })
    }

    // Insight 3: Activity Consistency
    const activeDays = achievements.filter((d) => (d.conversions || 0) > 0 || (d.leads_generated || 0) > 0).length
    const currentDay = currentMonthInfo.month === month && currentMonthInfo.year === year
      ? currentMonthInfo.currentDay
      : daysInMonth
    const activityRate = (activeDays / currentDay) * 100

    if (activityRate < 60) {
      coachingInsights.push({
        id: 'activity-inconsistent',
        type: 'alert',
        category: 'activity',
        title: 'Inconsistent Activity',
        description: `Only ${activeDays} out of ${currentDay} days have recorded activity (${activityRate.toFixed(0)}%).`,
        priority: 'high',
        actionItems: [
          'Set daily activity goals',
          'Implement daily check-ins',
          'Investigate reasons for low activity days',
        ],
        icon: 'AlertTriangle',
      })
    }

    // Insight 4: Projected Performance
    const projectedConversions = calculateProjectedValue(mtdTotals.conversions, currentDay, daysInMonth)
    const projectedAchievement = calculateAchievementPercentage(
      projectedConversions,
      targets.conversions_target || 0
    )

    if (projectedAchievement < 90 && overallAchievement >= 80) {
      coachingInsights.push({
        id: 'proj-risk',
        type: 'prediction',
        category: 'forecast',
        title: 'At Risk of Missing Target',
        description: `Projected to reach ${projectedAchievement}% by month-end. Needs ${Math.ceil((targets.conversions_target || 0) - projectedConversions)} more conversions.`,
        priority: 'medium',
        actionItems: [
          'Increase daily conversion target',
          'Focus on high-value leads',
          'Accelerate pipeline deals',
        ],
        icon: 'TrendingUp',
        confidenceLevel: 75,
      })
    }

    // =========================================================================
    // 12. BUILD RESPONSE
    // =========================================================================

    const response: BDEDetailResponse = {
      success: true,
      data: {
        header,
        dailyTrends,
        conversionFunnel: funnelStages,
        dailyActivities,
        coachingInsights,
        periodInfo: {
          month,
          year,
          monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
          currentDay,
          totalDays: daysInMonth,
        },
        lastUpdated: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in BDE details API', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
