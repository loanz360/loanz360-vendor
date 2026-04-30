
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { LenderType, CodeStatus, PayoutModel, LoanProductType } from '@/types/cp-profile'

/** Row shape for cp_disbursement_reports */
interface DisbursementRow {
  id: string
  loan_account_number: string
  customer_name: string
  disbursement_date: string
  disbursement_amount: number
  product_type: string
  validation_status: string
  commission_status: string
  commission_amount: number | null
}

/** Row shape for cp_payout_reconciliation */
interface PayoutRow {
  id: string
  period_start: string
  period_end: string
  expected_amount: number | null
  received_amount: number | null
  reconciliation_status: string
  payment_date: string | null
  utr_number: string | null
}

/**
 * GET /api/partners/cp/lender-associations/[id]
 * Fetches detailed information for a specific lender association
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
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
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Fetch lender association
    const { data: association, error } = await supabase
      .from('cp_lender_associations')
      .select('*')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (error || !association) {
      return NextResponse.json(
        { success: false, error: 'Lender association not found' },
        { status: 404 }
      )
    }

    // Fetch disbursement history for this lender
    const { data: disbursements } = await supabase
      .from('cp_disbursement_reports')
      .select('*')
      .eq('lender_association_id', id)
      .order('disbursement_date', { ascending: false })
      .limit(20)

    // Fetch payout history for this lender
    const { data: payouts } = await supabase
      .from('cp_payout_reconciliation')
      .select('*')
      .eq('lender_association_id', id)
      .order('period_end', { ascending: false })
      .limit(12)

    // Parse JSON arrays
    const parseJsonArray = (field: unknown): unknown[] => {
      if (!field) return []
      if (Array.isArray(field)) return field
      if (typeof field !== 'string') return []
      try {
        return JSON.parse(field)
      } catch {
        return []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        association: {
          id: association.id,
          lender_id: association.lender_id,
          lender_name: association.lender_name,
          lender_type: association.lender_type as LenderType,
          agreement_reference_number: association.agreement_reference_number || '',
          agreement_document_url: association.agreement_document_url,
          agreement_signed_date: association.agreement_signed_date,
          agreement_expiry_date: association.agreement_expiry_date,
          agreement_version: association.agreement_version,
          loans360_code: association.loans360_code || '',
          code_activation_date: association.code_activation_date,
          code_status: (association.code_status || 'ACTIVE') as CodeStatus,
          code_suspension_reason: association.code_suspension_reason,
          code_suspension_date: association.code_suspension_date,
          enabled_products: parseJsonArray(association.enabled_products) as LoanProductType[],
          payout_model: association.payout_model as PayoutModel | null,
          payout_percentage: association.payout_percentage,
          payout_flat_amount: association.payout_flat_amount,
          payout_slabs: parseJsonArray(association.payout_slabs),
          total_disbursements_count: association.total_disbursements_count || 0,
          total_disbursement_value: association.total_disbursement_value || 0,
          last_disbursement_date: association.last_disbursement_date,
          last_disbursement_amount: association.last_disbursement_amount
        },
        recent_disbursements: (disbursements || []).map((d: DisbursementRow) => ({
          id: d.id,
          loan_account_number: d.loan_account_number,
          customer_name: d.customer_name,
          disbursement_date: d.disbursement_date,
          disbursement_amount: d.disbursement_amount,
          product_type: d.product_type,
          validation_status: d.validation_status,
          commission_status: d.commission_status,
          commission_amount: d.commission_amount
        })),
        payout_history: (payouts || []).map((p: PayoutRow) => ({
          id: p.id,
          period_start: p.period_start,
          period_end: p.period_end,
          expected_amount: p.expected_amount,
          received_amount: p.received_amount,
          reconciliation_status: p.reconciliation_status,
          payment_date: p.payment_date,
          utr_number: p.utr_number
        }))
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/lender-associations/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
