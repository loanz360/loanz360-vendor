import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


/**
 * EDIT Manual Note
 *
 * Only manual notes (type: 'manual_note') can be edited
 * AI transcripts and system events are read-only
 *
 * PUT /api/ai-crm/notes/edit
 * Body: {
 *   entity_type: 'contact' | 'positive_contact' | 'lead' | 'deal'
 *   entity_id: string
 *   note_id: string
 *   content: string
 * }
 */
export async function PUT(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { entity_type, entity_id, note_id, content } = body

    // Validate inputs
    if (!entity_type || !entity_id || !note_id || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['contact', 'positive_contact', 'lead', 'deal'].includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type' },
        { status: 400 }
      )
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note content cannot be empty' },
        { status: 400 }
      )
    }

    // Map entity type to table name
    const tableMap: Record<string, string> = {
      contact: 'crm_contacts',
      positive_contact: 'positive_contacts',
      lead: 'crm_leads',
      deal: 'crm_deals',
    }

    const tableName = tableMap[entity_type]

    // Fetch current entity
    const { data: entity, error: fetchError } = await supabase
      .from(tableName)
      .select('notes_timeline')
      .eq('id', entity_id)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json(
        { success: false, error: `${entity_type} not found` },
        { status: 404 }
      )
    }

    const notes = (entity.notes_timeline as Note[]) || []

    // Find the note to edit
    const noteIndex = notes.findIndex((n) => n.id === note_id)

    if (noteIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    const noteToEdit = notes[noteIndex]

    // Validate note is editable
    if (!noteToEdit.is_editable) {
      return NextResponse.json(
        {
          success: false,
          error: 'This note cannot be edited. Only manual notes are editable.',
        },
        { status: 403 }
      )
    }

    // Validate user owns the note
    if (noteToEdit.created_by !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only edit your own notes' },
        { status: 403 }
      )
    }

    // Update the note
    const updatedNote: Note = {
      ...noteToEdit,
      content: content.trim(),
      updated_at: new Date().toISOString(),
    }

    // Replace the note in the array
    const updatedNotes = [...notes]
    updatedNotes[noteIndex] = updatedNote

    // Update entity
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        notes_timeline: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)

    if (updateError) {
      apiLogger.error('Error updating note', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        note: updatedNote,
      },
      message: 'Note updated successfully',
    })
  } catch (error) {
    apiLogger.error('Error in edit-note API', error)
    logApiError(error as Error, request, { action: 'put' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
