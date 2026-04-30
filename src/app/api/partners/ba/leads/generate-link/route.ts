/**
 * API Route: Generate Traceable Lead Link
 * POST /api/partners/ba/leads/generate-link
 *
 * Generates a unique, traceable short link for a BA to share with potential customers
 *
 * Rate Limit: 30 requests per minute (write operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { generateTraceToken } from '@/lib/utils/trace-token'
import { generateUniqueShortCode, buildShortUrl } from '@/lib/utils/short-code'
import type { GenerateLinkRequest, GenerateLinkResponse } from '@/types/partner-leads'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as GenerateLinkResponse,
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body: GenerateLinkRequest = await request.json()
    const { customer_mobile, customer_name, loan_type, required_loan_amount, remarks } = body

    // 3. Validate required fields (Option C: Mobile + Loan Type mandatory)
    if (!customer_mobile || !/^\+?[0-9]{10,15}$/.test(customer_mobile)) {
      return NextResponse.json(
        { success: false, error: 'Customer mobile number is required and must be valid' } as GenerateLinkResponse,
        { status: 400 }
      )
    }

    if (!loan_type || loan_type.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Loan type is required to generate link' } as GenerateLinkResponse,
        { status: 400 }
      )
    }

    // customer_name is optional - can be collected in form

    // 4. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name, user_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as GenerateLinkResponse,
        { status: 404 }
      )
    }

    // 5. Generate trace token
    const traceToken = generateTraceToken({
      role: 'BUSINESS_ASSOCIATE',
      userId: user.id,
      partnerId: partner.id,
      partnerCode: partner.partner_id || 'BA-UNKNOWN',
    })

    // 6. Generate unique short code
    const checkShortCodeExists = async (code: string): Promise<boolean> => {
      const { data } = await supabase
        .from('short_links')
        .select('id')
        .eq('short_code', code)
        .maybeSingle()
      return !!data
    }

    const shortCode = await generateUniqueShortCode(checkShortCodeExists, 8)
    const shortLink = buildShortUrl(shortCode)

    // 7. Generate lead_id using database function
    const { data: leadIdResult, error: leadIdError } = await supabase.rpc('generate_lead_id')

    if (leadIdError || !leadIdResult) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate lead ID' } as GenerateLinkResponse,
        { status: 500 }
      )
    }

    const leadId = leadIdResult as string

    // 8. Normalize mobile number (add +91 if not present)
    let normalizedMobile = customer_mobile.trim()
    if (!normalizedMobile.startsWith('+')) {
      normalizedMobile = '+91' + normalizedMobile.replace(/^0+/, '')
    }

    // 8.5. Check for blocking duplicates (Partner Flow: Block if same customer + same loan type)
    const { data: blockCheck, error: blockCheckError } = await supabase.rpc('check_partner_duplicate_blocking', {
      p_customer_mobile: normalizedMobile,
      p_customer_name: customer_name || '',
      p_loan_type: loan_type
    })

    // If duplicate check failed, log but don't block (fail-open for this check)
    if (blockCheckError) {
      apiLogger.error('Duplicate check error', blockCheckError)
    }

    // If lead is blocked due to duplicate
    if (blockCheck && blockCheck[0]?.is_blocked) {
      const blockInfo = blockCheck[0]
      return NextResponse.json({
        success: false,
        error: 'Duplicate lead detected',
        code: 'DUPLICATE_BLOCKED',
        message: `Cannot generate link - ${blockInfo.block_reason}`,
        existing_lead: {
          lead_id: blockInfo.existing_lead_id,
          system: blockInfo.existing_system,
          loan_type: blockInfo.existing_loan_type
        },
        suggestion: 'You can generate a link for a different loan type or a different customer.'
      } as GenerateLinkResponse, { status: 409 })
    }

    // 9. Create lead record (if not blocked)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        partner_id: partner.id,
        partner_type: 'BUSINESS_ASSOCIATE',
        lead_id: leadId,
        customer_name: customer_name || null,
        customer_mobile: normalizedMobile,
        loan_type: loan_type || null,
        required_loan_amount: required_loan_amount || null,
        short_link: shortLink,
        short_code: shortCode,
        trace_token: traceToken,
        form_status: 'PENDING',
        lead_status: 'NEW',
        remarks: remarks || null,
      })
      .select()
      .maybeSingle()

    if (leadError || !lead) {
      apiLogger.error('Lead creation error', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create lead' } as GenerateLinkResponse,
        { status: 500 }
      )
    }

    // 10. Create short link record
    const { error: shortLinkError } = await supabase.from('short_links').insert({
      short_code: shortCode,
      original_url: `/apply/${shortCode}?ref=${traceToken}`,
      created_by_user_id: user.id,
      created_for_entity_type: 'LEAD',
      created_for_entity_id: lead.id,
      lead_id: lead.id,
      is_active: true,
      expires_at: null, // No expiration
    })

    if (shortLinkError) {
      apiLogger.error('Short link creation error', shortLinkError)
      // Continue anyway, as lead is created
    }

    // 11. Create referral tracking record
    const { error: trackingError } = await supabase.from('lead_referral_tracking').insert({
      lead_id: lead.id,
      shared_by_user_id: user.id,
      shared_by_role: 'BUSINESS_ASSOCIATE',
      shared_by_partner_id: partner.id,
      shared_by_partner_code: partner.partner_id,
      parent_bp_id: null, // BA doesn't have a parent
      parent_bp_code: null,
      shared_to_mobile: normalizedMobile,
      shared_to_name: customer_name || null,
      short_link: shortLink,
      short_code: shortCode,
      trace_token: traceToken,
    })

    if (trackingError) {
      apiLogger.error('Tracking creation error', trackingError)
      // Continue anyway
    }

    // 12. Generate WhatsApp message
    const partnerName = partner.full_name || 'LOANZ360 Team'
    const loanAmount = required_loan_amount
      ? `₹${required_loan_amount.toLocaleString('en-IN')}`
      : 'your loan'

    const whatsappMessage = `Hello${customer_name ? ' ' + customer_name : ''}! 👋

I'm ${partnerName} from LOANZ360. I can help you with ${loan_type || 'your loan requirement'} ${required_loan_amount ? `of ${loanAmount}` : ''}.

Please fill out this quick form to get started:
${shortLink}

Feel free to reach out if you have any questions!

Best regards,
${partnerName}
LOANZ360`

    // Encode message for WhatsApp URL
    const encodedMessage = encodeURIComponent(whatsappMessage)
    const whatsappUrl = `https://wa.me/${normalizedMobile.replace(/\+/g, '')}?text=${encodedMessage}`

    // 13. Return response
    return NextResponse.json({
      success: true,
      data: {
        lead_id: leadId,
        short_link: shortLink,
        short_code: shortCode,
        whatsapp_url: whatsappUrl,
        lead: lead as unknown,
      },
    } as GenerateLinkResponse)
  } catch (error) {
    apiLogger.error('Generate link error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as GenerateLinkResponse,
      { status: 500 }
    )
  }
}
