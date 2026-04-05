export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface TeamPerformanceRPC {
  member_name: string
  member_id: string
  total_leads: number
  sanctioned: number
  in_progress: number
  dropped: number
  success_rate: string | number
  conversion_rate: string | number
  estimated_payout: string | number
  actual_payout: string | number
  avg_closure_time: number
  rank: number
}

/**
 * GET /api/partners/bp/team/performance
 * Fetch performance metrics for all Business Associates in the BP's team
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current partner profile
    const { data: allPartnerProfiles, error: allProfilesError } = await supabase
      .from('partners')
      .select('id, partner_type, partner_id')
      .eq('user_id', user.id)

    if (allProfilesError) {
      apiLogger.error('BP performance: failed to query partners table', allProfilesError)
      return NextResponse.json(
        { error: 'Database query failed' },
        { status: 500 }
      )
    }

    if (!allPartnerProfiles || allPartnerProfiles.length === 0) {
      return NextResponse.json(
        { error: 'No partner profile found' },
        { status: 404 }
      )
    }

    // Find Business Partner profile
    const partnerProfile = allPartnerProfiles.find(p => p.partner_type === 'BUSINESS_PARTNER')

    if (!partnerProfile) {
      return NextResponse.json(
        { error: 'Not a Business Partner' },
        { status: 403 }
      )
    }

    // Fetch team performance using the database function
    const { data: performanceData, error: perfError } = await supabase
      .rpc('get_bp_team_performance', { bp_id: partnerProfile.id })

    if (perfError) {
      // Check if it's a function not found error
      if (perfError.code === '42883' || perfError.message?.includes('function') || perfError.message?.includes('does not exist')) {
        apiLogger.error('BP performance: database function not found', perfError)
        return NextResponse.json(
          { error: 'Database function not found' },
          { status: 500 }
        )
      }

      apiLogger.error('BP performance: RPC call failed', perfError)
      return NextResponse.json(
        { error: 'Failed to fetch team performance' },
        { status: 500 }
      )
    }

    // If no data, return empty array
    if (!performanceData) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      })
    }

    // Format the response
    const formattedData = (performanceData || []).map((member: TeamPerformanceRPC) => ({
      memberName: member.member_name,
      memberId: member.member_id,
      totalLeads: member.total_leads || 0,
      sanctioned: member.sanctioned || 0,
      inProgress: member.in_progress || 0,
      dropped: member.dropped || 0,
      successRate: parseFloat(member.success_rate) || 0,
      conversionRate: parseFloat(member.conversion_rate) || 0,
      estimatedPayout: parseFloat(member.estimated_payout) || 0,
      actualPayout: parseFloat(member.actual_payout) || 0,
      avgClosureTime: member.avg_closure_time || 0,
      rank: member.rank || 0
    }))

    return NextResponse.json({
      success: true,
      data: formattedData,
      count: formattedData.length
    })

  } catch (error: unknown) {
    apiLogger.error('Unexpected error in BP team performance', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
