/**
 * Super Admin Lead Detail API
 * Fetches complete lead information including referral history, status history, documents, and notes
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getLeadDetailHandler(req, params.leadId)
  })
}

async function getLeadDetailHandler(request: NextRequest, leadId: string) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION (UNIFIED)
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Super Admin access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // =====================================================
    // 2. FETCH LEAD DETAILS
    // =====================================================

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_id,
        loan_type,
        loan_amount,
        loan_purpose,
        lead_status,
        form_status,
        progress_percentage,
        created_at,
        updated_at,
        referral_id,
        partner_type,
        assigned_bde_id
      `)
      .eq('id', leadId)
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

    // =====================================================
    // 3. FETCH CUSTOMER DETAILS
    // =====================================================

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('customer_id, name, phone, email, subrole')
      .eq('id', lead.customer_id)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found',
        },
        { status: 404 }
      )
    }

    // =====================================================
    // 4. FETCH CURRENT REFERRAL DETAILS
    // =====================================================

    let currentReferralName = 'LOANZ360 (Direct)'
    let currentReferralType = 'CUSTOMER'

    if (lead.referral_id && lead.referral_id !== 'LOANZ360') {
      if (lead.partner_type === 'BP') {
        const { data: bpData } = await supabase
          .from('business_partner')
          .select('name')
          .eq('referral_id', lead.referral_id)
          .maybeSingle()

        if (bpData) {
          currentReferralName = bpData.name
          currentReferralType = 'BP'
        }
      } else if (lead.partner_type === 'CP') {
        const { data: cpData } = await supabase
          .from('channel_partner')
          .select('name')
          .eq('referral_id', lead.referral_id)
          .maybeSingle()

        if (cpData) {
          currentReferralName = cpData.name
          currentReferralType = 'CP'
        }
      } else if (lead.partner_type === 'EMPLOYEE') {
        const { data: empData } = await supabase
          .from('employee_profile')
          .select('name')
          .eq('employee_id', lead.referral_id)
          .maybeSingle()

        if (empData) {
          currentReferralName = empData.name
          currentReferralType = 'EMPLOYEE'
        }
      }
    }

    // =====================================================
    // 5. FETCH ASSIGNED BDE NAME
    // =====================================================

    let assignedBdeName: string | null = null
    if (lead.assigned_bde_id) {
      const { data: bdeData } = await supabase
        .from('employee_profile')
        .select('name')
        .eq('id', lead.assigned_bde_id)
        .maybeSingle()

      if (bdeData) {
        assignedBdeName = bdeData.name
      }
    }

    // =====================================================
    // 6. FETCH REFERRAL CHANGE HISTORY
    // =====================================================

    const { data: referralHistory, error: refHistoryError } = await supabase
      .from('referral_change_history')
      .select('*')
      .eq('lead_id', leadId)
      .order('changed_at', { ascending: false })

    // Get referral names for history (OPTIMIZED - BATCH QUERIES)
    let referralHistoryWithNames: unknown[] = []

    if (referralHistory && referralHistory.length > 0) {
      // Collect all unique referral IDs by type for batch fetching
      const oldReferralIds: Record<string, Set<string>> = { BP: new Set(), CP: new Set(), EMPLOYEE: new Set() }
      const newReferralIds: Record<string, Set<string>> = { BP: new Set(), CP: new Set(), EMPLOYEE: new Set() }

      referralHistory.forEach(change => {
        if (change.old_referral_id && change.old_referral_id !== 'LOANZ360' && change.old_referral_type) {
          oldReferralIds[change.old_referral_type]?.add(change.old_referral_id)
        }
        if (change.new_referral_id && change.new_referral_id !== 'LOANZ360' && change.new_referral_type) {
          newReferralIds[change.new_referral_type]?.add(change.new_referral_id)
        }
      })

      // Batch fetch all referral names
      const referralNamesMap: Record<string, string> = {}

      // Fetch BP names
      const allBPIds = new Set([...oldReferralIds.BP, ...newReferralIds.BP])
      if (allBPIds.size > 0) {
        const { data: bpData } = await supabase
          .from('business_partner')
          .select('referral_id, name')
          .in('referral_id', Array.from(allBPIds))

        if (bpData) {
          bpData.forEach(bp => { referralNamesMap[bp.referral_id] = bp.name })
        }
      }

      // Fetch CP names
      const allCPIds = new Set([...oldReferralIds.CP, ...newReferralIds.CP])
      if (allCPIds.size > 0) {
        const { data: cpData } = await supabase
          .from('channel_partner')
          .select('referral_id, name')
          .in('referral_id', Array.from(allCPIds))

        if (cpData) {
          cpData.forEach(cp => { referralNamesMap[cp.referral_id] = cp.name })
        }
      }

      // Fetch Employee names
      const allEmpIds = new Set([...oldReferralIds.EMPLOYEE, ...newReferralIds.EMPLOYEE])
      if (allEmpIds.size > 0) {
        const { data: empData } = await supabase
          .from('employee_profile')
          .select('employee_id, name')
          .in('employee_id', Array.from(allEmpIds))

        if (empData) {
          empData.forEach(emp => { referralNamesMap[emp.employee_id] = emp.name })
        }
      }

      // Map names to history records
      referralHistoryWithNames = referralHistory.map(change => ({
        id: change.id,
        old_referral_id: change.old_referral_id,
        old_referral_name: change.old_referral_id && change.old_referral_id !== 'LOANZ360'
          ? referralNamesMap[change.old_referral_id] || 'LOANZ360 (Direct)'
          : 'LOANZ360 (Direct)',
        old_referral_type: change.old_referral_type,
        new_referral_id: change.new_referral_id,
        new_referral_name: change.new_referral_id && change.new_referral_id !== 'LOANZ360'
          ? referralNamesMap[change.new_referral_id] || 'LOANZ360 (Direct)'
          : 'LOANZ360 (Direct)',
        new_referral_type: change.new_referral_type,
        reason: change.reason,
        admin_notes: change.admin_notes,
        changed_by_name: change.changed_by_name,
        changed_at: change.changed_at,
      }))
    }

    // =====================================================
    // 7. FETCH STATUS HISTORY
    // =====================================================

    const { data: statusHistory, error: statusHistoryError } = await supabase
      .from('lead_status_history')
      .select('id, old_status, new_status, notes, changed_by_name, changed_at')
      .eq('lead_id', leadId)
      .order('changed_at', { ascending: false })

    // =====================================================
    // 8. FETCH DOCUMENTS
    // =====================================================

    const { data: documents, error: documentsError } = await supabase
      .from('lead_documents')
      .select('id, document_type, document_name, uploaded_at, status')
      .eq('lead_id', leadId)
      .order('uploaded_at', { ascending: false })

    // =====================================================
    // 9. FETCH NOTES
    // =====================================================

    const { data: notes, error: notesError } = await supabase
      .from('lead_notes')
      .select('id, note_text, created_by_name, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    // =====================================================
    // 10. RETURN COMPLETE LEAD DETAILS
    // =====================================================

    return NextResponse.json({
      success: true,
      lead: {
        id: lead.id,
        lead_id: lead.lead_id,
        customer_id: customer.customer_id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        customer_subrole: customer.subrole,
        loan_type: lead.loan_type,
        loan_amount: lead.loan_amount,
        loan_purpose: lead.loan_purpose,
        status: lead.lead_status,
        form_status: lead.form_status,
        progress_percentage: lead.progress_percentage || 0,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        current_referral_id: lead.referral_id,
        current_referral_name: currentReferralName,
        current_referral_type: currentReferralType,
        assigned_bde_id: lead.assigned_bde_id,
        assigned_bde_name: assignedBdeName,
      },
      referral_history: referralHistoryWithNames,
      status_history: statusHistory || [],
      documents: documents || [],
      notes: notes || [],
    })
  } catch (error) {
    apiLogger.error('Lead Detail API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
