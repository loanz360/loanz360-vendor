export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { CPLenderAssociation, LenderType, CodeStatus, PayoutModel, LoanProductType } from '@/types/cp-profile'

/** Row shape returned from the cp_lender_associations table */
interface LenderAssociationRow {
  id: string
  lender_id: string
  lender_name: string
  lender_type: string
  agreement_reference_number: string | null
  agreement_document_url: string | null
  agreement_signed_date: string | null
  agreement_expiry_date: string | null
  agreement_version: string | null
  loans360_code: string | null
  code_activation_date: string | null
  code_status: string | null
  code_suspension_reason: string | null
  code_suspension_date: string | null
  enabled_products: string | string[] | null
  payout_model: string | null
  payout_percentage: number | null
  payout_flat_amount: number | null
  payout_slabs: string | Record<string, unknown>[] | null
  total_disbursements_count: number | null
  total_disbursement_value: number | null
  last_disbursement_date: string | null
  last_disbursement_amount: number | null
}

/**
 * GET /api/partners/cp/lender-associations
 * Fetches all lender associations for the authenticated CP
 *
 * This is a CP-exclusive feature:
 * - Lists all Bank/NBFC associations where CP has Loans360 codes
 * - Shows agreement details, payout configuration, and performance metrics
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
    const lenderType = searchParams.get('lender_type') as LenderType | null
    const codeStatus = searchParams.get('code_status') as CodeStatus | null

    // Build query
    let query = supabase
      .from('cp_lender_associations')
      .select('*')
      .eq('partner_id', partner.id)

    // Apply filters
    if (lenderType) {
      query = query.eq('lender_type', lenderType)
    }
    if (codeStatus) {
      query = query.eq('code_status', codeStatus)
    }

    query = query.order('created_at', { ascending: false })

    const { data: associations, error } = await query

    if (error) {
      apiLogger.error('Error fetching lender associations:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch lender associations' },
        { status: 500 }
      )
    }

    // Parse JSON arrays and format response
    const formattedAssociations = (associations || []).map((la: LenderAssociationRow) => formatLenderAssociation(la))

    // Calculate summary metrics
    const summary = {
      total_associations: formattedAssociations.length,
      active_associations: formattedAssociations.filter(la => la.code_status === 'ACTIVE').length,
      suspended_associations: formattedAssociations.filter(la => la.code_status === 'SUSPENDED').length,
      by_lender_type: {
        BANK: formattedAssociations.filter(la => la.lender_type === 'BANK').length,
        NBFC: formattedAssociations.filter(la => la.lender_type === 'NBFC').length,
        HFC: formattedAssociations.filter(la => la.lender_type === 'HFC').length
      },
      total_disbursement_value: formattedAssociations.reduce((sum, la) => sum + (la.total_disbursement_value || 0), 0),
      total_disbursement_count: formattedAssociations.reduce((sum, la) => sum + (la.total_disbursements_count || 0), 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        associations: formattedAssociations,
        summary
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/lender-associations:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper to parse JSON arrays safely
 */
function parseJsonArray(field: unknown): unknown[] {
  if (!field) return []
  if (Array.isArray(field)) return field
  if (typeof field !== 'string') return []
  try {
    return JSON.parse(field)
  } catch {
    return []
  }
}

/**
 * Format lender association record
 */
function formatLenderAssociation(la: LenderAssociationRow): CPLenderAssociation {
  return {
    id: la.id,
    lender_id: la.lender_id,
    lender_name: la.lender_name,
    lender_type: la.lender_type as LenderType,
    agreement_reference_number: la.agreement_reference_number || '',
    agreement_document_url: la.agreement_document_url,
    agreement_signed_date: la.agreement_signed_date,
    agreement_expiry_date: la.agreement_expiry_date,
    agreement_version: la.agreement_version,
    loans360_code: la.loans360_code || '',
    code_activation_date: la.code_activation_date,
    code_status: (la.code_status || 'ACTIVE') as CodeStatus,
    code_suspension_reason: la.code_suspension_reason,
    code_suspension_date: la.code_suspension_date,
    enabled_products: parseJsonArray(la.enabled_products) as LoanProductType[],
    payout_model: la.payout_model as PayoutModel | null,
    payout_percentage: la.payout_percentage,
    payout_flat_amount: la.payout_flat_amount,
    payout_slabs: parseJsonArray(la.payout_slabs),
    total_disbursements_count: la.total_disbursements_count || 0,
    total_disbursement_value: la.total_disbursement_value || 0,
    last_disbursement_date: la.last_disbursement_date,
    last_disbursement_amount: la.last_disbursement_amount
  }
}
