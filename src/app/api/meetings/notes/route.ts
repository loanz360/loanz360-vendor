import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/meetings/notes
 * Retrieves notes for a specific meeting or all notes for the user
 *
 * Query Parameters:
 * - meeting_id: Filter by meeting ID
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meeting_id')

    let query = supabase
      .from('meeting_notes')
      .select(
        `
        *,
        meeting:meetings!meeting_notes_meeting_id_fkey(id, title, sales_executive_id),
        author:users!meeting_notes_created_by_fkey(full_name, email)
      `
      )
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (meetingId) {
      // Verify user has access to this meeting
      const { data: meeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('id', meetingId)
        .eq('sales_executive_id', user.id)
        .maybeSingle()

      if (!meeting) {
        return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
      }

      query = query.eq('meeting_id', meetingId)
    } else {
      // Get notes for all user's meetings
      query = query.eq('created_by', user.id)
    }

    const { data: notes, error: queryError } = await query

    if (queryError) {
      apiLogger.error('Error fetching notes', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({ notes })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/meetings/notes', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/meetings/notes
 * Creates a new meeting note
 *
 * Request Body:
 * - meeting_id: UUID (required)
 * - note_title: string (optional)
 * - note_content: string (required)
 * - note_type: NoteType (optional, default: GENERAL)
 * - is_private: boolean (optional, default: false)
 * - attachments: array (optional)
 * - tags: array (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      meeting_id: z.string().uuid().optional(),


      note_content: z.string().optional(),


      note_title: z.string().optional(),


      note_type: z.string().optional(),


      is_private: z.boolean().optional(),


      attachments: z.array(z.unknown()).optional(),


      tags: z.array(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.meeting_id || !body.note_content) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting_id, note_content' },
        { status: 400 }
      )
    }

    // Verify user has access to this meeting
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', body.meeting_id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Create note
    const noteData = {
      meeting_id: body.meeting_id,
      created_by: user.id,
      note_title: body.note_title || null,
      note_content: body.note_content,
      note_type: body.note_type || 'GENERAL',
      is_private: body.is_private || false,
      attachments: body.attachments || [],
      tags: body.tags || []
    }

    const { data: note, error: insertError } = await supabase
      .from('meeting_notes')
      .insert(noteData)
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating note', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create note' }, { status: 500 })
    }

    return NextResponse.json({ note }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/meetings/notes', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/meetings/notes/[id]
 * Updates a note (handled via query parameter for simplicity)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('id')

    if (!noteId) {
      return NextResponse.json({ success: false, error: 'Note ID required' }, { status: 400 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2

    // Verify ownership
    const { data: existingNote } = await supabase
      .from('meeting_notes')
      .select('id')
      .eq('id', noteId)
      .eq('created_by', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    // Update note
    const { data: note, error: updateError } = await supabase
      .from('meeting_notes')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating note', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update note' }, { status: 500 })
    }

    return NextResponse.json({ note })
  } catch (error: unknown) {
    apiLogger.error('Error in PATCH /api/meetings/notes', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/meetings/notes
 * Soft deletes a note (handled via query parameter)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('id')

    if (!noteId) {
      return NextResponse.json({ success: false, error: 'Note ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existingNote } = await supabase
      .from('meeting_notes')
      .select('id')
      .eq('id', noteId)
      .eq('created_by', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('meeting_notes')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', noteId)

    if (deleteError) {
      apiLogger.error('Error deleting note', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete note' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Note deleted successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/meetings/notes', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
