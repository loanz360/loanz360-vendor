import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CurrentMonthPerformance, CPMMonthlyTargets, CPMDailyMetrics, MetricCard } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/cpm/current-month
 * Returns current month performance data for Channel Partner Manager
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

    if (profile.sub_role !== 'CHANNEL_PARTNER_MANAGER') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Channel Partner Managers only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Try to fetch targets - handle gracefully if table doesn't exist
    let targets = null
    try {
      const { data, error } = await supabase
        .from('cpm_targets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      if (!error) {
        targets = data
      }
    } catch (e) {
      // Table might not exist, continue with defaults
    }

    const monthlyTargets: CPMMonthlyTargets = targets || {
      id: '',
      user_id: user.id,
      month: currentMonth,
      year: currentYear,
      active_partners_target: 30,
      new_partners_onboarded_target: 5,
      partner_revenue_target: 3000000,
      partner_satisfaction_target: 85.0,
      partner_training_sessions_target: 10,
      partner_performance_reviews_target: 15,
      top_performing_partners_target: 8,
      partner_grievances_resolved_target: 95.0,
      partner_engagement_score_target: 80.0,
      partner_retention_rate_target: 90.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    // Try to fetch daily metrics - handle gracefully if table doesn't exist
    let dailyMetrics: any[] = []
    try {
      const { data, error } = await supabase
        .from('cpm_daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

      if (!error && data) {
        dailyMetrics = data
      }
    } catch (e) {
      // Table might not exist, continue with empty metrics
    }

    const currentMetrics = aggregateCPMMetrics(dailyMetrics)

    const metricCards: MetricCard[] = [
      {
        label: 'Active Partners',
        value: currentMetrics.total_active_partners,
        target: monthlyTargets.active_partners_target,
        achievementPercentage: (currentMetrics.total_active_partners / monthlyTargets.active_partners_target) * 100,
        icon: '🤝',
        color: 'blue',
        category: 'team',
        description: 'Total active channel partners',
      },
      {
        label: 'New Partners Onboarded',
        value: currentMetrics.total_new_partners,
        target: monthlyTargets.new_partners_onboarded_target,
        achievementPercentage: (currentMetrics.total_new_partners / monthlyTargets.new_partners_onboarded_target) * 100,
        icon: '✨',
        color: 'green',
        category: 'activity',
        description: 'Partners added this month',
      },
      {
        label: 'Partner Revenue',
        value: currentMetrics.total_partner_revenue,
        target: monthlyTargets.partner_revenue_target,
        achievementPercentage: (currentMetrics.total_partner_revenue / monthlyTargets.partner_revenue_target) * 100,
        icon: '💰',
        color: 'emerald',
        category: 'revenue',
        description: 'Revenue from partners',
        unit: '₹',
      },
      {
        label: 'Partner Satisfaction',
        value: currentMetrics.average_partner_satisfaction,
        target: monthlyTargets.partner_satisfaction_target,
        achievementPercentage: (currentMetrics.average_partner_satisfaction / monthlyTargets.partner_satisfaction_target) * 100,
        icon: '⭐',
        color: 'yellow',
        category: 'quality',
        description: 'Average satisfaction score',
        unit: '%',
      },
      {
        label: 'Training Sessions',
        value: currentMetrics.total_training_sessions,
        target: monthlyTargets.partner_training_sessions_target,
        achievementPercentage: (currentMetrics.total_training_sessions / monthlyTargets.partner_training_sessions_target) * 100,
        icon: '📚',
        color: 'indigo',
        category: 'activity',
        description: 'Partner training conducted',
      },
      {
        label: 'Performance Reviews',
        value: currentMetrics.total_performance_reviews,
        target: monthlyTargets.partner_performance_reviews_target,
        achievementPercentage: (currentMetrics.total_performance_reviews / monthlyTargets.partner_performance_reviews_target) * 100,
        icon: '📊',
        color: 'purple',
        category: 'quality',
        description: 'Reviews completed',
      },
      {
        label: 'Top Performers',
        value: currentMetrics.total_top_performers,
        target: monthlyTargets.top_performing_partners_target,
        achievementPercentage: (currentMetrics.total_top_performers / monthlyTargets.top_performing_partners_target) * 100,
        icon: '🏆',
        color: 'amber',
        category: 'team',
        description: 'High-performing partners',
      },
      {
        label: 'Grievances Resolved',
        value: currentMetrics.grievance_resolution_rate,
        target: monthlyTargets.partner_grievances_resolved_target,
        achievementPercentage: (currentMetrics.grievance_resolution_rate / monthlyTargets.partner_grievances_resolved_target) * 100,
        icon: '✅',
        color: 'green',
        category: 'quality',
        description: 'Resolution rate',
        unit: '%',
      },
      {
        label: 'Engagement Score',
        value: currentMetrics.average_engagement_score,
        target: monthlyTargets.partner_engagement_score_target,
        achievementPercentage: (currentMetrics.average_engagement_score / monthlyTargets.partner_engagement_score_target) * 100,
        icon: '💪',
        color: 'cyan',
        category: 'quality',
        description: 'Partner engagement level',
        unit: '%',
      },
      {
        label: 'Retention Rate',
        value: currentMetrics.partner_retention_rate,
        target: monthlyTargets.partner_retention_rate_target,
        achievementPercentage: (currentMetrics.partner_retention_rate / monthlyTargets.partner_retention_rate_target) * 100,
        icon: '🔒',
        color: 'teal',
        category: 'quality',
        description: 'Partner retention',
        unit: '%',
      },
    ]

    const overallScore = calculateCPMPerformanceScore(currentMetrics, monthlyTargets)

    const response: CurrentMonthPerformance<CPMMonthlyTargets, CPMDailyMetrics, any> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'Channel Partner Manager',
      month: currentMonth,
      year: currentYear,
      summary: {
        overallScore,
        performanceGrade: getPerformanceGrade(overallScore),
        currentRank: 0,
        totalEmployees: 0,
        targetAchievement: calculateOverallAchievement(metricCards),
        trend: 'up',
      },
      metrics: metricCards,
      targets: monthlyTargets,
      currentMetrics,
      insights: [],
      graphData: {},
      leaderboard: [],
      currentUserRank: 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('CPM current month error', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}

function aggregateCPMMetrics(metrics: any[]): any {
  if (metrics.length === 0) {
    return {
      total_active_partners: 0,
      total_new_partners: 0,
      total_partner_revenue: 0,
      average_partner_satisfaction: 0,
      total_training_sessions: 0,
      total_performance_reviews: 0,
      total_top_performers: 0,
      grievance_resolution_rate: 0,
      average_engagement_score: 0,
      partner_retention_rate: 0,
    }
  }

  const latestMetric = metrics[metrics.length - 1]

  return {
    total_active_partners: latestMetric.active_partners_count || 0,
    total_new_partners: metrics.reduce((sum, m) => sum + (m.new_partners_onboarded || 0), 0),
    total_partner_revenue: metrics.reduce((sum, m) => sum + (m.partner_revenue_generated || 0), 0),
    average_partner_satisfaction: calculateAverage(metrics, 'partner_satisfaction_score'),
    total_training_sessions: metrics.reduce((sum, m) => sum + (m.training_sessions_conducted || 0), 0),
    total_performance_reviews: metrics.reduce((sum, m) => sum + (m.performance_reviews_completed || 0), 0),
    total_top_performers: latestMetric.top_performing_partners_count || 0,
    grievance_resolution_rate: calculateAverage(metrics, 'grievance_resolution_rate'),
    average_engagement_score: calculateAverage(metrics, 'engagement_score'),
    partner_retention_rate: latestMetric.retention_rate || 0,
  }
}

function calculateCPMPerformanceScore(current: any, targets: CPMMonthlyTargets): number {
  const weights = {
    active_partners: 0.15,
    new_partners: 0.10,
    revenue: 0.25,
    satisfaction: 0.15,
    training: 0.05,
    reviews: 0.05,
    top_performers: 0.10,
    grievances: 0.05,
    engagement: 0.05,
    retention: 0.05,
  }

  let score = 0

  score += weights.active_partners * Math.min(100, (current.total_active_partners / targets.active_partners_target) * 100)
  score += weights.new_partners * Math.min(100, (current.total_new_partners / targets.new_partners_onboarded_target) * 100)
  score += weights.revenue * Math.min(100, (current.total_partner_revenue / targets.partner_revenue_target) * 100)
  score += weights.satisfaction * Math.min(100, (current.average_partner_satisfaction / targets.partner_satisfaction_target) * 100)
  score += weights.training * Math.min(100, (current.total_training_sessions / targets.partner_training_sessions_target) * 100)
  score += weights.reviews * Math.min(100, (current.total_performance_reviews / targets.partner_performance_reviews_target) * 100)
  score += weights.top_performers * Math.min(100, (current.total_top_performers / targets.top_performing_partners_target) * 100)
  score += weights.grievances * Math.min(100, (current.grievance_resolution_rate / targets.partner_grievances_resolved_target) * 100)
  score += weights.engagement * Math.min(100, (current.average_engagement_score / targets.partner_engagement_score_target) * 100)
  score += weights.retention * Math.min(100, (current.partner_retention_rate / targets.partner_retention_rate_target) * 100)

  return Math.round(score)
}

function calculateAverage(metrics: any[], field: string): number {
  const validMetrics = metrics.filter(m => m[field] !== null && m[field] !== undefined)
  if (validMetrics.length === 0) return 0
  const sum = validMetrics.reduce((acc, m) => acc + (m[field] || 0), 0)
  return sum / validMetrics.length
}

function getPerformanceGrade(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function calculateOverallAchievement(metrics: MetricCard[]): number {
  if (metrics.length === 0) return 0
  const total = metrics.reduce((sum, m) => sum + (m.achievementPercentage || 0), 0)
  return Math.round(total / metrics.length)
}
