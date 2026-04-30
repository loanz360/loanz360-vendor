
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConvertToDealRequest, Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { maskRecord } from '@/lib/utils/data-masking'
import { sendStageTransitionMessage } from '@/lib/automation/stage-transition-whatsapp'
import { bridgeDealToCAE } from '@/lib/automation/auto-cam-generator'
import { apiLogger } from '@/lib/utils/logger'
import { verifyCROAuth } from '@/lib/api/ai-crm-middleware'

/**
 * CONVERT Lead to Deal
 *
 * Architecture: DELETE from crm_leads, INSERT into crm_deals
 * Master contact updated to track current_stage = 'deal'
 * Assigns to BDE (auto or manual)
 *
 * POST /api/ai-crm/cro/leads/convert-to-deal
 * Body: {
 *   lead_id: string
 *   bde_id?: string  // Optional, auto-assigned if not provided
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase } = authResult.context

  try {
    const body: ConvertToDealRequest = await request.json()
    const { lead_id, bde_id, notes } = body

    // Validate inputs
    if (!lead_id) {
      return NextResponse.json(
        { success: false, error: 'Missing lead_id' },
        { status: 400 }
      )
    }

    // Step 1: Fetch lead
    const { data: lead, error: fetchError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', lead_id)
      .eq('cro_id', user.id) // Ensure CRO owns this lead
      .maybeSingle()

    if (fetchError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found or unauthorized' },
        { status: 404 }
      )
    }

    // Validate lead is ready to convert
    if (lead.stage !== 'ready_to_convert') {
      return NextResponse.json(
        {
          success: false,
          error: `Lead must be in 'ready_to_convert' stage. Current stage: ${lead.stage}`,
        },
        { status: 400 }
      )
    }

    // Step 2: Auto-assign BDE if not provided
    let assignedBdeId = bde_id

    if (!assignedBdeId) {
      // Auto-assign logic: Find least loaded BDE
      const { data: bdes } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('sub_role', 'BDE')
        .eq('is_active', true)

      if (!bdes || bdes.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active BDEs available for assignment' },
          { status: 400 }
        )
      }

      // Get BDE with least active deals
      const { data: dealCounts } = await supabase
        .from('crm_deals')
        .select('bde_id, status')
        .in('status', ['in_progress'])

      const bdeWorkload = new Map<string, number>()
      bdes.forEach((bde) => bdeWorkload.set(bde.id, 0))

      dealCounts?.forEach((deal) => {
        if (deal.bde_id && bdeWorkload.has(deal.bde_id)) {
          bdeWorkload.set(deal.bde_id, (bdeWorkload.get(deal.bde_id) || 0) + 1)
        }
      })

      // Find BDE with minimum workload
      let minWorkload = Infinity
      let selectedBde = bdes[0].id

      bdeWorkload.forEach((count, bdeId) => {
        if (count < minWorkload) {
          minWorkload = count
          selectedBde = bdeId
        }
      })

      assignedBdeId = selectedBde
    }

    // Step 3: Add conversion note if provided
    let updatedNotes = (lead.notes_timeline as Note[]) || []

    if (notes) {
      const manualNote: Note = {
        id: crypto.randomUUID(),
        type: 'manual_note',
        timestamp: new Date().toISOString(),
        content: notes,
        is_editable: true,
        created_by: user.id,
        created_by_name: user.user_metadata?.full_name || 'Unknown',
        created_at: new Date().toISOString(),
      }
      updatedNotes = [...updatedNotes, manualNote]
    }

    // NOTE: Steps 4-7 are non-atomic (no DB transaction wrapper available via Supabase JS client).
    // If step 5 (delete lead) fails, we rollback step 4 (delete created deal).
    // If step 6 (update master contact) fails, we proceed anyway since the core conversion succeeded.
    // For true atomicity, consider migrating to an RPC function that wraps all steps in a transaction.

    // Step 4: Create deal (INSERT)
    const { data: deal, error: insertError } = await supabase
      .from('crm_deals')
      .insert({
        master_contact_id: lead.master_contact_id,
        lead_id: lead.id, // Keep reference for history
        cro_id: user.id, // Original CRO
        bde_id: assignedBdeId,
        customer_name: lead.customer_name,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        loan_type: lead.loan_type,
        loan_amount: lead.loan_amount,
        loan_purpose: lead.loan_purpose,
        business_name: lead.business_name,
        stage: 'docs_collected',
        status: 'in_progress',
        documents: lead.documents || [], // Carry forward documents
        notes_timeline: updatedNotes, // Carry forward all notes
        assigned_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating deal:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create deal' },
        { status: 500 }
      )
    }

    // Step 5: Delete from crm_leads (MOVE logic)
    const { error: deleteError } = await supabase
      .from('crm_leads')
      .delete()
      .eq('id', lead_id)

    if (deleteError) {
      apiLogger.error('Error deleting lead:', deleteError)
      // Rollback: Delete the deal we just created
      await supabase.from('crm_deals').delete().eq('id', deal.id)
      return NextResponse.json(
        { success: false, error: 'Failed to convert lead (rollback performed)' },
        { status: 500 }
      )
    }

    // Step 6: Update master contact
    const { error: masterUpdateError } = await supabase
      .from('master_contacts')
      .update({
        current_stage: 'deal',
        is_converted_to_deal: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.master_contact_id)

    if (masterUpdateError) {
      apiLogger.error('Error updating master contact:', masterUpdateError)
      // Don't rollback - the conversion was successful, just log the error
    }

    // Step 7: Add system event note to track the conversion
    const systemNote: Note = {
      id: crypto.randomUUID(),
      type: 'system_event',
      timestamp: new Date().toISOString(),
      event: 'converted_to_deal',
      details: {
        from_stage: 'lead',
        to_stage: 'deal',
        converted_by: user.user_metadata?.full_name || 'Unknown',
        assigned_to_bde: assignedBdeId,
        auto_assigned: !bde_id,
      },
      is_editable: false,
      created_by: 'system',
      created_by_name: 'System',
      created_at: new Date().toISOString(),
    }

    // Add system note to deal
    await supabase
      .from('crm_deals')
      .update({
        notes_timeline: [...updatedNotes, systemNote],
      })
      .eq('id', deal.id)

    // Step 8: Get BDE details for response
    const { data: bdeInfo } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', assignedBdeId)
      .maybeSingle()

    // Fire-and-forget: Auto-WhatsApp on lead → deal transition
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.loanz360.com'
    const authCookie = request.headers.get('cookie') || ''

    if (lead.phone) {
      sendStageTransitionMessage('lead_to_deal', {
        customerPhone: lead.phone,
        customerName: lead.customer_name,
        loanType: lead.loan_type,
        loanAmount: lead.loan_amount,
        croId: user.id,
        baseUrl,
        authCookie,
      }).catch(() => { /* Non-critical side effect */ })
    }

    // Fire-and-forget: Bridge deal to existing Credit Appraiser Engine (CAE)
    bridgeDealToCAE({
      dealId: deal.id,
      croUserId: user.id,
      bdeUserId: assignedBdeId,
      authCookie,
      baseUrl,
    }
    ).catch(() => { /* Non-critical side effect */ })

    return NextResponse.json({
      success: true,
      data: {
        deal: maskRecord(deal as Record<string, unknown>),
        moved_from: 'leads',
        moved_to: 'deals',
        deal_id: deal.id,
        assigned_bde: bdeInfo || { id: assignedBdeId },
        auto_assigned: !bde_id,
      },
      message: `Lead successfully converted to Deal and assigned to ${bdeInfo?.full_name || 'BDE'}`,
    })
  } catch (error) {
    apiLogger.error('Error in convert-to-deal API:', error)
    logApiError(error as Error, request, { action: 'convert_to_deal' })
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during conversion. Please try again.',
      },
      { status: 500 }
    )
  }
}
