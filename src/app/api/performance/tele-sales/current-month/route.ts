import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  CurrentMonthPerformance,
  TeleSalesMonthlyTargets,
  TeleSalesDailyMetrics,
  TeleSalesMonthlySummary,
  MetricCard,
  PerformanceGrade
} from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/tele-sales/current-month
 * Returns current month performance data for Tele Sales employees
 * Enterprise-grade implementation with comprehensive metrics
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Authentication check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and verify role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role, location, employee_id, department')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found. Please contact administrator.' },
        { status: 404 }
      )
    }

    // Verify the user is a Tele Sales employee
    if (profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch monthly targets (with defaults if not set)
    const { data: targets } = await supabase
      .from('tele_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Default targets for Tele Sales (enterprise-grade KPIs)
    const monthlyTargets: TeleSalesMonthlyTargets = targets || {
      id: '',
      userId: user.id,
      month: currentMonth,
      year: currentYear,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Call Targets
      outboundCallsTarget: 400,
      inboundCallsTarget: 100,
      totalCallsTarget: 500,
      talkTimeTarget: 1800, // 30 hours in minutes
      // Lead Targets
      leadsGeneratedTarget: 80,
      leadsQualifiedTarget: 50,
      leadsConvertedTarget: 25,
      // Sales Targets
      revenueTarget: 1500000,
      applicationsCompletedTarget: 30,
      loanDisbursementsTarget: 20,
      // Quality Targets
      callQualityScoreTarget: 85,
      customerSatisfactionTarget: 4.2,
      firstCallResolutionTarget: 75,
      // Efficiency Targets
      averageHandleTimeTarget: 300, // 5 minutes in seconds
      callbackCompletionTarget: 90,
      followUpComplianceTarget: 95,
    }

    // Get date range for current month
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    // Fetch daily metrics for current month
    const { data: dailyMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

    // Aggregate metrics
    const currentMetrics = aggregateTeleSalesMetrics(dailyMetrics || [])

    // Build metric cards with comprehensive KPIs
    const metricCards: MetricCard[] = [
      // Call Activity Metrics
      {
        label: 'Outbound Calls',
        value: currentMetrics.outboundCallsMade,
        target: monthlyTargets.outboundCallsTarget,
        achievementPercentage: calculateAchievement(currentMetrics.outboundCallsMade, monthlyTargets.outboundCallsTarget),
        icon: '📤',
        color: 'blue',
        category: 'activity',
        description: 'Outbound calls made this month',
        trend: calculateTrend(dailyMetrics || [], 'outbound_calls_made'),
      },
      {
        label: 'Inbound Calls',
        value: currentMetrics.inboundCallsReceived,
        target: monthlyTargets.inboundCallsTarget,
        achievementPercentage: calculateAchievement(currentMetrics.inboundCallsReceived, monthlyTargets.inboundCallsTarget),
        icon: '📥',
        color: 'cyan',
        category: 'activity',
        description: 'Inbound calls handled this month',
        trend: calculateTrend(dailyMetrics || [], 'inbound_calls_received'),
      },
      {
        label: 'Total Talk Time',
        value: currentMetrics.totalTalkTimeMinutes,
        target: monthlyTargets.talkTimeTarget,
        unit: 'min',
        achievementPercentage: calculateAchievement(currentMetrics.totalTalkTimeMinutes, monthlyTargets.talkTimeTarget),
        icon: '⏱️',
        color: 'purple',
        category: 'activity',
        description: 'Total time on calls',
        trend: calculateTrend(dailyMetrics || [], 'total_talk_time_minutes'),
      },
      // Lead Management Metrics
      {
        label: 'Leads Generated',
        value: currentMetrics.leadsGenerated,
        target: monthlyTargets.leadsGeneratedTarget,
        achievementPercentage: calculateAchievement(currentMetrics.leadsGenerated, monthlyTargets.leadsGeneratedTarget),
        icon: '🎯',
        color: 'orange',
        category: 'lead',
        description: 'New leads identified',
        trend: calculateTrend(dailyMetrics || [], 'leads_generated'),
      },
      {
        label: 'Leads Qualified',
        value: currentMetrics.leadsQualified,
        target: monthlyTargets.leadsQualifiedTarget,
        achievementPercentage: calculateAchievement(currentMetrics.leadsQualified, monthlyTargets.leadsQualifiedTarget),
        icon: '✅',
        color: 'green',
        category: 'lead',
        description: 'Leads qualified for sales',
        trend: calculateTrend(dailyMetrics || [], 'leads_qualified'),
      },
      {
        label: 'Leads Converted',
        value: currentMetrics.leadsConverted,
        target: monthlyTargets.leadsConvertedTarget,
        achievementPercentage: calculateAchievement(currentMetrics.leadsConverted, monthlyTargets.leadsConvertedTarget),
        icon: '🏆',
        color: 'gold',
        category: 'conversion',
        description: 'Leads converted to customers',
        trend: calculateTrend(dailyMetrics || [], 'leads_converted'),
      },
      // Revenue Metrics
      {
        label: 'Revenue Generated',
        value: currentMetrics.revenueGenerated,
        target: monthlyTargets.revenueTarget,
        unit: '₹',
        achievementPercentage: calculateAchievement(currentMetrics.revenueGenerated, monthlyTargets.revenueTarget),
        icon: '💰',
        color: 'green',
        category: 'revenue',
        description: 'Total revenue from sales',
        trend: calculateTrend(dailyMetrics || [], 'revenue_generated'),
      },
      {
        label: 'Applications Completed',
        value: currentMetrics.applicationsCompleted,
        target: monthlyTargets.applicationsCompletedTarget,
        achievementPercentage: calculateAchievement(currentMetrics.applicationsCompleted, monthlyTargets.applicationsCompletedTarget),
        icon: '📋',
        color: 'blue',
        category: 'conversion',
        description: 'Loan applications submitted',
        trend: calculateTrend(dailyMetrics || [], 'applications_completed'),
      },
      {
        label: 'Loan Disbursements',
        value: currentMetrics.loanDisbursements,
        target: monthlyTargets.loanDisbursementsTarget,
        achievementPercentage: calculateAchievement(currentMetrics.loanDisbursements, monthlyTargets.loanDisbursementsTarget),
        icon: '🏦',
        color: 'emerald',
        category: 'conversion',
        description: 'Loans successfully disbursed',
        trend: calculateTrend(dailyMetrics || [], 'loan_disbursements'),
      },
      // Quality Metrics
      {
        label: 'Call Quality Score',
        value: currentMetrics.callQualityScore,
        target: monthlyTargets.callQualityScoreTarget,
        unit: '%',
        achievementPercentage: calculateAchievement(currentMetrics.callQualityScore, monthlyTargets.callQualityScoreTarget),
        icon: '⭐',
        color: 'yellow',
        category: 'quality',
        description: 'Average call quality rating',
        trend: calculateTrend(dailyMetrics || [], 'call_quality_score'),
      },
      {
        label: 'Customer Satisfaction',
        value: currentMetrics.customerSatisfactionScore,
        target: monthlyTargets.customerSatisfactionTarget,
        unit: '/5',
        achievementPercentage: calculateAchievement(currentMetrics.customerSatisfactionScore, monthlyTargets.customerSatisfactionTarget),
        icon: '😊',
        color: 'pink',
        category: 'quality',
        description: 'Customer satisfaction rating',
        trend: calculateTrend(dailyMetrics || [], 'customer_satisfaction_score'),
      },
      {
        label: 'First Call Resolution',
        value: currentMetrics.firstCallResolutionRate,
        target: monthlyTargets.firstCallResolutionTarget,
        unit: '%',
        achievementPercentage: calculateAchievement(currentMetrics.firstCallResolutionRate, monthlyTargets.firstCallResolutionTarget),
        icon: '🎯',
        color: 'teal',
        category: 'quality',
        description: 'Issues resolved on first call',
        trend: calculateTrend(dailyMetrics || [], 'first_call_resolution_rate'),
      },
      // Efficiency Metrics
      {
        label: 'Avg Handle Time',
        value: Math.round(currentMetrics.averageHandleTime / 60), // Convert to minutes for display
        target: Math.round(monthlyTargets.averageHandleTimeTarget / 60),
        unit: 'min',
        achievementPercentage: calculateEfficiencyAchievement(currentMetrics.averageHandleTime, monthlyTargets.averageHandleTimeTarget),
        icon: '⚡',
        color: 'violet',
        category: 'quality',
        description: 'Average call handling time',
        trend: calculateTrend(dailyMetrics || [], 'average_handle_time', true),
      },
      {
        label: 'Callback Completion',
        value: currentMetrics.callbackCompletionRate,
        target: monthlyTargets.callbackCompletionTarget,
        unit: '%',
        achievementPercentage: calculateAchievement(currentMetrics.callbackCompletionRate, monthlyTargets.callbackCompletionTarget),
        icon: '📞',
        color: 'indigo',
        category: 'activity',
        description: 'Scheduled callbacks completed',
        trend: calculateTrend(dailyMetrics || [], 'callbacks_completed'),
      },
    ]

    // Calculate overall performance score
    const overallScore = calculateTeleSalesPerformanceScore(currentMetrics, monthlyTargets)

    // Get monthly summary with rankings
    const { data: monthlySummary } = await supabase
      .from('tele_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Get previous month data for trend calculation
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

    const { data: prevMonthlySummary } = await supabase
      .from('tele_sales_monthly_summary')
      .select('performance_score')
      .eq('user_id', user.id)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .maybeSingle()

    const changeFromLastMonth = prevMonthlySummary
      ? overallScore - prevMonthlySummary.performance_score
      : 0

    const targetAchievement = calculateOverallTargetAchievement(metricCards)
    const trend = changeFromLastMonth > 0 ? 'up' : changeFromLastMonth < 0 ? 'down' : 'stable'

    // Get total employees count for ranking context
    const { count: totalEmployees } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('sub_role', 'TELE_SALES')

    // Build response
    const response: CurrentMonthPerformance<TeleSalesMonthlyTargets, typeof currentMetrics, TeleSalesMonthlySummary> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'TELE_SALES',
      month: currentMonth,
      year: currentYear,
      summary: {
        overallScore,
        grade: monthlySummary?.performance_grade || calculateGrade(overallScore),
        rank: monthlySummary?.company_rank || 0,
        totalEmployees: totalEmployees || 1,
        percentile: monthlySummary?.percentile || calculatePercentile(monthlySummary?.company_rank || 0, totalEmployees || 1),
        targetAchievement,
        trend,
        changeFromLastMonth,
      },
      metrics: metricCards,
      targets: monthlyTargets,
      currentMetrics,
      monthlySummary: monthlySummary || undefined,
      insights: [], // Will be populated by AI insights endpoint
      graphData: {
        daily: [],
        comparison: {
          self: [],
          average: []
        }
      },
      leaderboard: [], // Will be populated by leaderboard endpoint
      currentUserRank: monthlySummary?.company_rank || 0,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales performance API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Aggregate daily metrics into monthly totals
 */
function aggregateTeleSalesMetrics(dailyMetrics: unknown[]): unknown {
  if (dailyMetrics.length === 0) {
    return getEmptyMetrics()
  }

  const totals = dailyMetrics.reduce(
    (acc, metric) => ({
      // Call Activity
      outboundCallsMade: acc.outboundCallsMade + (metric.outbound_calls_made || 0),
      inboundCallsReceived: acc.inboundCallsReceived + (metric.inbound_calls_received || 0),
      totalCalls: acc.totalCalls + (metric.total_calls || 0),
      totalTalkTimeMinutes: acc.totalTalkTimeMinutes + (metric.total_talk_time_minutes || 0),
      callsAnswered: acc.callsAnswered + (metric.calls_answered || 0),
      callsDropped: acc.callsDropped + (metric.calls_dropped || 0),
      voicemailsLeft: acc.voicemailsLeft + (metric.voicemails_left || 0),

      // Lead Management
      leadsGenerated: acc.leadsGenerated + (metric.leads_generated || 0),
      leadsQualified: acc.leadsQualified + (metric.leads_qualified || 0),
      leadsContacted: acc.leadsContacted + (metric.leads_contacted || 0),
      leadsConverted: acc.leadsConverted + (metric.leads_converted || 0),
      leadsNurtured: acc.leadsNurtured + (metric.leads_nurtured || 0),
      hotLeadsIdentified: acc.hotLeadsIdentified + (metric.hot_leads_identified || 0),

      // Sales Performance
      revenueGenerated: acc.revenueGenerated + (metric.revenue_generated || 0),
      applicationsStarted: acc.applicationsStarted + (metric.applications_started || 0),
      applicationsCompleted: acc.applicationsCompleted + (metric.applications_completed || 0),
      loanDisbursements: acc.loanDisbursements + (metric.loan_disbursements || 0),
      dealSizeSum: acc.dealSizeSum + (metric.average_deal_size || 0),

      // Quality (for averaging)
      callQualitySum: acc.callQualitySum + (metric.call_quality_score || 0),
      csatSum: acc.csatSum + (metric.customer_satisfaction_score || 0),
      fcrSum: acc.fcrSum + (metric.first_call_resolution_rate || 0),

      // Efficiency
      handleTimeSum: acc.handleTimeSum + (metric.average_handle_time || 0),
      wrapUpTimeSum: acc.wrapUpTimeSum + (metric.average_wrap_up_time || 0),
      callbacksScheduled: acc.callbacksScheduled + (metric.callbacks_scheduled || 0),
      callbacksCompleted: acc.callbacksCompleted + (metric.callbacks_completed || 0),
      followUpsCompleted: acc.followUpsCompleted + (metric.follow_ups_completed || 0),

      // Cross-sell/Up-sell
      crossSellAttempts: acc.crossSellAttempts + (metric.cross_sell_attempts || 0),
      crossSellSuccessful: acc.crossSellSuccessful + (metric.cross_sell_successful || 0),
      upsellAttempts: acc.upsellAttempts + (metric.upsell_attempts || 0),
      upsellSuccessful: acc.upsellSuccessful + (metric.upsell_successful || 0),

      // Compliance
      scriptAdherenceSum: acc.scriptAdherenceSum + (metric.script_adherence || 0),
      complianceScoreSum: acc.complianceScoreSum + (metric.compliance_score || 0),
      escalationsCreated: acc.escalationsCreated + (metric.escalations_created || 0),
      complaintsReceived: acc.complaintsReceived + (metric.complaints_received || 0),
    }),
    getEmptyAccumulator()
  )

  const daysWithData = dailyMetrics.length

  return {
    // Call Activity
    outboundCallsMade: totals.outboundCallsMade,
    inboundCallsReceived: totals.inboundCallsReceived,
    totalCalls: totals.totalCalls,
    totalTalkTimeMinutes: totals.totalTalkTimeMinutes,
    averageCallDuration: totals.totalCalls > 0
      ? (totals.totalTalkTimeMinutes * 60) / totals.totalCalls
      : 0,
    callsAnswered: totals.callsAnswered,
    callsDropped: totals.callsDropped,
    voicemailsLeft: totals.voicemailsLeft,

    // Lead Management
    leadsGenerated: totals.leadsGenerated,
    leadsQualified: totals.leadsQualified,
    leadsContacted: totals.leadsContacted,
    leadsConverted: totals.leadsConverted,
    leadsNurtured: totals.leadsNurtured,
    hotLeadsIdentified: totals.hotLeadsIdentified,
    leadConversionRate: totals.leadsGenerated > 0
      ? (totals.leadsConverted / totals.leadsGenerated) * 100
      : 0,

    // Sales Performance
    revenueGenerated: totals.revenueGenerated,
    applicationsStarted: totals.applicationsStarted,
    applicationsCompleted: totals.applicationsCompleted,
    loanDisbursements: totals.loanDisbursements,
    averageDealSize: totals.loanDisbursements > 0
      ? totals.revenueGenerated / totals.loanDisbursements
      : 0,
    revenuePerCall: totals.totalCalls > 0
      ? totals.revenueGenerated / totals.totalCalls
      : 0,

    // Quality (averaged)
    callQualityScore: daysWithData > 0 ? totals.callQualitySum / daysWithData : 0,
    customerSatisfactionScore: daysWithData > 0 ? totals.csatSum / daysWithData : 0,
    firstCallResolutionRate: daysWithData > 0 ? totals.fcrSum / daysWithData : 0,

    // Efficiency
    averageHandleTime: daysWithData > 0 ? totals.handleTimeSum / daysWithData : 0,
    averageWrapUpTime: daysWithData > 0 ? totals.wrapUpTimeSum / daysWithData : 0,
    callbacksScheduled: totals.callbacksScheduled,
    callbacksCompleted: totals.callbacksCompleted,
    callbackCompletionRate: totals.callbacksScheduled > 0
      ? (totals.callbacksCompleted / totals.callbacksScheduled) * 100
      : 0,
    followUpsCompleted: totals.followUpsCompleted,

    // Cross-sell/Up-sell
    crossSellAttempts: totals.crossSellAttempts,
    crossSellSuccessful: totals.crossSellSuccessful,
    crossSellRate: totals.crossSellAttempts > 0
      ? (totals.crossSellSuccessful / totals.crossSellAttempts) * 100
      : 0,
    upsellAttempts: totals.upsellAttempts,
    upsellSuccessful: totals.upsellSuccessful,
    upsellRate: totals.upsellAttempts > 0
      ? (totals.upsellSuccessful / totals.upsellAttempts) * 100
      : 0,

    // Compliance
    scriptAdherence: daysWithData > 0 ? totals.scriptAdherenceSum / daysWithData : 0,
    complianceScore: daysWithData > 0 ? totals.complianceScoreSum / daysWithData : 0,
    escalationsCreated: totals.escalationsCreated,
    complaintsReceived: totals.complaintsReceived,
  }
}

function getEmptyMetrics(): unknown {
  return {
    outboundCallsMade: 0,
    inboundCallsReceived: 0,
    totalCalls: 0,
    totalTalkTimeMinutes: 0,
    averageCallDuration: 0,
    callsAnswered: 0,
    callsDropped: 0,
    voicemailsLeft: 0,
    leadsGenerated: 0,
    leadsQualified: 0,
    leadsContacted: 0,
    leadsConverted: 0,
    leadsNurtured: 0,
    hotLeadsIdentified: 0,
    leadConversionRate: 0,
    revenueGenerated: 0,
    applicationsStarted: 0,
    applicationsCompleted: 0,
    loanDisbursements: 0,
    averageDealSize: 0,
    revenuePerCall: 0,
    callQualityScore: 0,
    customerSatisfactionScore: 0,
    firstCallResolutionRate: 0,
    averageHandleTime: 0,
    averageWrapUpTime: 0,
    callbacksScheduled: 0,
    callbacksCompleted: 0,
    callbackCompletionRate: 0,
    followUpsCompleted: 0,
    crossSellAttempts: 0,
    crossSellSuccessful: 0,
    crossSellRate: 0,
    upsellAttempts: 0,
    upsellSuccessful: 0,
    upsellRate: 0,
    scriptAdherence: 0,
    complianceScore: 0,
    escalationsCreated: 0,
    complaintsReceived: 0,
  }
}

function getEmptyAccumulator(): unknown {
  return {
    outboundCallsMade: 0,
    inboundCallsReceived: 0,
    totalCalls: 0,
    totalTalkTimeMinutes: 0,
    callsAnswered: 0,
    callsDropped: 0,
    voicemailsLeft: 0,
    leadsGenerated: 0,
    leadsQualified: 0,
    leadsContacted: 0,
    leadsConverted: 0,
    leadsNurtured: 0,
    hotLeadsIdentified: 0,
    revenueGenerated: 0,
    applicationsStarted: 0,
    applicationsCompleted: 0,
    loanDisbursements: 0,
    dealSizeSum: 0,
    callQualitySum: 0,
    csatSum: 0,
    fcrSum: 0,
    handleTimeSum: 0,
    wrapUpTimeSum: 0,
    callbacksScheduled: 0,
    callbacksCompleted: 0,
    followUpsCompleted: 0,
    crossSellAttempts: 0,
    crossSellSuccessful: 0,
    upsellAttempts: 0,
    upsellSuccessful: 0,
    scriptAdherenceSum: 0,
    complianceScoreSum: 0,
    escalationsCreated: 0,
    complaintsReceived: 0,
  }
}

/**
 * Calculate weighted performance score for Tele Sales
 * Enterprise-grade scoring with balanced weights
 */
function calculateTeleSalesPerformanceScore(current: unknown, targets: TeleSalesMonthlyTargets): number {
  // Weight distribution based on business priorities
  const weights = {
    // Revenue & Conversion (40%)
    revenue: 0.20,
    leadsConverted: 0.10,
    applications: 0.10,

    // Activity (25%)
    outboundCalls: 0.10,
    inboundCalls: 0.05,
    talkTime: 0.10,

    // Quality (25%)
    callQuality: 0.10,
    customerSatisfaction: 0.10,
    firstCallResolution: 0.05,

    // Efficiency (10%)
    handleTime: 0.05,
    callbackCompletion: 0.05,
  }

  const scores = {
    revenue: Math.min((current.revenueGenerated / targets.revenueTarget) * 100, 120),
    leadsConverted: Math.min((current.leadsConverted / targets.leadsConvertedTarget) * 100, 120),
    applications: Math.min((current.applicationsCompleted / targets.applicationsCompletedTarget) * 100, 120),
    outboundCalls: Math.min((current.outboundCallsMade / targets.outboundCallsTarget) * 100, 120),
    inboundCalls: Math.min((current.inboundCallsReceived / targets.inboundCallsTarget) * 100, 120),
    talkTime: Math.min((current.totalTalkTimeMinutes / targets.talkTimeTarget) * 100, 120),
    callQuality: Math.min((current.callQualityScore / targets.callQualityScoreTarget) * 100, 120),
    customerSatisfaction: Math.min((current.customerSatisfactionScore / targets.customerSatisfactionTarget) * 100, 120),
    firstCallResolution: Math.min((current.firstCallResolutionRate / targets.firstCallResolutionTarget) * 100, 120),
    // For handle time, lower is better (inverse calculation)
    handleTime: targets.averageHandleTimeTarget > 0 && current.averageHandleTime > 0
      ? Math.min((targets.averageHandleTimeTarget / current.averageHandleTime) * 100, 120)
      : 100,
    callbackCompletion: Math.min((current.callbackCompletionRate / targets.callbackCompletionTarget) * 100, 120),
  }

  const overallScore =
    scores.revenue * weights.revenue +
    scores.leadsConverted * weights.leadsConverted +
    scores.applications * weights.applications +
    scores.outboundCalls * weights.outboundCalls +
    scores.inboundCalls * weights.inboundCalls +
    scores.talkTime * weights.talkTime +
    scores.callQuality * weights.callQuality +
    scores.customerSatisfaction * weights.customerSatisfaction +
    scores.firstCallResolution * weights.firstCallResolution +
    scores.handleTime * weights.handleTime +
    scores.callbackCompletion * weights.callbackCompletion

  return Math.round(Math.min(overallScore, 100))
}

function calculateAchievement(current: number, target: number): number {
  if (target === 0) return 0
  return Math.round((current / target) * 100 * 10) / 10
}

function calculateEfficiencyAchievement(current: number, target: number): number {
  // For efficiency metrics where lower is better
  if (current === 0) return 100
  if (target === 0) return 0
  return Math.round((target / current) * 100 * 10) / 10
}

function calculateTrend(dailyMetrics: unknown[], field: string, lowerIsBetter: boolean = false): 'up' | 'down' | 'stable' {
  if (dailyMetrics.length < 7) return 'stable'

  // Compare last 7 days with previous 7 days
  const recentDays = dailyMetrics.slice(-7)
  const previousDays = dailyMetrics.slice(-14, -7)

  if (previousDays.length === 0) return 'stable'

  const recentAvg = recentDays.reduce((sum, m) => sum + (m[field] || 0), 0) / recentDays.length
  const previousAvg = previousDays.reduce((sum, m) => sum + (m[field] || 0), 0) / previousDays.length

  const change = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0

  if (Math.abs(change) < 5) return 'stable'

  if (lowerIsBetter) {
    return change < 0 ? 'up' : 'down'
  }
  return change > 0 ? 'up' : 'down'
}

function calculateGrade(score: number): PerformanceGrade {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function calculatePercentile(rank: number, total: number): number {
  if (total === 0 || rank === 0) return 0
  return Math.round(((total - rank + 1) / total) * 100)
}

function calculateOverallTargetAchievement(metricCards: MetricCard[]): number {
  if (metricCards.length === 0) return 0
  const totalAchievement = metricCards.reduce((sum, card) => sum + card.achievementPercentage, 0)
  return Math.round((totalAchievement / metricCards.length) * 10) / 10
}
