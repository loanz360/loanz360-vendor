
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/calendar/google-calendar-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/calendar/availability
 * Check user availability and get available time slots
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const date = searchParams.get('date')
    const duration_minutes = searchParams.get('duration_minutes')

    if (!user_id || !date) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: user_id, date'
      }, { status: 400 })
    }

    const duration = duration_minutes ? parseInt(duration_minutes) : 30

    const slots = await googleCalendarService.getAvailableSlots(user_id, date, duration)

    return NextResponse.json({
      success: true,
      data: {
        slots,
        count: slots.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/calendar/availability', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
