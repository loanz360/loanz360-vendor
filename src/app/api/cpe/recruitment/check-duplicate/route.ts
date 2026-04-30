import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/cpe/recruitment/check-duplicate
 *
 * Check if a mobile number already has an active invite or is already a partner
 *
 * Body:
 *   - mobile: string (required) - Mobile number to check
 *
 * Returns:
 *   - isDuplicate: boolean
 *   - reason: string (if duplicate)
 *   - existingInvite: object (if active invite exists)
 *   - existingPartner: object (if already a partner)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { mobile } = body

    // Validation
    if (!mobile) {
      return NextResponse.json(
        { success: false, error: 'Mobile number is required' },
        { status: 400 }
      )
    }

    // Validate mobile format
    const mobileRegex = /^(\+91)?[6-9]\d{9}$/
    if (!mobileRegex.test(mobile.replace(/\s/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format' },
        { status: 400 }
      )
    }

    // Normalize mobile number
    const normalizedMobile = mobile.replace(/\s/g, '').replace(/^\+91/, '+91')
    const mobileForStorage = normalizedMobile.startsWith('+91') ? normalizedMobile : `+91${normalizedMobile}`

    // Check 1: Is this mobile already a registered partner?
    const { data: existingPartner, error: partnerError } = await supabase
      .from('partners')
      .select('id, full_name, partner_type, status, created_at, recruited_by_cpe')
      .eq('mobile_number', mobileForStorage)
      .maybeSingle()

    if (partnerError && partnerError.code !== 'PGRST116') {
      apiLogger.error('Error checking existing partner', partnerError)
      return NextResponse.json(
        { success: false, error: 'Failed to check for existing partner' },
        { status: 500 }
      )
    }

    if (existingPartner) {
      // Check if recruited by this CPE or another
      const isOwnPartner = existingPartner.recruited_by_cpe === user.id

      return NextResponse.json({
        success: true,
        data: {
          isDuplicate: true,
          reason: isOwnPartner
            ? 'This mobile number is already registered as your partner'
            : 'This mobile number is already registered as a partner by another CPE',
          duplicateType: 'EXISTING_PARTNER',
          isOwnPartner,
          existingPartner: {
            id: existingPartner.id,
            name: existingPartner.full_name,
            partnerType: existingPartner.partner_type,
            status: existingPartner.status,
            registeredAt: existingPartner.created_at,
          },
        },
      })
    }

    // Check 2: Is there an active (non-expired) invite for this mobile?
    const { data: existingInvite, error: inviteError } = await supabase
      .from('partner_recruitment_invites')
      .select('*')
      .eq('mobile_number', mobileForStorage)
      .gte('expires_at', new Date().toISOString())
      .neq('status', 'COMPLETED')
      .neq('status', 'EXPIRED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (inviteError && inviteError.code !== 'PGRST116') {
      apiLogger.error('Error checking existing invite', inviteError)
      return NextResponse.json(
        { success: false, error: 'Failed to check for existing invite' },
        { status: 500 }
      )
    }

    if (existingInvite) {
      // Check if created by this CPE or another
      const isOwnInvite = existingInvite.created_by_cpe === user.id

      return NextResponse.json({
        success: true,
        data: {
          isDuplicate: true,
          reason: isOwnInvite
            ? 'You already have an active invite for this mobile number'
            : 'This mobile number already has an active invite from another CPE',
          duplicateType: 'ACTIVE_INVITE',
          isOwnInvite,
          existingInvite: {
            id: existingInvite.id,
            recipientName: existingInvite.recipient_name,
            partnerType: existingInvite.partner_type,
            status: existingInvite.status,
            shortCode: existingInvite.short_code,
            shortLink: existingInvite.short_link,
            createdAt: existingInvite.created_at,
            expiresAt: existingInvite.expires_at,
            daysUntilExpiry: Math.ceil(
              (new Date(existingInvite.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            ),
          },
        },
      })
    }

    // Check 3: Are there any expired invites? (informational only)
    const { data: expiredInvites, error: expiredError } = await supabase
      .from('partner_recruitment_invites')
      .select('id, created_at, status')
      .eq('mobile_number', mobileForStorage)
      .eq('created_by_cpe', user.id)
      .lt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (expiredError && expiredError.code !== 'PGRST116') {
      apiLogger.error('Error checking expired invites', expiredError)
    }

    // No duplicates found
    return NextResponse.json({
      success: true,
      data: {
        isDuplicate: false,
        message: 'No active invites or existing partners found for this mobile number',
        canProceed: true,
        history: {
          hasExpiredInvites: (expiredInvites?.length || 0) > 0,
          expiredInvitesCount: expiredInvites?.length || 0,
          lastInvitedAt: expiredInvites?.[0]?.created_at || null,
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error in check duplicate API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
