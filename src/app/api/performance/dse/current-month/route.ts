import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import type { CurrentMonthPerformance, DSEMonthlyTargets, DSEDailyMetrics, MetricCard } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dse/current-month
 * Returns current month performance data for Direct Sales Executive
 *
 * DB tables (from migration 20251123_sales_performance_complete_system.sql):
 *   dse_targets       (user_id, month, year) — performance targets
 *   dse_daily_metrics  (user_id, metric_date) — daily performance data
 *   dse_monthly_summary (user_id OR dse_user_id, month, year) — monthly rollup
 *
 * Uses admin client to bypass RLS after authenticating the user.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to verify DSE role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      apiLogger.error('User profile not found', { userId: user.id, error: profileError?.message })
      return NextResponse.json(
        { error: 'User profile not found. Please contact administrator.' },
        { status: 404 }
      )
    }

    if (profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales Executives only.' },
        { status: 403 }
      )
    }

    // Use admin client for performance table queries (bypasses RLS)
    const adminClient = createSupabaseAdmin()

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // --- Fetch targets ---
    // Try dse_targets first (20251123 migration, user_id), then dse_customer_targets (20251201, dse_user_id)
    let targets: any = null
    const { data: t1, error: t1Err } = await adminClient
      .from('dse_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    if (!t1Err && t1) {
      targets = t1
    } else {
      const { data: t2 } = await adminClient
        .from('dse_customer_targets')
        .select('*')
        .eq('dse_user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()
      targets = t2
    }

    // Transform targets to standardized format
    // dse_targets columns: field_visits_target, meetings_scheduled_target, meetings_attended_target,
    //   leads_generated_target, leads_converted_target, field_conversion_rate_target,
    //   revenue_target, average_deal_size_target, territory_coverage_target, customer_demos_target
    // dse_customer_targets columns: monthly_visits_target, meetings_target, leads_target,
    //   conversion_target, conversion_rate_target, revenue_target
    const monthlyTargets: DSEMonthlyTargets = targets ? {
      id: targets.id || '',
      userId: targets.user_id || targets.dse_user_id || user.id,
      month: targets.month || currentMonth,
      year: targets.year || currentYear,
      fieldVisitsTarget: targets.field_visits_target || targets.monthly_visits_target || 60,
      meetingsScheduledTarget: targets.meetings_scheduled_target || targets.meetings_target || 50,
      meetingsAttendedTarget: targets.meetings_attended_target || targets.meetings_target || 45,
      leadsGeneratedTarget: targets.leads_generated_target || targets.leads_target || 40,
      leadsConvertedTarget: targets.leads_converted_target || targets.conversion_target || 8,
      fieldConversionRateTarget: targets.field_conversion_rate_target || targets.conversion_rate_target || 20.0,
      revenueTarget: targets.revenue_target || 800000,
      averageDealSizeTarget: targets.average_deal_size_target || 100000,
      territoryCoverageTarget: targets.territory_coverage_target || 80.0,
      customerDemosTarget: targets.customer_demos_target || 20,
      createdAt: targets.created_at || new Date().toISOString(),
      updatedAt: targets.updated_at || new Date().toISOString(),
    } : {
      id: '', userId: user.id, month: currentMonth, year: currentYear,
      fieldVisitsTarget: 60, meetingsScheduledTarget: 50, meetingsAttendedTarget: 45,
      leadsGeneratedTarget: 40, leadsConvertedTarget: 8, fieldConversionRateTarget: 20.0,
      revenueTarget: 800000, averageDealSizeTarget: 100000, territoryCoverageTarget: 80.0,
      customerDemosTarget: 20,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }

    // --- Fetch daily metrics ---
    const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
    const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    // Try dse_daily_metrics first (20251123, user_id, metric_date), then dse_daily_analytics (20251201, dse_user_id, analytics_date)
    let dailyMetrics: any[] = []
    let usingOldSchema = true

    const { data: dm1, error: dm1Err } = await adminClient
      .from('dse_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDay)
      .lte('metric_date', lastDay)

    if (!dm1Err) {
      dailyMetrics = dm1 || []
    } else {
      usingOldSchema = false
      const { data: dm2 } = await adminClient
        .from('dse_daily_analytics')
        .select('*')
        .eq('dse_user_id', user.id)
        .gte('analytics_date', firstDay)
        .lte('analytics_date', lastDay)
      dailyMetrics = dm2 || []
    }

    // Aggregate daily metrics (handle both column naming schemas)
    const currentMetrics = aggregateDSEMetrics(dailyMetrics, usingOldSchema)

    // --- Build metric cards ---
    const metricCards: MetricCard[] = [
      {
        label: 'Field Visits',
        value: currentMetrics.total_field_visits,
        target: monthlyTargets.fieldVisitsTarget,
        achievementPercentage: safePercent(currentMetrics.total_field_visits, monthlyTargets.fieldVisitsTarget),
        icon: '🚗', color: 'blue', category: 'activity',
        description: 'Visits completed this month',
      },
      {
        label: 'Meetings Attended',
        value: currentMetrics.total_meetings_attended,
        target: monthlyTargets.meetingsAttendedTarget,
        achievementPercentage: safePercent(currentMetrics.total_meetings_attended, monthlyTargets.meetingsAttendedTarget),
        icon: '🤝', color: 'green', category: 'activity',
        description: 'Client meetings attended',
      },
      {
        label: 'Leads Generated',
        value: currentMetrics.total_leads_generated,
        target: monthlyTargets.leadsGeneratedTarget,
        achievementPercentage: safePercent(currentMetrics.total_leads_generated, monthlyTargets.leadsGeneratedTarget),
        icon: '🎯', color: 'purple', category: 'lead',
        description: 'New leads from field',
      },
      {
        label: 'Conversions',
        value: currentMetrics.total_conversions,
        target: monthlyTargets.leadsConvertedTarget,
        achievementPercentage: safePercent(currentMetrics.total_conversions, monthlyTargets.leadsConvertedTarget),
        icon: '✅', color: 'green', category: 'conversion',
        description: 'Deals closed',
      },
      {
        label: 'Conversion Rate',
        value: currentMetrics.field_conversion_rate,
        target: monthlyTargets.fieldConversionRateTarget,
        unit: '%',
        achievementPercentage: safePercent(currentMetrics.field_conversion_rate, monthlyTargets.fieldConversionRateTarget),
        icon: '📊', color: 'blue', category: 'conversion',
        description: 'Lead to deal conversion',
      },
      {
        label: 'Revenue Generated',
        value: currentMetrics.total_revenue,
        target: monthlyTargets.revenueTarget,
        unit: '₹',
        achievementPercentage: safePercent(currentMetrics.total_revenue, monthlyTargets.revenueTarget),
        icon: '💰', color: 'green', category: 'revenue',
        description: 'Total sales revenue',
      },
      {
        label: 'Average Deal Size',
        value: currentMetrics.average_deal_size,
        target: monthlyTargets.averageDealSizeTarget,
        unit: '₹',
        achievementPercentage: safePercent(currentMetrics.average_deal_size, monthlyTargets.averageDealSizeTarget),
        icon: '💎', color: 'purple', category: 'quality',
        description: 'Avg revenue per deal',
      },
      {
        label: 'Territory Coverage',
        value: currentMetrics.territory_coverage_percentage,
        target: monthlyTargets.territoryCoverageTarget,
        unit: '%',
        achievementPercentage: safePercent(currentMetrics.territory_coverage_percentage, monthlyTargets.territoryCoverageTarget),
        icon: '🗺️', color: 'orange', category: 'activity',
        description: 'Area coverage',
      },
      {
        label: 'Customer Demos',
        value: currentMetrics.total_customer_demos,
        target: monthlyTargets.customerDemosTarget,
        achievementPercentage: safePercent(currentMetrics.total_customer_demos, monthlyTargets.customerDemosTarget),
        icon: '🎬', color: 'blue', category: 'activity',
        description: 'Product demonstrations',
      },
      {
        label: 'Deals Count',
        value: currentMetrics.total_deals_count,
        target: monthlyTargets.leadsConvertedTarget,
        achievementPercentage: safePercent(currentMetrics.total_deals_count, monthlyTargets.leadsConvertedTarget),
        icon: '📋', color: 'cyan', category: 'conversion',
        description: 'Number of deals closed',
      },
    ]

    const overallScore = calculateDSEPerformanceScore(currentMetrics, monthlyTargets)

    // --- Fetch monthly summary (try both user_id and dse_user_id) ---
    let monthlySummary: any = null
    const { data: ms1, error: ms1Err } = await adminClient
      .from('dse_monthly_summary')
      .select('company_rank, total_employees, percentile, performance_grade, performance_score')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    if (!ms1Err && ms1) {
      monthlySummary = ms1
    } else {
      const { data: ms2 } = await adminClient
        .from('dse_monthly_summary')
        .select('company_rank, team_rank, percentile, performance_grade, performance_score')
        .eq('dse_user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()
      monthlySummary = ms2
    }

    const targetAchievement = calculateTargetAchievement(metricCards)

    const response: CurrentMonthPerformance<DSEMonthlyTargets, typeof currentMetrics, any> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'DIRECT_SALES_EXECUTIVE',
      month: currentMonth,
      year: currentYear,
      summary: {
        overallScore: monthlySummary?.performance_score || overallScore,
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
        comparison: { self: [], average: [] },
      },
      leaderboard: [],
      currentUserRank: monthlySummary?.company_rank || 0,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in DSE performance API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function safePercent(value: number, target: number): number {
  if (!target || target === 0) return 0
  return (value / target) * 100
}

/**
 * Aggregate daily metrics — handles both table schemas:
 *
 * Old schema (dse_daily_metrics from 20251123):
 *   field_visits_completed, meetings_scheduled, meetings_attended, travel_distance_km,
 *   leads_generated, leads_converted, field_conversion_rate, revenue_generated,
 *   deals_closed_count, average_deal_size, territory_coverage, new_prospects_added,
 *   customer_demos, product_presentations, same_day_followups, customer_referrals
 *
 * New schema (dse_daily_analytics from 20251201):
 *   total_visits, successful_visits, new_customer_visits, follow_up_visits,
 *   new_customers_added, customers_visited, visiting_cards_captured,
 *   leads_generated, leads_converted, calls_made, meetings_scheduled, meetings_completed,
 *   potential_revenue, converted_revenue, unique_locations, total_distance_km
 */
function aggregateDSEMetrics(dailyMetrics: any[], usingOldSchema: boolean): any {
  const empty = {
    total_field_visits: 0, total_meetings_scheduled: 0, total_meetings_attended: 0,
    total_travel_distance_km: 0, total_leads_generated: 0, total_conversions: 0,
    field_conversion_rate: 0, total_revenue: 0, total_deals_count: 0,
    average_deal_size: 0, territory_coverage_percentage: 0,
    new_prospects_added: 0, total_customer_demos: 0, total_customer_referrals: 0,
  }

  if (dailyMetrics.length === 0) return empty

  const totals = dailyMetrics.reduce((acc, m) => {
    if (usingOldSchema) {
      // dse_daily_metrics columns
      return {
        total_field_visits: acc.total_field_visits + (m.field_visits_completed || 0),
        total_meetings_scheduled: acc.total_meetings_scheduled + (m.meetings_scheduled || 0),
        total_meetings_attended: acc.total_meetings_attended + (m.meetings_attended || 0),
        total_travel_distance_km: acc.total_travel_distance_km + (Number(m.travel_distance_km) || 0),
        total_leads_generated: acc.total_leads_generated + (m.leads_generated || 0),
        total_conversions: acc.total_conversions + (m.leads_converted || 0),
        total_revenue: acc.total_revenue + (Number(m.revenue_generated) || 0),
        total_deals_count: acc.total_deals_count + (m.deals_closed_count || 0),
        new_prospects_added: acc.new_prospects_added + (m.new_prospects_added || 0),
        total_customer_demos: acc.total_customer_demos + (m.customer_demos || 0),
        total_customer_referrals: acc.total_customer_referrals + (m.customer_referrals || 0),
      }
    } else {
      // dse_daily_analytics columns
      return {
        total_field_visits: acc.total_field_visits + (m.total_visits || 0),
        total_meetings_scheduled: acc.total_meetings_scheduled + (m.meetings_scheduled || 0),
        total_meetings_attended: acc.total_meetings_attended + (m.meetings_completed || 0),
        total_travel_distance_km: acc.total_travel_distance_km + (Number(m.total_distance_km) || 0),
        total_leads_generated: acc.total_leads_generated + (m.leads_generated || 0),
        total_conversions: acc.total_conversions + (m.leads_converted || 0),
        total_revenue: acc.total_revenue + (Number(m.converted_revenue) || 0),
        total_deals_count: acc.total_deals_count + (m.leads_converted || 0),
        new_prospects_added: acc.new_prospects_added + (m.new_customers_added || 0),
        total_customer_demos: acc.total_customer_demos + 0,
        total_customer_referrals: acc.total_customer_referrals + 0,
      }
    }
  }, {
    total_field_visits: 0, total_meetings_scheduled: 0, total_meetings_attended: 0,
    total_travel_distance_km: 0, total_leads_generated: 0, total_conversions: 0,
    total_revenue: 0, total_deals_count: 0, new_prospects_added: 0,
    total_customer_demos: 0, total_customer_referrals: 0,
  })

  const field_conversion_rate = totals.total_leads_generated > 0
    ? (totals.total_conversions / totals.total_leads_generated) * 100 : 0
  const average_deal_size = totals.total_deals_count > 0
    ? totals.total_revenue / totals.total_deals_count : 0

  let territory_coverage_percentage = 0
  if (usingOldSchema) {
    territory_coverage_percentage = dailyMetrics.length > 0
      ? dailyMetrics.reduce((sum: number, m: any) => sum + (Number(m.territory_coverage) || 0), 0) / dailyMetrics.length : 0
  } else {
    territory_coverage_percentage = dailyMetrics.length > 0
      ? dailyMetrics.reduce((sum: number, m: any) => sum + (m.unique_locations || 0), 0) / dailyMetrics.length : 0
  }

  return { ...totals, field_conversion_rate, average_deal_size, territory_coverage_percentage }
}

function calculateDSEPerformanceScore(current: any, targets: DSEMonthlyTargets): number {
  const weights = {
    field_visits: 0.10, meetings: 0.10, leads: 0.15, conversions: 0.15,
    conversion_rate: 0.15, revenue: 0.20, deal_size: 0.05, territory: 0.05, demos: 0.05,
  }
  const scores = {
    field_visits: Math.min(safePercent(current.total_field_visits, targets.fieldVisitsTarget), 100),
    meetings: Math.min(safePercent(current.total_meetings_attended, targets.meetingsAttendedTarget), 100),
    leads: Math.min(safePercent(current.total_leads_generated, targets.leadsGeneratedTarget), 100),
    conversions: Math.min(safePercent(current.total_conversions, targets.leadsConvertedTarget), 100),
    conversion_rate: Math.min(safePercent(current.field_conversion_rate, targets.fieldConversionRateTarget), 100),
    revenue: Math.min(safePercent(current.total_revenue, targets.revenueTarget), 100),
    deal_size: Math.min(safePercent(current.average_deal_size, targets.averageDealSizeTarget), 100),
    territory: Math.min(safePercent(current.territory_coverage_percentage, targets.territoryCoverageTarget), 100),
    demos: Math.min(safePercent(current.total_customer_demos, targets.customerDemosTarget), 100),
  }
  return Math.round(
    scores.field_visits * weights.field_visits + scores.meetings * weights.meetings +
    scores.leads * weights.leads + scores.conversions * weights.conversions +
    scores.conversion_rate * weights.conversion_rate + scores.revenue * weights.revenue +
    scores.deal_size * weights.deal_size + scores.territory * weights.territory +
    scores.demos * weights.demos
  )
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
  return metricCards.reduce((sum, card) => sum + card.achievementPercentage, 0) / metricCards.length
}
