/**
 * Change Referrer API for Super Admin
 * Allows Super Admin to change the referral for any lead
 *
 * Rate Limit: 30 requests per minute (write operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


interface ChangeReferrerRequest {
  lead_id: string // UUID of the lead
  new_referral_id: string // New referral ID (can be 'LOANZ360' for direct)
  new_referral_type: 'BP' | 'CP' | 'EMPLOYEE' | 'CUSTOMER'
  reason: string // Required reason for change
  admin_notes?: string // Optional admin notes
}

export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await changeReferrerHandler(req)
  })
}

async function changeReferrerHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY SUPER ADMIN AUTHENTICATION (FIXED: Unified Auth)
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Authentication required',
        },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Super Admin access required.',
        },
        { status: 403 }
      )
    }

    const adminId = auth.userId!
    const supabase = createSupabaseAdmin()

    // Get admin name
    const { data: adminData } = await supabase
      .from('employee_profile')
      .select('name')
      .eq('user_id', adminId)
      .maybeSingle()

    const adminName = adminData?.name || 'Super Admin'

    // =====================================================
    // 2. VALIDATE REQUEST DATA
    // =====================================================

    const body: ChangeReferrerRequest = await request.json()

    if (!body.lead_id || !body.new_referral_id || !body.new_referral_type || !body.reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: lead_id, new_referral_id, new_referral_type, reason',
        },
        { status: 400 }
      )
    }

    if (body.reason.trim().length < 20) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reason must be at least 20 characters long',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 3. FETCH CURRENT LEAD DATA
    // =====================================================

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_id,
        customer_customer_id,
        customer_name,
        referral_id,
        partner_type,
        loan_type,
        loan_amount,
        lead_status
      `)
      .eq('id', body.lead_id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lead not found',
        },
        { status: 404 }
      )
    }

    // Check if already has the same referral
    if (lead.referral_id === body.new_referral_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lead already assigned to this referral',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 4. VALIDATE NEW REFERRAL EXISTS (if not LOANZ360)
    // =====================================================

    let newReferralName = 'LOANZ360 Direct'

    if (body.new_referral_id !== 'LOANZ360') {
      // Check if new referral exists and is active
      let referralData: any = null

      if (body.new_referral_type === 'EMPLOYEE') {
        const { data } = await supabase
          .from('employee_profile')
          .select('name, is_active, employee_id')
          .eq('employee_id', body.new_referral_id)
          .maybeSingle()

        if (!data || !data.is_active) {
          return NextResponse.json(
            {
              success: false,
              error: 'Employee referral not found or inactive',
            },
            { status: 400 }
          )
        }

        referralData = data
        newReferralName = data.name
      }
      // Add BP/CP validation here when tables exist
    }

    // =====================================================
    // 5. GET OLD REFERRAL NAME
    // =====================================================

    let oldReferralName = 'LOANZ360 Direct'

    if (lead.referral_id && lead.referral_id !== 'LOANZ360') {
      if (lead.partner_type === 'EMPLOYEE') {
        const { data: oldRef } = await supabase
          .from('employee_profile')
          .select('name')
          .eq('employee_id', lead.referral_id)
          .maybeSingle()

        if (oldRef) {
          oldReferralName = oldRef.name
        }
      }
    }

    // =====================================================
    // 6. UPDATE LEAD REFERRAL
    // =====================================================

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        referral_id: body.new_referral_id,
        partner_type: body.new_referral_type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.lead_id)

    if (updateError) {
      apiLogger.error('Lead update error', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update lead referral',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 7. LOG TO REFERRAL_CHANGE_HISTORY
    // =====================================================

    const { error: historyError } = await supabase
      .from('referral_change_history')
      .insert({
        lead_id: body.lead_id,
        customer_id: lead.customer_id,
        old_referral_id: lead.referral_id || null,
        new_referral_id: body.new_referral_id,
        old_referral_type: lead.partner_type || null,
        new_referral_type: body.new_referral_type,
        old_referral_name: oldReferralName,
        new_referral_name: newReferralName,
        changed_by: adminId,
        changed_by_name: adminName,
        changed_by_role: 'SUPER_ADMIN',
        reason: body.reason.trim(),
        admin_notes: body.admin_notes?.trim() || null,
        changed_at: new Date().toISOString(),
      })

    if (historyError) {
      apiLogger.error('History insert error', historyError)
      // Don't fail the request if history logging fails
    }

    // =====================================================
    // 8. CREATE STATUS HISTORY ENTRY
    // =====================================================

    const { error: statusHistoryError } = await supabase
      .from('status_history')
      .insert({
        lead_id: body.lead_id,
        status_type: 'LEAD_STATUS',
        from_status: lead.lead_status,
        to_status: lead.lead_status, // Status doesn't change, just referral
        changed_by_id: adminId,
        changed_by_name: adminName,
        changed_by_role: 'SUPER_ADMIN',
        reason: `Referral changed from ${oldReferralName} to ${newReferralName}. Reason: ${body.reason}`,
        change_metadata: {
          change_type: 'REFERRAL_CHANGE',
          old_referral_id: lead.referral_id,
          new_referral_id: body.new_referral_id,
          old_referral_name: oldReferralName,
          new_referral_name: newReferralName,
        },
      })

    if (statusHistoryError) {
      apiLogger.error('Status history error', statusHistoryError)
      // Don't fail the request
    }

    // =====================================================
    // 9. RETURN SUCCESS RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      message: 'Referral changed successfully',
      lead_id: lead.lead_id,
      customer_id: lead.customer_customer_id,
      customer_name: lead.customer_name,
      old_referral: {
        id: lead.referral_id,
        name: oldReferralName,
      },
      new_referral: {
        id: body.new_referral_id,
        name: newReferralName,
      },
      changed_by: adminName,
      changed_at: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Change Referrer API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
