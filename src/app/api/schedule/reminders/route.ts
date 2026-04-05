import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createScheduleReminderSchema } from '@/lib/validations/schedule.validation'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/schedule/reminders
 * Creates a new reminder for a schedule
 */
export async function POST(request: NextRequest) {
  try {
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
    const body = await request.json()

    // Validate request body
    const validatedData = createScheduleReminderSchema.parse(body)

    // Verify the meeting exists and belongs to the user
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, sales_executive_id, scheduled_date')
      .eq('id', validatedData.meeting_id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
    }

    // Ensure reminder time is before the meeting
    const reminderTime = new Date(validatedData.remind_at)
    const meetingTime = new Date(meeting.scheduled_date)

    if (reminderTime >= meetingTime) {
      return NextResponse.json(
        { error: 'Reminder time must be before the meeting time' },
        { status: 400 }
      )
    }

    // Prepare reminder data
    const reminderData = {
      meeting_id: validatedData.meeting_id,
      user_id: user.id,
      reminder_title: validatedData.reminder_title,
      reminder_message: validatedData.reminder_message || null,
      remind_at: validatedData.remind_at,
      frequency: validatedData.frequency,
      status: 'PENDING' as const,
      send_email: validatedData.send_email,
      send_push: validatedData.send_push,
      send_sms: validatedData.send_sms
    }

    // Insert reminder
    const { data: reminder, error: insertError } = await supabase
      .from('meeting_reminders')
      .insert(reminderData)
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating reminder', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create reminder' }, { status: 500 })
    }

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/schedule/reminders', error)

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
 * GET /api/schedule/reminders
 * Retrieves reminders for a schedule or all user reminders
 */
export async function GET(request: NextRequest) {
  try {
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
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('meeting_reminders')
      .select(
        `
        *,
        meeting:meetings(
          id,
          title,
          scheduled_date,
          location,
          is_virtual,
          participant_name
        )
      `
      )
      .eq('user_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (meetingId) {
      query = query.eq('meeting_id', meetingId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Order by remind_at
    query = query.order('remind_at', { ascending: true })

    // Execute query
    const { data: reminders, error: queryError } = await query

    if (queryError) {
      apiLogger.error('Error fetching reminders', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reminders' }, { status: 500 })
    }

    // Transform reminders to include meeting details
    const remindersWithDetails = reminders.map((reminder: any) => ({
      ...reminder,
      schedule_title: reminder.meeting?.title,
      schedule_date: reminder.meeting?.scheduled_date,
      participant_name: reminder.meeting?.participant_name,
      location: reminder.meeting?.location,
      is_virtual: reminder.meeting?.is_virtual
    }))

    return NextResponse.json({ reminders: remindersWithDetails })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/reminders', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
