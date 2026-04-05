import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { calculateDistance } from '@/lib/utils/geolocation'

// Validation schema for check-in
const checkinSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional()
  }).optional().nullable(),
  device_info: z.object({
    user_agent: z.string().optional(),
    ip_address: z.string().optional()
  }).optional().nullable(),
  timezone: z.string().optional().default('Asia/Kolkata')
})

/** Get current date/time in user's timezone */
function getUserLocalDate(timezone: string): { date: string; dayOfWeek: number; now: Date } {
  const now = new Date()
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const localDate = formatter.format(now) // YYYY-MM-DD
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    const dayStr = dayFormatter.format(now)
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return { date: localDate, dayOfWeek: dayMap[dayStr] ?? now.getDay(), now }
  } catch {
    // Fallback to UTC if timezone is invalid
    return { date: now.toISOString().split('T')[0], dayOfWeek: now.getDay(), now }
  }
}

// Helper to check if user is within office geo-fence
async function validateGeofence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userLat: number,
  userLon: number
): Promise<{ isValid: boolean; distance?: number; message?: string }> {
  try {
    // Get user's office location configuration
    const { data: userConfig } = await supabase
      .from('users')
      .select('office_location_id')
      .eq('id', userId)
      .maybeSingle()

    if (!userConfig?.office_location_id) {
      // No geo-fencing configured for this user
      return { isValid: true, message: 'No geo-fence configured' }
    }

    // Get office location details
    const { data: officeLocation } = await supabase
      .from('office_locations')
      .select('name, latitude, longitude, radius_meters')
      .eq('id', userConfig.office_location_id)
      .maybeSingle()

    if (!officeLocation) {
      return { isValid: true, message: 'Office location not found' }
    }

    // Calculate distance from office
    const distance = calculateDistance(
      userLat,
      userLon,
      officeLocation.latitude,
      officeLocation.longitude
    )

    const radiusMeters = officeLocation.radius_meters || 200 // Default 200m radius

    if (distance > radiusMeters) {
      return {
        isValid: false,
        distance: Math.round(distance),
        message: `You are ${Math.round(distance)}m away from ${officeLocation.name}. Please check in from within ${radiusMeters}m radius.`
      }
    }

    return {
      isValid: true,
      distance: Math.round(distance),
      message: `Check-in from ${officeLocation.name} (${Math.round(distance)}m away)`
    }
  } catch (error) {
    apiLogger.error('Geofence validation error', error)
    // Allow check-in if validation fails (backward compatibility)
    return { isValid: true, message: 'Geofence validation skipped' }
  }
}

// Helper to check late arrival using dynamic office timings
async function checkLateArrival(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  checkinTime: Date
): Promise<{
  isLate: boolean
  lateByMinutes: number
  expectedTime: string
  gracePeriodMinutes: number
}> {
  const hours = checkinTime.getHours()
  const minutes = checkinTime.getMinutes()
  const totalMinutes = hours * 60 + minutes

  // Fetch office timings from employee profile → office_timings table
  let expectedMinutes = 9 * 60 // Default: 09:00 AM
  let gracePeriodMinutes = 15 // Default: 15 minutes
  let expectedTimeStr = '09:00 AM'

  try {
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('office_timing_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (profile?.office_timing_id) {
      const { data: timing } = await supabase
        .from('office_timings')
        .select('check_in_time, grace_period_minutes')
        .eq('id', profile.office_timing_id)
        .maybeSingle()

      if (timing?.check_in_time) {
        // Parse time string (e.g., "09:00:00" or "09:30:00")
        const [h, m] = timing.check_in_time.split(':').map(Number)
        expectedMinutes = h * 60 + m
        gracePeriodMinutes = timing.grace_period_minutes || 15
        const period = h >= 12 ? 'PM' : 'AM'
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
        expectedTimeStr = `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
      }
    } else {
      // Fallback: try default office timing
      const { data: defaultTiming } = await supabase
        .from('office_timings')
        .select('check_in_time, grace_period_minutes')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()

      if (defaultTiming?.check_in_time) {
        const [h, m] = defaultTiming.check_in_time.split(':').map(Number)
        expectedMinutes = h * 60 + m
        gracePeriodMinutes = defaultTiming.grace_period_minutes || 15
        const period = h >= 12 ? 'PM' : 'AM'
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
        expectedTimeStr = `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
      }
    }
  } catch (err) {
    apiLogger.error('Failed to fetch office timings, using defaults', err)
  }

  const lateByMinutes = Math.max(0, totalMinutes - (expectedMinutes + gracePeriodMinutes))

  return {
    isLate: lateByMinutes > 0,
    lateByMinutes,
    expectedTime: expectedTimeStr,
    gracePeriodMinutes
  }
}

