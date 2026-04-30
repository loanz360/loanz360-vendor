import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'
import { generateSecureShortCode } from '@/lib/utils/short-code'


const recruitmentSchema = z.object({
  partner_type: z.enum(['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']),
  mobile_number: z.string()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(15, 'Mobile number too long')
    .regex(/^\+?\d{10,15}$/, 'Invalid mobile number format'),
  recipient_name: z.string().max(255).optional().nullable(),
  recipient_email: z.string().email('Invalid email format').optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId, profile } = auth

    const body = await request.json()
    const validated = recruitmentSchema.parse(body)

    const cleanedMobile = validated.mobile_number.replace(/[\s\-\(\)+]/g, '')

    if (cleanedMobile.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Mobile number must be at least 10 digits', code: 'INVALID_MOBILE' },
        { status: 400 }
      )
    }

    // Check for existing pending invitation from this DSE (prevent spam)
    const { data: existing } = await supabase
      .from('partner_recruitment_invites')
      .select('id, status, created_at')
      .eq('created_by_cpe', userId)
      .eq('mobile_number', cleanedMobile)
      .in('status', ['SENT', 'PENDING', 'CLICKED', 'OPENED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const daysSinceInvite = (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceInvite < 7) {
        return NextResponse.json(
          {
            success: false,
            error: 'An active invitation already exists for this number. You can resend after 7 days.',
            code: 'DUPLICATE_INVITE',
            data: { existing_invite_id: existing.id, days_remaining: Math.ceil(7 - daysSinceInvite) },
          },
          { status: 409 }
        )
      }
    }

    // Check if this number is already a registered partner
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('id, partner_id, full_name, partner_type')
      .eq('mobile_number', cleanedMobile)
      .maybeSingle()

    if (existingPartner) {
      return NextResponse.json(
        {
          success: false,
          error: `This mobile number is already registered as a ${(existingPartner.partner_type || '').replace(/_/g, ' ')} (${existingPartner.full_name || existingPartner.partner_id}).`,
          code: 'ALREADY_REGISTERED',
        },
        { status: 409 }
      )
    }

    // Build registration path based on partner type
    const typePathMap: Record<string, string> = {
      BUSINESS_ASSOCIATE: 'ba',
      BUSINESS_PARTNER: 'bp',
      CHANNEL_PARTNER: 'cp',
    }
    const typePath = typePathMap[validated.partner_type] || 'ba'
    const shortCode = generateSecureShortCode(8)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const registrationLink = `${baseUrl}/register/${typePath}?ref=${profile.generated_id || userId}&src=dse`

    // Create invitation record via RPC
    const { data: inviteId, error: inviteError } = await supabase.rpc(
      'create_dse_recruitment_invitation',
      {
        p_dse_user_id: userId,
        p_mobile_number: cleanedMobile,
        p_partner_type: validated.partner_type,
        p_recipient_name: validated.recipient_name || null,
        p_recipient_email: validated.recipient_email || null,
        p_registration_link: registrationLink,
        p_short_code: shortCode,
      }
    )

    if (inviteError) {
      apiLogger.error('DSE partner recruitment: failed to create invitation', inviteError)
      return NextResponse.json(
        { success: false, error: 'Failed to create invitation. Please try again.', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Build WhatsApp message
    const partnerTypeLabel: Record<string, string> = {
      BUSINESS_ASSOCIATE: 'Business Associate',
      BUSINESS_PARTNER: 'Business Partner',
      CHANNEL_PARTNER: 'Channel Partner',
    }
    const typeLabel = partnerTypeLabel[validated.partner_type]
    const dseName = profile.full_name || 'LOANZ360 Team'
    const recipientGreeting = validated.recipient_name ? `Hello ${validated.recipient_name}!` : 'Hello!'

    const whatsappMessage = `${recipientGreeting}\n\n${dseName} from LOANZ360 invites you to join as a *${typeLabel}*.\n\nAs a ${typeLabel}, you can:\n✅ Earn attractive commissions on every loan case\n✅ Access 20+ loan products\n✅ Track your leads & payouts in real-time\n✅ Get dedicated support\n\n👉 Register here: ${registrationLink}\n\nFor queries, contact ${dseName}.`

    const whatsappUrl = `https://wa.me/91${cleanedMobile}?text=${encodeURIComponent(whatsappMessage)}`

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    return NextResponse.json({
      success: true,
      message: 'Partner recruitment link generated successfully',
      data: {
        invitation_id: inviteId,
        mobile_number: cleanedMobile,
        partner_type: validated.partner_type,
        registration_link: registrationLink,
        short_code: shortCode,
        whatsapp_url: whatsappUrl,
        whatsapp_message: whatsappMessage,
        expires_at: expiresAt,
        sent_at: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('DSE partner recruitment error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
