export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardResponse, CROComparisonData } from '@/lib/types/cro-performance.types'
import { apiLogger } from '@/lib/utils/logger'
import { requireCROAuth } from '@/lib/middleware/cro-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Get current month info
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentYear = now.getFullYear()

    // Get current user's team/manager
    const { data: currentUserProfile } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Get all CROs with their monthly summaries
    const { data: croSummaries } = await supabase
      .from('cro_monthly_summary')
      .select(`
        cro_id,
        performance_score,
        total_calls_made,
        total_leads_converted,
        total_revenue,
        total_cases_disbursed,
        company_rank
      `)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .order('performance_score', { ascending: false })

    // Get employee IDs for all CROs
    const croIds = croSummaries?.map(s => s.cro_id) || []

    const [{ data: profiles }, { data: employees }] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, employee_id')
        .in('user_id', croIds),
      supabase
        .from('employees')
        .select('user_id, manager_id')
        .in('user_id', croIds),
    ])

    // Create lookup maps
    const profileMap = new Map(profiles?.map(p => [p.user_id, p.employee_id]) || [])
    const employeeMap = new Map(employees?.map(e => [e.user_id, e.manager_id]) || [])

    // Build company leaderboard
    const companyLeaderboard: CROComparisonData[] = (croSummaries || []).map((summary, index) => ({
      employee_id: profileMap.get(summary.cro_id) || `CRO-${index + 1}`,
      rank: index + 1,
      performance_score: summary.performance_score || 0,
      calls_made: summary.total_calls_made || 0,
      leads_converted: summary.total_leads_converted || 0,
      revenue_generated: summary.total_revenue || 0,
      cases_disbursed: summary.total_cases_disbursed || 0,
      is_current_user: summary.cro_id === user.id
    }))

    // Build team leaderboard (same manager)
    const teamCroIds = employees
      ?.filter(e => e.manager_id === currentUserProfile?.manager_id)
      .map(e => e.user_id) || []

    const teamLeaderboard: CROComparisonData[] = companyLeaderboard
      .filter(cro => {
        const croId = croSummaries?.find(s =>
          profileMap.get(s.cro_id) === cro.employee_id
        )?.cro_id
        return croId && teamCroIds.includes(croId)
      })
      .map((cro, index) => ({
        ...cro,
        rank: index + 1
      }))

    // Find current user's ranks
    const currentUserCompanyRank = companyLeaderboard.find(c => c.is_current_user)?.rank || 0
    const currentUserTeamRank = teamLeaderboard.find(c => c.is_current_user)?.rank || 0

    const response: LeaderboardResponse = {
      success: true,
      data: {
        company_leaderboard: companyLeaderboard.slice(0, 20), // Top 20
        team_leaderboard: teamLeaderboard,
        current_user_rank: {
          company: currentUserCompanyRank,
          team: currentUserTeamRank,
          total_cros: companyLeaderboard.length,
          team_size: teamLeaderboard.length
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    apiLogger.error('Error fetching leaderboard', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    )
  }
}
