import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// GET /api/crm/notes - List notes and call logs
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const leadId = searchParams.get('lead_id') || ''
    const noteType = searchParams.get('note_type') || ''
    const isCallLog = searchParams.get('is_call_log')

    const offset = (page - 1) * limit

    // Build base query
    let query = supabase
      .from('crm_notes')
      .select(`
        *,
        lead:crm_leads(id, customer_name, phone, cro_id)
      `, { count: 'exact' })

    // Role-based filtering: CROs see only notes for their leads
    if (profile.subrole === 'cro') {
      query = query.eq('lead.cro_id', user.id)
    }

    // Apply lead filter
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    // Apply note type filter
    if (noteType) {
      query = query.eq('note_type', noteType)
    }

    // Apply call log filter
    if (isCallLog === 'true') {
      query = query.eq('is_call_log', true)
    } else if (isCallLog === 'false') {
      query = query.eq('is_call_log', false)
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: notes, error: notesError, count } = await query

    if (notesError) {
      apiLogger.error('Error fetching notes', notesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: notes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/notes', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/crm/notes - Create new note or call log
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse request body
    const bodySchema = z.object({

      lead_id: z.string().uuid().optional(),

      text: z.string().optional(),

      note_type: z.string().optional(),

      is_call_log: z.boolean().optional(),

      call_direction: z.string().optional(),

      call_start_time: z.string().optional(),

      call_end_time: z.string().optional(),

      call_duration: z.string().optional(),

      call_recording_url: z.string().optional(),

      call_sid: z.string().uuid().optional(),

      disposition_code: z.string().optional(),

      disposition_notes: z.string().optional(),

      id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.lead_id || !body.text) {
      return NextResponse.json({ success: false, error: 'Missing required fields: lead_id, text'
      }, { status: 400 })
    }

    // Verify lead exists and user has access
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('id, cro_id')
      .eq('id', body.lead_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Check permissions: CRO can only create notes for their assigned leads
    if (profile.subrole === 'cro' && lead.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only create notes for your assigned leads' }, { status: 403 })
    }

    // Prepare note data
    const noteData: Record<string, unknown> = {
      lead_id: body.lead_id,
      note_type: body.note_type || 'General',
      text: body.text,
      is_call_log: body.is_call_log || false,
      created_by: user.id
    }

    // Add call log specific fields if this is a call log
    if (body.is_call_log) {
      noteData.call_direction = body.call_direction || null
      noteData.call_start_time = body.call_start_time || null
      noteData.call_end_time = body.call_end_time || null
      noteData.call_duration = body.call_duration || null
      noteData.call_recording_url = body.call_recording_url || null
      noteData.call_sid = body.call_sid || null
      noteData.disposition_code = body.disposition_code || null
      noteData.disposition_notes = body.disposition_notes || null
    }

    // Create note
    const { data: newNote, error: createError } = await supabase
      .from('crm_notes')
      .insert(noteData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating note', createError)
      return NextResponse.json({ success: false, error: 'Failed to create note' }, { status: 500 })
    }

    // Auto-update lead status based on disposition code (if provided)
    if (body.disposition_code) {
      const { data: dispositionCode } = await supabase
        .from('crm_disposition_codes')
        .select('auto_set_status, auto_schedule_followup_hours')
        .eq('code', body.disposition_code)
        .maybeSingle()

      if (dispositionCode) {
        const updates: Record<string, unknown> = {}

        // Auto-set status
        if (dispositionCode.auto_set_status) {
          updates.status = dispositionCode.auto_set_status
        }

        // Auto-schedule follow-up
        if (dispositionCode.auto_schedule_followup_hours) {
          const followupDate = new Date()
          followupDate.setHours(followupDate.getHours() + dispositionCode.auto_schedule_followup_hours)
          updates.next_follow_up_date = followupDate.toISOString()

          // Create follow-up record
          await supabase.from('crm_followups').insert({
            lead_id: body.lead_id,
            scheduled_at: followupDate.toISOString(),
            owner_id: user.id,
            created_by: user.id,
            title: `Follow-up after ${body.disposition_code}`,
            reminder_enabled: true
          })
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString()

          await supabase
            .from('crm_leads')
            .update(updates)
            .eq('id', body.lead_id)
        }
      }
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: body.lead_id,
      action: body.is_call_log ? 'call_logged' : 'note_added',
      performed_by: user.id,
      changes: { new: newNote }
    })

    return NextResponse.json({
      success: true,
      data: newNote
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/notes', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/crm/notes - Update note (requires note_id in body)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse request body
    const bodySchema2 = z.object({

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const noteId = body.id

    if (!noteId) {
      return NextResponse.json({ success: false, error: 'Note ID is required' }, { status: 400 })
    }

    // Fetch existing note with lead info
    const { data: existingNote, error: fetchError } = await supabase
      .from('crm_notes')
      .select('*, lead:crm_leads(id, cro_id)')
      .eq('id', noteId)
      .maybeSingle()

    if (fetchError || !existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    // Check permissions: CRO can only update notes for their assigned leads
    if (profile.subrole === 'cro' && existingNote.lead?.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only update notes for your assigned leads' }, { status: 403 })
    }

    // Users can only edit their own notes
    if (existingNote.created_by !== user.id && profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'You can only edit your own notes' }, { status: 403 })
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // List of updatable fields
    const updatableFields = [
      'note_type', 'text', 'disposition_code', 'disposition_notes'
    ]

    updatableFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // Update note
    const { data: updatedNote, error: updateError } = await supabase
      .from('crm_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating note', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update note' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: existingNote.lead_id,
      action: 'note_updated',
      performed_by: user.id,
      changes: {
        old: existingNote,
        new: updatedNote
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedNote
    })

  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/crm/notes', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/crm/notes - Delete note
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const noteId = request.nextUrl.searchParams.get('id')

    if (!noteId) {
      return NextResponse.json({ success: false, error: 'Note ID is required' }, { status: 400 })
    }

    // Fetch existing note with lead info
    const { data: existingNote, error: fetchError } = await supabase
      .from('crm_notes')
      .select('*, lead:crm_leads(id, cro_id)')
      .eq('id', noteId)
      .maybeSingle()

    if (fetchError || !existingNote) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }

    // Check permissions
    if (profile.subrole === 'cro' && existingNote.lead?.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only delete notes for your assigned leads' }, { status: 403 })
    }

    // Users can only delete their own notes (unless Super Admin)
    if (existingNote.created_by !== user.id && profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'You can only delete your own notes' }, { status: 403 })
    }

    // Delete note
    const { error: deleteError } = await supabase
      .from('crm_notes')
      .delete()
      .eq('id', noteId)

    if (deleteError) {
      apiLogger.error('Error deleting note', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete note' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: existingNote.lead_id,
      action: 'note_deleted',
      performed_by: user.id,
      changes: { deleted: existingNote }
    })

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/crm/notes', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
