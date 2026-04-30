
/**
 * API Route: BA Commission History
 * GET /api/partners/ba/commissions/history - Get commission history for BA
 *
 * Database Schema (leads table):
 * - lead_number: VARCHAR(50) - unique lead identifier
 * - customer_name: VARCHAR(255)
 * - customer_mobile: VARCHAR(15) - NOT customer_phone
 * - loan_type: VARCHAR(50)
 * - loan_amount: DECIMAL(15,2) - NOT required_loan_amount
 * - status: VARCHAR(50) - lead status
 * - estimated_commission: DECIMAL(15,2)
 * - actual_commission: DECIMAL(15,2)
 * - commission_paid: BOOLEAN
 * - commission_paid_at: TIMESTAMP
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export interface CommissionHistoryItem {
  id: string
  lead_id: string
  customer_name: string
  customer_phone: string
  loan_type: string
  bank_name: string | null
  location: string | null
  required_loan_amount: number
  commission_percentage: number | null
  commission_amount: number | null
  commission_status: string
  commission_calculated_at: string | null
  commission_paid_at: string | null
  payout_batch_id: string | null
  payout_remarks: string | null
  lead_status: string
  created_at: string
}

export interface CommissionHistoryResponse {
  success: boolean
  data?: CommissionHistoryItem[]
  error?: string
  total?: number
  page?: number
  limit?: number
}

// Helper function to derive commission status from lead status and commission_paid flag
function deriveCommissionStatus(
  leadStatus: string | null,
  commissionPaid: boolean | null
): string {
  const status = leadStatus?.toLowerCase() || ''

  switch (status) {
    case 'new':
    case 'in_progress':
    case 'documentation':
    case 'bank_processing':
      return 'PENDING'
    case 'sanctioned':
      return 'CALCULATED'
    case 'disbursed':
      return commissionPaid ? 'PAID' : 'APPROVED'
    case 'dropped':
      return 'DROPPED'
    case 'rejected':
      return 'LOST'
    default:
      return 'PENDING'
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as CommissionHistoryResponse,
        { status: 401 }
      )
    }

    // 2. Get partner information - try without partner_type filter first
    let partner = null

    // First try with partner_type filter
    const { data: partnerData } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerData) {
      partner = partnerData
    }

    if (!partner) {
      // Return empty data instead of 404 for better UX
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      } as CommissionHistoryResponse)
    }

    // 3. Get pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') // Optional filter by commission_status
    const from = (page - 1) * limit
    const to = from + limit - 1

    // 4. Build query using actual schema columns
    let query = supabase
      .from('partner_leads')
      .select(
        `
        id,
        lead_number,
        customer_name,
        customer_mobile,
        customer_email,
        loan_type,
        loan_amount,
        status,
        estimated_commission,
        actual_commission,
        commission_paid,
        commission_paid_at,
        sanctioned_at,
        dropped_at,
        dropped_reason,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('partner_id', partner.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .eq('is_active', true)

    // Apply status filter if provided - map commission status to lead status
    if (status && status !== 'ALL') {
      switch (status) {
        case 'PENDING':
          query = query.in('status', ['new', 'in_progress', 'documentation', 'bank_processing'])
          break
        case 'CALCULATED':
          query = query.eq('status', 'sanctioned')
          break
        case 'APPROVED':
          query = query.eq('status', 'disbursed').eq('commission_paid', false)
          break
        case 'PAID':
          query = query.eq('status', 'disbursed').eq('commission_paid', true)
          break
        case 'DROPPED':
          query = query.eq('status', 'dropped')
          break
        case 'LOST':
          query = query.eq('status', 'rejected')
          break
      }
    }

    // 5. Execute query with pagination and ordering
    const { data: leads, error: leadsError, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (leadsError) {
      apiLogger.error('Commission history fetch error', leadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch commission history' } as CommissionHistoryResponse,
        { status: 500 }
      )
    }

    // 6. Transform data to match the expected interface
    const transformedData: CommissionHistoryItem[] = (leads || []).map((lead) => {
      const commissionStatus = deriveCommissionStatus(lead.status, lead.commission_paid)
      const commissionAmount = Number(lead.actual_commission) || Number(lead.estimated_commission) || 0
      const loanAmount = Number(lead.loan_amount) || 0

      // Calculate commission percentage (if we have both values)
      let commissionPercentage: number | null = null
      if (loanAmount > 0 && commissionAmount > 0) {
        commissionPercentage = Math.round((commissionAmount / loanAmount) * 10000) / 100 // Round to 2 decimal places
      }

      return {
        id: lead.id,
        lead_id: lead.lead_number || lead.id,
        customer_name: lead.customer_name || 'N/A',
        customer_phone: lead.customer_mobile || 'N/A',
        loan_type: lead.loan_type || 'N/A',
        bank_name: null, // Not in current schema
        location: null, // Not in current schema
        required_loan_amount: loanAmount,
        commission_percentage: commissionPercentage,
        commission_amount: commissionAmount,
        commission_status: commissionStatus,
        commission_calculated_at: lead.sanctioned_at || null,
        commission_paid_at: lead.commission_paid_at || null,
        payout_batch_id: null, // Not in current schema
        payout_remarks: lead.dropped_reason || null,
        lead_status: lead.status || 'new',
        created_at: lead.created_at,
      }
    })

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: transformedData,
      total: count || 0,
      page,
      limit,
    } as CommissionHistoryResponse)
  } catch (error) {
    apiLogger.error('Get commission history error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as CommissionHistoryResponse,
      { status: 500 }
    )
  }
}
