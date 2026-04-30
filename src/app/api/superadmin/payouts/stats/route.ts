/**
 * API Route: Payout Statistics
 * GET /api/superadmin/payouts/stats
 * Returns real-time statistics for payout management
 * Used for sidebar badge counts and dashboard widgets
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export const revalidate = 0 // No caching, always fresh

export interface PayoutStatsResponse {
  success: boolean
  data?: {
    pending_commissions: {
      total: number
      ba: number
      bp: number
      total_amount: number
      ba_amount: number
      bp_amount: number
    }
    pending_batches: {
      total: number
      total_amount: number
    }
    approved_batches: {
      total: number
      total_amount: number
    }
    total_pending_actions: number // For sidebar badge
  }
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()

    // 1. Authenticate and verify superadmin role
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' } as PayoutStatsResponse,
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' } as PayoutStatsResponse,
        { status: 403 }
      )
    }

    // 2. Get pending commissions count and amount
    const { data: pendingCommissions, error: commissionsError } = await supabase
      .from('leads')
      .select('partner_type, commission_amount')
      .eq('commission_status', 'CALCULATED')
      .not('commission_amount', 'is', null)

    if (commissionsError) {
      apiLogger.error('Error fetching pending commissions', commissionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch statistics' } as PayoutStatsResponse,
        { status: 500 }
      )
    }

    // Calculate commission statistics
    const totalCommissions = pendingCommissions?.length || 0
    const baCommissions = pendingCommissions?.filter(c => c.partner_type === 'BUSINESS_ASSOCIATE') || []
    const bpCommissions = pendingCommissions?.filter(c => c.partner_type === 'BUSINESS_PARTNER') || []

    const totalAmount = pendingCommissions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0
    const baAmount = baCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    const bpAmount = bpCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    // 3. Get pending batches count and amount
    const { data: pendingBatches, error: pendingBatchesError } = await supabase
      .from('payout_batches')
      .select('total_amount')
      .eq('status', 'PENDING')

    if (pendingBatchesError) {
      apiLogger.error('Error fetching pending batches', pendingBatchesError)
    }

    const pendingBatchCount = pendingBatches?.length || 0
    const pendingBatchAmount = pendingBatches?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

    // 4. Get approved batches count and amount (waiting for payment)
    const { data: approvedBatches, error: approvedBatchesError } = await supabase
      .from('payout_batches')
      .select('total_amount')
      .eq('status', 'APPROVED')

    if (approvedBatchesError) {
      apiLogger.error('Error fetching approved batches', approvedBatchesError)
    }

    const approvedBatchCount = approvedBatches?.length || 0
    const approvedBatchAmount = approvedBatches?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

    // 5. Calculate total pending actions (for sidebar badge)
    // Pending actions = pending commissions + pending batches + approved batches
    const totalPendingActions = totalCommissions + pendingBatchCount + approvedBatchCount

    // 6. Return statistics
    return NextResponse.json({
      success: true,
      data: {
        pending_commissions: {
          total: totalCommissions,
          ba: baCommissions.length,
          bp: bpCommissions.length,
          total_amount: totalAmount,
          ba_amount: baAmount,
          bp_amount: bpAmount
        },
        pending_batches: {
          total: pendingBatchCount,
          total_amount: pendingBatchAmount
        },
        approved_batches: {
          total: approvedBatchCount,
          total_amount: approvedBatchAmount
        },
        total_pending_actions: totalPendingActions
      }
    } as PayoutStatsResponse)

  } catch (error) {
    apiLogger.error('Get payout stats error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      } as PayoutStatsResponse,
      { status: 500 }
    )
  }
}
