/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - OVERVIEW API
 * ============================================================================
 * Tab 1: Team Overview Dashboard
 * Returns: Summary KPIs, Calendar Heatmap, BDE Performance Grid, AI Insights
 * ============================================================================
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type {
  TeamOverviewResponse,
  TeamSummaryKPI,
  CalendarHeatmap,
  CalendarDayData,
  BDEPerformanceRow,
  AIInsightCard,
} from '@/types/bdm-team-performance'
import {
  calculateAchievementPercentage,
  calculateGrade,
  calculateTrend,
  calculateDayStatus,
  calculatePerformanceStatus,
  calculateConversionRate,
  getMonthName,
  getCurrentMonthInfo,
  getDayOfWeek,
  isWeekend,
  formatCurrency,
  formatTimeAgo,
} from '@/lib/bdm/team-performance-utils'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // ========================================================================
    // STEP 1: AUTHENTICATE & GET BDM INFO
    // ========================================================================

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

    // Get BDM profile
    const { data: bdmProfile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, email, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !bdmProfile) {
      return NextResponse.json(
        { success: false, error: 'BDM profile not found' },
        { status: 404 }
      )
    }

    if (bdmProfile.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Not a Business Development Manager' },
        { status: 403 }
      )
    }

    // ========================================================================
    // STEP 2: GET MONTH INFO & PARAMETERS
    // ========================================================================

    const searchParams = request.nextUrl.searchParams
    const monthInfo = getCurrentMonthInfo()
    const requestedMonth = parseInt(searchParams.get('month') || String(monthInfo.month))
    const requestedYear = parseInt(searchParams.get('year') || String(monthInfo.year))

    const isCurrentMonth = requestedMonth === monthInfo.month && requestedYear === monthInfo.year
    const currentDay = isCurrentMonth ? monthInfo.currentDay : getDaysInMonth(requestedMonth, requestedYear)
    const totalDays = getDaysInMonth(requestedMonth, requestedYear)

    // ========================================================================
    // STEP 3: GET ALL BDEs REPORTING TO THIS BDM
    // ========================================================================

    const { data: teamBDEs, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, email, employee_code, avatar_url, created_at')
      .eq('manager_id', user.id)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .order('full_name')

    if (teamError) {
      apiLogger.error('Error fetching team BDEs', teamError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    const teamBDEIds = teamBDEs?.map(bde => bde.id) || []

    if (teamBDEIds.length === 0) {
      // No team members, return empty state
      return NextResponse.json({
        success: true,
        data: {
          bdmInfo: {
            id: bdmProfile.id,
            name: bdmProfile.full_name,
            email: bdmProfile.email,
          },
          periodInfo: {
            month: requestedMonth,
            year: requestedYear,
            monthName: getMonthName(requestedMonth),
            currentDay,
            totalDays,
            workingDaysRemaining: totalDays - currentDay,
          },
          summaryKPIs: [],
          calendarHeatmap: {
            month: requestedMonth,
            year: requestedYear,
            monthName: getMonthName(requestedMonth),
            days: [],
            monthSummary: {
              totalWorkingDays: 0,
              daysWithActivity: 0,
              totalHolidays: 0,
              averageDailyLeads: 0,
              averageDailyConversions: 0,
              averageDailyRevenue: 0,
              bestDay: null,
              worstDay: null,
            },
          },
          bdePerformanceGrid: [],
          aiInsights: [],
          lastUpdated: new Date().toISOString(),
        },
      })
    }

    // ========================================================================
    // STEP 4: FETCH TEAM TARGETS
    // ========================================================================

    const { data: teamTargets } = await supabase
      .from('team_targets')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('target_type', 'BDE')
      .eq('month', requestedMonth)
      .eq('year', requestedYear)
      .eq('is_active', true)

    // ========================================================================
    // STEP 5: FETCH DAILY ACHIEVEMENTS FOR THE MONTH
    // ========================================================================

    const monthStart = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-01`
    const monthEnd = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

    const { data: dailyAchievements } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('bde_user_id', teamBDEIds)
      .gte('achievement_date', monthStart)
      .lte('achievement_date', monthEnd)
      .order('achievement_date', { ascending: true })

    // ========================================================================
    // STEP 6: CALCULATE SUMMARY KPIs
    // ========================================================================

    const todayDate = new Date().toISOString().split('T')[0]
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const todayData = dailyAchievements?.filter(d => d.achievement_date === todayDate) || []
    const yesterdayData = dailyAchievements?.filter(d => d.achievement_date === yesterdayDate) || []

    const mtdData = dailyAchievements || []

    const todayLeads = todayData.reduce((sum, d) => sum + (d.leads_contacted || 0), 0)
    const yesterdayLeads = yesterdayData.reduce((sum, d) => sum + (d.leads_contacted || 0), 0)
    const mtdLeads = Math.max(...mtdData.map(d => d.mtd_leads_contacted || 0), 0)

    const todayConversions = todayData.reduce((sum, d) => sum + (d.conversions || 0), 0)
    const yesterdayConversions = yesterdayData.reduce((sum, d) => sum + (d.conversions || 0), 0)
    const mtdConversions = Math.max(...mtdData.map(d => d.mtd_conversions || 0), 0)

    const todayRevenue = todayData.reduce((sum, d) => sum + (d.revenue || 0), 0)
    const yesterdayRevenue = yesterdayData.reduce((sum, d) => sum + (d.revenue || 0), 0)
    const mtdRevenue = Math.max(...mtdData.map(d => d.mtd_revenue || 0), 0)

    const totalConversionTarget = teamTargets?.reduce((sum, t) => sum + (t.monthly_conversion_target || 0), 0) || 0
    const totalRevenueTarget = teamTargets?.reduce((sum, t) => sum + (t.monthly_revenue_target || 0), 0) || 0

    const conversionAchievementPct = calculateAchievementPercentage(mtdConversions, totalConversionTarget)
    const revenueAchievementPct = calculateAchievementPercentage(mtdRevenue, totalRevenueTarget)

    const conversionRate = calculateConversionRate(mtdConversions, mtdLeads)

    const activeBDEsToday = new Set(todayData.map(d => d.bde_user_id)).size

    const summaryKPIs: TeamSummaryKPI[] = [
      {
        id: 'team-size',
        label: 'Team Size',
        value: teamBDEIds.length,
        formattedValue: String(teamBDEIds.length),
        subtitle: `${activeBDEsToday} active today`,
        trend: {
          direction: 'stable',
          percentage: 0,
          comparisonText: 'Active BDEs',
        },
        status: 'excellent',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: 'Users',
      },
      {
        id: 'mtd-conversions',
        label: 'MTD Conversions',
        value: mtdConversions,
        formattedValue: String(mtdConversions),
        target: totalConversionTarget,
        targetFormatted: String(totalConversionTarget),
        achievementPercentage: conversionAchievementPct,
        trend: calculateTrend(todayConversions, yesterdayConversions),
        status: conversionAchievementPct >= 100 ? 'excellent' : conversionAchievementPct >= 80 ? 'good' : conversionAchievementPct >= 60 ? 'warning' : 'critical',
        color: conversionAchievementPct >= 100 ? 'text-green-600' : 'text-blue-600',
        bgColor: conversionAchievementPct >= 100 ? 'bg-green-50' : 'bg-blue-50',
        icon: 'TrendingUp',
        subtitle: `${conversionAchievementPct}% of target`,
      },
      {
        id: 'mtd-revenue',
        label: 'MTD Revenue',
        value: mtdRevenue,
        formattedValue: formatCurrency(mtdRevenue, true),
        target: totalRevenueTarget,
        targetFormatted: formatCurrency(totalRevenueTarget, true),
        achievementPercentage: revenueAchievementPct,
        trend: calculateTrend(todayRevenue, yesterdayRevenue),
        status: revenueAchievementPct >= 100 ? 'excellent' : revenueAchievementPct >= 80 ? 'good' : revenueAchievementPct >= 60 ? 'warning' : 'critical',
        color: revenueAchievementPct >= 100 ? 'text-green-600' : 'text-purple-600',
        bgColor: revenueAchievementPct >= 100 ? 'bg-green-50' : 'bg-purple-50',
        icon: 'DollarSign',
        subtitle: `${revenueAchievementPct}% of target`,
      },
      {
        id: 'today-activity',
        label: "Today's Activity",
        value: todayLeads,
        formattedValue: `${todayLeads} leads`,
        subtitle: `${todayConversions} conversions`,
        trend: calculateTrend(todayLeads, yesterdayLeads),
        status: todayLeads > yesterdayLeads ? 'excellent' : todayLeads === yesterdayLeads ? 'good' : 'warning',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        icon: 'Activity',
      },
      {
        id: 'conversion-rate',
        label: 'Conversion Rate',
        value: conversionRate,
        formattedValue: `${conversionRate}%`,
        trend: {
          direction: 'stable',
          percentage: 0,
          comparisonText: 'This month',
        },
        status: conversionRate >= 10 ? 'excellent' : conversionRate >= 8 ? 'good' : conversionRate >= 5 ? 'warning' : 'critical',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        icon: 'Target',
      },
      {
        id: 'team-performance',
        label: 'Team Performance',
        value: Math.round((conversionAchievementPct + revenueAchievementPct) / 2),
        formattedValue: `Grade ${calculateGrade((conversionAchievementPct + revenueAchievementPct) / 2)}`,
        trend: {
          direction: 'stable',
          percentage: 0,
          comparisonText: 'Overall',
        },
        status: 'good',
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        icon: 'Award',
      },
    ]

    // ========================================================================
    // STEP 7: BUILD CALENDAR HEATMAP
    // ========================================================================

    const calendarDays: CalendarDayData[] = []

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayData = dailyAchievements?.filter(d => d.achievement_date === dateStr) || []

      const dayLeads = dayData.reduce((sum, d) => sum + (d.leads_contacted || 0), 0)
      const dayConversions = dayData.reduce((sum, d) => sum + (d.conversions || 0), 0)
      const dayRevenue = dayData.reduce((sum, d) => sum + (d.revenue || 0), 0)
      const activeBDEs = dayData.filter(d => (d.leads_contacted || 0) > 0).length

      // Simple target: total target / total days
      const dailyConversionTarget = totalDays > 0 ? totalConversionTarget / totalDays : 0
      const achievementPct = calculateAchievementPercentage(dayConversions, dailyConversionTarget)
      const perfLevel = calculateDayStatus(achievementPct)

      const colors = {
        exceeded: { color: 'green', bgColor: 'bg-green-100' },
        met: { color: 'blue', bgColor: 'bg-blue-100' },
        partial: { color: 'yellow', bgColor: 'bg-yellow-100' },
        missed: { color: 'red', bgColor: 'bg-red-100' },
        no_activity: { color: 'gray', bgColor: 'bg-gray-50' },
      }

      const topPerformer = dayData.length > 0
        ? dayData.reduce((max, d) => ((d.conversions || 0) > (max.conversions || 0) ? d : max), dayData[0])
        : null

      const topPerformerBDE = topPerformer
        ? teamBDEs?.find(b => b.id === topPerformer.bde_user_id)
        : null

      calendarDays.push({
        date: dateStr,
        dayOfMonth: day,
        dayOfWeek: getDayOfWeek(dateStr),
        isWeekend: isWeekend(dateStr),
        isHoliday: false,
        teamMetrics: {
          leadsContacted: dayLeads,
          conversions: dayConversions,
          revenue: dayRevenue,
          activeBDEs: dayData.length,
          bdesWithActivity: activeBDEs,
        },
        vsTarget: {
          leadsPercentage: 0,
          conversionsPercentage: achievementPct,
          revenuePercentage: 0,
        },
        performanceLevel: perfLevel,
        color: colors[perfLevel].color,
        bgColor: colors[perfLevel].bgColor,
        topPerformer: topPerformerBDE
          ? {
              bdeId: topPerformerBDE.id,
              bdeName: topPerformerBDE.full_name,
              conversions: topPerformer.conversions || 0,
            }
          : undefined,
      })
    }

    const workingDays = calendarDays.filter(d => !d.isWeekend && !d.isHoliday).length
    const daysWithActivity = calendarDays.filter(d => d.teamMetrics.leadsContacted > 0).length

    const calendarHeatmap: CalendarHeatmap = {
      month: requestedMonth,
      year: requestedYear,
      monthName: getMonthName(requestedMonth),
      days: calendarDays,
      monthSummary: {
        totalWorkingDays: workingDays,
        daysWithActivity,
        totalHolidays: calendarDays.filter(d => d.isHoliday).length,
        averageDailyLeads: daysWithActivity > 0 ? Math.round(mtdLeads / daysWithActivity) : 0,
        averageDailyConversions: daysWithActivity > 0 ? Math.round(mtdConversions / daysWithActivity) : 0,
        averageDailyRevenue: daysWithActivity > 0 ? Math.round(mtdRevenue / daysWithActivity) : 0,
        bestDay: calendarDays.reduce((best, day) =>
          day.teamMetrics.conversions > (best?.teamMetrics.conversions || 0) ? day : best,
          calendarDays[0]
        ) || null,
        worstDay: calendarDays
          .filter(d => d.teamMetrics.conversions > 0)
          .reduce((worst, day) =>
            day.teamMetrics.conversions < (worst?.teamMetrics.conversions || Infinity) ? day : worst,
            calendarDays.find(d => d.teamMetrics.conversions > 0) || calendarDays[0]
          ) || null,
      },
    }

    // ========================================================================
    // STEP 8: BUILD BDE PERFORMANCE GRID
    // ========================================================================

    const bdePerformanceGrid: BDEPerformanceRow[] = []

    for (const bde of teamBDEs || []) {
      const bdeTarget = teamTargets?.find(t => t.user_id === bde.id)
      const bdeAchievements = dailyAchievements?.filter(d => d.bde_user_id === bde.id) || []
      const latestAchievement = bdeAchievements.length > 0 ? bdeAchievements[bdeAchievements.length - 1] : null

      const bdeLeads = latestAchievement?.mtd_leads_contacted || 0
      const bdeConversions = latestAchievement?.mtd_conversions || 0
      const bdeRevenue = latestAchievement?.mtd_revenue || 0
      const bdeConversionRate = calculateConversionRate(bdeConversions, bdeLeads)

      const leadsTarget = bdeTarget?.monthly_conversion_target ? bdeTarget.monthly_conversion_target * 10 : 50 // Estimate
      const conversionsTarget = bdeTarget?.monthly_conversion_target || 10
      const revenueTarget = bdeTarget?.monthly_revenue_target || 1000000

      const leadsAchievement = calculateAchievementPercentage(bdeLeads, leadsTarget)
      const conversionsAchievement = calculateAchievementPercentage(bdeConversions, conversionsTarget)
      const revenueAchievement = calculateAchievementPercentage(bdeRevenue, revenueTarget)
      const overallAchievement = Math.round((conversionsAchievement + revenueAchievement) / 2)

      const status = calculatePerformanceStatus(overallAchievement, totalDays - currentDay)

      const joiningDate = new Date(bde.created_at)
      const experienceMonths = Math.floor((Date.now() - joiningDate.getTime()) / (30 * 24 * 60 * 60 * 1000))

      bdePerformanceGrid.push({
        bdeId: bde.id,
        bdeName: bde.full_name,
        bdeAvatar: bde.avatar_url,
        employeeCode: bde.employee_code || 'N/A',
        joiningDate: bde.created_at,
        experienceMonths,
        targets: {
          leadsContactedTarget: leadsTarget,
          conversionsTarget,
          revenueTarget,
          conversionRateTarget: 10,
        },
        currentPerformance: {
          leadsContacted: bdeLeads,
          conversions: bdeConversions,
          revenue: bdeRevenue,
          conversionRate: bdeConversionRate,
        },
        achievementRates: {
          leads: leadsAchievement,
          conversions: conversionsAchievement,
          revenue: revenueAchievement,
          overall: overallAchievement,
        },
        status,
        statusColor: status === 'exceeding' ? 'green' : status === 'on_track' ? 'blue' : status === 'at_risk' ? 'yellow' : 'red',
        statusBgColor: status === 'exceeding' ? 'bg-green-50' : status === 'on_track' ? 'bg-blue-50' : status === 'at_risk' ? 'bg-yellow-50' : 'bg-red-50',
        trend: {
          direction: 'stable',
          changePercentage: 0,
        },
        lastActivity: {
          timestamp: latestAchievement?.achievement_date || '',
          type: 'Activity',
          hoursAgo: latestAchievement ? Math.floor((Date.now() - new Date(latestAchievement.achievement_date).getTime()) / 3600000) : 0,
        },
        badges: [],
        currentStreak: latestAchievement?.current_streak || 0,
        rankByLeads: 0,
        rankByConversions: 0,
        rankByRevenue: 0,
        overallRank: 0,
      })
    }

    // Calculate rankings
    bdePerformanceGrid.sort((a, b) => b.currentPerformance.conversions - a.currentPerformance.conversions)
    bdePerformanceGrid.forEach((bde, idx) => {
      bde.rankByConversions = idx + 1
    })

    bdePerformanceGrid.sort((a, b) => b.currentPerformance.revenue - a.currentPerformance.revenue)
    bdePerformanceGrid.forEach((bde, idx) => {
      bde.rankByRevenue = idx + 1
    })

    bdePerformanceGrid.sort((a, b) => b.achievementRates.overall - a.achievementRates.overall)
    bdePerformanceGrid.forEach((bde, idx) => {
      bde.overallRank = idx + 1
    })

    // ========================================================================
    // STEP 9: GENERATE AI INSIGHTS
    // ========================================================================

    const aiInsights: AIInsightCard[] = []

    // Insight 1: Team performance
    if (conversionAchievementPct >= 100) {
      aiInsights.push({
        id: 'team-exceeding',
        type: 'strength',
        priority: 'high',
        title: 'Team Exceeding Target! 🎉',
        description: `Your team has achieved ${conversionAchievementPct}% of the monthly conversion target with ${totalDays - currentDay} days remaining.`,
        icon: 'Trophy',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        createdAt: new Date().toISOString(),
      })
    }

    // Insight 2: At-risk BDEs
    const atRiskBDEs = bdePerformanceGrid.filter(b => b.status === 'at_risk' || b.status === 'behind')
    if (atRiskBDEs.length > 0) {
      aiInsights.push({
        id: 'at-risk-bdes',
        type: 'alert',
        priority: 'high',
        title: `${atRiskBDEs.length} BDE${atRiskBDEs.length > 1 ? 's' : ''} At Risk`,
        description: `${atRiskBDEs.map(b => b.bdeName).join(', ')} may not meet monthly targets. Consider providing support.`,
        icon: 'AlertTriangle',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        relatedBDEs: atRiskBDEs.map(b => ({ id: b.bdeId, name: b.bdeName })),
        actionItems: [
          'Schedule 1-on-1 check-ins',
          'Review lead quality and reassign if needed',
          'Provide additional training or mentoring',
        ],
        createdAt: new Date().toISOString(),
      })
    }

    // Insight 3: Projection
    aiInsights.push({
      id: 'month-end-projection',
      type: 'prediction',
      priority: 'medium',
      title: 'Month-End Projection',
      description: `Based on current pace, team is projected to achieve ${Math.round((mtdConversions / currentDay) * totalDays)} conversions (${Math.round(((mtdConversions / currentDay) * totalDays) / totalConversionTarget * 100)}% of target).`,
      icon: 'TrendingUp',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      confidenceLevel: Math.min(95, 30 + (currentDay / totalDays) * 65),
      createdAt: new Date().toISOString(),
    })

    // ========================================================================
    // STEP 10: RETURN RESPONSE
    // ========================================================================

    const response: TeamOverviewResponse = {
      success: true,
      data: {
        bdmInfo: {
          id: bdmProfile.id,
          name: bdmProfile.full_name,
          email: bdmProfile.email,
        },
        periodInfo: {
          month: requestedMonth,
          year: requestedYear,
          monthName: getMonthName(requestedMonth),
          currentDay,
          totalDays,
          workingDaysRemaining: totalDays - currentDay,
        },
        summaryKPIs,
        calendarHeatmap,
        bdePerformanceGrid,
        aiInsights,
        lastUpdated: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in team performance overview API', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        },
      { status: 500 }
    )
  }
}

// Helper function
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}
