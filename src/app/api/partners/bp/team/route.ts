
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * GET /api/partners/bp/team
 * Fetch all Business Associates recruited by the current Business Partner
 */
export async function GET(_request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(_request, RATE_LIMIT_CONFIGS.DEFAULT)
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
      .select('id, partner_type, partner_id, full_name, is_active')
      .eq('user_id', user.id)

    if (allProfilesError) {
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

    // Fetch team members using the database function
    const { data: teamMembers, error: teamError } = await supabase
      .rpc('get_bp_team_members', { bp_id: partnerProfile.id })

    if (teamError) {
      // Check if it's a function not found error
      if (teamError.code === '42883' || teamError.message?.includes('function') || teamError.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'Database function not found',
            details: 'The get_bp_team_members function does not exist. Please run the migration.',
            code: teamError.code
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // If no data, return empty array
    if (!teamMembers) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      })
    }

    // Calculate derived fields
    interface TeamMemberRPC {
      id: string
      partner_id: string
      full_name: string | null
      email: string | null
      mobile_number: string | null
      city: string | null
      state: string | null
      joining_date: string | null
      status: string | null
      total_leads: number | null
      leads_in_progress: number | null
      leads_sanctioned: number | null
      leads_dropped: number | null
      estimated_payout: number | null
      actual_payout: number | null
      lifetime_earnings: number | null
      last_login_at: string | null
      present_address: string | null
    }

    const enrichedTeamMembers = (teamMembers as TeamMemberRPC[]).map((member) => {
      const totalLeads = member.total_leads || 0
      const sanctioned = member.leads_sanctioned || 0
      const dropped = member.leads_dropped || 0

      const successRate = totalLeads > 0
        ? ((sanctioned / totalLeads) * 100).toFixed(1)
        : '0.0'

      const conversionRate = (sanctioned + dropped) > 0
        ? ((sanctioned / (sanctioned + dropped)) * 100).toFixed(1)
        : '0.0'

      const avgClosureTime = sanctioned > 0 ? 20 : 0

      return {
        id: member.id,
        partnerId: member.partner_id,
        fullName: member.full_name || 'Unknown',
        email: member.email || '',
        phone: member.mobile_number || '',
        city: member.city || '',
        state: member.state || '',
        joiningDate: member.joining_date || null,
        status: member.status || 'PENDING',
        totalLeads,
        leadsInProgress: member.leads_in_progress || 0,
        leadsSanctioned: sanctioned,
        leadsDropped: dropped,
        estimatedPayout: member.estimated_payout || 0,
        actualPayout: member.actual_payout || 0,
        lifetimeEarnings: member.lifetime_earnings || 0,
        successRate: parseFloat(successRate),
        conversionRate: parseFloat(conversionRate),
        avgClosureTime,
        lastLoginAt: member.last_login_at || null,
        address: member.present_address || '',
        registrationDate: member.joining_date || null
      }
    })

    return NextResponse.json({
      success: true,
      data: enrichedTeamMembers,
      count: enrichedTeamMembers.length,
      partnerInfo: {
        partnerId: partnerProfile.partner_id,
        fullName: partnerProfile.full_name
      }
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
