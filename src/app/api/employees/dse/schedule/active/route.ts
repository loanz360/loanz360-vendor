import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'
import { getTodayDateString } from '@/lib/types/dse-schedule.types'


/**
 * GET /api/employees/dse/schedule/active
 * Retrieves active (upcoming) meetings grouped by time period
 * Supports dateFrom/dateTo for calendar view filtering
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Unified role verification
    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const customerId = searchParams.get('customerId')
    const leadId = searchParams.get('leadId')
    const meetingType = searchParams.get('meetingType')
    const meetingPurpose = searchParams.get('meetingPurpose')
    // BUG-20 FIX: Parse dateFrom/dateTo for calendar view
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const now = new Date()
    const today = getTodayDateString()

    // Calculate date ranges for grouping
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const dayAfterTomorrow = new Date(now)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0]

    // Calculate end of week (Sunday)
    const endOfWeek = new Date(now)
    const daysUntilSunday = 7 - endOfWeek.getDay()
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday)
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

    // Next week range
    const nextWeekStart = new Date(endOfWeek)
    nextWeekStart.setDate(nextWeekStart.getDate() + 1)
    const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0]
    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6)
    const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0]

    // Build base query
    let query = supabase
      .from('dse_meetings')
      .select('*, dse_customers(id, full_name, company_name, primary_mobile, email), dse_leads(id, customer_name, lead_stage, mobile)')
      .eq('organizer_id', user.id)
      .in('status', ['Scheduled', 'Confirmed', 'In Progress'])
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(limit)

    // Apply date range - use custom range if provided (for calendar), otherwise default to today+
    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom)
    } else {
      query = query.gte('scheduled_date', today)
    }

    if (dateTo) {
      query = query.lte('scheduled_date', dateTo)
    }

    // Apply filters
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }
    if (meetingType) {
      query = query.eq('meeting_type', meetingType)
    }
    if (meetingPurpose) {
      query = query.eq('meeting_purpose', meetingPurpose)
    }

    const { data: meetings, error: queryError } = await query

    if (queryError) {
      throw queryError
    }

    // Group meetings by time period
    const grouped = {
      today: [] as unknown[],
      tomorrow: [] as unknown[],
      this_week: [] as unknown[],
      next_week: [] as unknown[],
      later: [] as unknown[],
      total: meetings?.length || 0,
    }

    meetings?.forEach(meeting => {
      const meetingDate = meeting.scheduled_date?.split('T')[0] || meeting.scheduled_date

      if (meetingDate === today) {
        grouped.today.push(meeting)
      } else if (meetingDate === tomorrowStr) {
        grouped.tomorrow.push(meeting)
      } else if (meetingDate >= dayAfterTomorrowStr && meetingDate <= endOfWeekStr) {
        grouped.this_week.push(meeting)
      } else if (meetingDate >= nextWeekStartStr && meetingDate <= nextWeekEndStr) {
        grouped.next_week.push(meeting)
      } else {
        grouped.later.push(meeting)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        grouped,
        stats: {
          today_count: grouped.today.length,
          tomorrow_count: grouped.tomorrow.length,
          this_week_count: grouped.this_week.length,
          next_week_count: grouped.next_week.length,
          later_count: grouped.later.length,
        },
        date_ranges: {
          today,
          tomorrow: tomorrowStr,
          week_end: endOfWeekStr,
          next_week_start: nextWeekStartStr,
          next_week_end: nextWeekEndStr,
        },
      },
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE active schedules', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
