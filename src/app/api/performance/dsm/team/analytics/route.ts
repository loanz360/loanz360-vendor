import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DSMTeamAnalytics } from '@/lib/types/dsm-team-performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/dsm/team/analytics
 * Returns aggregated team analytics for the DSM
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
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Verify user is DSM
    if (profile.sub_role !== 'DIRECT_SALES_MANAGER') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales Managers only.' },
        { status: 403 }
      )
    }

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    // Get all DSEs reporting to this DSM
    const { data: dseUsers, error: dseError } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('manager_id', user.id)

    if (dseError) {
      apiLogger.error('Error fetching DSE users', dseError)
      return NextResponse.json(
        { error: 'Failed to fetch team data' },
        { status: 500 }
      )
    }

    const dseIds = dseUsers?.map((dse) => dse.id) || []
    const activeDseIds = dseUsers?.filter((dse) => dse.is_active).map((dse) => dse.id) || []

    if (dseIds.length === 0) {
      // No team members, return empty analytics
      return NextResponse.json({
        success: true,
        data: getEmptyAnalytics(),
      })
    }

    // Fetch aggregated daily metrics for all DSEs
    const { data: allDailyMetrics } = await supabase
      .from('dse_daily_metrics')
      .select('*')
      .in('user_id', dseIds)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

    // Fetch monthly summaries for performance scores and grades
    const { data: monthlySummaries } = await supabase
      .from('dse_monthly_summary')
      .select('user_id, overall_score, grade')
      .in('user_id', dseIds)
      .eq('month', currentMonth)
      .eq('year', currentYear)

    // Fetch DSM's coaching data (if table exists)
    let coachingSessions: any[] = []
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('dse_user_id, session_date, session_type, duration_minutes')
        .eq('dsm_user_id', user.id)
        .gte('session_date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('session_date', lastDayOfMonth.toISOString().split('T')[0])

      // Only use data if table exists
      if (!error || error.code !== '42P01') {
        coachingSessions = data || []
      }
    } catch (error) {
      // Table doesn't exist yet, use empty array
    }

    // Fetch DSM's monthly targets
    const { data: targets } = await supabase
      .from('dsm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Calculate analytics
    const analytics = calculateTeamAnalytics(
      dseIds.length,
      activeDseIds.length,
      allDailyMetrics || [],
      monthlySummaries || [],
      coachingSessions || [],
      targets
    )

    return NextResponse.json({
      success: true,
      data: analytics,
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching team analytics', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch team analytics',
        },
      { status: 500 }
    )
  }
}

/**
 * Calculate team analytics from raw data
 */
