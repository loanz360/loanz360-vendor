import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


// Validation schema for creating reminders
const createReminderSchema = z.object({
  meeting_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  reminder_datetime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid datetime format'
  }),
  reminder_type: z.enum(['Before Meeting', 'Follow-up', 'Custom']).default('Before Meeting'),
  minutes_before: z.number().optional().nullable(),
  send_email: z.boolean().default(false),
  send_push: z.boolean().default(true),
  send_sms: z.boolean().default(false)
})

// Validation schema for updating reminders
const updateReminderSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  reminder_datetime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid datetime format'
  }).optional(),
  reminder_type: z.enum(['Before Meeting', 'Follow-up', 'Custom']).optional(),
  status: z.enum(['Active', 'Completed', 'Cancelled', 'Snoozed']).optional(),
  send_email: z.boolean().optional(),
  send_push: z.boolean().optional(),
  send_sms: z.boolean().optional()
})

/**
 * POST /api/employees/dse/schedule/reminders
 * Creates a new reminder for a DSE meeting
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
    const validatedData = createReminderSchema.parse(body)

    // Verify the meeting exists and belongs to the user
    const { data: meeting, error: meetingError } = await supabase
      .from('dse_meetings')
      .select('id, title, scheduled_date, start_time')
      .eq('id', validatedData.meeting_id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Validate reminder time is in the future
    const reminderTime = new Date(validatedData.reminder_datetime)
    if (reminderTime <= new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Reminder time must be in the future'
      }, { status: 400 })
    }

    // Prepare reminder data
    const reminderData = {
      meeting_id: validatedData.meeting_id,
      title: validatedData.title,
      description: validatedData.description || null,
      reminder_datetime: validatedData.reminder_datetime,
      reminder_type: validatedData.reminder_type,
      minutes_before: validatedData.minutes_before || null,
      status: 'Active',
      send_email: validatedData.send_email,
      send_push: validatedData.send_push,
      send_sms: validatedData.send_sms,
      owner_id: user.id
    }

    // Insert reminder
    const { data: reminder, error: insertError } = await supabase
      .from('dse_reminders')
      .insert(reminderData)
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating reminder', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create reminder' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Reminder',
      entity_id: reminder.id,
      action: 'Created',
      new_values: { title: reminderData.title, reminder_datetime: reminderData.reminder_datetime },
      user_id: user.id,
      changes_summary: `Reminder "${reminderData.title}" created for meeting "${meeting.title}"`
    })

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder created successfully'
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

    apiLogger.error('Error in POST /api/employees/dse/schedule/reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employees/dse/schedule/reminders
 * Retrieves reminders for a DSE meeting or all user reminders
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
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('dse_reminders')
      .select(`
        *,
        dse_meetings!meeting_id(id, title, scheduled_date, start_time, status)
      `, { count: 'exact' })
      .eq('owner_id', user.id)

    // Apply filters
    if (meetingId) {
      query = query.eq('meeting_id', meetingId)
    }

    if (status) {
      query = query.eq('status', status)
    } else if (upcoming) {
      // Get only active reminders that are in the future
      query = query
        .eq('status', 'Active')
        .gte('reminder_datetime', new Date().toISOString())
    }

    // Apply pagination and ordering
    query = query
      .order('reminder_datetime', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: reminders, error: queryError, count } = await query

    if (queryError) {
      apiLogger.error('Error fetching reminders', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reminders' }, { status: 500 })
    }

    // Transform reminders to include meeting details
    const remindersWithDetails = (reminders || []).map((reminder: any) => ({
      ...reminder,
      meeting_title: reminder.dse_meetings?.title,
      meeting_date: reminder.dse_meetings?.scheduled_date,
      meeting_time: reminder.dse_meetings?.start_time,
      meeting_status: reminder.dse_meetings?.status
    }))

    return NextResponse.json({
      success: true,
      data: {
        reminders: remindersWithDetails,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/employees/dse/schedule/reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/dse/schedule/reminders
 * Updates an existing reminder
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
    const reminderId = searchParams.get('id')

    if (!reminderId) {
      return NextResponse.json({ success: false, error: 'Reminder ID is required' }, { status: 400 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateReminderSchema.parse(body)

    // Verify reminder exists and belongs to user
    const { data: existingReminder, error: fetchError } = await supabase
      .from('dse_reminders')
      .select('id, owner_id, title, status')
      .eq('id', reminderId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (fetchError || !existingReminder) {
      return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
    }

    // Validate new reminder time if provided
    if (validatedData.reminder_datetime) {
      const newReminderTime = new Date(validatedData.reminder_datetime)
      if (newReminderTime <= new Date() && validatedData.status !== 'Completed' && validatedData.status !== 'Cancelled') {
        return NextResponse.json({
          success: false,
          error: 'Reminder time must be in the future'
        }, { status: 400 })
      }
    }

    // Update reminder
    const { data: updatedReminder, error: updateError } = await supabase
      .from('dse_reminders')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', reminderId)
      .eq('owner_id', user.id)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // Create audit log if status changed
    if (validatedData.status && validatedData.status !== existingReminder.status) {
      await supabase.from('dse_audit_log').insert({
        entity_type: 'Reminder',
        entity_id: reminderId,
        action: 'StatusChanged',
        old_values: { status: existingReminder.status },
        new_values: { status: validatedData.status },
        user_id: user.id,
        changes_summary: `Reminder "${existingReminder.title}" status changed from ${existingReminder.status} to ${validatedData.status}`
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedReminder,
      message: 'Reminder updated successfully'
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

    apiLogger.error('Error in PUT /api/employees/dse/schedule/reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/dse/schedule/reminders
 * Deletes a reminder (soft delete via status change)
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
    const reminderId = searchParams.get('id')

    if (!reminderId) {
      return NextResponse.json({ success: false, error: 'Reminder ID is required' }, { status: 400 })
    }

    // Verify reminder exists and belongs to user
    const { data: existingReminder, error: fetchError } = await supabase
      .from('dse_reminders')
      .select('id, owner_id, title')
      .eq('id', reminderId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (fetchError || !existingReminder) {
      return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
    }

    // Soft delete by marking as cancelled
    const { error: deleteError } = await supabase
      .from('dse_reminders')
      .update({
        status: 'Cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', reminderId)
      .eq('owner_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Reminder',
      entity_id: reminderId,
      action: 'Deleted',
      old_values: { title: existingReminder.title },
      user_id: user.id,
      changes_summary: `Reminder "${existingReminder.title}" deleted`
    })

    return NextResponse.json({
      success: true,
      message: 'Reminder deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/employees/dse/schedule/reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
