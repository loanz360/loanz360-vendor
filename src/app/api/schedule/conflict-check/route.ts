import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'


/**
 * Validation schema for conflict check request
 */
const conflictCheckSchema = z.object({
  scheduled_date: z.string().datetime({ message: 'Invalid date format' }),
  duration_minutes: z.number().int().min(15).max(480),
  exclude_meeting_id: z.string().uuid().optional()
})

/**
 * Helper function to verify user authorization - all active employees can access
 */
async function verifyUserAuthorization(supabase: unknown, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile) {
    const userStatus = profile.status?.toUpperCase() || ''
    return userStatus === 'ACTIVE'
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (userProfile) {
    return userProfile.role?.toUpperCase() === 'EMPLOYEE'
  }

  return false
}

/**
 * POST /api/schedule/conflict-check
 * Checks if a scheduled date/time conflicts with existing meetings
 *
 * Request Body:
 * - scheduled_date: ISO datetime string
 * - duration_minutes: Meeting duration in minutes (15-480)
 * - exclude_meeting_id: Optional meeting ID to exclude (for updates)
 *
 * Response:
 * - has_conflict: boolean
 * - conflicting_meeting: Meeting details if conflict exists
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
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

    // Verify user authorization
    const isAuthorized = await verifyUserAuthorization(supabase, user.id)
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Channel Partner Executives and Managers.' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validationResult = conflictCheckSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { scheduled_date, duration_minutes, exclude_meeting_id } = validationResult.data

    // Call the database function to check for conflicts
    const { data: hasConflict, error: conflictError } = await supabase.rpc('check_schedule_conflict', {
      p_user_id: user.id,
      p_scheduled_date: scheduled_date,
      p_duration_minutes: duration_minutes,
      p_exclude_meeting_id: exclude_meeting_id || null
    })

    if (conflictError) {
      apiLogger.error('Error checking schedule conflict', conflictError)
      return NextResponse.json(
        { error: 'Failed to check for conflicts' },
        { status: 500 }
      )
    }

    // If there's a conflict, get the conflicting meeting details
    let conflictingMeeting = null
    if (hasConflict) {
      const scheduledDateTime = new Date(scheduled_date)
      const endDateTime = new Date(scheduledDateTime.getTime() + duration_minutes * 60000)

      const { data: conflictingMeetings } = await supabase
        .from('meetings')
        .select('id, title, scheduled_date, scheduled_end_date, duration_minutes, participant_name')
        .eq('sales_executive_id', user.id)
        .eq('is_deleted', false)
        .not('status', 'in', '("CANCELLED","COMPLETED")')
        .or(`and(scheduled_date.lte.${endDateTime.toISOString()},scheduled_end_date.gte.${scheduledDateTime.toISOString()})`)
        .neq('id', exclude_meeting_id || '00000000-0000-0000-0000-000000000000')
        .order('scheduled_date', { ascending: true })
        .limit(1)

      if (conflictingMeetings && conflictingMeetings.length > 0) {
        conflictingMeeting = {
          id: conflictingMeetings[0].id,
          title: conflictingMeetings[0].title,
          scheduled_date: conflictingMeetings[0].scheduled_date,
          scheduled_end_date: conflictingMeetings[0].scheduled_end_date,
          duration_minutes: conflictingMeetings[0].duration_minutes,
          participant_name: conflictingMeetings[0].participant_name
        }
      }
    }

    return NextResponse.json({
      success: true,
      has_conflict: !!hasConflict,
      conflicting_meeting: conflictingMeeting,
      message: hasConflict
        ? `This time slot conflicts with an existing meeting${conflictingMeeting ? ` with ${conflictingMeeting.participant_name}` : ''}`
        : 'No scheduling conflicts found'
    })

  } catch (error) {
    apiLogger.error('Error in conflict-check endpoint', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
