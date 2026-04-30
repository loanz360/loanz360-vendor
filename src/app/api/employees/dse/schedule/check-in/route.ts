import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


const checkInSchema = z.object({
  meeting_id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  action: z.enum(['check_in', 'check_out']),
})

/**
 * POST /api/employees/dse/schedule/check-in
 * GPS check-in/check-out for in-person meetings (MOB-2)
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { meeting_id, latitude, longitude, action } = checkInSchema.parse(body)

    // Verify meeting belongs to user
    const { data: meeting, error: meetingError } = await supabase
      .from('dse_meetings')
      .select('id, title, organizer_id, status, location_latitude, location_longitude, check_in_time')
      .eq('id', meeting_id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    if (action === 'check_in') {
      if (meeting.check_in_time) {
        return NextResponse.json({ success: false, error: 'Already checked in' }, { status: 400 })
      }

      // Update meeting with check-in data and set status to In Progress
      await supabase
        .from('dse_meetings')
        .update({
          check_in_time: now,
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          status: 'In Progress',
          updated_at: now,
        })
        .eq('id', meeting_id)
        .eq('organizer_id', user.id)

      // Calculate distance from planned location if available
      let distanceMeters: number | null = null
      if (meeting.location_latitude && meeting.location_longitude) {
        distanceMeters = calculateDistance(
          latitude, longitude,
          meeting.location_latitude, meeting.location_longitude
        )
      }

      // Audit log
      await supabase.from('dse_audit_log').insert({
        entity_type: 'Meeting',
        entity_id: meeting_id,
        action: 'CheckedIn',
        new_values: { latitude, longitude, distance_from_planned: distanceMeters },
        user_id: user.id,
        changes_summary: `Checked in to "${meeting.title}"${distanceMeters ? ` (${Math.round(distanceMeters)}m from planned location)` : ''}`,
      })

      return NextResponse.json({
        success: true,
        data: {
          meeting_id,
          action: 'check_in',
          time: now,
          latitude,
          longitude,
          distance_from_planned_meters: distanceMeters,
          status_updated: 'In Progress',
        },
        message: 'Checked in successfully',
      })
    }

    if (action === 'check_out') {
      if (!meeting.check_in_time) {
        return NextResponse.json({ success: false, error: 'Not checked in yet' }, { status: 400 })
      }

      // Calculate actual duration
      const checkInTime = new Date(meeting.check_in_time)
      const checkOutTime = new Date()
      const actualDurationMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60))

      await supabase
        .from('dse_meetings')
        .update({
          check_out_time: now,
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          updated_at: now,
        })
        .eq('id', meeting_id)
        .eq('organizer_id', user.id)

      // Audit log
      await supabase.from('dse_audit_log').insert({
        entity_type: 'Meeting',
        entity_id: meeting_id,
        action: 'CheckedOut',
        new_values: { latitude, longitude, actual_duration_minutes: actualDurationMinutes },
        user_id: user.id,
        changes_summary: `Checked out from "${meeting.title}" (${actualDurationMinutes} minutes)`,
      })

      return NextResponse.json({
        success: true,
        data: {
          meeting_id,
          action: 'check_out',
          time: now,
          latitude,
          longitude,
          actual_duration_minutes: actualDurationMinutes,
        },
        message: `Checked out. Meeting duration: ${actualDurationMinutes} minutes`,
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path.join('.'), message: err.message })),
      }, { status: 400 })
    }

    apiLogger.error('Error processing check-in/check-out', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Haversine distance calculation between two GPS coordinates
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
