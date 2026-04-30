import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Customer Wallet Referrals API
 * Manages referral creation and listing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

// GET - List customer's referrals
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Filters
    const status = searchParams.get('status')

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get customer profile using admin client
    const { data: customer } = await adminClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer profile not found' },
        { status: 404 }
      )
    }

    // Build query using admin client to bypass RLS (already verified user identity)
    let query = adminClient
      .from('customer_referrals')
      .select('*', { count: 'exact' })
      .eq('referrer_customer_id', customer.id)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'ALL') {
      query = query.eq('referral_status', status)
    }

    // Execute with pagination
    const { data: referrals, count, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        referrals: referrals || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error) {
    apiLogger.error('Wallet referrals GET error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referrals' },
      { status: 500 }
    )
  }
}

// POST - Create a new referral
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const adminClient = createAdminClient()
    const bodySchema = z.object({

      referred_name: z.string().optional(),

      referred_mobile: z.string(),

      referred_email: z.string().email().optional(),

      referred_city: z.string().optional(),

      loan_type: z.string().optional(),

      required_loan_amount: z.string().optional(),

      share_via_whatsapp: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      referred_name,
      referred_mobile,
      referred_email,
      referred_city,
      loan_type,
      required_loan_amount,
      share_via_whatsapp
    } = body

    // Validate required fields
    if (!referred_mobile) {
      return NextResponse.json(
        { success: false, error: 'Mobile number is required' },
        { status: 400 }
      )
    }

    // Validate mobile format
    const mobileRegex = /^\+?[0-9]{10,15}$/
    if (!mobileRegex.test(referred_mobile.replace(/\s/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get customer profile
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer profile not found' },
        { status: 404 }
      )
    }

    // Check if mobile already referred by this customer
    const { data: existingReferral } = await supabase
      .from('customer_referrals')
      .select('id')
      .eq('referrer_customer_id', customer.id)
      .eq('referred_mobile', referred_mobile.replace(/\s/g, ''))
      .maybeSingle()

    if (existingReferral) {
      return NextResponse.json(
        { success: false, error: 'You have already referred this person' },
        { status: 400 }
      )
    }

    // Generate referral ID using the database function
    const { data: referralIdResult } = await adminClient
      .rpc('generate_customer_referral_id')

    const referralId = referralIdResult || `CR-${Date.now()}`

    // Generate trace token
    const timestamp = Date.now()
    const random = crypto.randomBytes(8).toString('hex')
    const traceToken = Buffer.from(
      `CUSTOMER_${user.id}_${customer.id}_${timestamp}_${random}`
    ).toString('base64')

    // Generate short code for link
    const shortCode = crypto.randomBytes(6).toString('hex').toUpperCase()

    // Create short link (base URL would be configured)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const shortLink = `${baseUrl}/r/${shortCode}`

    // Create referral
    const { data: newReferral, error: insertError } = await adminClient
      .from('customer_referrals')
      .insert({
        referrer_customer_id: customer.id,
        referrer_user_id: user.id,
        referral_id: referralId,
        referred_name: referred_name || null,
        referred_mobile: referred_mobile.replace(/\s/g, ''),
        referred_email: referred_email || null,
        referred_city: referred_city || null,
        loan_type: loan_type || null,
        required_loan_amount: required_loan_amount || null,
        trace_token: traceToken,
        short_code: shortCode,
        short_link: shortLink,
        shared_via_whatsapp: share_via_whatsapp || false,
        whatsapp_sent_count: share_via_whatsapp ? 1 : 0,
        last_whatsapp_sent_at: share_via_whatsapp ? new Date().toISOString() : null,
        referral_status: 'NEW',
        form_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Referral insert error', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: {
        referral: newReferral,
        share_link: shortLink,
        whatsapp_message: generateWhatsAppMessage(referred_name, shortLink, loan_type)
      }
    })

  } catch (error) {
    apiLogger.error('Wallet referrals POST error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create referral' },
      { status: 500 }
    )
  }
}

// Generate WhatsApp share message
function generateWhatsAppMessage(name: string | null, link: string, loanType: string | null): string {
  const greeting = name ? `Hi ${name}!` : 'Hi!'
  const loanText = loanType ? ` for ${loanType}` : ''

  return encodeURIComponent(
    `${greeting} 🎉\n\n` +
    `I've been using Loanz360 for my loan needs and had a great experience!\n\n` +
    `I thought you might be interested in exploring loan options${loanText}.\n\n` +
    `Use my referral link to get started:\n${link}\n\n` +
    `✨ Quick approval process\n` +
    `💰 Competitive interest rates\n` +
    `📱 Easy documentation\n\n` +
    `Let me know if you have any questions!`
  )
}
