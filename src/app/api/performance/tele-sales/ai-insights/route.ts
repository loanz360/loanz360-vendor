import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AIInsight, InsightType, InsightPriority } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/tele-sales/ai-insights
 * Returns AI-powered performance insights for Tele Sales employees
 * Enterprise-grade intelligent recommendations
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

    const { data: profile } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Get targets
    const { data: targets } = await supabase
      .from('tele_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Get daily metrics for current month
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const { data: dailyMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: false })

    // Get organization averages for benchmarking
    const { data: allMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])

    // Calculate current month totals
    const currentMetrics = aggregateMetrics(dailyMetrics || [])
    const orgAverages = calculateOrgAverages(allMetrics || [])

    // Default targets if not set
    const defaultTargets = {
      outboundCallsTarget: 400,
      inboundCallsTarget: 100,
      totalCallsTarget: 500,
      talkTimeTarget: 1800,
      leadsGeneratedTarget: 80,
      leadsQualifiedTarget: 50,
      leadsConvertedTarget: 25,
      revenueTarget: 1500000,
      applicationsCompletedTarget: 30,
      loanDisbursementsTarget: 20,
      callQualityScoreTarget: 85,
      customerSatisfactionTarget: 4.2,
      firstCallResolutionTarget: 75,
      averageHandleTimeTarget: 300,
      callbackCompletionTarget: 90,
      followUpComplianceTarget: 95,
    }

    const monthlyTargets = targets || defaultTargets

    // Generate insights based on performance analysis
    const insights: AIInsight[] = generateInsights(
      currentMetrics,
      monthlyTargets,
      orgAverages,
      dailyMetrics || [],
      profile.full_name || 'Team Member'
    )

    return NextResponse.json({
      insights,
      generatedAt: new Date().toISOString(),
      totalInsights: insights.length,
      unreadCount: insights.filter((i) => !i.isRead).length,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales AI insights API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function aggregateMetrics(dailyMetrics: unknown[]): unknown {
  if (dailyMetrics.length === 0) return getEmptyMetrics()

  return dailyMetrics.reduce(
    (acc, m) => ({
      outboundCalls: acc.outboundCalls + (m.outbound_calls_made || 0),
      inboundCalls: acc.inboundCalls + (m.inbound_calls_received || 0),
      totalCalls: acc.totalCalls + (m.total_calls || 0),
      talkTime: acc.talkTime + (m.total_talk_time_minutes || 0),
      leadsGenerated: acc.leadsGenerated + (m.leads_generated || 0),
      leadsQualified: acc.leadsQualified + (m.leads_qualified || 0),
      leadsConverted: acc.leadsConverted + (m.leads_converted || 0),
      revenue: acc.revenue + (m.revenue_generated || 0),
      applications: acc.applications + (m.applications_completed || 0),
      disbursements: acc.disbursements + (m.loan_disbursements || 0),
      callQualitySum: acc.callQualitySum + (m.call_quality_score || 0),
      csatSum: acc.csatSum + (m.customer_satisfaction_score || 0),
      fcrSum: acc.fcrSum + (m.first_call_resolution_rate || 0),
      handleTimeSum: acc.handleTimeSum + (m.average_handle_time || 0),
      callbacksScheduled: acc.callbacksScheduled + (m.callbacks_scheduled || 0),
      callbacksCompleted: acc.callbacksCompleted + (m.callbacks_completed || 0),
      crossSellAttempts: acc.crossSellAttempts + (m.cross_sell_attempts || 0),
      crossSellSuccess: acc.crossSellSuccess + (m.cross_sell_successful || 0),
      daysCount: acc.daysCount + 1,
    }),
    getEmptyMetrics()
  )
}

function getEmptyMetrics() {
  return {
    outboundCalls: 0,
    inboundCalls: 0,
    totalCalls: 0,
    talkTime: 0,
    leadsGenerated: 0,
    leadsQualified: 0,
    leadsConverted: 0,
    revenue: 0,
    applications: 0,
    disbursements: 0,
    callQualitySum: 0,
    csatSum: 0,
    fcrSum: 0,
    handleTimeSum: 0,
    callbacksScheduled: 0,
    callbacksCompleted: 0,
    crossSellAttempts: 0,
    crossSellSuccess: 0,
    daysCount: 0,
  }
}

function calculateOrgAverages(allMetrics: unknown[]): unknown {
  if (allMetrics.length === 0) return {}

  const userMetrics: Record<string, any[]> = {}
  allMetrics.forEach((m) => {
    if (!userMetrics[m.user_id]) userMetrics[m.user_id] = []
    userMetrics[m.user_id].push(m)
  })

  const userTotals = Object.values(userMetrics).map((metrics) => aggregateMetrics(metrics))

  return {
    avgRevenue: userTotals.reduce((a, b) => a + b.revenue, 0) / userTotals.length,
    avgCalls: userTotals.reduce((a, b) => a + b.totalCalls, 0) / userTotals.length,
    avgLeadsConverted: userTotals.reduce((a, b) => a + b.leadsConverted, 0) / userTotals.length,
    avgCallQuality: userTotals.reduce((a, b) => a + (b.daysCount > 0 ? b.callQualitySum / b.daysCount : 0), 0) / userTotals.length,
  }
}

function generateInsights(
  metrics: unknown,
  targets: unknown,
  orgAverages: unknown,
  dailyMetrics: unknown[],
  userName: string
): AIInsight[] {
  const insights: AIInsight[] = []
  const now = new Date()

  // Revenue Analysis
  const revenueAchievement = (metrics.revenue / targets.revenueTarget) * 100
  if (revenueAchievement >= 100) {
    insights.push({
      id: `rev-achievement-${now.getTime()}`,
      type: 'achievement',
      priority: 'high',
      title: 'Revenue Target Achieved!',
      description: `Congratulations ${userName}! You have achieved ${revenueAchievement.toFixed(1)}% of your monthly revenue target. Outstanding performance!`,
      actionItems: [
        'Maintain momentum for remainder of the month',
        'Share best practices with team members',
        'Focus on quality metrics to maintain customer satisfaction',
      ],
      metricName: 'Revenue',
      currentValue: metrics.revenue,
      targetValue: targets.revenueTarget,
      variancePercentage: revenueAchievement - 100,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  } else if (revenueAchievement < 50) {
    insights.push({
      id: `rev-warning-${now.getTime()}`,
      type: 'warning',
      priority: 'critical',
      title: 'Revenue Target at Risk',
      description: `Current revenue achievement is at ${revenueAchievement.toFixed(1)}%. Immediate action required to meet monthly targets.`,
      actionItems: [
        'Prioritize high-value leads in your pipeline',
        'Increase outbound call volume by 20%',
        'Focus on cross-selling opportunities',
        'Request coaching session with manager',
      ],
      metricName: 'Revenue',
      currentValue: metrics.revenue,
      targetValue: targets.revenueTarget,
      variancePercentage: revenueAchievement - 100,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  }

  // Call Volume Analysis
  const callsAchievement = (metrics.totalCalls / targets.totalCallsTarget) * 100
  if (callsAchievement < 70) {
    insights.push({
      id: `calls-improvement-${now.getTime()}`,
      type: 'improvement',
      priority: 'high',
      title: 'Call Volume Needs Attention',
      description: `Your call volume is at ${callsAchievement.toFixed(1)}% of target. Increasing activity can significantly impact your results.`,
      actionItems: [
        'Block dedicated calling hours in your calendar',
        'Use auto-dialer feature for efficiency',
        'Reduce wrap-up time between calls',
        'Target peak calling hours (10 AM - 12 PM, 3 PM - 5 PM)',
      ],
      metricName: 'Total Calls',
      currentValue: metrics.totalCalls,
      targetValue: targets.totalCallsTarget,
      variancePercentage: callsAchievement - 100,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  }

  // Lead Conversion Analysis
  const conversionRate = metrics.leadsGenerated > 0
    ? (metrics.leadsConverted / metrics.leadsGenerated) * 100
    : 0
  if (conversionRate > 0 && conversionRate < 25) {
    insights.push({
      id: `conversion-improvement-${now.getTime()}`,
      type: 'improvement',
      priority: 'medium',
      title: 'Conversion Rate Optimization',
      description: `Your lead conversion rate is ${conversionRate.toFixed(1)}%. There's opportunity to improve qualification and closing techniques.`,
      actionItems: [
        'Review lead qualification criteria',
        'Practice objection handling techniques',
        'Focus on understanding customer pain points',
        'Follow up within 24 hours of initial contact',
      ],
      metricName: 'Conversion Rate',
      currentValue: conversionRate,
      targetValue: 31, // leadsConverted/leadsGenerated target
      variancePercentage: conversionRate - 31,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  } else if (conversionRate >= 40) {
    insights.push({
      id: `conversion-strength-${now.getTime()}`,
      type: 'strength',
      priority: 'medium',
      title: 'Excellent Conversion Rate',
      description: `Your conversion rate of ${conversionRate.toFixed(1)}% is well above average. This indicates strong qualification and closing skills.`,
      actionItems: [
        'Continue using current techniques',
        'Consider mentoring junior team members',
        'Document your successful strategies',
      ],
      metricName: 'Conversion Rate',
      currentValue: conversionRate,
      targetValue: 31,
      variancePercentage: conversionRate - 31,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  }

  // Quality Score Analysis
  const avgQuality = metrics.daysCount > 0 ? metrics.callQualitySum / metrics.daysCount : 0
  if (avgQuality > 0 && avgQuality < targets.callQualityScoreTarget) {
    insights.push({
      id: `quality-improvement-${now.getTime()}`,
      type: 'improvement',
      priority: 'high',
      title: 'Call Quality Below Target',
      description: `Average call quality score is ${avgQuality.toFixed(1)}% vs target of ${targets.callQualityScoreTarget}%. Focus on quality to improve customer satisfaction.`,
      actionItems: [
        'Review recent call recordings for improvement areas',
        'Follow the call script more closely',
        'Practice active listening techniques',
        'Attend quality coaching sessions',
      ],
      metricName: 'Call Quality Score',
      currentValue: avgQuality,
      targetValue: targets.callQualityScoreTarget,
      variancePercentage: ((avgQuality - targets.callQualityScoreTarget) / targets.callQualityScoreTarget) * 100,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  } else if (avgQuality >= 90) {
    insights.push({
      id: `quality-strength-${now.getTime()}`,
      type: 'strength',
      priority: 'low',
      title: 'Outstanding Call Quality',
      description: `Your call quality score of ${avgQuality.toFixed(1)}% demonstrates excellent customer engagement and professionalism.`,
      actionItems: [
        'Maintain current high standards',
        'Share techniques with the team',
      ],
      metricName: 'Call Quality Score',
      currentValue: avgQuality,
      targetValue: targets.callQualityScoreTarget,
      variancePercentage: ((avgQuality - targets.callQualityScoreTarget) / targets.callQualityScoreTarget) * 100,
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  }

  // Cross-sell/Up-sell Analysis
  if (metrics.crossSellAttempts > 0) {
    const crossSellRate = (metrics.crossSellSuccess / metrics.crossSellAttempts) * 100
    if (crossSellRate < 20) {
      insights.push({
        id: `crosssell-recommendation-${now.getTime()}`,
        type: 'recommendation',
        priority: 'medium',
        title: 'Cross-selling Opportunity',
        description: `Cross-sell success rate is ${crossSellRate.toFixed(1)}%. There's potential to increase additional product sales.`,
        actionItems: [
          'Identify relevant additional products during needs assessment',
          'Time cross-sell offers appropriately in the conversation',
          'Focus on customer benefits, not product features',
          'Practice value-based selling techniques',
        ],
        metricName: 'Cross-sell Rate',
        currentValue: crossSellRate,
        targetValue: 30,
        variancePercentage: crossSellRate - 30,
        isRead: false,
        isActioned: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Callback Completion Analysis
  if (metrics.callbacksScheduled > 0) {
    const callbackRate = (metrics.callbacksCompleted / metrics.callbacksScheduled) * 100
    if (callbackRate < 80) {
      insights.push({
        id: `callback-warning-${now.getTime()}`,
        type: 'warning',
        priority: 'high',
        title: 'Callback Completion Rate Low',
        description: `Only ${callbackRate.toFixed(1)}% of scheduled callbacks have been completed. Missing callbacks can result in lost opportunities.`,
        actionItems: [
          'Set reminders for all scheduled callbacks',
          'Review and prioritize callback queue daily',
          'Reduce callback scheduling if unable to follow through',
          'Use CRM alerts for callback reminders',
        ],
        metricName: 'Callback Completion',
        currentValue: callbackRate,
        targetValue: targets.callbackCompletionTarget,
        variancePercentage: callbackRate - targets.callbackCompletionTarget,
        isRead: false,
        isActioned: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Performance vs Organization Average
  if (orgAverages.avgRevenue && metrics.revenue > orgAverages.avgRevenue * 1.2) {
    insights.push({
      id: `org-benchmark-${now.getTime()}`,
      type: 'achievement',
      priority: 'medium',
      title: 'Above Team Average',
      description: `Your revenue is 20% above the team average. You're performing in the top tier of your peers.`,
      actionItems: [
        'Keep up the excellent work',
        'Consider sharing winning strategies in team meetings',
      ],
      isRead: false,
      isActioned: false,
      createdAt: now.toISOString(),
    })
  }

  // Best Time to Call Recommendation
  insights.push({
    id: `timing-recommendation-${now.getTime()}`,
    type: 'recommendation',
    priority: 'low',
    title: 'Optimal Calling Hours',
    description: 'Based on industry data, the best times for outbound sales calls are 10-11 AM and 4-5 PM. Consider planning your most important calls during these windows.',
    actionItems: [
      'Schedule high-priority calls between 10-11 AM',
      'Reserve 4-5 PM for follow-up calls',
      'Use early morning for call preparation',
      'Batch administrative tasks outside peak hours',
    ],
    isRead: false,
    isActioned: false,
    createdAt: now.toISOString(),
  })

  // Sort insights by priority
  const priorityOrder: Record<InsightPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
}
