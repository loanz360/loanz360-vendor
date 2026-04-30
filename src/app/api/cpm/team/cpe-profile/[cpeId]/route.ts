import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CPEProfileResponse, CPEProfileData } from '@/lib/types/cpm-team-performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/cpm/team/cpe-profile/[cpeId]
 * Returns detailed profile and performance for a specific CPE
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { cpeId: string } }
) {
  try {
    const supabase = await createClient()
    const { cpeId } = params

    if (!cpeId) {
      return NextResponse.json(
        { error: 'CPE ID is required' },
        { status: 400 }
      )
    }

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

    // Verify that the CPE reports to this CPM
    const { data: hierarchyCheck, error: hierarchyError } = await supabase
      .from('employee_hierarchy')
      .select('employee_id, reports_to')
      .eq('employee_id', cpeId)
      .eq('reports_to', user.id)
      .maybeSingle()

    if (hierarchyError || !hierarchyCheck) {
      return NextResponse.json(
        { error: 'CPE not found in your team or does not report to you' },
        { status: 403 }
      )
    }

    // Call the database function to get CPE profile
    const { data, error } = await supabase
      .rpc('get_cpe_profile_for_cpm', {
        p_cpm_user_id: user.id,
        p_cpe_user_id: cpeId
      })

    if (error) {
      apiLogger.error('Error fetching CPE profile', error)
      return NextResponse.json(
        { error: 'Failed to fetch CPE profile' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'CPE profile not found' },
        { status: 404 }
      )
    }

    const cpeProfile: CPEProfileData = data[0]

    const response: CPEProfileResponse = {
      success: true,
      data: cpeProfile,
      message: 'CPE profile retrieved successfully',
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    apiLogger.error('Unexpected error in CPE profile endpoint', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
