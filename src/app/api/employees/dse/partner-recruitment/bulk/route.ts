import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'
import { generateSecureShortCode } from '@/lib/utils/short-code'


const bulkEntrySchema = z.object({
  mobile_number: z.string().min(10).max(15),
  recipient_name: z.string().max(255).optional().nullable(),
  recipient_email: z.string().email().optional().nullable(),
  partner_type: z.enum(['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']),
})

const bulkSchema = z.object({
  entries: z.array(bulkEntrySchema).min(1, 'At least 1 entry required').max(50, 'Maximum 50 entries per batch'),
})

interface BulkResult {
  mobile_number: string
  recipient_name: string | null
  partner_type: string
  status: 'success' | 'skipped' | 'error'
  message: string
  registration_link?: string
  whatsapp_url?: string
}

/**
 * POST /api/employees/dse/partner-recruitment/bulk
 * Bulk generate recruitment links for up to 50 partners at once.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId, profile } = auth

    const body = await request.json()
    const validated = bulkSchema.parse(body)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const dseName = profile.full_name || 'LOANZ360 Team'
    const dseRef = profile.generated_id || userId

    const typePathMap: Record<string, string> = {
      BUSINESS_ASSOCIATE: 'ba',
      BUSINESS_PARTNER: 'bp',
      CHANNEL_PARTNER: 'cp',
    }
    const partnerTypeLabel: Record<string, string> = {
      BUSINESS_ASSOCIATE: 'Business Associate',
      BUSINESS_PARTNER: 'Business Partner',
      CHANNEL_PARTNER: 'Channel Partner',
    }

    const results: BulkResult[] = []
    let successCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const entry of validated.entries) {
      const cleanedMobile = entry.mobile_number.replace(/[\s\-\(\)+]/g, '')

      if (cleanedMobile.length < 10) {
        results.push({
          mobile_number: entry.mobile_number,
          recipient_name: entry.recipient_name || null,
          partner_type: entry.partner_type,
          status: 'error',
          message: 'Invalid mobile number (must be at least 10 digits)',
        })
        errorCount++
        continue
      }

      // Check if already a registered partner
      const { data: existingPartner } = await supabase
        .from('partners')
        .select('id')
        .eq('mobile_number', cleanedMobile)
        .maybeSingle()

      if (existingPartner) {
        results.push({
          mobile_number: cleanedMobile,
          recipient_name: entry.recipient_name || null,
          partner_type: entry.partner_type,
          status: 'skipped',
          message: 'Already registered as a partner',
        })
        skippedCount++
        continue
      }

      // Check for existing active invitation
      const { data: existingInvite } = await supabase
        .from('partner_recruitment_invites')
        .select('id, created_at')
        .eq('created_by_cpe', userId)
        .eq('mobile_number', cleanedMobile)
        .in('status', ['SENT', 'PENDING', 'CLICKED', 'OPENED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingInvite) {
        const daysSince = (Date.now() - new Date(existingInvite.created_at).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince < 7) {
          results.push({
            mobile_number: cleanedMobile,
            recipient_name: entry.recipient_name || null,
            partner_type: entry.partner_type,
            status: 'skipped',
            message: `Active invitation exists (${Math.ceil(7 - daysSince)} days until resend)`,
          })
          skippedCount++
          continue
        }
      }

      // Generate link and create invitation
      const typePath = typePathMap[entry.partner_type] || 'ba'
      const shortCode = generateSecureShortCode(8)
      const registrationLink = `${baseUrl}/register/${typePath}?ref=${dseRef}&src=dse`

      try {
        await supabase.rpc('create_dse_recruitment_invitation', {
          p_dse_user_id: userId,
          p_mobile_number: cleanedMobile,
          p_partner_type: entry.partner_type,
          p_recipient_name: entry.recipient_name || null,
          p_recipient_email: entry.recipient_email || null,
          p_registration_link: registrationLink,
          p_short_code: shortCode,
        })

        const typeLabel = partnerTypeLabel[entry.partner_type]
        const greeting = entry.recipient_name ? `Hello ${entry.recipient_name}!` : 'Hello!'
        const msg = `${greeting}\n\n${dseName} from LOANZ360 invites you to join as a *${typeLabel}*.\n\n✅ Earn commissions on every loan\n✅ 20+ loan products\n✅ Real-time tracking\n\n👉 Register: ${registrationLink}`
        const whatsappUrl = `https://wa.me/91${cleanedMobile}?text=${encodeURIComponent(msg)}`

        results.push({
          mobile_number: cleanedMobile,
          recipient_name: entry.recipient_name || null,
          partner_type: entry.partner_type,
          status: 'success',
          message: 'Invitation created successfully',
          registration_link: registrationLink,
          whatsapp_url: whatsappUrl,
        })
        successCount++
      } catch (err) {
        apiLogger.error('Bulk recruitment: failed for mobile', { mobile: cleanedMobile, error: err })
        results.push({
          mobile_number: cleanedMobile,
          recipient_name: entry.recipient_name || null,
          partner_type: entry.partner_type,
          status: 'error',
          message: 'Failed to create invitation',
        })
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${validated.entries.length} entries: ${successCount} created, ${skippedCount} skipped, ${errorCount} errors`,
      data: {
        results,
        summary: {
          total: validated.entries.length,
          success: successCount,
          skipped: skippedCount,
          errors: errorCount,
        },
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('Bulk recruitment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
