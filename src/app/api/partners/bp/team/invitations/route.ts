
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface InvitationRow {
  id: string
  mobile_number: string
  registration_link: string
  status: string
  registered_name: string | null
  registered_email: string | null
  registered_partner_id: string | null
  invited_at: string
  registered_at: string | null
  expires_at: string
  whatsapp_message_id: string | null
  ip_address: string | null
  user_agent: string | null
}

/**
 * GET /api/partners/bp/team/invitations
 * Fetch all recruitment invitations sent by the current Business Partner
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
      .select('id, partner_type')
      .eq('user_id', user.id)

    if (allProfilesError) {
      apiLogger.error('BP invitations: failed to query partners table', allProfilesError)
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

    // Fetch all invitations sent by this BP
    const { data: invitations, error: invitationsError } = await supabase
      .from('partner_recruitment_invitations')
      .select('*')
      .eq('business_partner_id', partnerProfile.id)
      .order('invited_at', { ascending: false })

    if (invitationsError) {
      // Check if table doesn't exist
      if (invitationsError.code === '42P01' || invitationsError.message?.includes('does not exist')) {
        apiLogger.error('BP invitations: table not found', invitationsError)
        return NextResponse.json(
          { error: 'Table not found' },
          { status: 500 }
        )
      }

      apiLogger.error('BP invitations: failed to fetch', invitationsError)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    // If no invitations, return empty array
    if (!invitations) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      })
    }

    // Format the response
    const formattedInvitations = (invitations as InvitationRow[]).map((inv) => ({
      id: inv.id,
      mobileNumber: inv.mobile_number,
      registrationLink: inv.registration_link,
      status: inv.status,
      registeredName: inv.registered_name || null,
      registeredEmail: inv.registered_email || null,
      registeredPartnerId: inv.registered_partner_id || null,
      invitedAt: inv.invited_at,
      registeredAt: inv.registered_at || null,
      expiresAt: inv.expires_at,
      whatsappMessageId: inv.whatsapp_message_id || null,
      ipAddress: inv.ip_address || null,
      userAgent: inv.user_agent || null
    }))

    return NextResponse.json({
      success: true,
      data: formattedInvitations,
      count: formattedInvitations.length
    })

  } catch (error: unknown) {
    apiLogger.error('Unexpected error in BP team invitations', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