function calculateTeamAnalytics(
  totalDseCount: number,
  activeDseCount: number,
  dailyMetrics: any[],
  monthlySummaries: any[],
  coachingSessions: any[],
  targets: any
): DSMTeamAnalytics {
  // Aggregate field activity
  const fieldActivity = dailyMetrics.reduce(
    (acc, metric) => {
      acc.total_field_visits += metric.field_visits_completed || 0
      acc.total_meetings_scheduled += metric.meetings_scheduled || 0
      acc.total_meetings_attended += metric.meetings_attended || 0
      acc.total_travel_distance += metric.travel_distance_km || 0
      return acc
    },
    {
      total_field_visits: 0,
      total_meetings_scheduled: 0,
      total_meetings_attended: 0,
      total_travel_distance: 0,
    }
  )

  // Aggregate revenue & conversion
  const revenueMetrics = dailyMetrics.reduce(
    (acc, metric) => {
      acc.total_revenue += metric.revenue_generated || 0
      acc.total_leads += metric.leads_generated || 0
      acc.total_conversions += metric.leads_converted || 0
      return acc
    },
    {
      total_revenue: 0,
      total_leads: 0,
      total_conversions: 0,
    }
  )

  // Calculate averages
  const avg_field_visits_per_dse =
    activeDseCount > 0 ? fieldActivity.total_field_visits / activeDseCount : 0
  const avg_meetings_per_dse =
    activeDseCount > 0 ? fieldActivity.total_meetings_scheduled / activeDseCount : 0
  const avg_conversion_rate =
    revenueMetrics.total_leads > 0
      ? (revenueMetrics.total_conversions / revenueMetrics.total_leads) * 100
      : 0
  const avg_deal_size =
    revenueMetrics.total_conversions > 0
      ? revenueMetrics.total_revenue / revenueMetrics.total_conversions
      : 0

  // Calculate performance grades distribution
  const topPerformersCount = monthlySummaries.filter(
    (s) => s.grade === 'A+' || s.grade === 'A'
  ).length
  const needsCoachingCount = monthlySummaries.filter(
    (s) => s.grade === 'C' || s.grade === 'D' || s.grade === 'F'
  ).length

  // Calculate team average score
  const team_avg_score =
    monthlySummaries.length > 0
      ? monthlySummaries.reduce((sum, s) => sum + (s.overall_score || 0), 0) /
        monthlySummaries.length
      : 0

  // Calculate coaching metrics
  const uniqueDsesCoached = new Set(coachingSessions.map((s) => s.dse_user_id)).size
  const one_on_one_coverage_pct =
    activeDseCount > 0 ? (uniqueDsesCoached / activeDseCount) * 100 : 0

  const total_one_on_ones_completed = coachingSessions.filter(
    (s) => s.session_type === 'one_on_one'
  ).length
  const total_coaching_sessions = coachingSessions.filter(
    (s) => s.session_type === 'field_coaching'
  ).length
  const total_training_hours =
    coachingSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60

  // Calculate target achievements
  const team_revenue_achievement_pct = targets
    ? (revenueMetrics.total_revenue / targets.team_revenue_target) * 100
    : 0
  const team_target_achievement_pct = targets
    ? ((revenueMetrics.total_conversions /
        (targets.team_field_visits_target * (targets.team_conversion_rate_target / 100))) *
        100)
    : 0

  // Get unique territories (from location field if available)
  const total_territories = 5 // Mock value - in production, query from territory table
  const avg_territory_coverage = 75 // Mock value
  const territories_expanded_this_month = 2 // Mock value

  // Team CSAT (mock value - in production, calculate from customer feedback)
  const team_csat = 4.5

  // Count on leave (DSEs with no activity)
  const on_leave_count = totalDseCount - activeDseCount

  return {
    // Team Overview
    total_dse_count: totalDseCount,
    active_dse_count: activeDseCount,
    on_leave_count,
    top_performers_count: topPerformersCount,
    needs_coaching_count: needsCoachingCount,

    // Aggregated Field Activity
    total_field_visits: fieldActivity.total_field_visits,
    total_meetings_scheduled: fieldActivity.total_meetings_scheduled,
    total_meetings_attended: fieldActivity.total_meetings_attended,
    total_travel_distance: fieldActivity.total_travel_distance,
    avg_field_visits_per_dse,
    avg_meetings_per_dse,

    // Aggregated Revenue & Conversion
    total_revenue: revenueMetrics.total_revenue,
    total_leads: revenueMetrics.total_leads,
    total_conversions: revenueMetrics.total_conversions,
    avg_conversion_rate,
    avg_deal_size,

    // Territory Coverage
    total_territories,
    avg_territory_coverage,
    territories_expanded_this_month,

    // Team Quality Metrics
    team_avg_score,
    team_csat,
    team_revenue_achievement_pct: Math.round(team_revenue_achievement_pct * 10) / 10,
    team_target_achievement_pct: Math.round(team_target_achievement_pct * 10) / 10,

    // Management Metrics
    total_one_on_ones_completed,
    total_coaching_sessions,
    total_training_hours: Math.round(total_training_hours * 10) / 10,
    one_on_one_coverage_pct: Math.round(one_on_one_coverage_pct * 10) / 10,
  }
}

/**
 * Return empty analytics when no team members
 */
function getEmptyAnalytics(): DSMTeamAnalytics {
  return {
    total_dse_count: 0,
    active_dse_count: 0,
    on_leave_count: 0,
    top_performers_count: 0,
    needs_coaching_count: 0,
    total_field_visits: 0,
    total_meetings_scheduled: 0,
    total_meetings_attended: 0,
    total_travel_distance: 0,
    avg_field_visits_per_dse: 0,
    avg_meetings_per_dse: 0,
    total_revenue: 0,
    total_leads: 0,
    total_conversions: 0,
    avg_conversion_rate: 0,
    avg_deal_size: 0,
    total_territories: 0,
    avg_territory_coverage: 0,
    territories_expanded_this_month: 0,
    team_avg_score: 0,
    team_csat: 0,
    team_revenue_achievement_pct: 0,
    team_target_achievement_pct: 0,
    total_one_on_ones_completed: 0,
    total_coaching_sessions: 0,
    total_training_hours: 0,
    one_on_one_coverage_pct: 0,
  }
}
