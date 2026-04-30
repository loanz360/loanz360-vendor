/**
 * API Route: Generate Customer Referral Link
 * POST /api/customers/referrals/generate-link
 *
 * Generates a unique, traceable short link for a customer to share with potential referrals
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { generateCustomerTraceToken } from '@/lib/utils/trace-token'
import { generateUniqueShortCode, buildShortUrl } from '@/lib/utils/short-code'
import type { GenerateReferralLinkRequest, GenerateReferralLinkResponse } from '@/types/customer-referrals'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  // Apply rate limiting
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
        { success: false, error: 'Unauthorized' } as GenerateReferralLinkResponse,
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body: GenerateReferralLinkRequest = await request.json()
    const { referred_mobile, referred_name, loan_type, required_loan_amount, remarks } = body

    // 3. Validate required fields
    if (!referred_mobile || !/^\+?[0-9]{10,15}$/.test(referred_mobile)) {
      return NextResponse.json(
        { success: false, error: 'Valid mobile number is required (10-15 digits)' } as GenerateReferralLinkResponse,
        { status: 400 }
      )
    }

    // 4. Get customer information
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_id, full_name, mobile, email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json(
        { success: false, error: 'Customer profile not found. Please complete your profile first.' } as GenerateReferralLinkResponse,
        { status: 404 }
      )
    }

    // 5. Generate trace token for customer referral
    const traceToken = generateCustomerTraceToken({
      userId: user.id,
      customerId: customer.id,
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

    // 7. Generate referral ID using database function
    const { data: referralIdResult, error: referralIdError } = await supabase.rpc('generate_customer_referral_id')

    if (referralIdError || !referralIdResult) {
      apiLogger.error('Referral ID generation error', referralIdError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate referral ID' } as GenerateReferralLinkResponse,
        { status: 500 }
      )
    }

    const referralId = referralIdResult as string

    // 8. Normalize mobile number (add +91 if not present)
    let normalizedMobile = referred_mobile.trim()
    if (!normalizedMobile.startsWith('+')) {
      normalizedMobile = '+91' + normalizedMobile.replace(/^0+/, '')
    }

    // 9. Create referral record
    const { data: referral, error: referralError } = await supabase
      .from('customer_referrals')
      .insert({
        referrer_customer_id: customer.id,
        referrer_user_id: user.id,
        referral_id: referralId,
        referred_name: referred_name || null,
        referred_mobile: normalizedMobile,
        loan_type: loan_type || null,
        required_loan_amount: required_loan_amount || null,
        short_link: shortLink,
        short_code: shortCode,
        trace_token: traceToken,
        form_status: 'PENDING',
        referral_status: 'NEW',
        remarks: remarks || null,
      })
      .select()
      .maybeSingle()

    if (referralError || !referral) {
      apiLogger.error('Referral creation error', referralError)
      return NextResponse.json(
        { success: false, error: 'Failed to create referral' } as GenerateReferralLinkResponse,
        { status: 500 }
      )
    }

    // 10. Create short link record
    const { error: shortLinkError } = await supabase.from('short_links').insert({
      short_code: shortCode,
      original_url: `/apply/brief/${shortCode}?ref=${traceToken}`,
      created_by_user_id: user.id,
      created_for_entity_type: 'CUSTOMER_REFERRAL',
      created_for_entity_id: referral.id,
      is_active: true,
      expires_at: null, // No expiration for customer referral links
    })

    if (shortLinkError) {
      apiLogger.error('Short link creation error', shortLinkError)
      // Continue anyway, as referral is created
    }

    // 11. Generate WhatsApp message (friend-to-friend tone)
    const referrerName = customer.full_name || 'Your Friend'
    const loanInfo = loan_type ? `${loan_type}` : 'a loan'
    const amountInfo = required_loan_amount
      ? ` of Rs. ${required_loan_amount.toLocaleString('en-IN')}`
      : ''

    const whatsappMessage = `Hey${referred_name ? ' ' + referred_name : ''}!

I've been using LOANZ360 for my financial needs and thought you might find it helpful too.

If you're looking for ${loanInfo}${amountInfo}, check out this link - it's quick and easy to apply:
${shortLink}

Let me know if you have any questions!

- ${referrerName}`

    // Encode message for WhatsApp URL
    const encodedMessage = encodeURIComponent(whatsappMessage)
    const whatsappUrl = `https://wa.me/${normalizedMobile.replace(/\+/g, '')}?text=${encodedMessage}`

    // 12. Return response
    return NextResponse.json({
      success: true,
      data: {
        referral_id: referralId,
        short_link: shortLink,
        short_code: shortCode,
        whatsapp_url: whatsappUrl,
        referral: referral as unknown,
      },
    } as GenerateReferralLinkResponse)
  } catch (error) {
    apiLogger.error('Generate referral link error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as GenerateReferralLinkResponse,
      { status: 500 }
    )
  }
}
