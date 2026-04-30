import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


/**
 * Validation schema for conflict check request
 */
const conflictCheckSchema = z.object({
  scheduled_date: z.string(), // YYYY-MM-DD
  start_time: z.string(), // HH:mm
  end_time: z.string().optional(), // HH:mm
  duration_minutes: z.number().int().min(15).max(480).optional(),
  exclude_meeting_id: z.string().uuid().optional()
})

/**
 * POST /api/employees/dse/schedule/conflict-check
 * Checks if a scheduled date/time conflicts with existing meetings
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

    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = conflictCheckSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { scheduled_date, start_time, end_time, duration_minutes, exclude_meeting_id } = validationResult.data

    // Calculate end time if not provided
    let calculatedEndTime = end_time
    if (!calculatedEndTime && duration_minutes) {
      const [hours, minutes] = start_time.split(':').map(Number)
      const startMinutes = hours * 60 + minutes
      const endMinutes = startMinutes + duration_minutes
      const endHours = Math.floor(endMinutes / 60)
      const endMins = endMinutes % 60
      calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
      // BUG-12: Prevent overnight meetings - cap at 23:59
      if (endMinutes >= 1440) {
        calculatedEndTime = '23:59'
      }
    }

    // Default to 1 hour if no end time or duration
    if (!calculatedEndTime) {
      const [hours, minutes] = start_time.split(':').map(Number)
      const endHours = hours + 1
      calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      // BUG-12: Prevent overnight meetings - cap at 23:59
      if (endHours >= 24) {
        calculatedEndTime = '23:59'
      }
    }

    // Check for overlapping meetings
    // A meeting overlaps if:
    // - Same date AND
    // - (new_start < existing_end AND new_end > existing_start)
    let query = supabase
      .from('dse_meetings')
      .select('id, title, scheduled_date, start_time, end_time, duration_minutes, status')
      .eq('organizer_id', user.id)
      .eq('scheduled_date', scheduled_date)
      .in('status', ['Scheduled', 'Confirmed', 'In Progress'])
      .lt('start_time', calculatedEndTime) // New meeting's end is after existing start
      .or(`end_time.gt.${start_time},end_time.is.null`) // Existing meeting's end is after new start

    // Exclude specific meeting if updating
    if (exclude_meeting_id) {
      query = query.neq('id', exclude_meeting_id)
    }

    const { data: conflictingMeetings, error: queryError } = await query

    if (queryError) {
      throw queryError
    }

    // Filter out false positives - more precise overlap check
    const realConflicts = (conflictingMeetings || []).filter(meeting => {
      const existingStart = meeting.start_time
      let existingEnd = meeting.end_time

      // Calculate end time for existing meeting if not set
      if (!existingEnd && meeting.duration_minutes) {
        const [h, m] = existingStart.split(':').map(Number)
        const endMinutes = h * 60 + m + meeting.duration_minutes
        existingEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
        // BUG-12: Prevent overnight meetings - cap at 23:59
        if (endMinutes >= 1440) {
          existingEnd = '23:59'
        }
      } else if (!existingEnd) {
        // Default to 1 hour
        const [h, m] = existingStart.split(':').map(Number)
        existingEnd = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        // BUG-12: Prevent overnight meetings - cap at 23:59
        if (h + 1 >= 24) {
          existingEnd = '23:59'
        }
      }

      // Check overlap: (start1 < end2) AND (end1 > start2)
      return start_time < existingEnd && calculatedEndTime > existingStart
    })

    const hasConflict = realConflicts.length > 0

    return NextResponse.json({
      success: true,
      data: {
        has_conflict: hasConflict,
        conflicting_meetings: realConflicts.map(m => ({
          id: m.id,
          title: m.title,
          scheduled_date: m.scheduled_date,
          start_time: m.start_time,
          end_time: m.end_time,
          duration_minutes: m.duration_minutes,
          status: m.status
        })),
        message: hasConflict
          ? `This time slot conflicts with ${realConflicts.length} existing meeting${realConflicts.length > 1 ? 's' : ''}: "${realConflicts[0].title}"`
          : 'No scheduling conflicts found',
        checked_slot: {
          date: scheduled_date,
          start_time,
          end_time: calculatedEndTime
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error checking schedule conflict', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
