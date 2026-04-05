export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { CPReconciliationDisputeRequest } from '@/types/cp-profile'

/** Row shape for cp_payout_disputes with nested reconciliation + lender join */
interface DisputeRow {
  id: string
  reconciliation_id: string
  cp_payout_reconciliation: {
    lender_association_id: string
    period_start: string
    period_end: string
    expected_commission: number | null
    received_amount: number | null
    difference: number | null
    cp_lender_associations: { lender_name: string; lender_type: string } | null
  } | null
  dispute_reason: string
  supporting_documents: string[] | null
  status: string
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

/**
 * GET /api/partners/cp/payouts/disputes
 * Fetches all dispute records for the authenticated CP
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
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('cp_payout_disputes')
      .select(`
        *,
        cp_payout_reconciliation!inner(
          lender_association_id,
          period_start,
          period_end,
          expected_commission,
          received_amount,
          difference,
          cp_lender_associations(lender_name, lender_type)
        )
      `)
      .eq('partner_id', partner.id)

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false })

    const { data: disputes, error } = await query

    if (error) {
      apiLogger.error('Error fetching disputes:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch disputes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        disputes: (disputes || []).map((d: DisputeRow) => ({
          id: d.id,
          reconciliation_id: d.reconciliation_id,
          lender_name: d.cp_payout_reconciliation?.cp_lender_associations?.lender_name || '',
          period: `${d.cp_payout_reconciliation?.period_start} to ${d.cp_payout_reconciliation?.period_end}`,
          expected_amount: d.cp_payout_reconciliation?.expected_commission,
          received_amount: d.cp_payout_reconciliation?.received_amount,
          difference: d.cp_payout_reconciliation?.difference,
          dispute_reason: d.dispute_reason,
          supporting_documents: d.supporting_documents || [],
          status: d.status,
          resolution: d.resolution,
          resolved_by: d.resolved_by,
          resolved_at: d.resolved_at,
          created_at: d.created_at
        })),
        summary: {
          total: (disputes || []).length,
          pending: (disputes || []).filter((d: DisputeRow) => d.status === 'PENDING').length,
          under_review: (disputes || []).filter((d: DisputeRow) => d.status === 'UNDER_REVIEW').length,
          resolved: (disputes || []).filter((d: DisputeRow) => d.status === 'RESOLVED').length,
          rejected: (disputes || []).filter((d: DisputeRow) => d.status === 'REJECTED').length
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/payouts/disputes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/cp/payouts/disputes
 * Raise a new dispute for payout reconciliation mismatch
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
    const body: CPReconciliationDisputeRequest = await request.json()

    // Validate required fields
    if (!body.reconciliation_id) {
      return NextResponse.json(
        { success: false, error: 'Reconciliation ID is required' },
        { status: 400 }
      )
    }

    if (!body.dispute_reason || body.dispute_reason.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Dispute reason must be at least 10 characters' },
        { status: 400 }
      )
    }

    // Verify reconciliation record belongs to this partner
    const { data: reconciliation, error: recError } = await supabase
      .from('cp_payout_reconciliation')
      .select('id, partner_id, reconciliation_status')
      .eq('id', body.reconciliation_id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (recError || !reconciliation) {
      return NextResponse.json(
        { success: false, error: 'Invalid reconciliation record' },
        { status: 400 }
      )
    }

    // Check if dispute already exists
    const { data: existingDispute } = await supabase
      .from('cp_payout_disputes')
      .select('id')
      .eq('reconciliation_id', body.reconciliation_id)
      .not('status', 'in', '("RESOLVED","REJECTED")')
      .maybeSingle()

    if (existingDispute) {
      return NextResponse.json(
        { success: false, error: 'An active dispute already exists for this payout period' },
        { status: 409 }
      )
    }

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Create dispute
    const { data: dispute, error: insertError } = await supabase
      .from('cp_payout_disputes')
      .insert({
        partner_id: partner.id,
        reconciliation_id: body.reconciliation_id,
        dispute_reason: body.dispute_reason.trim(),
        supporting_documents: body.supporting_documents || [],
        status: 'PENDING',
        raised_by: user.id,
        raised_ip: ipAddress,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating dispute:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create dispute' },
        { status: 500 }
      )
    }

    // Update reconciliation status
    await supabase
      .from('cp_payout_reconciliation')
      .update({
        dispute_id: dispute.id,
        dispute_status: 'PENDING',
        reconciliation_status: 'MISMATCH'
      })
      .eq('id', body.reconciliation_id)

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'PAYOUT_DISPUTE',
      action_description: `Raised payout dispute for reconciliation ${body.reconciliation_id}`,
      section: 'payouts',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Dispute raised successfully',
      data: {
        dispute_id: dispute.id,
        status: dispute.status
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/partners/cp/payouts/disputes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
