import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { generateSecureShortCode, buildShortUrl } from '@/lib/utils/short-code'


const generateLinkSchema = z.object({
  customer_name: z.string().max(255).optional().nullable(),
  customer_mobile: z.string().min(10).max(15).optional().nullable(),
  loan_type: z.string().max(100).optional().nullable(),
  loan_amount: z.number().positive().optional().nullable(),
})

/**
 * POST /api/employees/dse/customer-link/generate
 * DSE generates a self-apply link for a customer
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, sub_role, full_name, generated_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const validated = generateLinkSchema.parse(body)

    const shortCode = generateSecureShortCode(8)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const shortLink = `${baseUrl}/apply/${shortCode}?src=dse&ref=${profile.generated_id || user.id}`
    const traceToken = `DSE_${user.id}_${Date.now()}_${shortCode}`

    const cleanedMobile = validated.customer_mobile
      ? validated.customer_mobile.replace(/[\s\-\(\)]/g, '')
      : null

    // Store in dse_customer_links
    const { data: link, error: linkError } = await supabase
      .from('dse_customer_links')
      .insert({
        dse_user_id: user.id,
        customer_name: validated.customer_name || null,
        customer_mobile: cleanedMobile,
        loan_type: validated.loan_type || null,
        loan_amount: validated.loan_amount || null,
        short_code: shortCode,
        short_link: shortLink,
        trace_token: traceToken,
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, short_code, short_link, created_at, expires_at')
      .maybeSingle()

    if (linkError) {
      apiLogger.error('DSE customer-link generate error', linkError)
      return NextResponse.json({ success: false, error: 'Failed to generate link' }, { status: 500 })
    }

    // Build WhatsApp message
    const dseName = profile.full_name || 'LOANZ360 Team'
    const customerGreeting = validated.customer_name ? `Hello ${validated.customer_name},` : 'Hello,'
    const loanInfo = validated.loan_type ? `\n\nLoan Type: ${validated.loan_type}` : ''
    const amountInfo = validated.loan_amount ? `\nAmount: ₹${validated.loan_amount.toLocaleString('en-IN')}` : ''

    const whatsappMessage = `${customerGreeting}\n\n${dseName} from LOANZ360 has shared a loan application link with you.${loanInfo}${amountInfo}\n\nApply here in just 2 minutes:\n👉 ${shortLink}\n\n✅ 20+ loan products available\n✅ Quick pre-approval\n✅ 100% secure & confidential\n\nFor any queries, contact ${dseName}.`

    const whatsappUrl = cleanedMobile
      ? `https://wa.me/91${cleanedMobile}?text=${encodeURIComponent(whatsappMessage)}`
      : null

    return NextResponse.json({
      success: true,
      message: 'Customer link generated successfully',
      data: {
        link_id: link?.id,
        short_code: shortCode,
        short_link: shortLink,
        whatsapp_url: whatsappUrl,
        whatsapp_message: whatsappMessage,
        expires_at: link?.expires_at,
        created_at: link?.created_at,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('DSE customer-link generate error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
