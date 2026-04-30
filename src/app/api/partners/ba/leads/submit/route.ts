/**
 * API Route: BA Lead Phase 1 Submission
 * POST /api/partners/ba/leads/submit
 *
 * Handles Phase 1 loan application submission by BA with:
 * - Basic customer details (Name, Mobile, Email, Location)
 * - Loan type selection
 * - NO BDE auto-assignment (happens after Phase 2)
 * - Lead goes to Unified CRM Pipeline with status NEW_UNASSIGNED
 *
 * Rate Limit: 30 requests per minute (write operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { generateTraceToken } from '@/lib/utils/trace-token'
import { notifyLeadCreated } from '@/lib/notifications/ulap-lead-notifications'
import { apiLogger } from '@/lib/utils/logger'


// Type definitions for the request
interface CoApplicant {
  co_applicant_type: 'INDIVIDUAL' | 'ENTITY'
  relationship: string
  relationship_other?: string
  // Individual fields
  full_name?: string
  date_of_birth?: string
  gender?: string
  mobile_number?: string
  email?: string
  pan_number?: string
  aadhar_number?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  employment_type?: string
  employer_name?: string
  designation?: string
  monthly_income?: number
  years_of_experience?: number
  // Entity fields
  entity_name?: string
  entity_type?: string
  registration_number?: string
  gst_number?: string
  annual_turnover?: number
  // Eligibility settings
  income_considered?: boolean
  income_percentage_considered?: number
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

  // Property Details (for secured loans)
  property_type?: string
  property_value?: number
  property_address?: string
  property_city?: string

  // Employment Details
  employment_type: string
  employer_name?: string
  designation?: string
  monthly_income: number
  years_of_employment?: number

  // Co-applicants
  co_applicants?: CoApplicant[]

  // Documents (placeholder)
  documents?: { document_type: string; file_name: string; file_url: string; file_size?: number; mime_type?: string }[]

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
        { success: false, error: 'Unauthorized' } as SubmitLeadResponse,
        { status: 401 }
      )
    }

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

    // 5. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, full_name')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as SubmitLeadResponse,
        { status: 404 }
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
      const blockInfo = blockCheck[0]
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate lead detected',
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
        { success: false, error: 'Failed to generate lead ID' } as SubmitLeadResponse,
        { status: 500 }
      )
    }

    const leadId = leadIdResult as string

    // 9. Generate trace token for direct submission
    const traceToken = generateTraceToken({
      role: 'BUSINESS_ASSOCIATE',
      userId: user.id,
      partnerId: partner.id,
      partnerCode: partner.partner_id || 'BA-UNKNOWN',
    })

    // 10. Phase 1: NO BDE auto-assignment
    // BDE assignment happens in Phase 2 after complete application is submitted
    // Lead goes to Unified CRM Pipeline with status NEW_UNASSIGNED

    // 11. Create lead record (Phase 1 - minimal data)
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        partner_id: partner.id,
        partner_type: 'BUSINESS_ASSOCIATE',
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

        // Lead Status - Phase 1: NEW_UNASSIGNED (no BDE yet)
        form_status: 'PHASE_1_SUBMITTED',
        form_completion_percentage: 30, // Phase 1 is ~30% of full application
        form_submitted_at: new Date().toISOString(),
        lead_status: 'NEW_UNASSIGNED',
        lead_priority: 'MEDIUM',

        // Source tracking
        form_source: 'BA_PHASE_1',
        trace_token: traceToken,

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
          submitted_by: 'BA_PHASE_1',
          submitted_at: new Date().toISOString(),
          partner_name: partner.full_name,
          application_phase: 1,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      })
      .select()
      .maybeSingle()

    if (leadError || !lead) {
      apiLogger.error('Lead creation error', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create lead' } as SubmitLeadResponse,
        { status: 500 }
      )
    }

    // 12. Phase 1: No co-applicants or BDE assignment
    // Co-applicants and BDE assignment happen in Phase 2

    // 13. Send lead created notifications (async)
    notifyLeadCreated(
      lead.id,
      leadId,
      body.customer_name,
      normalizedMobile,
      body.customer_email,
      body.loan_type,
      undefined, // No loan amount in Phase 1
      partner.id,
      undefined, // No BDE assigned in Phase 1
      undefined
    ).catch((err) => apiLogger.error('Lead notification error', err))

    // 14. Phase 1: No CAE processing - happens after Phase 2

    // 15. Return success response
    return NextResponse.json({
      success: true,
      data: {
        lead_id: lead.id,
        lead_number: leadId,
        cam_status: 'NOT_STARTED',
        message: `Lead submitted successfully! Application ID: ${leadId}. Please complete Phase 2 to proceed with loan processing.`,
      },
    } as SubmitLeadResponse)
  } catch (error) {
    apiLogger.error('Submit lead error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as SubmitLeadResponse,
      { status: 500 }
    )
  }
}
