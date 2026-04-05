export const dynamic = 'force-dynamic'

/**
 * API Route: Reject Commission
 * PUT /api/superadmin/payouts/leads/[id]/reject
 * Rejects a pending commission with reason
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export interface RejectCommissionRequest {
  rejection_reason: string
  notify_partner?: boolean
}

export interface RejectCommissionResponse {
  success: boolean
  data?: {
    lead_id: string
    rejected_at: string
    rejection_reason: string
  }
  error?: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseAdmin()
    const { id: leadId } = await params

    // 1. Authenticate and verify superadmin role
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' } as RejectCommissionResponse,
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' } as RejectCommissionResponse,
        { status: 403 }
      )
    }

    // 2. Parse request body
    const body: RejectCommissionRequest = await request.json()
    const { rejection_reason, notify_partner = false } = body

    if (!rejection_reason || rejection_reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' } as RejectCommissionResponse,
        { status: 400 }
      )
    }

    if (rejection_reason.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason must be less than 1000 characters' } as RejectCommissionResponse,
        { status: 400 }
      )
    }

    // 3. Verify lead exists and is in correct status
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_id, partner_id, commission_status, commission_amount, partner_type')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' } as RejectCommissionResponse,
        { status: 404 }
      )
    }

    // Only CALCULATED commissions can be rejected
    if (lead.commission_status !== 'CALCULATED') {
      return NextResponse.json(
        {
          success: false,
          error: `Commission cannot be rejected. Current status: ${lead.commission_status}. Only CALCULATED commissions can be rejected.`
        } as RejectCommissionResponse,
        { status: 400 }
      )
    }

    // 4. Update lead with rejection
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        commission_status: 'REJECTED_BY_ADMIN',
        payout_remarks: rejection_reason,
        updated_at: now
      })
      .eq('id', leadId)

    if (updateError) {
      apiLogger.error('Error rejecting commission', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to reject commission' } as RejectCommissionResponse,
        { status: 500 }
      )
    }

    // 5. Log audit trail (if audit system exists)
    try {
      // Check if audit_logs table exists
      const { error: auditCheckError } = await supabase
        .from('audit_logs')
        .select('id')
        .limit(1)

      if (!auditCheckError) {
        // Audit table exists, log the rejection
        await supabase
          .from('audit_logs')
          .insert({
            user_id: auth.userId,
            action: 'COMMISSION_REJECTED',
            resource_type: 'leads',
            resource_id: leadId,
            details: {
              lead_id: lead.lead_id,
              partner_id: lead.partner_id,
              partner_type: lead.partner_type,
              commission_amount: lead.commission_amount,
              rejection_reason: rejection_reason,
              rejected_by: auth.userId
            },
            ip_address: request.headers.get('x-forwarded-for') ||
                       request.headers.get('x-real-ip') ||
                       'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown'
          })
      }
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      apiLogger.error('Audit logging failed', auditError)
    }

    // 6. TODO: Send notification to partner (if notify_partner is true)
    if (notify_partner) {
      try {
        // This will be implemented when notification system is ready
        // For now, we'll just log it

        // Future implementation:
        // await sendPartnerNotification({
        //   partner_id: lead.partner_id,
        //   type: 'COMMISSION_REJECTED',
        //   title: 'Commission Rejected',
        //   message: `Your commission for lead ${lead.lead_id} has been rejected. Reason: ${rejection_reason}`,
        //   channels: ['email', 'in_app']
        // })
      } catch (notificationError) {
        // Don't fail the request if notification fails
        apiLogger.error('Partner notification failed', notificationError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lead_id: leadId,
        rejected_at: now,
        rejection_reason: rejection_reason
      }
    } as RejectCommissionResponse)

  } catch (error) {
    apiLogger.error('Reject commission error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      } as RejectCommissionResponse,
      { status: 500 }
    )
  }
}