// Helper to get cumulative late count for current month
async function getMonthlyLateCount(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, date: Date): Promise<number> {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  const { count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_late', true)
    .gte('date', monthStart)
    .lte('date', monthEnd)

  return count || 0
}

// POST - Check in
export async function POST(request: NextRequest) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  // Apply rate limiting (stricter for check-in to prevent abuse)
  try {
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.CREATE,
    maxRequests: 5, // Max 5 check-in attempts per hour
    windowMs: 60 * 60 * 1000
  })
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate with Zod
    const validatedData = checkinSchema.parse(body)

    // Get current date and time in user's timezone (critical for correct day-of-week)
    const now = new Date()
    const userTimezone = validatedData.timezone || 'Asia/Kolkata'
    const userLocal = getUserLocalDate(userTimezone)
    const todayUTC = userLocal.date

    // === VALIDATION 1: Check if it's a working day (not weekend or holiday) ===
    const dayOfWeek = userLocal.dayOfWeek

    // Check if it's weekend (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot check in on weekends',
          errorCode: 'WEEKEND_CHECKIN',
          day: dayOfWeek === 0 ? 'Sunday' : 'Saturday'
        },
        { status: 400 }
      )
    }

    // Check if it's a mandatory holiday (allow check-in on optional holidays)
    let isMandatoryHoliday: boolean | null = null
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('is_working_day', { p_check_date: todayUTC })

    if (rpcError) {
      // Fallback: Direct query to holidays table if RPC doesn't exist
      // Only block on mandatory holidays; optional holidays allow check-in
      const { data: holidayRecord } = await supabase
        .from('holidays')
        .select('id, name, is_mandatory')
        .eq('date', todayUTC)
        .limit(1)
        .maybeSingle()

      if (holidayRecord?.is_mandatory) {
        isMandatoryHoliday = true
      } else {
        isMandatoryHoliday = false
      }
    } else {
      // RPC returns false if NOT a working day — verify it's a mandatory holiday
      if (rpcResult === false) {
        const { data: holidayRecord } = await supabase
          .from('holidays')
          .select('id, is_mandatory')
          .eq('date', todayUTC)
          .maybeSingle()

        // Only block mandatory holidays; optional holidays are working days
        isMandatoryHoliday = holidayRecord?.is_mandatory === true
      } else {
        isMandatoryHoliday = false
      }
    }

    if (isMandatoryHoliday === true) {
      const { data: holidayInfo } = await supabase
        .from('holidays')
        .select('name')
        .eq('date', todayUTC)
        .eq('is_mandatory', true)
        .maybeSingle()

      return NextResponse.json(
        {
          success: false,
          error: `Cannot check in on mandatory holiday: ${holidayInfo?.name || 'Public Holiday'}`,
          errorCode: 'HOLIDAY_CHECKIN'
        },
        { status: 400 }
      )
    }

    // === VALIDATION 2: Check if already checked in today ===
    const { data: existing, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayUTC)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existing && existing.check_in) {
      return NextResponse.json(
        {
          success: false,
          error: 'Already checked in today',
          errorCode: 'ALREADY_CHECKED_IN',
          checkedInAt: existing.check_in
        },
        { status: 400 }
      )
    }

    // === VALIDATION 3: Geo-fence validation (if location provided) ===
    let geofenceResult = { isValid: true, distance: 0, message: 'Location not provided' }

    if (validatedData.location && validatedData.location.latitude != null && validatedData.location.longitude != null) {
      geofenceResult = await validateGeofence(
        supabase,
        user.id,
        validatedData.location.latitude,
        validatedData.location.longitude
      )

      if (!geofenceResult.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: geofenceResult.message,
            errorCode: 'GEOFENCE_VIOLATION',
            distance: geofenceResult.distance
          },
          { status: 403 }
        )
      }
    }

    // === VALIDATION 4: Check late arrival (dynamic from office_timings) ===
    const lateArrivalCheck = await checkLateArrival(supabase, user.id, now)

    // === CREATE ATTENDANCE RECORD ===
    const attendanceData: Record<string, unknown> = {
      user_id: user.id,
      date: todayUTC,
      check_in: now.toISOString(),
      location_check_in: validatedData.location
        ? `${validatedData.location.latitude},${validatedData.location.longitude}`
        : null,
      status: 'present',
      is_late: lateArrivalCheck.isLate,
      late_by_minutes: lateArrivalCheck.lateByMinutes
    }

    // Add device info if provided
    if (validatedData.device_info) {
      attendanceData.device_info = validatedData.device_info
    }

    const { data: attendance, error: insertError } = await supabase
      .from('attendance')
      .upsert(attendanceData, {
        onConflict: 'user_id,date'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      throw insertError
    }

    // Get cumulative late count for current month
    const monthlyLateCount = lateArrivalCheck.isLate
      ? await getMonthlyLateCount(supabase, user.id, now)
      : 0

    // Log successful check-in

    // Prepare response message
    let message = 'Check-in successful'
    if (lateArrivalCheck.isLate) {
      const checkinTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      message = `Late check-in (${lateArrivalCheck.lateByMinutes} minutes late). Expected: ${lateArrivalCheck.expectedTime} (${lateArrivalCheck.gracePeriodMinutes} min grace). You checked in at ${checkinTimeStr}`
      if (monthlyLateCount > 1) {
        message += `. You have been late ${monthlyLateCount} times this month.`
      }
    }
    if (geofenceResult.distance && geofenceResult.distance > 0) {
      message += `. ${geofenceResult.message}`
    }

    return NextResponse.json({
      success: true,
      data: {
        checkIn: now.toISOString(),
        date: todayUTC,
        isLate: lateArrivalCheck.isLate,
        lateByMinutes: lateArrivalCheck.lateByMinutes,
        monthlyLateCount,
        distance: geofenceResult.distance
      },
      message
    }, { status: 201 })

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errorCode: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Check-in error', error)
    logApiError(error as Error, request, { action: 'post_checkin' })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'CHECKIN_FAILED'
      },
      { status: 500 }
    )
  }
}
