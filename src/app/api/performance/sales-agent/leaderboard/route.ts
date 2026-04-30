import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/sales-agent/leaderboard
 * Returns Sales Agent leaderboard ranked by revenue
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

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const { data: salesAgents, error: employeesError } = await supabase
      .from('users')
      .select('id, full_name, location, avatar_url')
      .eq('sub_role', 'TELE_SALES')
      .eq('is_active', true)

    if (employeesError) {
      apiLogger.error('Error fetching Sales Agents', employeesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
    }

    if (!salesAgents || salesAgents.length === 0) {
      return NextResponse.json({ leaderboard: [], currentUserRank: 0 })
    }

    const { data: monthlySummaries } = await supabase
      .from('sales_agent_monthly_summary')
      .select('*')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .in(
        'user_id',
        salesAgents.map((e) => e.id)
      )

    const leaderboardEntries: LeaderboardEntry[] = []

    for (const employee of salesAgents) {
      const summary = monthlySummaries?.find((s) => s.user_id === employee.id)

      if (summary) {
        leaderboardEntries.push({
          rank: 0,
          userId: employee.id,
          name: employee.full_name,
          avatar: employee.avatar_url,
          location: employee.location,
          primaryMetric: summary.total_revenue || 0,
          secondaryMetric: summary.total_leads_qualified || 0,
          tertiaryMetric: summary.conversion_rate || 0,
          trend: 'stable',
          changePercentage: 0,
          isCurrentUser: employee.id === user.id,
          badge: summary.performance_grade === 'A+' ? '🏆 Top Performer' : undefined,
        })
      } else {
        leaderboardEntries.push({
          rank: 0,
          userId: employee.id,
          name: employee.full_name,
          avatar: employee.avatar_url,
          location: employee.location,
          primaryMetric: 0,
          secondaryMetric: 0,
          tertiaryMetric: 0,
          trend: 'stable',
          changePercentage: 0,
          isCurrentUser: employee.id === user.id,
        })
      }
    }

    leaderboardEntries.sort((a, b) => {
      if (b.primaryMetric !== a.primaryMetric) {
        return b.primaryMetric - a.primaryMetric
      }
      return (b.secondaryMetric || 0) - (a.secondaryMetric || 0)
    })

    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    const currentUserRank = leaderboardEntries.find((e) => e.userId === user.id)?.rank || 0

    return NextResponse.json({
      leaderboard: leaderboardEntries,
      currentUserRank,
      totalEmployees: leaderboardEntries.length,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Sales Agent leaderboard API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
