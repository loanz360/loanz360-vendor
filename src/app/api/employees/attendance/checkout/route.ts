export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { calculateDistance } from '@/lib/utils/geolocation'

// Validation schema for checkout
const checkoutSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional()
  }).optional().nullable()
})

// Helper to validate checkout geofence
async function validateCheckoutGeofence(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
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
      .select('name, latitude, longitude, radius_meters, checkout_radius_meters')
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

    // Use checkout radius if specified, otherwise use default radius or 200m
    const radiusMeters = officeLocation.checkout_radius_meters || officeLocation.radius_meters || 200

    if (distance > radiusMeters) {
      return {
        isValid: false,
        distance: Math.round(distance),
        message: `You are ${Math.round(distance)}m away from ${officeLocation.name}. Please check out from within ${radiusMeters}m radius.`
      }
    }

    return {
      isValid: true,
      distance: Math.round(distance),
      message: `Check-out from ${officeLocation.name} (${Math.round(distance)}m away)`
    }
  } catch (error) {
    apiLogger.error('Checkout geofence validation error', error)
    // Allow check-out if validation fails (backward compatibility)
    return { isValid: true, message: 'Geofence validation skipped' }
  }
}

export async function POST(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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
    
    // Validate request body
    const validationResult = checkoutSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      )
    }
    
    const { location } = validationResult.data

    // Find the most recent open attendance record (handles midnight checkout)
    const { data: existing, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .is('check_out', null)
      .not('check_in', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Please check in first', errorCode: 'NOT_CHECKED_IN' },
        { status: 400 }
      )
    }

    const attendanceDate = existing.date

    // Validate geofence if location is provided (nullish check to handle coords of 0)
    let geofenceMessage = ''
    if (location?.latitude != null && location?.longitude != null) {
      const geofenceResult = await validateCheckoutGeofence(
        supabase,
        user.id,
        location.latitude,
        location.longitude
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
      geofenceMessage = geofenceResult.message || ''
    }

    const now = new Date().toISOString()
    const locationString = location
      ? `${location.latitude},${location.longitude}`
      : null

    // Calculate total hours worked
    const checkInTime = new Date(existing.check_in)
    const checkOutTime = new Date(now)
    const rawHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    // Deduct lunch break from total hours
    let lunchDurationMinutes = 60 // Default: 1 hour lunch
    try {
      const { data: profile } = await supabase
        .from('employee_profile')
        .select('office_timing_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile?.office_timing_id) {
        const { data: timing } = await supabase
          .from('office_timings')
          .select('lunch_duration_minutes')
          .eq('id', profile.office_timing_id)
          .maybeSingle()

        if (timing?.lunch_duration_minutes != null) {
          lunchDurationMinutes = timing.lunch_duration_minutes
        }
      } else {
        // Fallback: default office timing
        const { data: defaultTiming } = await supabase
          .from('office_timings')
          .select('lunch_duration_minutes')
          .eq('is_default', true)
          .limit(1)
          .maybeSingle()

        if (defaultTiming?.lunch_duration_minutes != null) {
          lunchDurationMinutes = defaultTiming.lunch_duration_minutes
        }
      }
    } catch (err) {
      apiLogger.error('Failed to fetch lunch duration, using default 60 min', err)
    }

    // Cap lunch deduction at 120 minutes to prevent data corruption from bad config
    const cappedLunchMinutes = Math.min(120, lunchDurationMinutes)
    // Only deduct lunch if employee worked more than 4 hours (short days skip lunch deduction)
    const lunchDeduction = rawHours > 4 ? cappedLunchMinutes / 60 : 0
    const totalHours = Math.max(0, rawHours - lunchDeduction).toFixed(2)

    // Update attendance record with check-out time (using original check-in date)
    const { data, error } = await supabase
      .from('attendance')
      .update({
        check_out: now,
        location_check_out: locationString,
        total_hours: parseFloat(totalHours)
      })
      .eq('user_id', user.id)
      .eq('date', attendanceDate)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        checkOut: now,
        checkIn: data.check_in,
        totalHours: data.total_hours,
        lunchDeducted: lunchDeduction > 0,
        date: attendanceDate
      },
      message: geofenceMessage || 'Successfully checked out'
    })

  } catch (error) {
    apiLogger.error('Check-out error', error)
    logApiError(error as Error, request, { action: 'post_checkout' })
    return NextResponse.json(
      { success: false, error: 'Failed to check out', errorCode: 'CHECKOUT_FAILED' },
      { status: 500 }
    )
  }
}
