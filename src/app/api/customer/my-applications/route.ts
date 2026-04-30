
/**
 * Customer Applications API
 * Returns all loan applications for authenticated customer
 * IMPORTANT: Does NOT expose referral information, payout details, or commission
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

interface CustomerApplication {
  lead_id: string
  lead_uuid: string
  loan_type: string
  loan_amount: number
  loan_purpose: string | null
  status: string
  form_status: string
  progress_percentage: number
  applied_at: string
  last_updated: string
  can_proceed_to_detailed: boolean
  assigned_bde_name?: string
  document_count: number
  note_count: number
}

export async function GET(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY CUSTOMER AUTHENTICATION
    // =====================================================

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('customer_token')?.value

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    let customerId: string

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      customerId = payload.customerId as string

      if (!customerId) {
        throw new Error('Invalid token payload')
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      )
    }

    // =====================================================
    // 2. FETCH CUSTOMER INFO
    // =====================================================

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_id, name, is_active')
      .eq('id', customerId)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found',
        },
        { status: 404 }
      )
    }

    if (!customer.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: 'Account is deactivated',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 3. FETCH ALL APPLICATIONS FOR CUSTOMER
    // =====================================================
    // IMPORTANT: Do NOT include referral_id, partner information, or payout data

    const { data: applications, error: appsError } = await supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        loan_type,
        loan_amount,
        loan_purpose,
        lead_status,
        form_status,
        progress_percentage,
        created_at,
        updated_at,
        can_proceed_to_detailed,
        assigned_bde_id,
        documents_uploaded_count,
        notes_count
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (appsError) {
      apiLogger.error('Applications fetch error', appsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch applications',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 4. GET BDE NAMES FOR ASSIGNED APPLICATIONS
    // =====================================================

    const bdeIds = applications
      ?.map((app) => app.assigned_bde_id)
      .filter((id): id is string => id !== null) || []

    let bdeMap: Record<string, string> = {}
    if (bdeIds.length > 0) {
      const { data: bdeData } = await supabase
        .from('employee_profile')
        .select('id, name')
        .in('id', bdeIds)

      if (bdeData) {
        bdeMap = bdeData.reduce((acc, bde) => {
          acc[bde.id] = bde.name
          return acc
        }, {} as Record<string, string>)
      }
    }

    // =====================================================
    // 5. FORMAT APPLICATIONS (HIDE REFERRAL INFO)
    // =====================================================

    const formattedApplications: CustomerApplication[] = (applications || []).map((app) => ({
      lead_id: app.lead_id,
      lead_uuid: app.id,
      loan_type: app.loan_type,
      loan_amount: app.loan_amount,
      loan_purpose: app.loan_purpose,
      status: app.lead_status,
      form_status: app.form_status,
      progress_percentage: app.progress_percentage || 0,
      applied_at: app.created_at,
      last_updated: app.updated_at,
      can_proceed_to_detailed: app.can_proceed_to_detailed || false,
      assigned_bde_name: app.assigned_bde_id ? bdeMap[app.assigned_bde_id] : undefined,
      document_count: app.documents_uploaded_count || 0,
      note_count: app.notes_count || 0,
    }))

    // =====================================================
    // 6. CATEGORIZE APPLICATIONS
    // =====================================================

    const activeStatuses = [
      'NEW',
      'IN_PROGRESS',
      'UNDER_REVIEW',
      'DOCUMENTS_PENDING',
      'VERIFICATION_PENDING',
      'APPROVAL_PENDING',
      'ASSIGNED_TO_BDE',
      'IN_PROCESS',
      'CONTACTED',
      'QUALIFIED',
      'DOCUMENT_PENDING',
    ]

    const activeApplications = formattedApplications.filter((app) =>
      activeStatuses.includes(app.status)
    )

    const pastApplications = formattedApplications.filter(
      (app) => !activeStatuses.includes(app.status)
    )

    // =====================================================
    // 7. RETURN RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      customer_id: customer.customer_id,
      customer_name: customer.name,
      active_applications: activeApplications,
      past_applications: pastApplications,
      stats: {
        total_applications: formattedApplications.length,
        active_count: activeApplications.length,
        past_count: pastApplications.length,
      },
    })
  } catch (error) {
    apiLogger.error('My Applications API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
