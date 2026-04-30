import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScheduleNoteSchema } from '@/lib/validations/schedule.validation'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/schedule/notes
 * Creates a new note for a schedule
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr

    // Validate request body
    const validatedData = createScheduleNoteSchema.parse(body)

    // Verify the meeting exists and belongs to the user
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, sales_executive_id')
      .eq('id', validatedData.meeting_id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
    }

    // Prepare note data
    const noteData = {
      meeting_id: validatedData.meeting_id,
      created_by: user.id,
      note_title: validatedData.note_title || null,
      note_content: validatedData.note_content,
      note_type: validatedData.note_type,
      is_private: validatedData.is_private,
      attachments: validatedData.attachments || [],
      tags: validatedData.tags || []
    }

    // Insert note
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
    apiLogger.error('Error in POST /api/schedule/notes', error)

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/schedule/notes
 * Retrieves notes for a schedule
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meeting_id')

    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meeting_id is required' }, { status: 400 })
    }

    // Verify the meeting exists and belongs to the user
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
    }

    // Fetch notes
    const { data: notes, error: notesError } = await supabase
      .from('meeting_notes')
      .select(
        `
        *,
        author:auth.users!created_by(
          id,
          email,
          user_metadata
        )
      `
      )
      .eq('meeting_id', meetingId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (notesError) {
      apiLogger.error('Error fetching notes', notesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 })
    }

    // Transform notes to include author details
    const notesWithAuthor = notes.map((note: unknown) => ({
      ...note,
      author_name: note.author?.user_metadata?.full_name || note.author?.email,
      author_email: note.author?.email,
      author_avatar_url: note.author?.user_metadata?.avatar_url
    }))

    return NextResponse.json({ notes: notesWithAuthor })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/notes', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
