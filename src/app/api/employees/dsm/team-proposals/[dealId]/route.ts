import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

// Helper function to verify DSM role
async function verifyDSMRole(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { isValid: false, error: 'User profile not found' }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') {
    return { isValid: false, error: 'Access denied. This feature is only available for Direct Sales Managers.' }
  }

  return { isValid: true, profile }
}

/**
 * GET - Get detailed proposal (deal) information for team member's proposals
 * DSM can view proposals from any of their team member DSEs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { dealId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSM role
    const roleCheck = await verifyDSMRole(supabase, user.id)
    if (!roleCheck.isValid) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Fetch the deal
    const { data: deal, error: dealError } = await supabase
      .from('crm_deals')
      .select(`
        id,
        lead_id,
        bde_id,
        cro_id,
        customer_name,
        phone,
        email,
        location,
        loan_type,
        loan_amount,
        loan_purpose,
        business_name,
        stage,
        status,
        documents,
        notes,
        daily_updates,
        assigned_at,
        last_updated_by_bde_at,
        sanctioned_at,
        disbursed_at,
        dropped_at,
        drop_reason,
        sanctioned_amount,
        disbursed_amount,
        source_type,
        source_employee_id,
        source_lead_type,
        dse_lead_id,
        created_at,
        updated_at
      `)
      .eq('id', dealId)
      .maybeSingle()

    if (dealError) {
      apiLogger.error('Error fetching deal', dealError)
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 })
    }

    // Verify that the deal source is a DSE who reports to this DSM
    if (deal.source_type !== 'dse') {
      return NextResponse.json(
        { success: false, error: 'Access denied. This is not a DSE proposal.' },
        { status: 403 }
      )
    }

    // Check if the DSE who created this proposal reports to the current DSM
    const { data: dseProfile } = await supabase
      .from('profiles')
      .select('reporting_manager_id')
      .eq('user_id', deal.source_employee_id)
      .maybeSingle()

    if (!dseProfile || dseProfile.reporting_manager_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only view proposals from your team members.' },
        { status: 403 }
      )
    }

    // Fetch DSE info (proposal originator)
    let dseName = 'Unknown DSE'
    let dseEmail = ''
    if (deal.source_employee_id) {
      const { data: dse } = await supabase
        .from('users')
        .select('full_name, email, phone')
        .eq('id', deal.source_employee_id)
        .maybeSingle()

      if (dse) {
        dseName = dse.full_name || 'Unknown DSE'
        dseEmail = dse.email || ''
      }
    }

    // Fetch BDE info
    let bdeName = 'Not Assigned'
    if (deal.bde_id) {
      const { data: bde } = await supabase
        .from('users')
        .select('full_name, email, phone')
        .eq('id', deal.bde_id)
        .maybeSingle()

      if (bde) {
        bdeName = bde.full_name
      }
    }

    // Fetch all updates for this deal
    const { data: updates, error: updatesError } = await supabase
      .from('deal_updates')
      .select(`
        id,
        bde_id,
        stage_at_update,
        status_at_update,
        stage_changed_to,
        status_changed_to,
        notes_original,
        notes_translated,
        original_language,
        target_language,
        activity_type,
        activity_description,
        interaction_with,
        interaction_mode,
        interaction_summary,
        customer_response,
        banker_feedback,
        pending_items,
        next_action,
        next_action_date,
        attachments,
        update_source,
        is_overdue,
        hours_since_last_update,
        created_at
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (updatesError) {
      apiLogger.error('Error fetching updates', updatesError)
    }

    // Fetch BDE names for updates
    const bdeIdsInUpdates = [...new Set(updates?.map(u => u.bde_id) || [])]
    let bdeMapForUpdates: Record<string, string> = {}
    if (bdeIdsInUpdates.length > 0) {
      const { data: bdes } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', bdeIdsInUpdates)

      if (bdes) {
        bdeMapForUpdates = bdes.reduce((acc, bde) => {
          acc[bde.id] = bde.full_name
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Fetch stage history
    const { data: stageHistory, error: historyError } = await supabase
      .from('deal_stage_history')
      .select(`
        id,
        from_stage,
        to_stage,
        from_status,
        to_status,
        changed_by,
        changed_by_name,
        change_reason,
        update_id,
        notes,
        created_at
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (historyError) {
      apiLogger.error('Error fetching stage history', historyError)
    }

    // Fetch original DSE lead info if available
    let dseLeadInfo = null
    if (deal.dse_lead_id) {
      const { data: dseLead } = await supabase
        .from('dse_leads')
        .select(`
          id,
          lead_id,
          customer_id,
          stage,
          status,
          converted_to_deal,
          converted_to_deal_at,
          created_at
        `)
        .eq('id', deal.dse_lead_id)
        .maybeSingle()

      if (dseLead) {
        dseLeadInfo = dseLead
      }
    }

    // Calculate statistics
    const assignedAt = deal.assigned_at ? new Date(deal.assigned_at) : null
    const lastUpdateAt = deal.last_updated_by_bde_at ? new Date(deal.last_updated_by_bde_at) : null
    const now = new Date()

    const daysSinceAssignment = assignedAt
      ? Math.floor((now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    let isOverdue = false
    if (deal.status === 'in_progress') {
      const lastActivity = lastUpdateAt || assignedAt
      if (lastActivity) {
        const hoursSinceUpdate = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)
        isOverdue = hoursSinceUpdate > 3
      }
    }

    // Transform updates with BDE names
    const formattedUpdates = updates?.map(update => ({
      ...update,
      bde_name: bdeMapForUpdates[update.bde_id] || 'Unknown'
    })) || []

    // Build response
    const proposalDetail = {
      deal_id: deal.id,
      customer_name: deal.customer_name,
      phone: deal.phone,
      email: deal.email,
      location: deal.location,
      loan_type: deal.loan_type,
      loan_amount: deal.loan_amount,
      loan_purpose: deal.loan_purpose,
      business_name: deal.business_name,
      current_stage: deal.stage,
      current_status: deal.status,
      bde_id: deal.bde_id,
      bde_name: bdeName,
      source_employee_id: deal.source_employee_id,
      dse_name: dseName,
      dse_email: dseEmail,
      assigned_at: deal.assigned_at,
      last_update_at: deal.last_updated_by_bde_at,
      last_update_notes: formattedUpdates[0]?.notes_original || null,
      last_update_stage: formattedUpdates[0]?.stage_at_update || null,
      sanctioned_amount: deal.sanctioned_amount,
      disbursed_amount: deal.disbursed_amount,
      documents: deal.documents || [],
      total_updates: updates?.length || 0,
      days_since_assignment: daysSinceAssignment,
      is_overdue: isOverdue,
      source_lead_type: deal.source_lead_type,
      dse_lead_id: deal.dse_lead_id,
      dse_lead_info: dseLeadInfo,
      updates: formattedUpdates,
      stage_history: stageHistory || [],
      created_at: deal.created_at,
      updated_at: deal.updated_at,
      sanctioned_at: deal.sanctioned_at,
      disbursed_at: deal.disbursed_at,
      dropped_at: deal.dropped_at,
      drop_reason: deal.drop_reason
    }

    return NextResponse.json({
      success: true,
      data: proposalDetail
    })

  } catch (error) {
    apiLogger.error('Error in DSM team proposal detail GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
