import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CurrentMonthPerformance, SalesAgentMonthlyTargets, SalesAgentDailyMetrics, MetricCard } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/sales-agent/current-month
 * Returns current month performance data for Sales Agent
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

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role, location')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found. Please contact administrator.' },
        { status: 404 }
      )
    }

    if (profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Sales Agents only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const { data: targets } = await supabase
      .from('sales_agent_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const monthlyTargets: SalesAgentMonthlyTargets = targets || {
      id: '',
      user_id: user.id,
      month: currentMonth,
      year: currentYear,
      calls_target: 200,
      call_duration_target: 120,
      leads_qualified_target: 40,
      appointments_set_target: 20,
      appointments_attended_target: 15,
      conversion_rate_target: 25.0,
      revenue_target: 600000,
      average_deal_size_target: 40000,
      follow_ups_completed_target: 50,
      customer_satisfaction_target: 4.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    const { data: dailyMetrics } = await supabase
      .from('sales_agent_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

    const currentMetrics = aggregateSalesAgentMetrics(dailyMetrics || [])

    const metricCards: MetricCard[] = [
      {
        label: 'Calls Made',
        value: currentMetrics.total_calls,
        target: monthlyTargets.calls_target,
        achievementPercentage: (currentMetrics.total_calls / monthlyTargets.calls_target) * 100,
        icon: '📞',
        color: 'blue',
        category: 'activity',
        description: 'Total calls made',
      },
      {
        label: 'Avg Call Duration',
        value: currentMetrics.average_call_duration,
        target: monthlyTargets.call_duration_target,
        unit: 'min',
        achievementPercentage: (currentMetrics.average_call_duration / monthlyTargets.call_duration_target) * 100,
        icon: '⏱️',
        color: 'purple',
        category: 'quality',
        description: 'Average call length',
      },
      {
        label: 'Leads Qualified',
        value: currentMetrics.total_leads_qualified,
        target: monthlyTargets.leads_qualified_target,
        achievementPercentage: (currentMetrics.total_leads_qualified / monthlyTargets.leads_qualified_target) * 100,
        icon: '✅',
        color: 'green',
        category: 'lead',
        description: 'Qualified prospects',
      },
      {
        label: 'Appointments Set',
        value: currentMetrics.total_appointments_set,
        target: monthlyTargets.appointments_set_target,
        achievementPercentage: (currentMetrics.total_appointments_set / monthlyTargets.appointments_set_target) * 100,
        icon: '📅',
        color: 'blue',
        category: 'activity',
        description: 'Meetings scheduled',
      },
      {
        label: 'Appointments Attended',
        value: currentMetrics.total_appointments_attended,
        target: monthlyTargets.appointments_attended_target,
        achievementPercentage: (currentMetrics.total_appointments_attended / monthlyTargets.appointments_attended_target) * 100,
        icon: '🤝',
        color: 'green',
        category: 'activity',
        description: 'Meetings completed',
      },
      {
        label: 'Conversion Rate',
        value: currentMetrics.conversion_rate,
        target: monthlyTargets.conversion_rate_target,
        unit: '%',
        achievementPercentage: (currentMetrics.conversion_rate / monthlyTargets.conversion_rate_target) * 100,
        icon: '📈',
        color: 'blue',
        category: 'conversion',
        description: 'Appointment to deal conversion',
      },
      {
        label: 'Revenue Generated',
        value: currentMetrics.total_revenue,
        target: monthlyTargets.revenue_target,
        unit: '₹',
        achievementPercentage: (currentMetrics.total_revenue / monthlyTargets.revenue_target) * 100,
        icon: '💰',
        color: 'green',
        category: 'revenue',
        description: 'Total sales revenue',
      },
      {
        label: 'Average Deal Size',
        value: currentMetrics.average_deal_size,
        target: monthlyTargets.average_deal_size_target,
        unit: '₹',
        achievementPercentage: (currentMetrics.average_deal_size / monthlyTargets.average_deal_size_target) * 100,
        icon: '💵',
        color: 'purple',
        category: 'quality',
        description: 'Avg revenue per deal',
      },
      {
        label: 'Follow-ups Completed',
        value: currentMetrics.total_follow_ups_completed,
        target: monthlyTargets.follow_ups_completed_target,
        achievementPercentage: (currentMetrics.total_follow_ups_completed / monthlyTargets.follow_ups_completed_target) * 100,
        icon: '🔄',
        color: 'orange',
        category: 'activity',
        description: 'Customer follow-ups',
      },
      {
        label: 'Customer Satisfaction',
        value: currentMetrics.average_customer_satisfaction,
        target: monthlyTargets.customer_satisfaction_target,
        unit: '/5',
        achievementPercentage: (currentMetrics.average_customer_satisfaction / monthlyTargets.customer_satisfaction_target) * 100,
        icon: '⭐',
        color: 'yellow',
        category: 'quality',
        description: 'Customer rating',
      },
    ]

    const overallScore = calculateSalesAgentPerformanceScore(currentMetrics, monthlyTargets)

    const { data: monthlySummary } = await supabase
      .from('sales_agent_monthly_summary')
      .select('company_rank, total_employees, percentile, performance_grade')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const targetAchievement = calculateTargetAchievement(metricCards)

    const response: CurrentMonthPerformance<SalesAgentMonthlyTargets, typeof currentMetrics, any> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'TELE_SALES',
      month: currentMonth,
      year: currentYear,
      summary: {
        overallScore,
        grade: monthlySummary?.performance_grade || calculateGrade(overallScore),
        rank: monthlySummary?.company_rank || 0,
        totalEmployees: monthlySummary?.total_employees || 1,
        percentile: monthlySummary?.percentile || 0,
        targetAchievement,
        trend: 'stable',
        changeFromLastMonth: 0,
      },
      metrics: metricCards,
      targets: monthlyTargets,
      currentMetrics,
      insights: [],
      graphData: { daily: [], comparison: { self: [], average: [] } },
      leaderboard: [],
      currentUserRank: monthlySummary?.company_rank || 0,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in Sales Agent performance API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function aggregateSalesAgentMetrics(dailyMetrics: unknown[]): unknown {
  if (dailyMetrics.length === 0) {
    return {
      total_calls: 0,
      average_call_duration: 0,
      total_leads_qualified: 0,
      total_appointments_set: 0,
      total_appointments_attended: 0,
      conversion_rate: 0,
      total_revenue: 0,
      total_deals_count: 0,
      average_deal_size: 0,
      total_follow_ups_completed: 0,
      average_customer_satisfaction: 0,
    }
  }

  const totals = dailyMetrics.reduce(
    (acc, metric) => ({
      total_calls: acc.total_calls + (metric.calls_made || 0),
      call_duration_sum: acc.call_duration_sum + (metric.total_call_duration || 0),
      total_leads_qualified: acc.total_leads_qualified + (metric.leads_qualified || 0),
      total_appointments_set: acc.total_appointments_set + (metric.appointments_set || 0),
      total_appointments_attended: acc.total_appointments_attended + (metric.appointments_attended || 0),
      total_revenue: acc.total_revenue + (metric.revenue_generated || 0),
      total_deals_count: acc.total_deals_count + (metric.deals_closed_count || 0),
      total_follow_ups_completed: acc.total_follow_ups_completed + (metric.follow_ups_completed || 0),
      satisfaction_sum: acc.satisfaction_sum + (metric.customer_satisfaction_score || 0),
    }),
    {
      total_calls: 0,
      call_duration_sum: 0,
      total_leads_qualified: 0,
      total_appointments_set: 0,
      total_appointments_attended: 0,
      total_revenue: 0,
      total_deals_count: 0,
      total_follow_ups_completed: 0,
      satisfaction_sum: 0,
    }
  )

  const average_call_duration = totals.total_calls > 0 ? totals.call_duration_sum / totals.total_calls : 0
  const conversion_rate = totals.total_appointments_attended > 0
    ? (totals.total_deals_count / totals.total_appointments_attended) * 100
    : 0
  const average_deal_size = totals.total_deals_count > 0 ? totals.total_revenue / totals.total_deals_count : 0
  const average_customer_satisfaction = dailyMetrics.length > 0 ? totals.satisfaction_sum / dailyMetrics.length : 0

  return {
    total_calls: totals.total_calls,
    average_call_duration,
    total_leads_qualified: totals.total_leads_qualified,
    total_appointments_set: totals.total_appointments_set,
    total_appointments_attended: totals.total_appointments_attended,
    conversion_rate,
    total_revenue: totals.total_revenue,
    total_deals_count: totals.total_deals_count,
    average_deal_size,
    total_follow_ups_completed: totals.total_follow_ups_completed,
    average_customer_satisfaction,
  }
}

function calculateSalesAgentPerformanceScore(current: unknown, targets: SalesAgentMonthlyTargets): number {
  const weights = {
    calls: 0.10,
    call_duration: 0.05,
    leads_qualified: 0.15,
    appointments_set: 0.10,
    appointments_attended: 0.10,
    conversion_rate: 0.15,
    revenue: 0.20,
    deal_size: 0.05,
    follow_ups: 0.05,
    satisfaction: 0.05,
  }

  const scores = {
    calls: Math.min((current.total_calls / targets.calls_target) * 100, 100),
    call_duration: Math.min((current.average_call_duration / targets.call_duration_target) * 100, 100),
    leads_qualified: Math.min((current.total_leads_qualified / targets.leads_qualified_target) * 100, 100),
    appointments_set: Math.min((current.total_appointments_set / targets.appointments_set_target) * 100, 100),
    appointments_attended: Math.min((current.total_appointments_attended / targets.appointments_attended_target) * 100, 100),
    conversion_rate: Math.min((current.conversion_rate / targets.conversion_rate_target) * 100, 100),
    revenue: Math.min((current.total_revenue / targets.revenue_target) * 100, 100),
    deal_size: Math.min((current.average_deal_size / targets.average_deal_size_target) * 100, 100),
    follow_ups: Math.min((current.total_follow_ups_completed / targets.follow_ups_completed_target) * 100, 100),
    satisfaction: Math.min((current.average_customer_satisfaction / targets.customer_satisfaction_target) * 100, 100),
  }

  const overallScore =
    scores.calls * weights.calls +
    scores.call_duration * weights.call_duration +
    scores.leads_qualified * weights.leads_qualified +
    scores.appointments_set * weights.appointments_set +
    scores.appointments_attended * weights.appointments_attended +
    scores.conversion_rate * weights.conversion_rate +
    scores.revenue * weights.revenue +
    scores.deal_size * weights.deal_size +
    scores.follow_ups * weights.follow_ups +
    scores.satisfaction * weights.satisfaction

  return Math.round(overallScore)
}

function calculateGrade(score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function calculateTargetAchievement(metricCards: MetricCard[]): number {
  if (metricCards.length === 0) return 0
  const totalAchievement = metricCards.reduce((sum, card) => sum + card.achievementPercentage, 0)
  return totalAchievement / metricCards.length
}
