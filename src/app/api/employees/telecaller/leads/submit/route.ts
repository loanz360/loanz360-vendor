/**
 * API Route: Telecaller Phase 1 Lead Submission
 * POST /api/employees/telecaller/leads/submit
 *
 * Handles Phase 1 lead capture by Telecaller agents with:
 * - Basic customer details (Name, Mobile, Email, Location)
 * - Loan type selection
 * - Call tracking data (duration, call ID)
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

  // Call tracking
  call_id?: string
  call_duration?: number

  // Remarks
  remarks?: string

  // Source
  source: 'TELECALLER'
  employee_id?: string
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
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
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

    // 5. Get employee information (Telecaller profile)
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, role, branch_id, team_id')
      .eq('user_id', user.id)
      .in('role', ['TELECALLER', 'TELE_SALES_EXECUTIVE', 'TELE_SALES_AGENT'])
      .maybeSingle()

    if (employeeError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Telecaller profile not found' } as SubmitLeadResponse,
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

    // 9. Generate trace token for Telecaller submission
    const traceToken = generateTraceToken({
      role: 'TELECALLER',
      userId: user.id,
      employeeId: employee.id,
      employeeCode: employee.employee_id || 'TC-UNKNOWN',
      callId: body.call_id,
    })

    // 10. Phase 1: NO BDE auto-assignment
    // BDE assignment happens in Phase 2 after complete application is submitted
    // Lead goes to Unified CRM Pipeline with status NEW_UNASSIGNED

    // 11. Create lead record (Phase 1 - minimal data)
    // SECURITY: encryptLeadPII encrypts PAN, DOB, address, income fields before DB insert
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(encryptLeadPII({
        partner_id: null,
        partner_type: null,
        employee_id: employee.id,
        employee_type: 'TELECALLER',
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
        lead_priority: 'MEDIUM',

        // Source tracking
        form_source: 'TELECALLER_PHASE_1',
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

        // Collected data JSON with call info
        collected_data: {
          submitted_by: 'TELECALLER_PHASE_1',
          submitted_at: new Date().toISOString(),
          application_phase: 1,
          employee_name: employee.full_name,
          employee_id: employee.employee_id,
          call_id: body.call_id || null,
          call_duration_seconds: body.call_duration || null,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      }))
      .select()
      .maybeSingle()

    if (leadError || !lead) {
      apiLogger.error('Lead creation error', leadError)
      return NextResponse.json(
        { success: false, error: 'Failed to create lead' } as SubmitLeadResponse,
        { status: 500 }
      )
    }

    // 12. Phase 1: No BDE assignment - happens in Phase 2

    // 13. Track call metrics for telecaller
    try {
      const today = new Date().toISOString().split('T')[0]

      // Update telecaller daily stats
      await supabase.from('employee_daily_targets').upsert(
        {
          employee_id: employee.id,
          target_date: today,
          leads_created: 1,
          calls_made: body.call_id ? 1 : 0,
          total_call_duration: body.call_duration || 0,
        },
        {
          onConflict: 'employee_id,target_date',
        }
      )

      // Increment counters if record exists
      if (body.call_id) {
        await supabase.rpc('increment_telecaller_stats', {
          p_employee_id: employee.id,
          p_date: today,
          p_call_duration: body.call_duration || 0,
        }).catch(() => { /* Non-critical side effect */ })
      }
    } catch (statsError) {
      apiLogger.error('Stats tracking error', statsError)
    }

    // 14. Send lead created notifications (async)
    notifyLeadCreated(
      lead.id,
      leadId,
      body.customer_name,
      normalizedMobile,
      body.customer_email,
      body.loan_type,
      undefined, // No loan amount in Phase 1
      undefined, // No partner for Telecaller leads
      undefined, // No BDE assigned in Phase 1
      undefined
    ).catch((err) => apiLogger.error('Lead notification error', err))

    // 15. Phase 1: No CAE processing - happens after Phase 2

    // 16. Return success response
    return NextResponse.json({
      success: true,
      data: {
        lead_id: lead.id,
        lead_number: leadId,
        cam_status: 'NOT_STARTED',
        message: `Lead created successfully! Application ID: ${leadId}. Please complete Phase 2 to proceed with loan processing.`,
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
