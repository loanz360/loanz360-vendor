import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/meetings/reminders
 * Retrieves reminders for the user
 *
 * Query Parameters:
 * - meeting_id: Filter by meeting ID
 * - status: Filter by reminder status
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
    const status = searchParams.get('status')

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
          customer:customers(full_name)
        )
      `
      )
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('remind_at', { ascending: true })

    if (meetingId) {
      query = query.eq('meeting_id', meetingId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: reminders, error: queryError } = await query

    if (queryError) {
      apiLogger.error('Error fetching reminders', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reminders' }, { status: 500 })
    }

    return NextResponse.json({ reminders })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/meetings/reminders', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/meetings/reminders
 * Creates a new reminder
 *
 * Request Body:
 * - meeting_id: UUID (required)
 * - reminder_title: string (required)
 * - reminder_message: string (optional)
 * - remind_at: ISO string (required)
 * - frequency: ReminderFrequency (optional, default: ONCE)
 * - send_email: boolean (optional, default: true)
 * - send_push: boolean (optional, default: true)
 * - send_sms: boolean (optional, default: false)
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

    const body = await request.json()

    // Validate required fields
    if (!body.meeting_id || !body.reminder_title || !body.remind_at) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting_id, reminder_title, remind_at' },
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

    // Create reminder
    const reminderData = {
      meeting_id: body.meeting_id,
      user_id: user.id,
      reminder_title: body.reminder_title,
      reminder_message: body.reminder_message || null,
      remind_at: body.remind_at,
      frequency: body.frequency || 'ONCE',
      send_email: body.send_email !== undefined ? body.send_email : true,
      send_push: body.send_push !== undefined ? body.send_push : true,
      send_sms: body.send_sms || false
    }

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
    apiLogger.error('Error in POST /api/meetings/reminders', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/meetings/reminders
 * Updates a reminder (e.g., mark as acknowledged)
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
    const reminderId = searchParams.get('id')

    if (!reminderId) {
      return NextResponse.json({ success: false, error: 'Reminder ID required' }, { status: 400 })
    }

    const body = await request.json()

    // Verify ownership
    const { data: existingReminder } = await supabase
      .from('meeting_reminders')
      .select('id')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingReminder) {
      return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
    }

    // Handle status changes with timestamps
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString()
    }

    if (body.status === 'ACKNOWLEDGED' && !body.acknowledged_at) {
      updateData.acknowledged_at = new Date().toISOString()
    } else if (body.status === 'DISMISSED' && !body.dismissed_at) {
      updateData.dismissed_at = new Date().toISOString()
    } else if (body.status === 'SENT' && !body.sent_at) {
      updateData.sent_at = new Date().toISOString()
    }

    // Update reminder
    const { data: reminder, error: updateError } = await supabase
      .from('meeting_reminders')
      .update(updateData)
      .eq('id', reminderId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating reminder', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update reminder' }, { status: 500 })
    }

    return NextResponse.json({ reminder })
  } catch (error: unknown) {
    apiLogger.error('Error in PATCH /api/meetings/reminders', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/meetings/reminders
 * Soft deletes a reminder
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
    const reminderId = searchParams.get('id')

    if (!reminderId) {
      return NextResponse.json({ success: false, error: 'Reminder ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existingReminder } = await supabase
      .from('meeting_reminders')
      .select('id')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingReminder) {
      return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('meeting_reminders')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', reminderId)

    if (deleteError) {
      apiLogger.error('Error deleting reminder', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete reminder' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Reminder deleted successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/meetings/reminders', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
