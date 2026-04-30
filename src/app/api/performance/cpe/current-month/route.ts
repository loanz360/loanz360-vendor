import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CurrentMonthPerformance, CPEMonthlyTargets, CPEDailyMetrics, MetricCard } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpe/current-month
 * Returns current month performance data for Channel Partner Executive
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role, location')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      apiLogger.error('User profile not found', {
        userId: user.id,
        error: profileError?.message,
      })
      return NextResponse.json(
        {
          error: 'User profile not found. Please contact administrator.',
          details: 'Your user profile needs to be set up before accessing performance data.',
        },
        { status: 404 }
      )
    }

    // Verify user is CPE
    if (profile.sub_role !== 'CHANNEL_PARTNER_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Channel Partner Executives only.' },
        { status: 403 }
      )
    }

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch monthly targets
    const { data: targets } = await supabase
      .from('cpe_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // If no targets, create default ones
    const monthlyTargets: CPEMonthlyTargets = targets || {
      id: '',
      user_id: user.id,
      month: currentMonth,
      year: currentYear,
      partners_onboarded_target: 5,
      active_partners_target: 20,
      partner_revenue_target: 800000,
      partner_leads_generated_target: 50,
      partner_leads_converted_target: 10,
      partner_conversion_rate_target: 20.0,
      partner_network_size_target: 25,
      partner_engagement_score_target: 75.0,
      commission_earned_target: 80000,
      partner_training_sessions_target: 8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Fetch current month daily metrics
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    const { data: dailyMetrics } = await supabase
      .from('cpe_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

    // Aggregate daily metrics
    const currentMetrics = aggregateCPEMetrics(dailyMetrics || [])

    // Calculate metric cards
    const metricCards: MetricCard[] = [
      {
        label: 'Partners Onboarded',
        value: currentMetrics.total_partners_onboarded,
        target: monthlyTargets.partners_onboarded_target,
        achievementPercentage: (currentMetrics.total_partners_onboarded / monthlyTargets.partners_onboarded_target) * 100,
        icon: '🤝',
        color: 'blue',
        category: 'lead',
        description: 'New partners this month',
      },
      {
        label: 'Active Partners',
        value: currentMetrics.total_active_partners,
        target: monthlyTargets.active_partners_target,
        achievementPercentage: (currentMetrics.total_active_partners / monthlyTargets.active_partners_target) * 100,
        icon: '👥',
        color: 'green',
        category: 'activity',
        description: 'Currently active partners',
      },
      {
        label: 'Partner Revenue',
        value: currentMetrics.total_partner_revenue,
        target: monthlyTargets.partner_revenue_target,
        unit: '₹',
        achievementPercentage: (currentMetrics.total_partner_revenue / monthlyTargets.partner_revenue_target) * 100,
        icon: '💰',
        color: 'green',
        category: 'revenue',
        description: 'Revenue from partners',
      },
      {
        label: 'Partner Leads Generated',
        value: currentMetrics.total_partner_leads_generated,
        target: monthlyTargets.partner_leads_generated_target,
        achievementPercentage: (currentMetrics.total_partner_leads_generated / monthlyTargets.partner_leads_generated_target) * 100,
        icon: '📊',
        color: 'blue',
        category: 'lead',
        description: 'Leads from partner network',
      },
      {
        label: 'Partner Conversions',
        value: currentMetrics.total_partner_leads_converted,
        target: monthlyTargets.partner_leads_converted_target,
        achievementPercentage: (currentMetrics.total_partner_leads_converted / monthlyTargets.partner_leads_converted_target) * 100,
        icon: '✅',
        color: 'green',
        category: 'conversion',
        description: 'Partner leads closed',
      },
      {
        label: 'Partner Conversion Rate',
        value: currentMetrics.partner_conversion_rate,
        target: monthlyTargets.partner_conversion_rate_target,
        unit: '%',
        achievementPercentage: (currentMetrics.partner_conversion_rate / monthlyTargets.partner_conversion_rate_target) * 100,
        icon: '📈',
        color: 'blue',
        category: 'conversion',
        description: 'Partner lead conversion',
      },
      {
        label: 'Partner Network Size',
        value: currentMetrics.partner_network_size,
        target: monthlyTargets.partner_network_size_target,
        achievementPercentage: (currentMetrics.partner_network_size / monthlyTargets.partner_network_size_target) * 100,
        icon: '🌐',
        color: 'purple',
        category: 'activity',
        description: 'Total partner network',
      },
      {
        label: 'Engagement Score',
        value: currentMetrics.average_partner_engagement_score,
        target: monthlyTargets.partner_engagement_score_target,
        unit: '%',
        achievementPercentage: (currentMetrics.average_partner_engagement_score / monthlyTargets.partner_engagement_score_target) * 100,
        icon: '⭐',
        color: 'yellow',
        category: 'quality',
        description: 'Partner engagement level',
      },
      {
        label: 'Commission Earned',
        value: currentMetrics.total_commission_earned,
        target: monthlyTargets.commission_earned_target,
        unit: '₹',
        achievementPercentage: (currentMetrics.total_commission_earned / monthlyTargets.commission_earned_target) * 100,
        icon: '💵',
        color: 'green',
        category: 'revenue',
        description: 'Your commission',
      },
      {
        label: 'Training Sessions',
        value: currentMetrics.total_partner_training_sessions,
        target: monthlyTargets.partner_training_sessions_target,
        achievementPercentage: (currentMetrics.total_partner_training_sessions / monthlyTargets.partner_training_sessions_target) * 100,
        icon: '🎓',
        color: 'orange',
        category: 'activity',
        description: 'Partner training conducted',
      },
    ]

    // Calculate overall performance score
    const overallScore = calculateCPEPerformanceScore(currentMetrics, monthlyTargets)

    // Fetch monthly summary for ranking
    const { data: monthlySummary } = await supabase
      .from('cpe_monthly_summary')
      .select('company_rank, total_employees, percentile, performance_grade')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Calculate target achievement
    const targetAchievement = calculateTargetAchievement(metricCards)

    const response: CurrentMonthPerformance<CPEMonthlyTargets, typeof currentMetrics, any> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'CHANNEL_PARTNER_EXECUTIVE',
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
      graphData: {
        daily: [],
        comparison: {
          self: [],
          average: [],
        },
      },
      leaderboard: [],
      currentUserRank: monthlySummary?.company_rank || 0,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in CPE performance API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to aggregate daily metrics
function aggregateCPEMetrics(dailyMetrics: any[]): any {
  if (dailyMetrics.length === 0) {
    return {
      total_partners_onboarded: 0,
      total_active_partners: 0,
      total_partner_revenue: 0,
      total_partner_leads_generated: 0,
      total_partner_leads_converted: 0,
      partner_conversion_rate: 0,
      partner_network_size: 0,
      average_partner_engagement_score: 0,
      total_commission_earned: 0,
      total_partner_training_sessions: 0,
    }
  }

  const totals = dailyMetrics.reduce(
    (acc, metric) => ({
      total_partners_onboarded: acc.total_partners_onboarded + (metric.partners_onboarded || 0),
      total_active_partners: Math.max(acc.total_active_partners, metric.active_partners || 0),
      total_partner_revenue: acc.total_partner_revenue + (metric.partner_revenue || 0),
      total_partner_leads_generated: acc.total_partner_leads_generated + (metric.partner_leads_generated || 0),
      total_partner_leads_converted: acc.total_partner_leads_converted + (metric.partner_leads_converted || 0),
      partner_network_size: Math.max(acc.partner_network_size, metric.partner_network_size || 0),
      engagement_score_sum: acc.engagement_score_sum + (metric.partner_engagement_score || 0),
      total_commission_earned: acc.total_commission_earned + (metric.commission_earned || 0),
      total_partner_training_sessions: acc.total_partner_training_sessions + (metric.partner_training_sessions || 0),
    }),
    {
      total_partners_onboarded: 0,
      total_active_partners: 0,
      total_partner_revenue: 0,
      total_partner_leads_generated: 0,
      total_partner_leads_converted: 0,
      partner_network_size: 0,
      engagement_score_sum: 0,
      total_commission_earned: 0,
      total_partner_training_sessions: 0,
    }
  )

  // Calculate derived metrics
  const partner_conversion_rate = totals.total_partner_leads_generated > 0
    ? (totals.total_partner_leads_converted / totals.total_partner_leads_generated) * 100
    : 0

  const average_partner_engagement_score = dailyMetrics.length > 0
    ? totals.engagement_score_sum / dailyMetrics.length
    : 0

  return {
    total_partners_onboarded: totals.total_partners_onboarded,
    total_active_partners: totals.total_active_partners,
    total_partner_revenue: totals.total_partner_revenue,
    total_partner_leads_generated: totals.total_partner_leads_generated,
    total_partner_leads_converted: totals.total_partner_leads_converted,
    partner_conversion_rate,
    partner_network_size: totals.partner_network_size,
    average_partner_engagement_score,
    total_commission_earned: totals.total_commission_earned,
    total_partner_training_sessions: totals.total_partner_training_sessions,
  }
}

// Helper function to calculate performance score
function calculateCPEPerformanceScore(current: any, targets: CPEMonthlyTargets): number {
  const weights = {
    partners_onboarded: 0.15,
    active_partners: 0.10,
    partner_revenue: 0.20,
    partner_leads: 0.10,
    partner_conversions: 0.15,
    conversion_rate: 0.10,
    network_size: 0.05,
    engagement: 0.10,
    commission: 0.05,
  }

  const scores = {
    partners_onboarded: Math.min((current.total_partners_onboarded / targets.partners_onboarded_target) * 100, 100),
    active_partners: Math.min((current.total_active_partners / targets.active_partners_target) * 100, 100),
    partner_revenue: Math.min((current.total_partner_revenue / targets.partner_revenue_target) * 100, 100),
    partner_leads: Math.min((current.total_partner_leads_generated / targets.partner_leads_generated_target) * 100, 100),
    partner_conversions: Math.min((current.total_partner_leads_converted / targets.partner_leads_converted_target) * 100, 100),
    conversion_rate: Math.min((current.partner_conversion_rate / targets.partner_conversion_rate_target) * 100, 100),
    network_size: Math.min((current.partner_network_size / targets.partner_network_size_target) * 100, 100),
    engagement: Math.min((current.average_partner_engagement_score / targets.partner_engagement_score_target) * 100, 100),
    commission: Math.min((current.total_commission_earned / targets.commission_earned_target) * 100, 100),
  }

  const overallScore =
    scores.partners_onboarded * weights.partners_onboarded +
    scores.active_partners * weights.active_partners +
    scores.partner_revenue * weights.partner_revenue +
    scores.partner_leads * weights.partner_leads +
    scores.partner_conversions * weights.partner_conversions +
    scores.conversion_rate * weights.conversion_rate +
    scores.network_size * weights.network_size +
    scores.engagement * weights.engagement +
    scores.commission * weights.commission

  return Math.round(overallScore)
}

// Helper function to calculate grade
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

// Helper function to calculate overall target achievement
function calculateTargetAchievement(metricCards: MetricCard[]): number {
  if (metricCards.length === 0) return 0

  const totalAchievement = metricCards.reduce((sum, card) => sum + card.achievementPercentage, 0)
  return totalAchievement / metricCards.length
}
