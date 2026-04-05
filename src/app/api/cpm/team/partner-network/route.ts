import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PartnerNetworkResponse, PartnerInNetwork } from '@/lib/types/cpm-team-performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cpm/team/partner-network
 * Returns all partners in CPM's network grouped by CPE
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

    // Get optional query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    const cpeFilter = searchParams.get('cpe_id')
    const partnerTypeFilter = searchParams.get('partner_type')

    // Call the database function to get partner network
    const { data, error } = await supabase
      .rpc('get_cpm_partner_network', { p_cpm_user_id: user.id })

    if (error) {
      apiLogger.error('Error fetching partner network', error)
      return NextResponse.json(
        { error: 'Failed to fetch partner network' },
        { status: 500 }
      )
    }

    let partnerNetwork: PartnerInNetwork[] = data || []

    // Apply filters if provided
    if (cpeFilter) {
      partnerNetwork = partnerNetwork.filter(p => p.cpe_user_id === cpeFilter)
    }

    if (partnerTypeFilter && partnerTypeFilter !== 'all') {
      partnerNetwork = partnerNetwork.filter(p =>
        p.partner_type === partnerTypeFilter ||
        p.partner_type === `BUSINESS_${partnerTypeFilter === 'BA' ? 'ASSOCIATE' : partnerTypeFilter === 'BP' ? 'PARTNER' : 'CHANNEL'}`
      )
    }

    const response: PartnerNetworkResponse = {
      success: true,
      data: partnerNetwork,
      message: `Retrieved ${partnerNetwork.length} partners in network`,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    apiLogger.error('Unexpected error in partner network endpoint', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
