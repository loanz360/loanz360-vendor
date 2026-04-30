
import { NextRequest, NextResponse } from 'next/server'
import { ConvertToLeadRequest, Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'

/**
 * CONVERT Positive Contact to Lead
 *
 * Architecture: Soft-delete crm_contacts (status='converted'), INSERT into crm_leads
 * Master contact updated to track current_stage = 'lead'
 *
 * POST /api/ai-crm/cro/positive-contacts/convert-to-lead
 * Body: {
 *   positive_contact_id: string
 *   loan_purpose?: string
 *   monthly_income?: number
 *   additional_notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  // Use proper CRO auth verification
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    let body: ConvertToLeadRequest
    try {
      body = await request.json()
    } catch {
      return createErrorResponse('Invalid JSON body', 400, requestId)
    }

    const { positive_contact_id, loan_purpose, monthly_income, additional_notes } = body

    // Validate inputs
    if (!positive_contact_id) {
      return createErrorResponse('Missing positive_contact_id', 400, requestId)
    }

    // Step 1: Fetch positive contact from crm_contacts (status='positive')
    const { data: contact, error: contactError } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', positive_contact_id)
      .eq('status', 'positive')
      .or(`cro_id.eq.${user.id},assigned_to_cro.eq.${user.id}`)
      .maybeSingle()

    if (contactError || !contact) {
      return createErrorResponse('Positive contact not found or unauthorized', 404, requestId)
    }

    // Step 2: Add conversion note if additional notes provided
    let updatedNotes = (contact.notes_timeline as Note[]) || []

    if (additional_notes) {
      const manualNote: Note = {
        id: crypto.randomUUID(),
        type: 'manual_note',
        timestamp: new Date().toISOString(),
        content: additional_notes,
        is_editable: true,
        created_by: user.id,
        created_by_name: user.email || 'Unknown',
        created_at: new Date().toISOString(),
      }
      updatedNotes = [...updatedNotes, manualNote]
    }

    // Step 3: Create lead (INSERT)
    const { data: lead, error: insertError } = await supabase
      .from('crm_leads')
      .insert({
        master_contact_id: contact.master_contact_id,
        cro_id: user.id,
        contact_id: contact.id, // Keep reference for history
        customer_name: contact.name,
        phone: contact.phone,
        alternate_phone: contact.alternate_phone,
        email: contact.email,
        location: contact.location,
        loan_type: contact.loan_type || 'Business Term Loan',
        loan_amount: contact.loan_amount,
        loan_purpose: loan_purpose || `${contact.business_name || 'Business'} - ${contact.loan_type || 'General'}`,
        business_name: contact.business_name,
        business_type: contact.business_type,
        monthly_income: monthly_income,
        status: 'active',
        stage: 'new',
        call_count: contact.call_count || 0,
        last_called_at: contact.last_called_at,
        documents: [], // Start with empty documents array
        notes_timeline: updatedNotes, // Carry forward all notes
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating lead', insertError)
      return createErrorResponse('Failed to create lead', 500, requestId)
    }

    if (!lead) {
      return createErrorResponse('Lead creation returned no data', 500, requestId)
    }

    // Step 4: Soft-delete the crm_contacts record (set status='converted' + deleted_at)
    const { error: softDeleteError } = await supabase
      .from('crm_contacts')
      .update({
        status: 'converted',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', positive_contact_id)

    if (softDeleteError) {
      apiLogger.error('Error soft-deleting contact', softDeleteError)
      // Rollback: Delete the lead we just created
      await supabase.from('crm_leads').delete().eq('id', lead.id)
      return createErrorResponse('Failed to convert contact (rollback performed)', 500, requestId)
    }

    // Step 5: Update master contact
    if (contact.master_contact_id) {
      const { error: masterUpdateError } = await supabase
        .from('master_contacts')
        .update({
          current_stage: 'lead',
          is_converted_to_lead: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.master_contact_id)

      if (masterUpdateError) {
        apiLogger.error('Error updating master contact', masterUpdateError)
        // Don't rollback - the conversion was successful, just log the error
      }
    }

    // Step 6: Add system event note to track the conversion
    const systemNote: Note = {
      id: crypto.randomUUID(),
      type: 'system_event',
      timestamp: new Date().toISOString(),
      event: 'converted_to_lead',
      details: {
        from_stage: 'positive',
        to_stage: 'lead',
        converted_by: user.email || 'Unknown',
        loan_purpose,
        monthly_income,
      },
      is_editable: false,
      created_by: 'system',
      created_by_name: 'System',
      created_at: new Date().toISOString(),
    }

    // Add system note to lead
    await supabase
      .from('crm_leads')
      .update({
        notes_timeline: [...updatedNotes, systemNote],
      })
      .eq('id', lead.id)

    return NextResponse.json({
      success: true,
      data: {
        lead,
        moved_from: 'crm_contacts',
        moved_to: 'leads',
        lead_id: lead.id,
      },
      message: 'Positive contact successfully converted to Lead',
    })
  } catch (error) {
    apiLogger.error('Error in convert-to-lead API', error)
    logApiError(error as Error, request, { action: 'post', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
