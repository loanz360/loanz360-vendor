
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type {
  CPDisbursementSubmitRequest,
  DisbursementValidationStatus,
  CommissionStatus,
  LoanProductType
} from '@/types/cp-profile'

/** Row shape for cp_disbursement_reports with joined lender data */
interface DisbursementRow {
  id: string
  lender_association_id: string
  cp_lender_associations: { lender_name: string; lender_type: string } | null
  loan_account_number: string
  customer_name: string
  co_applicant_name: string | null
  disbursement_date: string
  disbursement_amount: number
  product_type: string
  property_location: string | null
  loan_tenure_months: number | null
  roi: number | null
  validation_status: string
  validation_errors: string | null
  validated_at: string | null
  commission_status: string
  commission_amount: number | null
  commission_percentage: number | null
  payout_reference: string | null
  created_at: string
  submitted_via: string
}

/**
 * GET /api/partners/cp/disbursements
 * Fetches disbursement reports for the authenticated CP
 *
 * This is a CP-exclusive feature:
 * - CPs independently disburse loans using Loans360 codes
 * - They report disbursement data back into Loans360
 * - Data is validated and commissions are calculated
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const lenderAssociationId = searchParams.get('lender_association_id')
    const validationStatus = searchParams.get('validation_status') as DisbursementValidationStatus | null
    const commissionStatus = searchParams.get('commission_status') as CommissionStatus | null
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('cp_disbursement_reports')
      .select('*, cp_lender_associations!inner(lender_name, lender_type)', { count: 'exact' })
      .eq('partner_id', partner.id)

    // Apply filters
    if (lenderAssociationId) {
      query = query.eq('lender_association_id', lenderAssociationId)
    }
    if (validationStatus) {
      query = query.eq('validation_status', validationStatus)
    }
    if (commissionStatus) {
      query = query.eq('commission_status', commissionStatus)
    }
    if (startDate) {
      query = query.gte('disbursement_date', startDate)
    }
    if (endDate) {
      query = query.lte('disbursement_date', endDate)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: disbursements, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching disbursements:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch disbursements' },
        { status: 500 }
      )
    }

    // Calculate summary metrics
    const { data: summary } = await supabase
      .rpc('get_cp_disbursement_summary', { cp_partner_id: partner.id })
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        disbursements: (disbursements || []).map((d: DisbursementRow) => ({
          id: d.id,
          lender_association_id: d.lender_association_id,
          lender_name: d.cp_lender_associations?.lender_name || '',
          lender_type: d.cp_lender_associations?.lender_type || '',
          loan_account_number: d.loan_account_number,
          customer_name: d.customer_name,
          co_applicant_name: d.co_applicant_name,
          disbursement_date: d.disbursement_date,
          disbursement_amount: d.disbursement_amount,
          product_type: d.product_type,
          property_location: d.property_location,
          loan_tenure_months: d.loan_tenure_months,
          roi: d.roi,
          validation_status: d.validation_status,
          validation_errors: d.validation_errors,
          validated_at: d.validated_at,
          commission_status: d.commission_status,
          commission_amount: d.commission_amount,
          commission_percentage: d.commission_percentage,
          payout_reference: d.payout_reference,
          submitted_at: d.created_at,
          submitted_via: d.submitted_via
        })),
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        },
        summary: summary || {
          total_count: 0,
          total_value: 0,
          pending_validation: 0,
          validated_count: 0,
          rejected_count: 0,
          commission_pending: 0,
          commission_paid: 0
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/disbursements:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/cp/disbursements
 * Submit a new disbursement report
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body: CPDisbursementSubmitRequest = await request.json()

    // Validate required fields
    const validationErrors: string[] = []
    if (!body.lender_association_id) validationErrors.push('Lender association is required')
    if (!body.loan_account_number) validationErrors.push('Loan account number is required')
    if (!body.customer_name) validationErrors.push('Customer name is required')
    if (!body.disbursement_date) validationErrors.push('Disbursement date is required')
    if (!body.disbursement_amount || body.disbursement_amount <= 0) validationErrors.push('Valid disbursement amount is required')
    if (!body.product_type) validationErrors.push('Product type is required')

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', validation_errors: validationErrors },
        { status: 400 }
      )
    }

    // Verify lender association belongs to this partner
    const { data: lenderAssociation, error: laError } = await supabase
      .from('cp_lender_associations')
      .select('id, code_status, enabled_products')
      .eq('id', body.lender_association_id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (laError || !lenderAssociation) {
      return NextResponse.json(
        { success: false, error: 'Invalid lender association' },
        { status: 400 }
      )
    }

    // Check if lender code is active
    if (lenderAssociation.code_status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Lender code is not active. Cannot submit disbursements.' },
        { status: 400 }
      )
    }

    // Check for duplicate submission
    const { data: existingDisbursement } = await supabase
      .from('cp_disbursement_reports')
      .select('id')
      .eq('partner_id', partner.id)
      .eq('lender_association_id', body.lender_association_id)
      .eq('loan_account_number', body.loan_account_number)
      .maybeSingle()

    if (existingDisbursement) {
      return NextResponse.json(
        { success: false, error: 'Duplicate submission: This loan account number has already been reported' },
        { status: 409 }
      )
    }

    // Get IP address for audit
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Insert disbursement report
    const { data: disbursement, error: insertError } = await supabase
      .from('cp_disbursement_reports')
      .insert({
        partner_id: partner.id,
        lender_association_id: body.lender_association_id,
        loan_account_number: body.loan_account_number.trim().toUpperCase(),
        customer_name: body.customer_name.trim(),
        co_applicant_name: body.co_applicant_name?.trim() || null,
        disbursement_date: body.disbursement_date,
        disbursement_amount: body.disbursement_amount,
        product_type: body.product_type,
        property_location: body.property_location?.trim() || null,
        loan_tenure_months: body.loan_tenure_months || null,
        roi: body.roi || null,
        validation_status: 'PENDING',
        commission_status: 'PENDING',
        submitted_via: 'MANUAL_ENTRY',
        submitted_by: user.id,
        submitted_ip: ipAddress,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error submitting disbursement:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to submit disbursement' },
        { status: 500 }
      )
    }

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'DISBURSEMENT_SUBMIT',
      action_description: `Submitted disbursement for loan ${body.loan_account_number}`,
      section: 'disbursements',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Disbursement submitted successfully',
      data: {
        id: disbursement.id,
        loan_account_number: disbursement.loan_account_number,
        validation_status: disbursement.validation_status
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/partners/cp/disbursements:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
