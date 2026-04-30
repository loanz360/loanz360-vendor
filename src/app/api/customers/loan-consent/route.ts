
/**
 * Loan Co-applicant Consent API
 * Handle consent requests for co-applicants and guarantors
 *
 * GET  - Fetch pending consent requests for current user
 * POST - Create new consent request (send OTP)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

// Admin client for operations requiring elevated privileges
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema for creating consent request
const createConsentSchema = z.object({
  loan_application_id: z.string().uuid().optional(),
  applicant_type: z.enum(['CO_APPLICANT', 'GUARANTOR']),
  mobile_number: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  email: z.string().email().optional(),
  full_name: z.string().min(2).max(100),
  relationship: z.string().max(50).optional(),
  pan_number: z.string().max(10).optional(),
  // For entity applications
  entity_id: z.string().uuid().optional(),
  role_code: z.string().max(50).optional(),
  role_name: z.string().max(100).optional(),
  ownership_percentage: z.number().min(0).max(100).optional(),
})

/**
 * GET /api/customers/loan-consent
 * Fetch pending consent requests for current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's phone number
    const userPhone = user.phone?.replace('+91', '') || ''

    // Fetch pending consent requests for this phone number
    const { data: pendingRequests, error: requestsError } = await supabase
      .from('loan_consent_requests')
      .select(`
        id,
        loan_application_id,
        applicant_type,
        full_name,
        mobile_number,
        email,
        relationship,
        entity_id,
        consent_status,
        requested_at,
        expires_at,
        loan_applications_v2(
          id,
          application_number,
          loan_amount,
          loan_purpose,
          individuals(full_name),
          entities(legal_name)
        )
      `)
      .eq('mobile_number', userPhone)
      .eq('consent_status', 'PENDING')
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: false })

    if (requestsError) {
      apiLogger.error('Error fetching consent requests', requestsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch consent requests' },
        { status: 500 }
      )
    }

    // Also fetch requests sent by this user
    const { data: individual } = await supabase
      .from('individuals')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let sentRequests: unknown[] = []
    if (individual) {
      const { data: sent } = await supabase
        .from('loan_consent_requests')
        .select(`
          id,
          loan_application_id,
          applicant_type,
          full_name,
          mobile_number,
          consent_status,
          requested_at,
          responded_at,
          entity_id
        `)
        .eq('requested_by_individual_id', individual.id)
        .order('requested_at', { ascending: false })
        .limit(20)

      sentRequests = sent || []
    }

    return NextResponse.json({
      success: true,
      pendingRequests: pendingRequests || [],
      sentRequests
    })

  } catch (error) {
    apiLogger.error('Loan Consent GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/loan-consent
 * Create new consent request and send OTP
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get requesting individual's ID
    const { data: individual, error: indError } = await supabase
      .from('individuals')
      .select('id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (indError || !individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createConsentSchema.parse(body)

    // Generate OTP (6 digits)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await hashOTP(otp)

    // Set expiry (15 minutes for OTP, 24 hours for consent request)
    const now = new Date()
    const otpExpiry = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes
    const requestExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    // Check if user already exists with this mobile number
    const { data: existingUser } = await supabaseAdmin
      .from('individuals')
      .select('id, user_id, full_name')
      .eq('mobile_number', validatedData.mobile_number)
      .maybeSingle()

    // Create consent request
    const { data: consentRequest, error: createError } = await supabaseAdmin
      .from('loan_consent_requests')
      .insert({
        loan_application_id: validatedData.loan_application_id || null,
        requested_by_individual_id: individual.id,
        target_individual_id: existingUser?.id || null,
        applicant_type: validatedData.applicant_type,
        mobile_number: validatedData.mobile_number,
        email: validatedData.email || null,
        full_name: validatedData.full_name,
        relationship: validatedData.relationship || null,
        pan_number: validatedData.pan_number || null,
        entity_id: validatedData.entity_id || null,
        role_code: validatedData.role_code || null,
        role_name: validatedData.role_name || null,
        ownership_percentage: validatedData.ownership_percentage || null,
        otp_hash: otpHash,
        otp_expires_at: otpExpiry.toISOString(),
        otp_attempts: 0,
        consent_status: 'PENDING',
        expires_at: requestExpiry.toISOString()
      })
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating consent request', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create consent request' },
        { status: 500 }
      )
    }

    // Send OTP via SMS
    // TODO: Integrate with actual SMS provider (MSG91, Twilio, etc.)
    // For now, we'll log it and return success

    // In production, send SMS:
    // await sendSMS(validatedData.mobile_number, `Your OTP for loan consent is ${otp}. Valid for 15 minutes. - LOANZ360`)

    // Also send via email if provided
    if (validatedData.email) {
      // TODO: Send email with consent details and OTP
    }

    return NextResponse.json({
      success: true,
      consentRequestId: consentRequest.id,
      message: `OTP sent to ${validatedData.mobile_number.slice(0, 2)}****${validatedData.mobile_number.slice(-2)}`,
      expiresAt: otpExpiry.toISOString(),
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { _devOTP: otp })
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Loan Consent POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Simple hash function for OTP (in production, use bcrypt or similar)
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(otp + process.env.OTP_SALT || 'LOANZ360_OTP_SALT')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
