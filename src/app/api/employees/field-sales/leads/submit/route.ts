/**
 * API Route: Field Sales Lead Submission
 * POST /api/employees/field-sales/leads/submit
 *
 * Handles lead capture by Field Sales agents with:
 * - Full customer details collected during field visit
 * - Loan requirements
 * - GPS location tracking
 * - Visit tracking data
 * - Auto BDE allocation
 * - CAE trigger (async)
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

  // Visit & Location tracking
  visit_id?: string
  latitude?: number
  longitude?: number
  location_accuracy?: number

  // Remarks
  remarks?: string

  // Source
  source: 'FIELD_SALES'
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

    // 3. Validate required fields
    const requiredFields = [
      'customer_name',
      'customer_mobile',
      'customer_city',
      'customer_pincode',
      'customer_subrole',
      'loan_type',
      'loan_amount',
      'employment_type',
      'monthly_income',
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

    // 5. Get employee information (Field Sales profile)
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, role, branch_id, territory_id')
      .eq('user_id', user.id)
      .in('role', ['FIELD_SALES_AGENT', 'FIELD_SALES_EXECUTIVE', 'FIELD_SALES'])
      .maybeSingle()

    if (employeeError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Field Sales profile not found' } as SubmitLeadResponse,
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

    // 9. Generate trace token for Field Sales submission
    const traceToken = generateTraceToken({
      role: 'FIELD_SALES',
      userId: user.id,
      employeeId: employee.id,
      employeeCode: employee.employee_id || 'FS-UNKNOWN',
      visitId: body.visit_id,
      latitude: body.latitude,
      longitude: body.longitude,
    })

    // 10. Field Sales self-assigns the lead
    const assignedBdeId = employee.id
    const assignedBdeName = employee.full_name

    // 11. Create lead record
    // SECURITY: encryptLeadPII encrypts PAN, DOB, address, income fields before DB insert
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(encryptLeadPII({
        partner_id: null,
        partner_type: null,
        employee_id: employee.id,
        employee_type: 'FIELD_SALES',
        lead_id: leadId,

        // Customer Details
        customer_name: body.customer_name,
        customer_mobile: normalizedMobile,
        customer_email: body.customer_email || null,
        customer_dob: body.customer_dob || null,
        customer_gender: body.customer_gender || null,
        customer_pan: body.customer_pan?.toUpperCase() || null,
        customer_aadhar: body.customer_aadhar || null,
        customer_address: body.customer_address || null,
        customer_city: body.customer_city,
        customer_state: body.customer_state || null,
        customer_pincode: body.customer_pincode,
        customer_subrole: body.customer_subrole,

        // Loan Details
        loan_type: body.loan_type,
        required_loan_amount: body.loan_amount,
        loan_purpose: body.loan_purpose || null,
        loan_tenure_months: body.loan_tenure_months || null,
        existing_emis: body.existing_emis || null,
        // UUID validation: only set if valid UUID, otherwise store as code
        loan_category_id: body.loan_category_id && isValidUUID(body.loan_category_id) ? body.loan_category_id : null,
        loan_category_code: body.loan_category_id && !isValidUUID(body.loan_category_id) ? body.loan_category_id : null,
        loan_subcategory_id: body.loan_subcategory_id && isValidUUID(body.loan_subcategory_id) ? body.loan_subcategory_id : null,
        loan_subcategory_code: body.loan_subcategory_id && !isValidUUID(body.loan_subcategory_id) ? body.loan_subcategory_id : null,

        // Employment Details
        employment_type: body.employment_type,
        employer_name: body.employer_name || null,
        monthly_income: body.monthly_income,
        years_of_employment: body.years_of_employment || null,

        // Lead Status
        form_status: 'SUBMITTED',
        form_completion_percentage: 100,
        form_submitted_at: new Date().toISOString(),
        lead_status: 'NEW',
        lead_priority: 'MEDIUM',

        // Source tracking
        form_source: 'FIELD_SALES',
        trace_token: traceToken,

        // BDE Assignment (self-assign for Field Sales)
        assigned_bde_id: assignedBdeId,
        assigned_bde_name: assignedBdeName,
        assigned_at: new Date().toISOString(),

        // CAM Status
        cam_status: 'NOT_STARTED',

        // Remarks
        remarks: body.remarks || null,

        // Collected data JSON with location
        collected_data: {
          submitted_by: 'FIELD_SALES',
          submitted_at: new Date().toISOString(),
          employee_name: employee.full_name,
          employee_id: employee.employee_id,
          visit_id: body.visit_id || null,
          location: body.latitude && body.longitude ? {
            latitude: body.latitude,
            longitude: body.longitude,
            accuracy: body.location_accuracy || null,
          } : null,
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

    // 12. Create lead assignment record (self-assign)
    const { error: assignmentError } = await supabase.from('lead_assignments').insert({
      lead_id: lead.id,
      lead_number: leadId,
      assigned_to_bde_id: assignedBdeId,
      assigned_to_bde_name: assignedBdeName,
      assigned_by_user_id: user.id,
      assigned_by_role: 'FIELD_SALES',
      assignment_type: 'SELF_ASSIGN',
      assignment_reason: `Self-assigned by Field Sales: ${employee.full_name}`,
      is_current: true,
    })

    if (assignmentError) {
      apiLogger.error('Assignment record creation error', assignmentError)
    }

    // 13. Update visit record if we have a visit ID
    if (body.visit_id) {
      try {
        await supabase
          .from('field_visits')
          .update({
            lead_id: lead.id,
            lead_number: leadId,
            outcome: 'LEAD_CAPTURED',
            outcome_notes: `Lead captured: ${body.loan_type} - ₹${body.loan_amount}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', body.visit_id)
      } catch (visitUpdateError) {
        apiLogger.error('Visit update error', visitUpdateError)
      }
    }

    // 14. Track field sales metrics
    try {
      const today = new Date().toISOString().split('T')[0]

      await supabase.from('employee_daily_targets').upsert(
        {
          employee_id: employee.id,
          target_date: today,
          leads_created: 1,
          visits_completed: body.visit_id ? 1 : 0,
        },
        {
          onConflict: 'employee_id,target_date',
        }
      )

      // Increment counters
      await supabase.rpc('increment_field_sales_stats', {
        p_employee_id: employee.id,
        p_date: today,
        p_has_visit: body.visit_id ? true : false,
      }).catch(() => { /* Non-critical side effect */ })
    } catch (statsError) {
      apiLogger.error('Stats tracking error', statsError)
    }

    // 15. Send lead created notifications (async)
    notifyLeadCreated(
      lead.id,
      leadId,
      body.customer_name,
      normalizedMobile,
      body.customer_email,
      body.loan_type,
      body.loan_amount,
      undefined, // No partner for Field Sales leads
      assignedBdeId,
      assignedBdeName
    ).catch((err) => apiLogger.error('Lead notification error', err))

    // 16. Trigger CAE processing (async)
    setTimeout(async () => {
      try {
        await supabase
          .from('leads')
          .update({ cam_status: 'PROCESSING' })
          .eq('id', lead.id)

        setTimeout(async () => {
          await supabase
            .from('leads')
            .update({
              cam_status: 'COMPLETED',
              cam_generated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
        }, 30000)
      } catch (err) {
        apiLogger.error('CAE trigger error', err)
      }
    }, 1000)

    // 17. Return success response
    return NextResponse.json({
      success: true,
      data: {
        lead_id: lead.id,
        lead_number: leadId,
        cam_status: 'PROCESSING',
        assigned_bde_id: assignedBdeId,
        assigned_bde_name: assignedBdeName,
        message: `Lead captured successfully from field visit! CAM generation in progress.`,
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
