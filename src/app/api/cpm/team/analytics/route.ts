import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CPMTeamAnalyticsResponse, CPMTeamAnalytics } from '@/lib/types/cpm-team-performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cpm/team/analytics
 * Returns aggregated team analytics for a Channel Partner Manager
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
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

    // Call the database function to get team analytics
    const { data, error } = await supabase
      .rpc('get_cpm_team_analytics', { p_cpm_user_id: user.id })

    if (error) {
      apiLogger.error('Error fetching team analytics', error)
      return NextResponse.json(
        { error: 'Failed to fetch team analytics' },
        { status: 500 }
      )
    }

    // The function returns a single row, so we take the first result
    const analytics: CPMTeamAnalytics = data && data.length > 0 ? data[0] : {
      total_cpe_count: 0,
      active_cpe_count: 0,
      total_partners: 0,
      total_ba: 0,
      total_bp: 0,
      total_cp: 0,
      active_partners: 0,
      total_leads: 0,
      leads_in_progress: 0,
      leads_sanctioned: 0,
      leads_disbursed: 0,
      leads_dropped: 0,
      leads_rejected: 0,
      total_loan_volume: 0,
      volume_in_process: 0,
      sanctioned_volume: 0,
      disbursed_volume: 0,
      rejected_volume: 0,
      estimated_commission: 0,
      actual_commission: 0,
      avg_conversion_rate: 0,
      avg_sanction_rate: 0,
      avg_disbursement_rate: 0,
      team_avg_score: 0,
    }

    const response: CPMTeamAnalyticsResponse = {
      success: true,
      data: analytics,
      message: 'Team analytics retrieved successfully',
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    apiLogger.error('Unexpected error in team analytics endpoint', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
