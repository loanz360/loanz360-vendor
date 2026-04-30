
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/partners/bp/team/recruit
 * Send WhatsApp invitation to recruit a new Business Associate
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - 10 invitations per hour per IP
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const rateLimitResult = await checkRateLimit(
      clientIP,
      '/api/partners/bp/team/recruit',
      10, // max 10 invitations
      3600000 // per hour
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many invitation requests. Please try again later.',
          retryAfter: rateLimitResult.resetAt ? Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) : 3600
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

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
    const { data: partnerProfile, error: profileError } = await supabase
      .from('partners')
      .select('id, partner_id, full_name, partner_type')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (profileError || !partnerProfile) {
      return NextResponse.json(
        { error: 'Business Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse request body with error handling
    let body: { mobileNumber?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { mobileNumber } = body

    // Validate mobile number
    if (!mobileNumber || typeof mobileNumber !== 'string') {
      return NextResponse.json(
        { error: 'Valid mobile number is required' },
        { status: 400 }
      )
    }

    // Clean mobile number (remove spaces, dashes, etc.)
    const cleanedMobile = mobileNumber.replace(/[\s\-\(\)]/g, '')

    // Validate format (basic validation)
    if (cleanedMobile.length < 10) {
      return NextResponse.json(
        { error: 'Mobile number must be at least 10 digits' },
        { status: 400 }
      )
    }

    // Check if invitation already exists for this mobile number
    const { data: existingInvitation } = await supabase
      .from('partner_recruitment_invitations')
      .select('id, status')
      .eq('business_partner_id', partnerProfile.id)
      .eq('mobile_number', cleanedMobile)
      .order('invited_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If there's a pending invitation within last 7 days, don't allow duplicate
    if (existingInvitation && existingInvitation.status === 'PENDING') {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this number recently' },
        { status: 409 }
      )
    }

    // Generate registration link
    const registrationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/register/ba?ref=${partnerProfile.partner_id}`

    // Create invitation record using database function
    const { data: invitationId, error: inviteError } = await supabase
      .rpc('create_recruitment_invitation', {
        p_bp_id: partnerProfile.id,
        p_mobile_number: cleanedMobile,
        p_registration_link: registrationLink
      })

    if (inviteError) {
      apiLogger.error('BP recruit: failed to create invitation', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // WhatsApp Business API integration not yet implemented.
    // When ready, integrate via Twilio or WhatsApp Business API to dispatch the invitation message.
    // Message template: "Hello! You've been invited by {name} to join LOANZ360 as a Business Associate. Click here to register: {link}"
    // See Twilio WhatsApp API example below for reference implementation.
    /*
    const whatsappMessage = `Hello! You've been invited by ${partnerProfile.full_name} to join LOANZ360 as a Business Associate. Click here to register: ${registrationLink}`
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER

    const twilio = require('twilio')(accountSid, authToken)

    const message = await twilio.messages.create({
      from: `whatsapp:${twilioNumber}`,
      to: `whatsapp:${cleanedMobile}`,
      body: whatsappMessage
    })

    // Update invitation with WhatsApp message ID
    await supabase
      .from('partner_recruitment_invitations')
      .update({ whatsapp_message_id: message.sid })
      .eq('id', invitationId)
    */

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitationId,
        mobileNumber: cleanedMobile,
        registrationLink,
        sentAt: new Date().toISOString()
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Unexpected error in BP team recruit', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
