export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { ReconciliationStatus } from '@/types/cp-profile'

/** Row shape for cp_payout_reconciliation with joined lender data */
interface PayoutRow {
  id: string
  lender_association_id: string
  cp_lender_associations: { lender_name: string; lender_type: string } | null
  period_start: string
  period_end: string
  disbursements_count: number | null
  disbursements_value: number | null
  expected_commission: number | null
  tds_deducted: number | null
  gst_amount: number | null
  net_expected: number | null
  received_amount: number | null
  difference: number | null
  reconciliation_status: string
  payment_date: string | null
  utr_number: string | null
  payment_mode: string | null
  remarks: string | null
  dispute_id: string | null
  dispute_status: string | null
  created_at: string
}

/**
 * GET /api/partners/cp/payouts
 * Fetches payout reconciliation records for the authenticated CP
 *
 * CP-exclusive feature:
 * - View payout history by lender
 * - Track expected vs received amounts
 * - Identify reconciliation mismatches
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
    const reconciliationStatus = searchParams.get('reconciliation_status') as ReconciliationStatus | null
    const year = searchParams.get('year')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('cp_payout_reconciliation')
      .select('*, cp_lender_associations!inner(lender_name, lender_type)', { count: 'exact' })
      .eq('partner_id', partner.id)

    // Apply filters
    if (lenderAssociationId) {
      query = query.eq('lender_association_id', lenderAssociationId)
    }
    if (reconciliationStatus) {
      query = query.eq('reconciliation_status', reconciliationStatus)
    }
    if (year) {
      query = query
        .gte('period_start', `${year}-01-01`)
        .lte('period_end', `${year}-12-31`)
    }

    query = query
      .order('period_end', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: payouts, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching payouts:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payouts' },
        { status: 500 }
      )
    }

    // Calculate summary
    const { data: summary } = await supabase
      .rpc('get_cp_payout_summary', { cp_partner_id: partner.id })
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        payouts: (payouts || []).map((p: PayoutRow) => ({
          id: p.id,
          lender_association_id: p.lender_association_id,
          lender_name: p.cp_lender_associations?.lender_name || '',
          lender_type: p.cp_lender_associations?.lender_type || '',
          period_start: p.period_start,
          period_end: p.period_end,
          disbursements_count: p.disbursements_count,
          disbursements_value: p.disbursements_value,
          expected_commission: p.expected_commission,
          tds_deducted: p.tds_deducted,
          gst_amount: p.gst_amount,
          net_expected: p.net_expected,
          received_amount: p.received_amount,
          difference: p.difference,
          reconciliation_status: p.reconciliation_status,
          payment_date: p.payment_date,
          utr_number: p.utr_number,
          payment_mode: p.payment_mode,
          remarks: p.remarks,
          dispute_id: p.dispute_id,
          dispute_status: p.dispute_status,
          created_at: p.created_at
        })),
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        },
        summary: summary || {
          total_expected: 0,
          total_received: 0,
          total_pending: 0,
          total_disputed: 0,
          matched_count: 0,
          mismatch_count: 0
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/payouts:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
