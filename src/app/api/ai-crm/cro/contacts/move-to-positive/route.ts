
import { NextRequest, NextResponse } from 'next/server'
import { MoveToPositiveRequest, Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { verifyCROAuth } from '@/lib/api/ai-crm-middleware'

/**
 * MOVE Contact to Positive Contacts
 *
 * Architecture: DELETE from crm_contacts, INSERT into positive_contacts
 * Master contact updated to track current_stage = 'positive'
 *
 * POST /api/ai-crm/cro/contacts/move-to-positive
 * Body: {
 *   contact_id: string
 *   ai_analysis?: AIAnalysis (optional for manual moves)
 *   cro_approved: boolean
 *   manual_move?: boolean
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
    // Parse body with try-catch for malformed JSON
    let body: MoveToPositiveRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { contact_id, ai_analysis, cro_approved, manual_move } = body

    // Validate required fields
    if (!contact_id) {
      return NextResponse.json(
        { success: false, error: 'Missing contact_id' },
        { status: 400 }
      )
    }

    // ai_analysis is optional for manual moves
    const analysis = ai_analysis || {
      summary: 'Manually approved by CRO',
      rating: 7,
      sentiment: 'positive' as const,
      interest_level: 'high' as const,
      key_points: ['CRO manually marked as positive'],
      positive_points: ['Shows genuine interest'],
      improvement_points: [],
    }

    // Step 1: Fetch contact from crm_contacts
    const { data: contact, error: fetchError } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', contact_id)
      .eq('cro_id', user.id) // Ensure CRO owns this contact
      .maybeSingle()

    if (fetchError || !contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found or unauthorized' },
        { status: 404 }
      )
    }

    // Step 2: Create AI analysis note
    const aiNote: Note = {
      id: crypto.randomUUID(),
      type: 'ai_transcript',
      timestamp: new Date().toISOString(),
      ai_summary: analysis.summary,
      ai_rating: analysis.rating,
      sentiment: analysis.sentiment,
      interest_level: analysis.interest_level,
      key_points: analysis.key_points,
      positive_points: analysis.positive_points,
      improvement_points: analysis.improvement_points,
      is_editable: false,
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || 'Unknown',
      created_at: new Date().toISOString(),
    }

    // Combine existing notes with new AI note
    const existingNotes = (contact.notes_timeline as Note[]) || []
    const updatedNotes = [...existingNotes, aiNote]

    // Step 3: Create positive contact (INSERT)
    const { data: positiveContact, error: insertError } = await supabase
      .from('positive_contacts')
      .insert({
        master_contact_id: contact.master_contact_id,
        cro_id: user.id,
        name: contact.name,
        phone: contact.phone,
        alternate_phone: contact.alternate_phone,
        email: contact.email,
        location: contact.location,
        city: contact.city,
        state: contact.state,
        loan_type: contact.loan_type,
        loan_amount: contact.loan_amount,
        business_name: contact.business_name,
        business_type: contact.business_type,
        interest_level: analysis.interest_level,
        ai_rating: analysis.rating,
        ai_summary: analysis.summary,
        added_by_ai: !cro_approved, // If CRO rejected but AI rating >= 7, this will be true
        status: 'pending',
        call_count: contact.call_count || 0,
        last_called_at: contact.last_called_at,
        notes_timeline: updatedNotes,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating positive contact', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create positive contact' },
        { status: 500 }
      )
    }

    if (!positiveContact) {
      apiLogger.error('Positive contact insert returned no data')
      return NextResponse.json(
        { success: false, error: 'Failed to create positive contact - no data returned' },
        { status: 500 }
      )
    }

    // Step 4: Delete from crm_contacts (MOVE logic) - scoped to CRO ownership
    const { error: deleteError } = await supabase
      .from('crm_contacts')
      .delete()
      .eq('id', contact_id)
      .eq('cro_id', user.id)

    if (deleteError) {
      apiLogger.error('Error deleting contact', deleteError)
      // Rollback: Delete the positive contact we just created
      await supabase.from('positive_contacts').delete().eq('id', positiveContact.id)
      return NextResponse.json(
        { success: false, error: 'Failed to move contact (rollback performed)' },
        { status: 500 }
      )
    }

    // Step 5: Update master contact
    const { error: masterUpdateError } = await supabase
      .from('master_contacts')
      .update({
        current_stage: 'positive',
        is_interested: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.master_contact_id)

    if (masterUpdateError) {
      apiLogger.error('Error updating master contact', masterUpdateError)
      // Don't rollback - the move was successful, just log the error
    }

    // Step 6: Add system event note to track the move
    const systemNote: Note = {
      id: crypto.randomUUID(),
      type: 'system_event',
      timestamp: new Date().toISOString(),
      event: 'moved_to_positive_contacts',
      details: {
        from_stage: 'contact',
        to_stage: 'positive',
        cro_approved,
        ai_rating: analysis.rating,
        interest_level: analysis.interest_level,
      },
      is_editable: false,
      created_by: 'system',
      created_by_name: 'System',
      created_at: new Date().toISOString(),
    }

    // Add system note to positive contact
    await supabase
      .from('positive_contacts')
      .update({
        notes_timeline: [...updatedNotes, systemNote],
      })
      .eq('id', positiveContact.id)

    return NextResponse.json({
      success: true,
      data: {
        positive_contact: positiveContact,
        moved_from: 'contacts',
        moved_to: 'positive_contacts',
        cro_approved,
        ai_rating: analysis.rating,
      },
      message: cro_approved
        ? 'Contact successfully moved to Positive Contacts'
        : 'Contact added to Positive Contacts with "AI CRM Suggest" tag',
    })
  } catch (error) {
    apiLogger.error('Error in move-to-positive API', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
