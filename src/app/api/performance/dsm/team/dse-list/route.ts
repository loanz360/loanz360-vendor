import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DSETeamMember } from '@/lib/types/dsm-team-performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dsm/team/dse-list
 * Returns list of all DSEs in the DSM's team with their performance metrics
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
      .select('id, full_name, email, mobile, avatar_url, location')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('manager_id', user.id)
      .eq('is_active', true)
      .order('full_name')

    if (dseError) {
      apiLogger.error('Error fetching DSE users', dseError)
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    if (!dseUsers || dseUsers.length === 0) {
      // No DSEs in team, return empty list
      return NextResponse.json({
        success: true,
        data: {
          dseList: [],
          teamSummary: {
            total_count: 0,
            active_count: 0,
            on_leave_count: 0,
            avg_performance_score: 0,
            total_revenue: 0,
          },
        },
      })
    }

    // Fetch performance data for each DSE
    const dseTeamMembers: DSETeamMember[] = await Promise.all(
      dseUsers.map(async (dse) => {
        // Fetch DSE's daily metrics for current month
        const { data: dailyMetrics } = await supabase
          .from('dse_daily_metrics')
          .select('*')
          .eq('user_id', dse.id)
          .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
          .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

        // Aggregate metrics
        const aggregated = aggregateDSEMetrics(dailyMetrics || [])

        // Fetch monthly summary for performance score and grade
        const { data: monthlySummary } = await supabase
          .from('dse_monthly_summary')
          .select('overall_score, grade, rank')
          .eq('user_id', dse.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .maybeSingle()

        // Calculate days since last activity
        const lastMetric = dailyMetrics && dailyMetrics.length > 0
          ? dailyMetrics[dailyMetrics.length - 1]
          : null

        const lastFieldVisit = lastMetric?.metric_date || null
        const daysSinceLastConversion = lastMetric
          ? calculateDaysSince(lastMetric.metric_date)
          : 999

        // Check last one-on-one date (from coaching_sessions table if exists)
        let lastOneOnOne = null
        try {
          const { data: lastCoaching, error: coachingError } = await supabase
            .from('coaching_sessions')
            .select('session_date')
            .eq('dse_user_id', dse.id)
            .eq('dsm_user_id', user.id)
            .order('session_date', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Only set if table exists and query succeeded
          if (!coachingError || coachingError.code !== 'PGRST116') {
            lastOneOnOne = lastCoaching?.session_date || null
          }
        } catch (error) {
          // Table might not exist yet, that's okay
        }

        return {
          dse_user_id: dse.id,
          dse_name: dse.full_name,
          dse_email: dse.email,
          dse_mobile: dse.mobile || '',
          dse_avatar: dse.avatar_url || undefined,
          dse_territory: dse.location || 'Not Assigned',

          // Field Activity
          field_visits: aggregated.field_visits,
          meetings_scheduled: aggregated.meetings_scheduled,
          meetings_attended: aggregated.meetings_attended,
          travel_distance_km: aggregated.travel_distance_km,

          // Lead & Revenue
          leads_generated: aggregated.leads_generated,
          leads_converted: aggregated.leads_converted,
          revenue_generated: aggregated.revenue_generated,
          conversion_rate: aggregated.conversion_rate,
          average_deal_size: aggregated.average_deal_size,

          // Territory
          territory_coverage: aggregated.territory_coverage,
          new_prospects_added: aggregated.new_prospects_added,

          // Performance
          performance_score: monthlySummary?.overall_score || 0,
          performance_grade: monthlySummary?.grade || null,
          team_rank: monthlySummary?.rank || null,

          // Engagement
          last_field_visit: lastFieldVisit,
          days_since_last_conversion: daysSinceLastConversion,
          last_one_on_one: lastOneOnOne,
        }
      })
    )

    // Calculate team summary
    const teamSummary = {
      total_count: dseTeamMembers.length,
      active_count: dseTeamMembers.filter(
        (dse) => dse.field_visits > 0 || dse.leads_generated > 0
      ).length,
      on_leave_count: dseTeamMembers.filter(
        (dse) => dse.field_visits === 0 && dse.leads_generated === 0
      ).length,
      avg_performance_score:
        dseTeamMembers.reduce((sum, dse) => sum + dse.performance_score, 0) /
        dseTeamMembers.length,
      total_revenue: dseTeamMembers.reduce(
        (sum, dse) => sum + dse.revenue_generated,
        0
      ),
    }

    // Sort by performance score descending
    dseTeamMembers.sort((a, b) => b.performance_score - a.performance_score)

    return NextResponse.json({
      success: true,
      data: {
        dseList: dseTeamMembers,
        teamSummary,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE team list', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch team list',
        },
      { status: 500 }
    )
  }
}

/**
 * Aggregate DSE daily metrics for the month
 */
function aggregateDSEMetrics(dailyMetrics: any[]) {
  if (!dailyMetrics || dailyMetrics.length === 0) {
    return {
      field_visits: 0,
      meetings_scheduled: 0,
      meetings_attended: 0,
      travel_distance_km: 0,
      leads_generated: 0,
      leads_converted: 0,
      revenue_generated: 0,
      conversion_rate: 0,
      average_deal_size: 0,
      territory_coverage: 0,
      new_prospects_added: 0,
    }
  }

  const totals = dailyMetrics.reduce(
    (acc, day) => {
      acc.field_visits += day.field_visits_completed || 0
      acc.meetings_scheduled += day.meetings_scheduled || 0
      acc.meetings_attended += day.meetings_attended || 0
      acc.travel_distance_km += day.travel_distance_km || 0
      acc.leads_generated += day.leads_generated || 0
      acc.leads_converted += day.leads_converted || 0
      acc.revenue_generated += day.revenue_generated || 0
      acc.new_prospects_added += day.new_prospects_added || 0
      return acc
    },
    {
      field_visits: 0,
      meetings_scheduled: 0,
      meetings_attended: 0,
      travel_distance_km: 0,
      leads_generated: 0,
      leads_converted: 0,
      revenue_generated: 0,
      new_prospects_added: 0,
    }
  )

  // Get latest territory coverage
  const latest = dailyMetrics[dailyMetrics.length - 1]

  return {
    ...totals,
    conversion_rate:
      totals.leads_generated > 0
        ? (totals.leads_converted / totals.leads_generated) * 100
        : 0,
    average_deal_size:
      totals.leads_converted > 0
        ? totals.revenue_generated / totals.leads_converted
        : 0,
    territory_coverage: latest?.territory_coverage || 0,
  }
}

/**
 * Calculate days since a given date
 */
function calculateDaysSince(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}
