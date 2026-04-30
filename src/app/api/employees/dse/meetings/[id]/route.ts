import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


// Validation schema for updating meeting
const updateMeetingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  meeting_type: z.enum([
    'In Person', 'Phone Call', 'Video Call', 'Virtual Meeting', 'Site Visit'
  ]).optional(),
  meeting_purpose: z.enum([
    'Introduction', 'Product Demo', 'Proposal Discussion', 'Negotiation',
    'Document Collection', 'Contract Signing', 'Review', 'Follow-up', 'Other'
  ]).optional().nullable(),
  scheduled_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional().nullable(),
  duration_minutes: z.number().optional().nullable(),
  location_type: z.enum(['Customer Office', 'Our Office', 'Virtual', 'Other']).optional().nullable(),
  location_address: z.string().optional().nullable(),
  location_latitude: z.number().optional().nullable(),
  location_longitude: z.number().optional().nullable(),
  virtual_meeting_link: z.string().url().optional().nullable(),
  virtual_meeting_provider: z.string().optional().nullable(),
  status: z.enum([
    'Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'
  ]).optional(),
  status_reason: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  outcome_notes: z.string().optional().nullable(),
  meeting_notes: z.string().optional().nullable(),
  action_items: z.array(z.object({
    item: z.string(),
    assignee: z.string().optional(),
    due_date: z.string().optional(),
    completed: z.boolean().optional()
  })).optional().nullable(),
  follow_up_required: z.boolean().optional(),
  follow_up_date: z.string().optional().nullable(),
  next_steps: z.string().optional().nullable(),
  attendees: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    role: z.string().optional(),
    rsvp_status: z.enum(['pending', 'accepted', 'declined', 'tentative']).optional()
  })).optional().nullable(),
})

/**
 * Escape PostgREST special characters in a string before using in filters
 */
function escapePostgrestValue(value: string): string {
  return value
    .replace(/[%_\\]/g, '\\$&')
    .replace(/[(),."']/g, '')
}

/**
 * GET /api/employees/dse/meetings/[id]
 * Retrieves a specific meeting by ID with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { id } = await params

    // Fetch meeting with related data
    const { data: meeting, error: fetchError } = await supabase
      .from('dse_meetings')
      .select(`
        *,
        dse_customers(id, full_name, company_name, designation, primary_mobile, email, customer_status, priority),
        dse_leads(id, customer_name, company_name, mobile, email, lead_type, lead_stage, estimated_value)
      `)
      .eq('id', id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (fetchError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Fetch related notes
    const { data: notes } = await supabase
      .from('dse_notes')
      .select('*')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch related reminders
    const { data: reminders } = await supabase
      .from('dse_reminders')
      .select('*')
      .eq('meeting_id', meeting.id)
      .eq('owner_id', user.id)
      .order('reminder_datetime', { ascending: true })
      .limit(5)

    return NextResponse.json({
      success: true,
      data: {
        meeting,
        notes: notes || [],
        reminders: reminders || [],
        participant_name: meeting.dse_customers?.full_name || meeting.dse_leads?.customer_name || null,
        participant_company: meeting.dse_customers?.company_name || meeting.dse_leads?.company_name || null
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/dse/meetings/[id]
 * Updates a specific meeting
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { id } = await params
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = updateMeetingSchema.parse(body)

    // Verify meeting exists and belongs to user
    const { data: existingMeeting, error: fetchError } = await supabase
      .from('dse_meetings')
      .select('id, organizer_id, status, title')
      .eq('id', id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (fetchError || !existingMeeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Prepare update data with timestamp
    const updateData = {
      ...validatedData,
      updated_at: new Date().toISOString()
    }

    // Update meeting
    const { data: updatedMeeting, error: updateError } = await supabase
      .from('dse_meetings')
      .update(updateData)
      .eq('id', id)
      .eq('organizer_id', user.id)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Meeting',
      entity_id: id,
      action: validatedData.status ? 'StatusChanged' : 'Updated',
      old_values: { status: existingMeeting.status, title: existingMeeting.title },
      new_values: validatedData,
      user_id: user.id,
      changes_summary: validatedData.status
        ? `Meeting status changed from ${existingMeeting.status} to ${validatedData.status}`
        : `Meeting "${existingMeeting.title}" updated`
    })

    return NextResponse.json({
      success: true,
      data: updatedMeeting,
      message: 'Meeting updated successfully'
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

    apiLogger.error('Error updating DSE meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/dse/meetings/[id]
 * Deletes a specific meeting (soft delete via status change)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { id } = await params

    // Verify meeting exists and belongs to user
    const { data: existingMeeting, error: fetchError } = await supabase
      .from('dse_meetings')
      .select('id, organizer_id, title')
      .eq('id', id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (fetchError || !existingMeeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Soft delete by marking as cancelled with deletion info
    const { error: deleteError } = await supabase
      .from('dse_meetings')
      .update({
        status: 'Cancelled',
        status_reason: 'Deleted by user',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organizer_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    // Cancel associated reminders by meeting_id (not by title match)
    await supabase
      .from('dse_reminders')
      .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
      .eq('meeting_id', id)
      .eq('owner_id', user.id)
      .eq('status', 'Active')

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Meeting',
      entity_id: id,
      action: 'Deleted',
      old_values: { title: existingMeeting.title },
      user_id: user.id,
      changes_summary: `Meeting "${existingMeeting.title}" deleted`
    })

    return NextResponse.json({
      success: true,
      message: 'Meeting deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting DSE meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
