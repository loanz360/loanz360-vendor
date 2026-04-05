export const dynamic = 'force-dynamic'

/**
 * API Route: BP Commission Summary
 * GET /api/partners/bp/commissions/summary - Get commission summary for BP
 *
 * Database Schema (leads table):
 * - estimated_commission: DECIMAL(15,2) - estimated commission amount
 * - actual_commission: DECIMAL(15,2) - actual commission after disbursement
 * - commission_paid: BOOLEAN - whether commission has been paid
 * - commission_paid_at: TIMESTAMP - when commission was paid
 * - status: VARCHAR(50) - lead status (new, in_progress, documentation, bank_processing, sanctioned, disbursed, dropped, rejected)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export interface CommissionSummary {
  total_estimated: number
  total_calculated: number
  total_approved: number
  total_paid: number
  total_dropped: number
  total_lost: number
  pending_payout: number
  total_leads: number
}

export interface CommissionSummaryResponse {
  success: boolean
  data?: CommissionSummary
  error?: string
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
        { success: false, error: 'Unauthorized' } as CommissionSummaryResponse,
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
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerData) {
      partner = partnerData
    }

    if (!partner) {
      // Return empty summary instead of 404 for better UX
      return NextResponse.json({
        success: true,
        data: {
          total_estimated: 0,
          total_calculated: 0,
          total_approved: 0,
          total_paid: 0,
          total_dropped: 0,
          total_lost: 0,
          pending_payout: 0,
          total_leads: 0,
        },
      } as CommissionSummaryResponse)
    }

    // 3. Query commission summary from partner_leads table
    // Using actual schema columns: status, estimated_commission, actual_commission, commission_paid
    const { data: leads, error: leadsError } = await supabase
      .from('partner_leads')
      .select('status, estimated_commission, actual_commission, commission_paid, loan_amount')
      .eq('partner_id', partner.id)
      .eq('is_active', true)

    if (leadsError) {
      apiLogger.error('Commission summary fetch error', leadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch commission summary' } as CommissionSummaryResponse,
        { status: 500 }
      )
    }

    // 4. Calculate summary from leads data based on actual schema
    // Map lead status to commission status:
    // - new, in_progress, documentation, bank_processing = PENDING (estimated commission)
    // - sanctioned = CALCULATED (actual commission calculated)
    // - disbursed + commission_paid=false = APPROVED (awaiting payment)
    // - disbursed + commission_paid=true = PAID
    // - dropped = DROPPED
    // - rejected = LOST
    const summary: CommissionSummary = {
      total_estimated: 0,
      total_calculated: 0,
      total_approved: 0,
      total_paid: 0,
      total_dropped: 0,
      total_lost: 0,
      pending_payout: 0,
      total_leads: leads?.length || 0,
    }

    leads?.forEach((lead) => {
      const estimatedAmount = Number(lead.estimated_commission) || 0
      const actualAmount = Number(lead.actual_commission) || 0
      const status = lead.status?.toLowerCase() || ''
      const isPaid = lead.commission_paid === true

      switch (status) {
        case 'new':
        case 'in_progress':
        case 'documentation':
        case 'bank_processing':
          // Lead is in progress - use estimated commission
          summary.total_estimated += estimatedAmount
          summary.pending_payout += estimatedAmount
          break
        case 'sanctioned':
          // Loan sanctioned - commission calculated but not yet disbursed
          summary.total_calculated += actualAmount || estimatedAmount
          summary.pending_payout += actualAmount || estimatedAmount
          break
        case 'disbursed':
          // Loan disbursed - check if commission is paid
          if (isPaid) {
            summary.total_paid += actualAmount || estimatedAmount
          } else {
            // Disbursed but commission not yet paid = approved/pending payout
            summary.total_approved += actualAmount || estimatedAmount
            summary.pending_payout += actualAmount || estimatedAmount
          }
          break
        case 'dropped':
          // Lead dropped by customer
          summary.total_dropped += estimatedAmount
          break
        case 'rejected':
          // Lead rejected by bank - commission lost
          summary.total_lost += estimatedAmount
          break
      }
    })

    // 5. Return response with calculated summary
    return NextResponse.json({
      success: true,
      data: summary,
    } as CommissionSummaryResponse)
  } catch (error) {
    apiLogger.error('Get commission summary error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as CommissionSummaryResponse,
      { status: 500 }
    )
  }
}
