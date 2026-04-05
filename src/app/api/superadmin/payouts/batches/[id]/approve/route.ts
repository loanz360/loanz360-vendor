export const dynamic = 'force-dynamic'

/**
 * API Route: Approve Payout Batch
 * PUT /api/superadmin/payouts/batches/[id]/approve
 * Approves a batch for payment processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export interface ApproveBatchResponse {
  success: boolean
  data?: {
    batch_id: string
    approved_at: string
  }
  error?: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: batchId } = await params

    // 1. Authenticate superadmin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApproveBatchResponse,
        { status: 401 }
      )
    }

    // 2. Verify superadmin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Superadmin access required' } as ApproveBatchResponse,
        { status: 403 }
      )
    }

    // 3. Verify batch exists and is in PENDING status
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .select('id, status')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' } as ApproveBatchResponse,
        { status: 404 }
      )
    }

    if (batch.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Batch is already ${batch.status}` } as ApproveBatchResponse,
        { status: 400 }
      )
    }

    // 4. Update batch status to APPROVED
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('payout_batches')
      .update({
        status: 'APPROVED',
        approved_by: user.id,
        approved_at: now,
      })
      .eq('id', batchId)

    if (updateError) {
      apiLogger.error('Error approving batch', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to approve batch' } as ApproveBatchResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batchId,
        approved_at: now,
      },
    } as ApproveBatchResponse)
  } catch (error) {
    apiLogger.error('Approve batch error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ApproveBatchResponse,
      { status: 500 }
    )
  }
}
