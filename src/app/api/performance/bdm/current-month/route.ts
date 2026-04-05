import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CurrentMonthPerformance, BDMMonthlyTargets, BDMDailyMetrics, MetricCard } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/bdm/current-month
 * Returns current month performance data for Business Development Manager
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

    if (profile.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Business Development Managers only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const { data: targets } = await supabase
      .from('bdm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const monthlyTargets: BDMMonthlyTargets = targets || {
      id: '',
      user_id: user.id,
      month: currentMonth,
      year: currentYear,
      partnerships_initiated_target: 15,
      partnerships_closed_target: 8,
      partnership_revenue_target: 2500000,
      meetings_attended_target: 25,
      proposals_submitted_target: 12,
      proposal_success_rate_target: 60.0,
      new_territories_target: 3,
      market_expansion_target: 20.0,
      strategic_deals_target: 5,
      team_performance_score_target: 85.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    const { data: dailyMetrics } = await supabase
      .from('bdm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

    const currentMetrics = aggregateBDMMetrics(dailyMetrics || [])

    const metricCards: MetricCard[] = [
      {
        label: 'Partnerships Initiated',
        value: currentMetrics.total_partnerships_initiated,
        target: monthlyTargets.partnerships_initiated_target,
        achievementPercentage: (currentMetrics.total_partnerships_initiated / monthlyTargets.partnerships_initiated_target) * 100,
        icon: '🤝',
        color: 'blue',
        category: 'activity',
        description: 'New partnerships started',
      },
      {
        label: 'Partnerships Closed',
        value: currentMetrics.total_partnerships_closed,
        target: monthlyTargets.partnerships_closed_target,
        achievementPercentage: (currentMetrics.total_partnerships_closed / monthlyTargets.partnerships_closed_target) * 100,
        icon: '✅',
        color: 'green',
        category: 'conversion',
        description: 'Deals successfully closed',
      },
      {
        label: 'Partnership Revenue',
        value: currentMetrics.total_partnership_revenue,
        target: monthlyTargets.partnership_revenue_target,
        unit: '₹',
        achievementPercentage: (currentMetrics.total_partnership_revenue / monthlyTargets.partnership_revenue_target) * 100,
        icon: '💰',
        color: 'green',
        category: 'revenue',
        description: 'Revenue from partnerships',
      },
      {
        label: 'Meetings Attended',
        value: currentMetrics.total_meetings_attended,
        target: monthlyTargets.meetings_attended_target,
        achievementPercentage: (currentMetrics.total_meetings_attended / monthlyTargets.meetings_attended_target) * 100,
        icon: '📅',
        color: 'blue',
        category: 'activity',
        description: 'Strategic meetings',
      },
      {
        label: 'Proposals Submitted',
        value: currentMetrics.total_proposals_submitted,
        target: monthlyTargets.proposals_submitted_target,
        achievementPercentage: (currentMetrics.total_proposals_submitted / monthlyTargets.proposals_submitted_target) * 100,
        icon: '📄',
        color: 'purple',
        category: 'activity',
        description: 'Business proposals sent',
      },
      {
        label: 'Proposal Success Rate',
        value: currentMetrics.proposal_success_rate,
        target: monthlyTargets.proposal_success_rate_target,
        unit: '%',
        achievementPercentage: (currentMetrics.proposal_success_rate / monthlyTargets.proposal_success_rate_target) * 100,
        icon: '📈',
        color: 'green',
        category: 'conversion',
        description: 'Proposal conversion rate',
      },
      {
        label: 'New Territories',
        value: currentMetrics.total_new_territories,
        target: monthlyTargets.new_territories_target,
        achievementPercentage: (currentMetrics.total_new_territories / monthlyTargets.new_territories_target) * 100,
        icon: '🗺️',
        color: 'blue',
        category: 'activity',
        description: 'Markets expanded into',
      },
      {
        label: 'Market Expansion',
        value: currentMetrics.market_expansion_percentage,
        target: monthlyTargets.market_expansion_target,
        unit: '%',
        achievementPercentage: (currentMetrics.market_expansion_percentage / monthlyTargets.market_expansion_target) * 100,
        icon: '📊',
        color: 'purple',
        category: 'quality',
        description: 'Market growth rate',
      },
      {
        label: 'Strategic Deals',
        value: currentMetrics.total_strategic_deals,
        target: monthlyTargets.strategic_deals_target,
        achievementPercentage: (currentMetrics.total_strategic_deals / monthlyTargets.strategic_deals_target) * 100,
        icon: '🎯',
        color: 'orange',
        category: 'quality',
        description: 'High-value partnerships',
      },
      {
        label: 'Team Performance',
        value: currentMetrics.team_performance_score,
        target: monthlyTargets.team_performance_score_target,
        unit: '/100',
        achievementPercentage: (currentMetrics.team_performance_score / monthlyTargets.team_performance_score_target) * 100,
        icon: '👥',
        color: 'yellow',
        category: 'team',
        description: 'Team effectiveness score',
      },
    ]

    const overallScore = calculateBDMPerformanceScore(currentMetrics, monthlyTargets)

    const { data: monthlySummary } = await supabase
      .from('bdm_monthly_summary')
      .select('company_rank, total_employees, percentile, performance_grade')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const targetAchievement = calculateTargetAchievement(metricCards)

    const response: CurrentMonthPerformance<BDMMonthlyTargets, typeof currentMetrics, any> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'BUSINESS_DEVELOPMENT_MANAGER',
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
    apiLogger.error('Error in BDM performance API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function aggregateBDMMetrics(dailyMetrics: any[]): any {
  if (dailyMetrics.length === 0) {
    return {
      total_partnerships_initiated: 0,
      total_partnerships_closed: 0,
      total_partnership_revenue: 0,
      total_meetings_attended: 0,
      total_proposals_submitted: 0,
      total_proposals_accepted: 0,
      proposal_success_rate: 0,
      total_new_territories: 0,
      market_expansion_percentage: 0,
      total_strategic_deals: 0,
      team_performance_score: 0,
    }
  }

  const totals = dailyMetrics.reduce(
    (acc, metric) => ({
      total_partnerships_initiated: acc.total_partnerships_initiated + (metric.partnerships_initiated || 0),
      total_partnerships_closed: acc.total_partnerships_closed + (metric.partnerships_closed || 0),
      total_partnership_revenue: acc.total_partnership_revenue + (metric.partnership_revenue || 0),
      total_meetings_attended: acc.total_meetings_attended + (metric.meetings_attended || 0),
      total_proposals_submitted: acc.total_proposals_submitted + (metric.proposals_submitted || 0),
      total_proposals_accepted: acc.total_proposals_accepted + (metric.proposals_accepted || 0),
      total_new_territories: acc.total_new_territories + (metric.new_territories || 0),
      market_expansion_sum: acc.market_expansion_sum + (metric.market_expansion_percentage || 0),
      total_strategic_deals: acc.total_strategic_deals + (metric.strategic_deals || 0),
      team_performance_sum: acc.team_performance_sum + (metric.team_performance_score || 0),
    }),
    {
      total_partnerships_initiated: 0,
      total_partnerships_closed: 0,
      total_partnership_revenue: 0,
      total_meetings_attended: 0,
      total_proposals_submitted: 0,
      total_proposals_accepted: 0,
      total_new_territories: 0,
      market_expansion_sum: 0,
      total_strategic_deals: 0,
      team_performance_sum: 0,
    }
  )

  const proposal_success_rate = totals.total_proposals_submitted > 0
    ? (totals.total_proposals_accepted / totals.total_proposals_submitted) * 100
    : 0
  const market_expansion_percentage = dailyMetrics.length > 0 ? totals.market_expansion_sum / dailyMetrics.length : 0
  const team_performance_score = dailyMetrics.length > 0 ? totals.team_performance_sum / dailyMetrics.length : 0

  return {
    total_partnerships_initiated: totals.total_partnerships_initiated,
    total_partnerships_closed: totals.total_partnerships_closed,
    total_partnership_revenue: totals.total_partnership_revenue,
    total_meetings_attended: totals.total_meetings_attended,
    total_proposals_submitted: totals.total_proposals_submitted,
    total_proposals_accepted: totals.total_proposals_accepted,
    proposal_success_rate,
    total_new_territories: totals.total_new_territories,
    market_expansion_percentage,
    total_strategic_deals: totals.total_strategic_deals,
    team_performance_score,
  }
}

function calculateBDMPerformanceScore(current: any, targets: BDMMonthlyTargets): number {
  const weights = {
    partnerships_initiated: 0.10,
    partnerships_closed: 0.15,
    partnership_revenue: 0.20,
    meetings: 0.10,
    proposals_submitted: 0.10,
    proposal_success: 0.15,
    territories: 0.05,
    market_expansion: 0.05,
    strategic_deals: 0.05,
    team_performance: 0.05,
  }

  const scores = {
    partnerships_initiated: Math.min((current.total_partnerships_initiated / targets.partnerships_initiated_target) * 100, 100),
    partnerships_closed: Math.min((current.total_partnerships_closed / targets.partnerships_closed_target) * 100, 100),
    partnership_revenue: Math.min((current.total_partnership_revenue / targets.partnership_revenue_target) * 100, 100),
    meetings: Math.min((current.total_meetings_attended / targets.meetings_attended_target) * 100, 100),
    proposals_submitted: Math.min((current.total_proposals_submitted / targets.proposals_submitted_target) * 100, 100),
    proposal_success: Math.min((current.proposal_success_rate / targets.proposal_success_rate_target) * 100, 100),
    territories: Math.min((current.total_new_territories / targets.new_territories_target) * 100, 100),
    market_expansion: Math.min((current.market_expansion_percentage / targets.market_expansion_target) * 100, 100),
    strategic_deals: Math.min((current.total_strategic_deals / targets.strategic_deals_target) * 100, 100),
    team_performance: Math.min((current.team_performance_score / targets.team_performance_score_target) * 100, 100),
  }

  const overallScore =
    scores.partnerships_initiated * weights.partnerships_initiated +
    scores.partnerships_closed * weights.partnerships_closed +
    scores.partnership_revenue * weights.partnership_revenue +
    scores.meetings * weights.meetings +
    scores.proposals_submitted * weights.proposals_submitted +
    scores.proposal_success * weights.proposal_success +
    scores.territories * weights.territories +
    scores.market_expansion * weights.market_expansion +
    scores.strategic_deals * weights.strategic_deals +
    scores.team_performance * weights.team_performance

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
