/**
 * API Route: Customer Phase 1 Lead Submission
 * POST /api/customers/leads/submit
 *
 * Handles Phase 1 loan application submission by customers with:
 * - Basic customer details (Name, Mobile, Email, Location)
 * - Loan type selection
 * - Referral code tracking
 * - NO BDE auto-assignment (happens after Phase 2)
 * - Lead goes to Unified CRM Pipeline with status NEW_UNASSIGNED
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { generateTraceToken } from '@/lib/utils/trace-token'
import { notifyLeadCreated } from '@/lib/notifications/ulap-lead-notifications'
import { encryptLeadPII } from '@/lib/security/encryption-pii'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Check if a value is a valid UUID
function isValidUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return UUID_REGEX.test(value)
}

interface SubmitLeadRequest {
  // Customer Details
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_dob?: string
  customer_gender?: string
  customer_pan?: string
  customer_aadhar?: string
  customer_address?: string
  customer_city: string
  customer_state?: string
  customer_pincode: string
  customer_subrole: string

  // Loan Requirements
  loan_type: string
  loan_amount: number
  loan_purpose?: string
  loan_tenure_months?: number
  existing_emis?: number
  loan_category_id?: string
  loan_subcategory_id?: string

  // Employment Details
  employment_type: string
  employer_name?: string
  designation?: string
  monthly_income: number
  years_of_employment?: number

  // Referral tracking
  source: 'CUSTOMER' | 'REFERRAL'
  referral_code?: string

  // Remarks
  remarks?: string
}

interface SubmitLeadResponse {
  success: boolean
  data?: {
    lead_id: string
    lead_number: string
    cam_status: string
    assigned_bde_id?: string
    assigned_bde_name?: string
    message: string
  }
  error?: string
  code?: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting (stricter for public endpoint)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // 1. Check if user is authenticated (optional for customer self-service)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 2. Parse request body
    const body: SubmitLeadRequest = await request.json()

    // 3. Validate required fields (Phase 1 - Basic info only)
    const requiredFields = [
      'customer_name',
      'customer_mobile',
      'customer_city',
      'customer_pincode',
      'loan_type',
    ]

    for (const field of requiredFields) {
      if (!body[field as keyof SubmitLeadRequest]) {
        return NextResponse.json(
          { success: false, error: `${field.replace(/_/g, ' ')} is required` } as SubmitLeadResponse,
          { status: 400 }
        )
      }
    }

    // 4. Validate mobile number
    if (!/^\+?[0-9]{10,15}$/.test(body.customer_mobile)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format' } as SubmitLeadResponse,
        { status: 400 }
      )
    }

    // 5. Validate email if provided
    if (body.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' } as SubmitLeadResponse,
        { status: 400 }
      )
    }

    // 6. Normalize mobile number
    let normalizedMobile = body.customer_mobile.trim()
    if (!normalizedMobile.startsWith('+')) {
      normalizedMobile = '+91' + normalizedMobile.replace(/^0+/, '')
    }

    // 7. Check for duplicate leads
    const { data: blockCheck } = await supabase.rpc('check_partner_duplicate_blocking', {
      p_customer_mobile: normalizedMobile,
      p_customer_name: body.customer_name,
      p_loan_type: body.loan_type,
    })

    if (blockCheck && blockCheck[0]?.is_blocked) {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have an active application for this loan type. Please check your application status.',
          code: 'DUPLICATE_BLOCKED',
        } as SubmitLeadResponse,
        { status: 409 }
      )
    }

    // 8. Generate lead_id using database function
    const { data: leadIdResult, error: leadIdError } = await supabase.rpc('generate_lead_id')

    if (leadIdError || !leadIdResult) {
      apiLogger.error('Lead ID generation error', leadIdError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate application ID' } as SubmitLeadResponse,
        { status: 500 }
      )
    }

    const leadId = leadIdResult as string

    // 9. Validate referral code if provided
    let referrerId: string | null = null
    let referrerType: string | null = null
    let referrerName: string | null = null

    if (body.referral_code) {
      // Check partners first
      const { data: partner } = await supabase
        .from('partners')
        .select('id, partner_type, full_name, referral_code')
        .eq('referral_code', body.referral_code)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (partner) {
        referrerId = partner.id
        referrerType = partner.partner_type
        referrerName = partner.full_name
      } else {
        // Check customers
        const { data: referrer } = await supabase
          .from('customer_profiles')
          .select('id, full_name, referral_code')
          .eq('referral_code', body.referral_code)
          .maybeSingle()

        if (referrer) {
          referrerId = referrer.id
          referrerType = 'CUSTOMER'
          referrerName = referrer.full_name
        }
      }
    }

    // 10. Generate trace token for customer submission
    const traceToken = generateTraceToken({
      role: 'CUSTOMER',
      userId: user?.id || null,
      referralCode: body.referral_code,
      referrerId,
    })

    // 11. Phase 1: NO BDE auto-assignment
    // BDE assignment happens in Phase 2 after complete application is submitted
    // Lead goes to Unified CRM Pipeline with status NEW_UNASSIGNED

    // 12. Create lead record (Phase 1 - minimal data)
    // SECURITY: encryptLeadPII encrypts PAN, DOB, address, income fields before DB insert
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(encryptLeadPII({
        partner_id: referrerId,
        partner_type: referrerType,
        employee_id: null,
        employee_type: null,
        customer_user_id: user?.id || null,
        lead_id: leadId,

        // Phase 1: Basic Customer Details ONLY
        customer_name: body.customer_name,
        customer_mobile: normalizedMobile,
        customer_email: body.customer_email || null,
        customer_city: body.customer_city,
        customer_state: body.customer_state || null,
        customer_pincode: body.customer_pincode,

        // Phase 1: Loan Selection
        loan_type: body.loan_type,
        // UUID validation: only set if valid UUID, otherwise store as code
        loan_category_id: body.loan_category_id && isValidUUID(body.loan_category_id) ? body.loan_category_id : null,
        loan_category_code: body.loan_category_id && !isValidUUID(body.loan_category_id) ? body.loan_category_id : null,
        loan_subcategory_id: body.loan_subcategory_id && isValidUUID(body.loan_subcategory_id) ? body.loan_subcategory_id : null,
        loan_subcategory_code: body.loan_subcategory_id && !isValidUUID(body.loan_subcategory_id) ? body.loan_subcategory_id : null,

        // Lead Status - Phase 1: NEW_UNASSIGNED (no BDE yet)
        form_status: 'PHASE_1_SUBMITTED',
        form_completion_percentage: 30, // Phase 1 is ~30% of full application
        form_submitted_at: new Date().toISOString(),
        lead_status: 'NEW_UNASSIGNED',
        lead_priority: body.referral_code ? 'HIGH' : 'MEDIUM', // Referrals get higher priority

        // Source tracking
        form_source: body.referral_code ? 'REFERRAL_PHASE_1' : 'CUSTOMER_PHASE_1',
        trace_token: traceToken,

        // Referral tracking
        referral_code: body.referral_code || null,
        referrer_id: referrerId,
        referrer_type: referrerType,
        referrer_name: referrerName,

        // NO BDE Assignment in Phase 1
        assigned_bde_id: null,
        assigned_bde_name: null,
        assigned_at: null,

        // CAM Status - Not applicable for Phase 1
        cam_status: 'NOT_STARTED',

        // Application Phase indicator
        application_phase: 1,

        // Remarks
        remarks: body.remarks || null,

        // Collected data JSON
        collected_data: {
          submitted_by: body.referral_code ? 'REFERRAL_PHASE_1' : 'CUSTOMER_PHASE_1',
          submitted_at: new Date().toISOString(),
          application_phase: 1,
          is_authenticated: !!user,
          referral_code: body.referral_code || null,
          referrer_name: referrerName,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      }))
      .select()
      .maybeSingle()

    if (leadError || !lead) {
      apiLogger.error('Lead creation error', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create application' } as SubmitLeadResponse,
        { status: 500 }
      )
    }

    // 13. Phase 1: No BDE assignment - happens in Phase 2

    // 14. Track referral if applicable
    if (referrerId && body.referral_code) {
      try {
        await supabase.from('referral_tracking').insert({
          referral_code: body.referral_code,
          referrer_id: referrerId,
          referrer_type: referrerType,
          referee_lead_id: lead.id,
          referee_name: body.customer_name,
          referee_mobile: normalizedMobile,
          status: 'LEAD_CREATED',
          created_at: new Date().toISOString(),
        })
      } catch (refError) {
        apiLogger.error('Referral tracking error', refError)
      }
    }

    // 15. Send lead created notifications (async)
    notifyLeadCreated(
      lead.id,
      leadId,
      body.customer_name,
      normalizedMobile,
      body.customer_email,
      body.loan_type,
      undefined, // No loan amount in Phase 1
      referrerId || undefined,
      undefined, // No BDE assigned in Phase 1
      undefined
    ).catch((err) => apiLogger.error('Lead notification error', err))

    // 16. Phase 1: No CAE processing - happens after Phase 2

    // 17. Return success response
    return NextResponse.json({
      success: true,
      data: {
        lead_id: lead.id,
        lead_number: leadId,
        cam_status: 'NOT_STARTED',
        message: `Your loan application has been submitted successfully! Application ID: ${leadId}. Please complete the remaining details to proceed with loan processing.`,
      },
    } as SubmitLeadResponse)
  } catch (error) {
    apiLogger.error('Submit lead error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as SubmitLeadResponse,
      { status: 500 }
    )
  }
}
