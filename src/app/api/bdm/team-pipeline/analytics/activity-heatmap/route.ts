export const dynamic = 'force-dynamic'

/**
 * BDM Team Pipeline - Activity Heatmap API
 * GET /api/bdm/team-pipeline/analytics/activity-heatmap
 *
 * Returns BDE activity intensity by day and hour
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds, getBDEsByIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)
    const bdeIdsParam = searchParams.get('bdeIds')?.split(',').filter(Boolean)

    // 3. Get BDEs under this BDM
    const allBDEIds = await getBDEIds(bdmId)
    const bdeIds = bdeIdsParam && bdeIdsParam.length > 0 ? bdeIdsParam : allBDEIds

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // 4. Get BDE details
    const bdes = await getBDEsByIds(bdeIds)

    // 5. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 6. Fetch timeline events for activity tracking
    const { data: events, error } = await supabase
      .from('lead_timeline_events')
      .select('performed_by, created_at, event_type')
      .in('performed_by', bdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (error) {
      apiLogger.error('[Activity Heatmap API] Error fetching events', error)
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    // 7. Group events by BDE, day, and hour
    const bdeActivityMap = new Map<
      string,
      Map<number, Map<number, number>>
    >()

    // Initialize map for each BDE
    bdeIds.forEach((bdeId) => {
      const dayMap = new Map<number, Map<number, number>>()
      // Initialize all days (0-6) and hours (0-23)
      for (let day = 0; day < 7; day++) {
        const hourMap = new Map<number, number>()
        for (let hour = 0; hour < 24; hour++) {
          hourMap.set(hour, 0)
        }
        dayMap.set(day, hourMap)
      }
      bdeActivityMap.set(bdeId, dayMap)
    })

    // Count activities
    events?.forEach((event) => {
      const eventDate = new Date(event.created_at)
      const dayOfWeek = eventDate.getDay() // 0-6 (Sunday-Saturday)
      const hour = eventDate.getHours() // 0-23

      const bdeMap = bdeActivityMap.get(event.performed_by)
      if (bdeMap) {
        const dayMap = bdeMap.get(dayOfWeek)
        if (dayMap) {
          const currentCount = dayMap.get(hour) || 0
          dayMap.set(hour, currentCount + 1)
        }
      }
    })

    // 8. Calculate intensity levels
    // Find global max for normalization
    let globalMax = 0
    bdeActivityMap.forEach((dayMap) => {
      dayMap.forEach((hourMap) => {
        hourMap.forEach((count) => {
          if (count > globalMax) globalMax = count
        })
      })
    })

    // 9. Build response data
    const data = bdes.map((bde) => {
      const bdeMap = bdeActivityMap.get(bde.id)
      if (!bdeMap) return null

      const activityByDay = DAYS_OF_WEEK.map((dayName, dayIndex) => {
        const hourMap = bdeMap.get(dayIndex)
        if (!hourMap) return { day: dayName, hours: [] }

        const hours = Array.from(hourMap.entries()).map(([hour, activityCount]) => {
          // Calculate intensity (0-100)
          const intensity = globalMax > 0 ? (activityCount / globalMax) * 100 : 0

          // Categorize intensity
          let intensityLevel: 'none' | 'low' | 'medium' | 'high'
          if (activityCount === 0) {
            intensityLevel = 'none'
          } else if (intensity < 33) {
            intensityLevel = 'low'
          } else if (intensity < 67) {
            intensityLevel = 'medium'
          } else {
            intensityLevel = 'high'
          }

          return {
            hour,
            activityCount,
            intensity: Math.round(intensity),
            intensityLevel,
          }
        })

        return {
          day: dayName,
          dayIndex,
          hours,
          totalActivity: hours.reduce((sum, h) => sum + h.activityCount, 0),
        }
      })

      // Calculate total activity for this BDE
      const totalActivity = activityByDay.reduce(
        (sum, day) => sum + day.totalActivity,
        0
      )

      // Find peak hours
      const allHours: Array<{ day: string; hour: number; count: number }> = []
      activityByDay.forEach((day) => {
        day.hours.forEach((hourData) => {
          allHours.push({
            day: day.day,
            hour: hourData.hour,
            count: hourData.activityCount,
          })
        })
      })
      allHours.sort((a, b) => b.count - a.count)
      const peakHours = allHours.slice(0, 3).filter((h) => h.count > 0)

      return {
        bdeId: bde.id,
        bdeName: bde.full_name,
        activityByDay,
        totalActivity,
        peakHours,
        avgDailyActivity: Math.round(totalActivity / 7),
      }
    }).filter(Boolean)

    // 10. Return response
    return NextResponse.json({
      success: true,
      data,
      metadata: {
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          type: range,
        },
        bdeCount: bdeIds.length,
        totalEvents: events?.length || 0,
        globalMaxActivity: globalMax,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Activity Heatmap API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch activity heatmap data',
      },
      { status: 500 }
    )
  }
}
