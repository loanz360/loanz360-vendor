import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CPEListResponse, CPETeamMember } from '@/lib/types/cpm-team-performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/cpm/team/cpe-list
 * Returns list of CPEs reporting to a CPM with their performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
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

    // Call the database function to get CPE list
    const { data, error } = await supabase
      .rpc('get_cpm_cpe_list', { p_cpm_user_id: user.id })

    if (error) {
      apiLogger.error('Error fetching CPE list', error)
      return NextResponse.json(
        { error: 'Failed to fetch CPE list' },
        { status: 500 }
      )
    }

    const cpeList: CPETeamMember[] = data || []

    const response: CPEListResponse = {
      success: true,
      data: cpeList,
      message: `Retrieved ${cpeList.length} CPE team members`,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    apiLogger.error('Unexpected error in CPE list endpoint', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
