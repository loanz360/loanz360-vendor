
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCROAuth } from '@/lib/middleware/cro-auth'
import {
  PerformanceMetricWithTarget,
  CurrentMonthPerformanceResponse,
  calculatePerformanceGrade,
  MetricTrend
} from '@/lib/types/cro-performance.types'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Get current month info
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentYear = now.getFullYear()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - now.getDate()

    // Get employee ID for the user
    const { data: profile } = await supabase
      .from('profiles')
      .select('employee_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Get targets for current month
    const { data: targets } = await supabase
      .from('cro_targets')
      .select('*')
      .eq('cro_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Get current month's daily metrics aggregated
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    const { data: dailyMetrics } = await supabase
      .from('cro_daily_metrics')
      .select('*')
      .eq('cro_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', today)

    // Get previous month's metrics for trend calculation
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`

    const { data: prevMonthSummary } = await supabase
      .from('cro_monthly_summary')
      .select('*')
      .eq('cro_id', user.id)
      .eq('month', prevMonthStr)
      .eq('year', prevYear)
      .maybeSingle()

    // Aggregate current metrics
    const currentMetrics = aggregateMetrics(dailyMetrics || [])

    // Calculate metrics with targets
    const metrics: PerformanceMetricWithTarget[] = calculateMetricsWithTargets(
      currentMetrics,
      targets,
      prevMonthSummary
    )

    // Calculate overall score
    const overallScore = calculateOverallScore(metrics)
    const overallGrade = calculatePerformanceGrade(overallScore)

    // Calculate target achievement
    const targetAchievement = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.achievement_percentage, 0) / metrics.length
      : 0

    const response: CurrentMonthPerformanceResponse = {
      success: true,
      data: {
        cro_id: user.id,
        employee_id: profile?.employee_id || 'N/A',
        month: currentMonth,
        metrics,
        overall_score: Math.round(overallScore * 100) / 100,
        overall_grade: overallGrade,
        target_achievement: Math.round(targetAchievement * 100) / 100,
        days_remaining: daysRemaining,
        last_updated: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    apiLogger.error('Error fetching current month performance', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}

// Helper function to aggregate daily metrics
function aggregateMetrics(dailyMetrics: unknown[]) {
  if (dailyMetrics.length === 0) {
    return {
      total_logins: 0,
      total_active_hours: 0,
      total_calls_made: 0,
      total_call_duration: 0,
      avg_call_duration: 0,
      total_leads_generated: 0,
      total_leads_converted: 0,
      total_leads_dropped: 0,
      total_deals_created: 0,
      total_deals_won: 0,
      total_followups_completed: 0,
      avg_response_time: 0,
      total_revenue: 0,
      total_volume: 0,
      avg_customer_satisfaction: 0,
      total_cases_sanctioned: 0,
      total_cases_disbursed: 0,
      total_disbursement_amount: 0
    }
  }

  const daysWorked = dailyMetrics.length

  return {
    total_logins: dailyMetrics.reduce((sum, d) => sum + (d.login_count || 0), 0),
    total_active_hours: dailyMetrics.reduce((sum, d) => sum + (d.active_hours || 0), 0),
    total_calls_made: dailyMetrics.reduce((sum, d) => sum + (d.calls_made || 0), 0),
    total_call_duration: dailyMetrics.reduce((sum, d) => sum + (d.total_call_duration_minutes || 0), 0),
    avg_call_duration: dailyMetrics.reduce((sum, d) => sum + (d.avg_call_duration_minutes || 0), 0) / daysWorked,
    total_leads_generated: dailyMetrics.reduce((sum, d) => sum + (d.leads_generated || 0), 0),
    total_leads_converted: dailyMetrics.reduce((sum, d) => sum + (d.leads_converted || 0), 0),
    total_leads_dropped: dailyMetrics.reduce((sum, d) => sum + (d.leads_dropped || 0), 0),
    total_deals_created: dailyMetrics.reduce((sum, d) => sum + (d.deals_created || 0), 0),
    total_deals_won: dailyMetrics.reduce((sum, d) => sum + (d.deals_won || 0), 0),
    total_followups_completed: dailyMetrics.reduce((sum, d) => sum + (d.followups_completed || 0), 0),
    avg_response_time: dailyMetrics.reduce((sum, d) => sum + (d.avg_response_time_minutes || 0), 0) / daysWorked,
    total_revenue: dailyMetrics.reduce((sum, d) => sum + (d.revenue_generated || 0), 0),
    total_volume: dailyMetrics.reduce((sum, d) => sum + (d.volume_generated || 0), 0),
    avg_customer_satisfaction: dailyMetrics.reduce((sum, d) => sum + (d.customer_satisfaction_score || 0), 0) / daysWorked,
    total_cases_sanctioned: dailyMetrics.reduce((sum, d) => sum + (d.cases_sanctioned || 0), 0),
    total_cases_disbursed: dailyMetrics.reduce((sum, d) => sum + (d.cases_disbursed || 0), 0),
    total_disbursement_amount: dailyMetrics.reduce((sum, d) => sum + (d.disbursement_amount || 0), 0)
  }
}

// Helper function to calculate metrics with targets
function calculateMetricsWithTargets(
  current: unknown,
  targets: unknown,
  prevMonth: unknown): PerformanceMetricWithTarget[] {
  const metrics: PerformanceMetricWithTarget[] = []

  // Define metric mappings
  const metricMappings = [
    {
      metric_name: 'calls_made',
      display_name: 'Calls Made',
      current_value: current.total_calls_made,
      target_value: targets?.target_calls_per_day ? targets.target_calls_per_day * 22 : 1100, // 22 working days
      prev_value: prevMonth?.total_calls_made || 0,
      unit: 'calls',
      category: 'calls' as const
    },
    {
      metric_name: 'call_duration',
      display_name: 'Avg Call Duration',
      current_value: current.avg_call_duration,
      target_value: targets?.target_call_duration_minutes || 3,
      prev_value: prevMonth?.avg_call_duration_minutes || 0,
      unit: 'min',
      category: 'calls' as const
    },
    {
      metric_name: 'leads_generated',
      display_name: 'Leads Generated',
      current_value: current.total_leads_generated,
      target_value: targets?.target_leads_generated || 100,
      prev_value: prevMonth?.total_leads_generated || 0,
      unit: 'leads',
      category: 'leads' as const
    },
    {
      metric_name: 'leads_converted',
      display_name: 'Leads Converted',
      current_value: current.total_leads_converted,
      target_value: targets?.target_leads_converted || 20,
      prev_value: prevMonth?.total_leads_converted || 0,
      unit: 'leads',
      category: 'leads' as const
    },
    {
      metric_name: 'conversion_rate',
      display_name: 'Conversion Rate',
      current_value: current.total_leads_generated > 0
        ? (current.total_leads_converted / current.total_leads_generated) * 100
        : 0,
      target_value: targets?.target_conversion_rate || 20,
      prev_value: prevMonth?.conversion_rate || 0,
      unit: '%',
      category: 'leads' as const
    },
    {
      metric_name: 'revenue_generated',
      display_name: 'Revenue Generated',
      current_value: current.total_revenue,
      target_value: targets?.target_revenue || 500000,
      prev_value: prevMonth?.total_revenue || 0,
      unit: '₹',
      category: 'revenue' as const
    },
    {
      metric_name: 'cases_sanctioned',
      display_name: 'Cases Sanctioned',
      current_value: current.total_cases_sanctioned,
      target_value: targets?.target_cases_sanctioned || 15,
      prev_value: prevMonth?.total_cases_sanctioned || 0,
      unit: 'cases',
      category: 'deals' as const
    },
    {
      metric_name: 'cases_disbursed',
      display_name: 'Cases Disbursed',
      current_value: current.total_cases_disbursed,
      target_value: targets?.target_cases_disbursed || 10,
      prev_value: prevMonth?.total_cases_disbursed || 0,
      unit: 'cases',
      category: 'deals' as const
    },
    {
      metric_name: 'response_time',
      display_name: 'Avg Response Time',
      current_value: current.avg_response_time,
      target_value: targets?.target_response_time_minutes || 30,
      prev_value: prevMonth?.avg_response_time_minutes || 0,
      unit: 'min',
      category: 'quality' as const
    },
    {
      metric_name: 'customer_satisfaction',
      display_name: 'Customer Satisfaction',
      current_value: current.avg_customer_satisfaction,
      target_value: targets?.target_customer_satisfaction || 4,
      prev_value: prevMonth?.avg_customer_satisfaction || 0,
      unit: '/5',
      category: 'quality' as const
    },
    {
      metric_name: 'volume_generated',
      display_name: 'Volume Generated',
      current_value: current.total_volume,
      target_value: targets?.target_volume || 5000000,
      prev_value: prevMonth?.total_volume || 0,
      unit: '₹',
      category: 'revenue' as const
    },
    {
      metric_name: 'followup_completion',
      display_name: 'Follow-ups Completed',
      current_value: current.total_followups_completed,
      target_value: targets?.target_followup_completion_rate ?
        Math.round(targets.target_followup_completion_rate) : 50,
      prev_value: prevMonth?.total_followups_completed || 0,
      unit: 'follow-ups',
      category: 'quality' as const
    }
  ]

  // Calculate metrics
  for (const mapping of metricMappings) {
    const achievement = mapping.target_value > 0
      ? Math.min((mapping.current_value / mapping.target_value) * 100, 150)
      : 0

    let trend: MetricTrend = 'stable'
    let trendPercentage = 0

    if (mapping.prev_value > 0) {
      const change = ((mapping.current_value - mapping.prev_value) / mapping.prev_value) * 100
      trendPercentage = Math.round(change * 100) / 100

      if (change > 5) trend = 'up'
      else if (change < -5) trend = 'down'
    }

    metrics.push({
      metric_name: mapping.metric_name,
      display_name: mapping.display_name,
      current_value: Math.round(mapping.current_value * 100) / 100,
      target_value: mapping.target_value,
      achievement_percentage: Math.round(achievement * 100) / 100,
      trend,
      trend_percentage: trendPercentage,
      unit: mapping.unit,
      category: mapping.category
    })
  }

  return metrics
}

// Helper function to calculate overall score
function calculateOverallScore(metrics: PerformanceMetricWithTarget[]): number {
  if (metrics.length === 0) return 0

  // Weighted score calculation
  const weights: Record<string, number> = {
    calls_made: 0.08,
    call_duration: 0.05,
    leads_generated: 0.1,
    leads_converted: 0.15,
    conversion_rate: 0.12,
    revenue_generated: 0.15,
    cases_sanctioned: 0.1,
    cases_disbursed: 0.1,
    response_time: 0.05,
    customer_satisfaction: 0.05,
    volume_generated: 0.03,
    followup_completion: 0.02
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const metric of metrics) {
    const weight = weights[metric.metric_name] || 0.05
    // Cap achievement at 100 for score calculation
    const cappedAchievement = Math.min(metric.achievement_percentage, 100)
    weightedSum += cappedAchievement * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}
