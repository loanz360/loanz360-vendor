export const dynamic = 'force-dynamic'

/**
 * API Route: Mark Payout Batch as Paid
 * PUT /api/superadmin/payouts/batches/[id]/paid
 * Marks batch as paid and updates all associated leads
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createInAppNotification } from '@/lib/notifications/notification-service'
import { apiLogger } from '@/lib/utils/logger'

export interface MarkPaidRequest {
  payment_date?: string
  payment_reference?: string
  remarks?: string
}

export interface MarkPaidResponse {
  success: boolean
  data?: {
    batch_id: string
    paid_at: string
    leads_updated: number
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
        { success: false, error: 'Unauthorized' } as MarkPaidResponse,
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
        { success: false, error: 'Unauthorized - Superadmin access required' } as MarkPaidResponse,
        { status: 403 }
      )
    }

    // 3. Parse request body
    const body: MarkPaidRequest = await request.json()
    const payment_date = body.payment_date || new Date().toISOString().split('T')[0]
    const payment_reference = body.payment_reference
    const remarks = body.remarks

    // 4. Verify batch exists and is APPROVED
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .select('id, status')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' } as MarkPaidResponse,
        { status: 404 }
      )
    }

    if (batch.status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: `Batch must be APPROVED before marking as PAID (current status: ${batch.status})` } as MarkPaidResponse,
        { status: 400 }
      )
    }

    // 5. Update batch status to PAID
    const now = new Date().toISOString()
    const { error: updateBatchError } = await supabase
      .from('payout_batches')
      .update({
        status: 'PAID',
        paid_at: now,
        payment_date,
        payment_reference,
        remarks: remarks || batch.status,
      })
      .eq('id', batchId)

    if (updateBatchError) {
      apiLogger.error('Error marking batch as paid', updateBatchError)
      return NextResponse.json(
        { success: false, error: 'Failed to update batch' } as MarkPaidResponse,
        { status: 500 }
      )
    }

    // 6. Update all leads in this batch to PAID status
    const { data: updatedLeads, error: updateLeadsError } = await supabase
      .from('leads')
      .update({
        commission_status: 'PAID',
        commission_paid_at: now,
        payout_remarks: remarks || `Paid via batch on ${payment_date}`,
      })
      .eq('payout_batch_id', batchId)
      .select('id')

    if (updateLeadsError) {
      apiLogger.error('Error updating leads', updateLeadsError)
      return NextResponse.json(
        { success: false, error: 'Failed to update leads' } as MarkPaidResponse,
        { status: 500 }
      )
    }

    // 7. Send commission paid notifications to partners (non-blocking)
    if (updatedLeads && updatedLeads.length > 0) {
      const { data: paidLeads } = await supabase
        .from('leads')
        .select('id, partner_id')
        .in('id', updatedLeads.map(l => l.id))

      if (paidLeads) {
        const uniquePartnerIds = [...new Set(paidLeads.map(l => l.partner_id).filter(Boolean))]
        // Look up partner types to route to correct portal URLs
        const { data: partnerTypes } = await supabase
          .from('partners')
          .select('id, partner_type')
          .in('id', uniquePartnerIds as string[])

        const partnerTypeMap = new Map(partnerTypes?.map(p => [p.id, p.partner_type]) || [])
        const typeToPath: Record<string, string> = {
          'BUSINESS_ASSOCIATE': '/partners/ba/commissions',
          'BUSINESS_PARTNER': '/partners/bp/commissions',
          'CHANNEL_PARTNER': '/partners/cp/payout-status',
        }

        for (const partnerId of uniquePartnerIds) {
          const pType = partnerTypeMap.get(partnerId as string) || 'BUSINESS_ASSOCIATE'
          createInAppNotification({
            adminId: partnerId as string,
            type: 'success',
            category: 'payouts',
            title: 'Commission Paid!',
            message: `Your commission payment has been processed${payment_reference ? ` (Ref: ${payment_reference})` : ''}. Check your bank account.`,
            actionUrl: typeToPath[pType] || '/partners/ba/commissions',
            actionLabel: 'View History',
            icon: '🎉',
            metadata: { batch_id: batchId, payment_reference },
          }).catch(error => {
            apiLogger.error('Failed to send commission paid notification', error)
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        batch_id: batchId,
        paid_at: now,
        leads_updated: updatedLeads?.length || 0,
      },
    } as MarkPaidResponse)
  } catch (error) {
    apiLogger.error('Mark paid error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as MarkPaidResponse,
      { status: 500 }
    )
  }
}
