import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/schedule/dsm-team/check-conflicts
 * Checks for scheduling conflicts before creating or transferring a schedule
 * Returns any overlapping schedules for the specified executive
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      executive_user_id,
      scheduled_date,
      duration_minutes,
      exclude_schedule_id // Optional: exclude this schedule when checking (for updates)
    } = body

    // Validate required fields
    if (!executive_user_id || !scheduled_date || !duration_minutes) {
      return NextResponse.json(
        { error: 'Missing required fields: executive_user_id, scheduled_date, duration_minutes' },
        { status: 400 }
      )
    }

    // Calculate end time
    const startTime = new Date(scheduled_date)
    const endTime = new Date(startTime.getTime() + duration_minutes * 60 * 1000)

    // Query for overlapping schedules
    let query = supabase
      .from('meetings')
      .select('id, title, scheduled_date, duration_minutes, status, participant_name')
      .eq('sales_executive_id', executive_user_id)
      .eq('is_deleted', false)
      .in('status', ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'])

    // Exclude specific schedule if provided (for updates)
    if (exclude_schedule_id) {
      query = query.neq('id', exclude_schedule_id)
    }

    const { data: existingSchedules, error: scheduleError } = await query

    if (scheduleError) {
      apiLogger.error('Error fetching schedules', scheduleError)
      return NextResponse.json(
        { error: 'Failed to check for conflicts.' },
        { status: 500 }
      )
    }

    // Check for overlaps
    const conflicts = existingSchedules.filter((schedule: any) => {
      const scheduleStart = new Date(schedule.scheduled_date)
      const scheduleEnd = new Date(scheduleStart.getTime() + schedule.duration_minutes * 60 * 1000)

      // Check if there's an overlap
      // Overlap occurs if: (start1 < end2) AND (end1 > start2)
      return (startTime < scheduleEnd) && (endTime > scheduleStart)
    })

    // Return result
    return NextResponse.json({
      has_conflicts: conflicts.length > 0,
      conflict_count: conflicts.length,
      conflicts: conflicts.map((c: any) => ({
        id: c.id,
        title: c.title,
        scheduled_date: c.scheduled_date,
        duration_minutes: c.duration_minutes,
        participant_name: c.participant_name,
        status: c.status,
        start_time: new Date(c.scheduled_date).toLocaleString(),
        end_time: new Date(new Date(c.scheduled_date).getTime() + c.duration_minutes * 60 * 1000).toLocaleString()
      })),
      requested_slot: {
        start_time: startTime.toLocaleString(),
        end_time: endTime.toLocaleString(),
        duration_minutes
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/schedule/dsm-team/check-conflicts', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
