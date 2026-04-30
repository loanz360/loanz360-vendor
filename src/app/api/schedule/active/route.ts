import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/schedule/active
 * Retrieves active (upcoming) schedules grouped by time period
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Call the database function to get active schedules
    const { data: schedules, error: queryError } = await supabase.rpc(
      'get_active_schedules',
      {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset
      }
    )

    if (queryError) {
      apiLogger.error('Error fetching active schedules', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch active schedules' },
        { status: 500 }
      )
    }

    // Group schedules by time period
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    const endOfWeek = new Date(now)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
    endOfWeek.setHours(23, 59, 59, 999)

    const nextWeekStart = new Date(endOfWeek)
    nextWeekStart.setDate(nextWeekStart.getDate() + 1)
    nextWeekStart.setHours(0, 0, 0, 0)

    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)
    nextWeekEnd.setHours(23, 59, 59, 999)

    const grouped = {
      today: schedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= now && scheduleDate <= endOfToday
      }),
      tomorrow: schedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= tomorrow && scheduleDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
      }),
      this_week: schedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        const tomorrowEnd = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        return scheduleDate >= tomorrowEnd && scheduleDate <= endOfWeek
      }),
      next_week: schedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= nextWeekStart && scheduleDate <= nextWeekEnd
      }),
      total: schedules.length
    }

    return NextResponse.json(grouped)
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/active', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
