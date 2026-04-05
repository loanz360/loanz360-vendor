export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/cpe/recruitment/generate-link
 *
 * Generate a recruitment link for partner onboarding
 *
 * Body:
 *   - mobile: string (required) - Mobile number of prospect
 *   - partnerType: string (required) - BUSINESS_ASSOCIATE | BUSINESS_PARTNER | CHANNEL_PARTNER
 *   - name: string (optional) - Prospect name
 *   - email: string (optional) - Prospect email
 *   - channel: string (optional) - WHATSAPP | SMS | EMAIL (default: WHATSAPP)
 *
 * Returns:
 *   - inviteId: UUID of created invite
 *   - shortLink: Shortened URL
 *   - whatsappUrl: WhatsApp share URL (if channel is WHATSAPP)
 *   - fullUrl: Complete registration URL
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
    const body = await request.json()
    const { mobile, partnerType, name, email, channel = 'WHATSAPP' } = body

    // Validation
    if (!mobile) {
      return NextResponse.json(
        { success: false, error: 'Mobile number is required' },
        { status: 400 }
      )
    }

    // Validate mobile format (Indian: 10 digits or +91 followed by 10 digits)
    const mobileRegex = /^(\+91)?[6-9]\d{9}$/
    if (!mobileRegex.test(mobile.replace(/\s/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format' },
        { status: 400 }
      )
    }

    if (!partnerType || !['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER'].includes(partnerType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid partner type' },
        { status: 400 }
      )
    }

    // Normalize mobile number
    const normalizedMobile = mobile.replace(/\s/g, '').replace(/^\+91/, '+91')
    const mobileForStorage = normalizedMobile.startsWith('+91') ? normalizedMobile : `+91${normalizedMobile}`

    // Check if invite already exists for this mobile (not expired)
    const { data: existingInvite, error: checkError } = await supabase
      .from('partner_recruitment_invites')
      .select('id, status, expires_at')
      .eq('mobile_number', mobileForStorage)
      .eq('created_by_cpe', user.id)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      apiLogger.error('Error checking existing invite', checkError)
    }

    // If active invite exists, return it
    if (existingInvite && existingInvite.status !== 'COMPLETED') {
      const { data: inviteDetails } = await supabase
        .from('partner_recruitment_invites')
        .select('*')
        .eq('id', existingInvite.id)
        .maybeSingle()

      if (inviteDetails) {
        // Generate WhatsApp URL
        const whatsappMessage = encodeURIComponent(
          `Hi! You're invited to join our partner network as a ${partnerType.replace(/_/g, ' ')}. ` +
          `Complete your registration here: ${inviteDetails.short_link}`
        )
        const whatsappUrl = `https://wa.me/${mobileForStorage.replace('+', '')}?text=${whatsappMessage}`

        return NextResponse.json({
          success: true,
          data: {
            inviteId: inviteDetails.id,
            shortCode: inviteDetails.short_code,
            shortLink: inviteDetails.short_link,
            fullUrl: inviteDetails.full_registration_url,
            whatsappUrl,
            status: inviteDetails.status,
            isExisting: true,
          },
          message: 'Active invite already exists for this mobile number',
        })
      }
    }

    // Generate short code
    const { data: shortCodeData, error: shortCodeError } = await supabase.rpc('generate_short_code')

    if (shortCodeError) {
      apiLogger.error('Error generating short code', shortCodeError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate short code' },
        { status: 500 }
      )
    }

    const shortCode = shortCodeData as string

    // Generate trace token (encrypted for security and traceability)
    const traceToken = crypto.randomBytes(32).toString('hex')

    // Construct URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const shortLink = `${baseUrl}/r/${shortCode}`
    const fullRegistrationUrl = `${baseUrl}/partner/register?t=${traceToken}&type=${partnerType.toLowerCase()}`

    // Calculate expiry (30 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Create recruitment invite
    const { data: newInvite, error: createError } = await supabase
      .from('partner_recruitment_invites')
      .insert({
        created_by_cpe: user.id,
        mobile_number: mobileForStorage,
        email: email || null,
        recipient_name: name || null,
        partner_type: partnerType,
        channel,
        short_code: shortCode,
        short_link: shortLink,
        full_registration_url: fullRegistrationUrl,
        trace_token: traceToken,
        status: 'SENT',
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating recruitment invite', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create recruitment invite' },
        { status: 500 }
      )
    }

    // Generate WhatsApp share URL
    const partnerTypeDisplay = partnerType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')

    const whatsappMessage = encodeURIComponent(
      `Hi${name ? ` ${name}` : ''}! 👋\n\n` +
      `You're invited to join Loanz360's partner network as a *${partnerTypeDisplay}*.\n\n` +
      `🚀 Benefits:\n` +
      `✓ Earn attractive commissions\n` +
      `✓ Access to multiple loan products\n` +
      `✓ Dedicated support team\n` +
      `✓ Real-time tracking dashboard\n\n` +
      `📝 Complete your registration here:\n${shortLink}\n\n` +
      `Link expires in 30 days.`
    )
    const whatsappUrl = `https://wa.me/${mobileForStorage.replace('+', '')}?text=${whatsappMessage}`

    // Format response
    const response = {
      success: true,
      data: {
        inviteId: newInvite.id,
        shortCode: newInvite.short_code,
        shortLink: newInvite.short_link,
        fullUrl: newInvite.full_registration_url,
        whatsappUrl,
        expiresAt: newInvite.expires_at,
        mobile: mobileForStorage,
        partnerType,
        channel,
      },
      message: 'Recruitment link generated successfully',
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in generate recruitment link API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
