import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/digital-sales/leaderboard
 * Returns Digital Sales leaderboard ranked by revenue
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

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Get all Digital Sales employees
    const { data: digitalSalesEmployees, error: employeesError } = await supabase
      .from('users')
      .select('id, full_name, location, avatar_url')
      .eq('sub_role', 'DIGITAL_SALES')
      .eq('is_active', true)

    if (employeesError) {
      apiLogger.error('Error fetching Digital Sales employees', employeesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
    }

    if (!digitalSalesEmployees || digitalSalesEmployees.length === 0) {
      return NextResponse.json({ leaderboard: [], currentUserRank: 0 })
    }

    // Fetch monthly summaries for all Digital Sales
    const { data: monthlySummaries } = await supabase
      .from('digital_sales_monthly_summary')
      .select('*')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .in(
        'user_id',
        digitalSalesEmployees.map((e) => e.id)
      )

    // Create leaderboard entries
    const leaderboardEntries: LeaderboardEntry[] = []

    for (const employee of digitalSalesEmployees) {
      const summary = monthlySummaries?.find((s) => s.user_id === employee.id)

      if (summary) {
        leaderboardEntries.push({
          rank: 0, // Will be assigned after sorting
          userId: employee.id,
          name: employee.full_name,
          avatar: employee.avatar_url,
          location: employee.location,
          primaryMetric: summary.total_revenue || 0,
          secondaryMetric: summary.total_conversions || 0,
          tertiaryMetric: summary.digital_conversion_rate || 0,
          trend: 'stable',
          changePercentage: 0,
          isCurrentUser: employee.id === user.id,
          badge: summary.performance_grade === 'A+' ? '🏆 Top Performer' : undefined,
        })
      } else {
        // Employee has no data for current month
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

    // Sort by primary metric (revenue) descending, then by conversions
    leaderboardEntries.sort((a, b) => {
      if (b.primaryMetric !== a.primaryMetric) {
        return b.primaryMetric - a.primaryMetric
      }
      return (b.secondaryMetric || 0) - (a.secondaryMetric || 0)
    })

    // Assign ranks
    leaderboardEntries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    // Find current user rank
    const currentUserRank = leaderboardEntries.find((e) => e.userId === user.id)?.rank || 0

    return NextResponse.json({
      leaderboard: leaderboardEntries,
      currentUserRank,
      totalEmployees: leaderboardEntries.length,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Digital Sales leaderboard API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
