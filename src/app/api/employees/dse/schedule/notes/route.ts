import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


// Validation schema for creating notes
const createNoteSchema = z.object({
  meeting_id: z.string().uuid(),
  note_title: z.string().max(255).optional().nullable(),
  note_content: z.string().min(1, 'Note content is required'),
  note_type: z.enum(['General', 'Pre-Meeting', 'During Meeting', 'Post-Meeting', 'Follow-Up', 'Action Item']).default('General'),
  is_private: z.boolean().default(false),
  tags: z.array(z.string()).optional().nullable()
})

// Validation schema for updating notes
const updateNoteSchema = z.object({
  note_title: z.string().max(255).optional().nullable(),
  note_content: z.string().min(1).optional(),
  note_type: z.enum(['General', 'Pre-Meeting', 'During Meeting', 'Post-Meeting', 'Follow-Up', 'Action Item']).optional(),
  is_private: z.boolean().optional(),
  tags: z.array(z.string()).optional().nullable()
})

/**
 * POST /api/employees/dse/schedule/notes
 * Creates a new note for a DSE meeting
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = createNoteSchema.parse(body)

    // Verify the meeting exists and belongs to the user
    const { data: meeting, error: meetingError } = await supabase
      .from('dse_meetings')
      .select('id, title')
      .eq('id', validatedData.meeting_id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Prepare note data
    const noteData = {
      meeting_id: validatedData.meeting_id,
      note_title: validatedData.note_title || null,
      note_content: validatedData.note_content,
      note_type: validatedData.note_type,
      is_private: validatedData.is_private,
      tags: validatedData.tags || [],
      created_by: user.id
    }

    // Insert note
    const { data: note, error: insertError } = await supabase
      .from('dse_notes')
      .insert(noteData)
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating note', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create note' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Note',
      entity_id: note.id,
      action: 'Created',
      new_values: { note_title: noteData.note_title, note_type: noteData.note_type },
      user_id: user.id,
      changes_summary: `Note added to meeting "${meeting.title}"`
    })

    return NextResponse.json({
      success: true,
      data: note,
      message: 'Note created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error in POST /api/employees/dse/schedule/notes', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employees/dse/schedule/notes
 * Retrieves notes for a DSE meeting or all user notes
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meeting_id')
    const noteType = searchParams.get('note_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('dse_notes')
      .select(`
        *,
        dse_meetings!meeting_id(id, title, scheduled_date)
      `, { count: 'exact' })
      .eq('created_by', user.id)

    // Apply filters
    if (meetingId) {
      query = query.eq('meeting_id', meetingId)
    }

    if (noteType) {
      query = query.eq('note_type', noteType)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: notes, error: queryError, count } = await query

    if (queryError) {
      apiLogger.error('Error fetching notes', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        notes: notes || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/employees/dse/schedule/notes', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/dse/schedule/notes
 * Updates an existing note
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('id')

    if (!noteId) {
      return NextResponse.json({ success: false, error: 'Note ID is required' }, { status: 400 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateNoteSchema.parse(body)

    // Verify note exists and belongs to user
    const { data: existingNote, error: fetchError } = await supabase
      .from('dse_notes')
      .select('id, created_by, note_title')
      .eq('id', noteId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (fetchError || !existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    // Update note
    const { data: updatedNote, error: updateError } = await supabase
      .from('dse_notes')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId)
      .eq('created_by', user.id)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      data: updatedNote,
      message: 'Note updated successfully'
    })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error in PUT /api/employees/dse/schedule/notes', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/dse/schedule/notes
 * Deletes a note
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('id')

    if (!noteId) {
      return NextResponse.json({ success: false, error: 'Note ID is required' }, { status: 400 })
    }

    // Verify note exists and belongs to user
    const { data: existingNote, error: fetchError } = await supabase
      .from('dse_notes')
      .select('id, created_by')
      .eq('id', noteId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (fetchError || !existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    // Delete note
    const { error: deleteError } = await supabase
      .from('dse_notes')
      .delete()
      .eq('id', noteId)
      .eq('created_by', user.id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/employees/dse/schedule/notes', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
