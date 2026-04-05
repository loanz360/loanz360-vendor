import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateScheduleSchema } from '@/lib/validations/schedule.validation'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/schedule/[id]
 * Retrieves a specific schedule by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Fetch schedule with related data
    const { data: schedule, error: fetchError } = await supabase
      .from('meetings')
      .select(
        `
        *,
        customer:customers(full_name, email, phone),
        partner:partners(full_name, email, phone, company_name),
        notes:meeting_notes(
          id,
          note_title,
          note_content,
          note_type,
          is_private,
          attachments,
          tags,
          created_at,
          created_by,
          author:auth.users!created_by(
            id,
            email,
            user_metadata
          )
        ),
        reminders:meeting_reminders(
          id,
          reminder_title,
          reminder_message,
          remind_at,
          frequency,
          status,
          send_email,
          send_push,
          send_sms,
          sent_at,
          acknowledged_at,
          created_at
        )
      `
      )
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
      }
      apiLogger.error('Error fetching schedule', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to fetch schedule' }, { status: 500 })
    }

    // Transform data
    const scheduleWithDetails = {
      ...schedule,
      partner_email: schedule.partner?.email,
      partner_phone: schedule.partner?.phone,
      partner_company: schedule.partner?.company_name,
      customer_email: schedule.customer?.email,
      customer_phone: schedule.customer?.phone,
      participant_name:
        schedule.participant_name ||
        schedule.partner?.full_name ||
        schedule.customer?.full_name,
      notes_count: schedule.notes?.length || 0,
      reminders_count: schedule.reminders?.length || 0
    }

    return NextResponse.json({ schedule: scheduleWithDetails })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/schedule/[id]
 * Updates a specific schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Parse request body
    const body = await request.json()

    // Validate request body
    const validatedData = updateScheduleSchema.parse(body)

    // Check if schedule exists and belongs to user
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('meetings')
      .select('id, sales_executive_id, scheduled_date, duration_minutes')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (fetchError || !existingSchedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
    }

    // If scheduled_date is being updated, check for conflicts
    if (validatedData.scheduled_date) {
      const durationToCheck = validatedData.duration_minutes || existingSchedule.duration_minutes

      const { data: hasConflict } = await supabase.rpc('check_schedule_conflict', {
        p_user_id: user.id,
        p_scheduled_date: validatedData.scheduled_date,
        p_duration_minutes: durationToCheck,
        p_exclude_meeting_id: id
      })

      if (hasConflict) {
        return NextResponse.json(
          {
            error: 'Schedule conflict detected',
            message:
              'You already have a meeting scheduled at this time. Please choose a different time.'
          },
          { status: 409 }
        )
      }
    }

    // Prepare update data
    const updateData = {
      ...validatedData,
      updated_at: new Date().toISOString()
    }

    // Update schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating schedule', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update schedule' }, { status: 500 })
    }

    return NextResponse.json({ schedule: updatedSchedule })
  } catch (error: unknown) {
    apiLogger.error('Error in PUT /api/schedule/[id]', error)

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
 * DELETE /api/schedule/[id]
 * Soft deletes a specific schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    // Check if schedule exists and belongs to user
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (fetchError || !existingSchedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
    }

    // Soft delete the schedule
    const { error: deleteError } = await supabase
      .from('meetings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (deleteError) {
      apiLogger.error('Error deleting schedule', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete schedule' }, { status: 500 })
    }

    // Also soft delete associated reminders
    await supabase
      .from('meeting_reminders')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('meeting_id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ message: 'Schedule deleted successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/schedule/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
