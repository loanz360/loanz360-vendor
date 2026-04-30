import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/emi-inquiries
 * Create a new customer EMI inquiry
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user details
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, sub_role, employee_id, designation')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const bodySchema = z.object({


      principal_amount: z.string().optional(),


      interest_rate: z.string().optional(),


      tenure_months: z.string().optional(),


      monthly_emi: z.string().optional(),


      total_interest: z.string().optional(),


      total_amount: z.string().optional(),


      customer_name: z.string().optional(),


      customer_email: z.string().email().optional(),


      customer_phone: z.string().optional(),


      loan_type: z.string().optional(),


      customer_requirements: z.string().optional(),


      internal_notes: z.string().optional(),


      inquiry_source: z.string().optional(),


      meeting_type: z.string().optional(),


      customer_income_range: z.string().optional(),


      customer_credit_score_range: z.string().optional(),


      tags: z.array(z.unknown()).optional(),


      hot_lead: z.string().optional(),


      customer_consent_given: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    const {
      principal_amount,
      interest_rate,
      tenure_months,
      monthly_emi,
      total_interest,
      total_amount,
      customer_name,
      customer_email,
      customer_phone,
      loan_type,
      customer_requirements,
      internal_notes,
      inquiry_source,
      meeting_type,
      customer_income_range,
      customer_credit_score_range,
      tags,
      hot_lead,
      customer_consent_given
    } = body

    if (!principal_amount || !interest_rate || !tenure_months) {
      return NextResponse.json(
        { error: 'Missing required fields: principal_amount, interest_rate, tenure_months' },
        { status: 400 }
      )
    }

    // Set data retention (default: 2 years from now, or based on compliance)
    const dataRetentionUntil = new Date()
    dataRetentionUntil.setFullYear(dataRetentionUntil.getFullYear() + 2)

    // Create the inquiry
    const { data: inquiry, error: insertError } = await supabase
      .from('customer_emi_inquiries')
      .insert({
        created_by_employee_id: user.id,
        employee_name: userData.full_name || user.email,
        employee_role: userData.sub_role || 'EMPLOYEE',
        employee_code: userData.employee_id,
        employee_department: userData.designation,

        customer_name,
        customer_email,
        customer_phone,

        loan_type: loan_type || 'personal_loan',
        principal_amount,
        interest_rate,
        tenure_months,

        monthly_emi,
        total_interest,
        total_amount,

        customer_requirements,
        internal_notes,
        customer_income_range,
        customer_credit_score_range,

        inquiry_source: inquiry_source || 'direct',
        meeting_type: meeting_type || 'online',

        tags: tags || [],
        hot_lead: hot_lead || false,

        data_retention_until: dataRetentionUntil.toISOString().split('T')[0],
        customer_consent_given: customer_consent_given || false
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating inquiry', insertError)
      return NextResponse.json(
        { error: 'Failed to create inquiry' },
        { status: 500 }
      )
    }

    // Log audit trail
    await supabase
      .from('inquiry_audit_log')
      .insert({
        inquiry_id: inquiry.id,
        action_type: 'created',
        action_by_employee_id: user.id,
        action_metadata: {
          loan_type,
          principal_amount,
          customer_provided: !!(customer_name || customer_email || customer_phone)
        }
      })

    return NextResponse.json({
      success: true,
      inquiry
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in POST /api/emi-inquiries', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/emi-inquiries
 * Get all inquiries for the current employee
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const ALLOWED_SORT_COLUMNS = ['created_at', 'principal_amount', 'interest_rate', 'monthly_emi', 'status', 'customer_name', 'loan_type']
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const safeSortBy = ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build query
    let query = supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact' })
      .eq('created_by_employee_id', user.id)
      .is('archived_at', null)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    // Apply sorting
    query = query.order(safeSortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: inquiries, error: fetchError, count } = await query

    if (fetchError) {
      apiLogger.error('Error fetching inquiries', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch inquiries' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      inquiries,
      total: count,
      limit,
      offset
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/emi-inquiries', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
