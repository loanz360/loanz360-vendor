import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'


const resendSchema = z.object({
  invitation_id: z.string().uuid('Invalid invitation ID'),
})

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId, profile } = auth

    const body = await request.json()
    const validated = resendSchema.parse(body)

    // Fetch existing invitation — must belong to this DSE
    const { data: invitation, error: fetchError } = await supabase
      .from('partner_recruitment_invites')
      .select('*')
      .eq('id', validated.invitation_id)
      .eq('created_by_cpe', userId)
      .maybeSingle()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // FIX: Prevent resending completed/registered invitations
    if (invitation.status === 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: 'This partner has already registered. No need to resend.',
          code: 'ALREADY_COMPLETED',
        },
        { status: 400 }
      )
    }

    // Check rate limit: max 3 resends per invitation per day
    if (invitation.reminder_count >= 3) {
      const lastReminder = invitation.last_reminder_at ? new Date(invitation.last_reminder_at) : null
      if (lastReminder) {
        const hoursSinceLastReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastReminder < 24) {
          return NextResponse.json(
            {
              success: false,
              error: 'Maximum reminders sent for today. Try again tomorrow.',
              code: 'REMINDER_LIMIT',
            },
            { status: 429 }
          )
        }
      }
    }

    // Update invitation: reset expiry, update status, increment reminder count
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error: updateError } = await supabase
      .from('partner_recruitment_invites')
      .update({
        status: 'SENT',
        expires_at: newExpiry,
        reminder_count: (invitation.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
        reminder_channel: 'WHATSAPP',
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.invitation_id)

    if (updateError) {
      apiLogger.error('DSE resend invitation error', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to resend invitation', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Build WhatsApp message for resend
    const partnerTypeLabel: Record<string, string> = {
      BUSINESS_ASSOCIATE: 'Business Associate',
      BUSINESS_PARTNER: 'Business Partner',
      CHANNEL_PARTNER: 'Channel Partner',
    }
    const typeLabel = partnerTypeLabel[invitation.partner_type_target || invitation.partner_type] || 'Partner'
    const dseName = profile.full_name || 'LOANZ360 Team'
    const greeting = invitation.recipient_name ? `Hi ${invitation.recipient_name},` : 'Hello,'

    // FIX: Regenerate link if both URLs are null
    let link = invitation.full_registration_url || invitation.short_link || ''
    if (!link) {
      const typePathMap: Record<string, string> = {
        BUSINESS_ASSOCIATE: 'ba',
        BUSINESS_PARTNER: 'bp',
        CHANNEL_PARTNER: 'cp',
      }
      const typePath = typePathMap[invitation.partner_type_target || 'BUSINESS_ASSOCIATE'] || 'ba'
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
      link = `${baseUrl}/register/${typePath}?ref=${profile.generated_id || userId}&src=dse`

      // Update the record with the regenerated link
      await supabase
        .from('partner_recruitment_invites')
        .update({ full_registration_url: link })
        .eq('id', validated.invitation_id)
    }

    const whatsappMessage = `${greeting}\n\nThis is a reminder from ${dseName} at LOANZ360.\n\nYour invitation to join as a *${typeLabel}* is still active! Don't miss out on earning commissions.\n\n👉 Register here: ${link}\n\nLink expires in 30 days.`

    const whatsappUrl = `https://wa.me/91${invitation.mobile_number}?text=${encodeURIComponent(whatsappMessage)}`

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        invitation_id: validated.invitation_id,
        registration_link: link,
        whatsapp_url: whatsappUrl,
        new_expiry: newExpiry,
        reminder_count: (invitation.reminder_count || 0) + 1,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('DSE resend invitation error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
