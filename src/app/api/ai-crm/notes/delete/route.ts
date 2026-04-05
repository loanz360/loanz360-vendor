import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * DELETE Manual Note
 *
 * Only manual notes can be deleted
 * AI transcripts and system events cannot be deleted
 *
 * DELETE /api/ai-crm/notes/delete
 * Body: {
 *   entity_type: 'contact' | 'positive_contact' | 'lead' | 'deal'
 *   entity_id: string
 *   note_id: string
 * }
 */
export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const { entity_type, entity_id, note_id } = body

    // Validate inputs
    if (!entity_type || !entity_id || !note_id) {
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

    // Find the note to delete
    const noteToDelete = notes.find((n) => n.id === note_id)

    if (!noteToDelete) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    // Validate note is deletable (only manual notes)
    if (!noteToDelete.is_editable) {
      return NextResponse.json(
        {
          success: false,
          error: 'This note cannot be deleted. Only manual notes can be deleted.',
        },
        { status: 403 }
      )
    }

    // Validate user owns the note
    if (noteToDelete.created_by !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own notes' },
        { status: 403 }
      )
    }

    // Remove the note from the array
    const updatedNotes = notes.filter((n) => n.id !== note_id)

    // Update entity
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        notes_timeline: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)

    if (updateError) {
      apiLogger.error('Error deleting note', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        deleted_note_id: note_id,
        remaining_notes: updatedNotes.length,
      },
      message: 'Note deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Error in delete-note API', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
