import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/tele-sales/leaderboard
 * Returns leaderboard data for Tele Sales employees
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

    // Verify user is Tele Sales
    const { data: profile } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const scope = searchParams.get('scope') || 'company' // company, team, region

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Get all Tele Sales employees with their monthly summaries
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('tele_sales_monthly_summary')
      .select(`
        user_id,
        performance_score,
        company_rank,
        total_revenue,
        total_calls,
        leads_converted,
        conversion_rate,
        users!inner (
          id,
          full_name,
          avatar_url,
          location,
          sub_role
        )
      `)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('users.sub_role', 'TELE_SALES')
      .order('company_rank', { ascending: true })
      .limit(limit)

    // If no monthly summary exists, fetch from daily metrics aggregation
    let entries: LeaderboardEntry[] = []

    if (leaderboardData && leaderboardData.length > 0) {
      entries = leaderboardData.map((entry: any, index: number) => ({
        rank: entry.company_rank || index + 1,
        userId: entry.user_id,
        name: entry.users?.full_name || 'Unknown',
        avatar: entry.users?.avatar_url,
        location: entry.users?.location,
        primaryMetric: entry.total_revenue || 0,
        secondaryMetric: entry.total_calls || 0,
        tertiaryMetric: entry.conversion_rate || 0,
        trend: calculateTrendFromScore(entry.performance_score),
        changePercentage: 0,
        isCurrentUser: entry.user_id === user.id,
        badge: getBadge(entry.company_rank),
      }))
    } else {
      // Fallback: Build leaderboard from daily metrics
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

      const { data: allUsers } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, location')
        .eq('sub_role', 'TELE_SALES')

      if (allUsers && allUsers.length > 0) {
        const userPerformance = await Promise.all(
          allUsers.map(async (u) => {
            const { data: metrics } = await supabase
              .from('tele_sales_daily_metrics')
              .select('revenue_generated, total_calls, leads_converted, leads_generated')
              .eq('user_id', u.id)
              .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
              .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

            const totals = (metrics || []).reduce(
              (acc, m) => ({
                revenue: acc.revenue + (m.revenue_generated || 0),
                calls: acc.calls + (m.total_calls || 0),
                leadsConverted: acc.leadsConverted + (m.leads_converted || 0),
                leadsGenerated: acc.leadsGenerated + (m.leads_generated || 0),
              }),
              { revenue: 0, calls: 0, leadsConverted: 0, leadsGenerated: 0 }
            )

            return {
              user: u,
              revenue: totals.revenue,
              calls: totals.calls,
              leadsConverted: totals.leadsConverted,
              conversionRate: totals.leadsGenerated > 0
                ? (totals.leadsConverted / totals.leadsGenerated) * 100
                : 0,
            }
          })
        )

        // Sort by revenue (primary metric)
        const sortedPerformance = userPerformance.sort((a, b) => b.revenue - a.revenue)

        entries = sortedPerformance.slice(0, limit).map((entry, index) => ({
          rank: index + 1,
          userId: entry.user.id,
          name: entry.user.full_name || 'Unknown',
          avatar: entry.user.avatar_url,
          location: entry.user.location,
          primaryMetric: entry.revenue,
          secondaryMetric: entry.calls,
          tertiaryMetric: entry.conversionRate,
          trend: 'stable' as const,
          changePercentage: 0,
          isCurrentUser: entry.user.id === user.id,
          badge: getBadge(index + 1),
        }))
      }
    }

    // Ensure current user is in the list if not in top results
    const currentUserInList = entries.find((e) => e.isCurrentUser)
    if (!currentUserInList) {
      // Get current user's position
      const { data: currentUserSummary } = await supabase
        .from('tele_sales_monthly_summary')
        .select('company_rank, total_revenue, total_calls, conversion_rate')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      const { data: currentUserProfile } = await supabase
        .from('users')
        .select('full_name, avatar_url, location')
        .eq('id', user.id)
        .maybeSingle()

      if (currentUserSummary && currentUserProfile) {
        entries.push({
          rank: currentUserSummary.company_rank,
          userId: user.id,
          name: currentUserProfile.full_name || 'You',
          avatar: currentUserProfile.avatar_url,
          location: currentUserProfile.location,
          primaryMetric: currentUserSummary.total_revenue || 0,
          secondaryMetric: currentUserSummary.total_calls || 0,
          tertiaryMetric: currentUserSummary.conversion_rate || 0,
          trend: 'stable',
          changePercentage: 0,
          isCurrentUser: true,
          badge: undefined,
        })
      }
    }

    return NextResponse.json({
      leaderboard: entries,
      scope,
      month: currentMonth,
      year: currentYear,
      totalParticipants: entries.length,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales leaderboard API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateTrendFromScore(score: number): 'up' | 'down' | 'stable' {
  // This would ideally compare with previous period
  if (score >= 85) return 'up'
  if (score <= 60) return 'down'
  return 'stable'
}

function getBadge(rank: number): string | undefined {
  if (rank === 1) return '🥇 Champion'
  if (rank === 2) return '🥈 Runner-up'
  if (rank === 3) return '🥉 Top 3'
  if (rank <= 5) return '⭐ Top 5'
  if (rank <= 10) return '🌟 Top 10'
  return undefined
}
