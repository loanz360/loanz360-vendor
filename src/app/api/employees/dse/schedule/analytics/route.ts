import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


/**
 * GET /api/employees/dse/schedule/analytics
 * Comprehensive schedule analytics for DSE
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

    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days
    const periodDays = parseInt(period)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = new Date().toISOString().split('T')[0]

    // Fetch all meetings in the period
    const { data: meetings } = await supabase
      .from('dse_meetings')
      .select('id, status, meeting_type, meeting_purpose, outcome, scheduled_date, start_time, end_time, duration_minutes, customer_id, lead_id, created_at')
      .eq('organizer_id', user.id)
      .gte('scheduled_date', startDateStr)
      .lte('scheduled_date', endDateStr)

    const allMeetings = meetings || []

    // ANA-1: Meeting Funnel
    const funnelScheduled = allMeetings.length
    const funnelConfirmed = allMeetings.filter(m => m.status !== 'Cancelled').length
    const funnelAttended = allMeetings.filter(m => ['Completed', 'In Progress'].includes(m.status)).length
    const funnelPositive = allMeetings.filter(m =>
      m.status === 'Completed' && m.outcome &&
      ['Successful - Positive Response', 'Successful - Deal Closed', 'Successful - Documents Collected'].includes(m.outcome)
    ).length
    const funnelDealClosed = allMeetings.filter(m =>
      m.outcome === 'Successful - Deal Closed'
    ).length

    const meetingFunnel = {
      scheduled: funnelScheduled,
      confirmed: funnelConfirmed,
      attended: funnelAttended,
      positive_outcome: funnelPositive,
      deal_closed: funnelDealClosed,
      conversion_rate: funnelScheduled > 0 ? Math.round((funnelDealClosed / funnelScheduled) * 100) : 0,
      attendance_rate: funnelScheduled > 0 ? Math.round((funnelAttended / funnelScheduled) * 100) : 0,
    }

    // ANA-2: Best Time Slots
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const timeSlotMap: Record<string, { total: number; successful: number }> = {}

    allMeetings.forEach(m => {
      const date = new Date(m.scheduled_date + 'T00:00:00')
      const dayOfWeek = dayNames[date.getDay()]
      const hour = parseInt(m.start_time?.split(':')[0] || '0')
      const timeSlot = hour < 12 ? 'Morning (9-12)' : hour < 15 ? 'Afternoon (12-3)' : hour < 18 ? 'Late Afternoon (3-6)' : 'Evening (6+)'
      const key = `${dayOfWeek}|${timeSlot}`

      if (!timeSlotMap[key]) {
        timeSlotMap[key] = { total: 0, successful: 0 }
      }
      timeSlotMap[key].total++
      if (m.status === 'Completed' && m.outcome?.startsWith('Successful')) {
        timeSlotMap[key].successful++
      }
    })

    const bestTimeSlots = Object.entries(timeSlotMap)
      .map(([key, stats]) => {
        const [day, slot] = key.split('|')
        return {
          day_of_week: day,
          time_slot: slot,
          total_meetings: stats.total,
          successful_meetings: stats.successful,
          success_rate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0,
        }
      })
      .sort((a, b) => b.success_rate - a.success_rate)

    // Meeting Type Distribution
    const typeDistribution: Record<string, number> = {}
    const purposeDistribution: Record<string, number> = {}
    const outcomeDistribution: Record<string, number> = {}

    allMeetings.forEach(m => {
      typeDistribution[m.meeting_type || 'Other'] = (typeDistribution[m.meeting_type || 'Other'] || 0) + 1
      purposeDistribution[m.meeting_purpose || 'Other'] = (purposeDistribution[m.meeting_purpose || 'Other'] || 0) + 1
      if (m.outcome) {
        outcomeDistribution[m.outcome] = (outcomeDistribution[m.outcome] || 0) + 1
      }
    })

    // Average meeting duration
    const completedMeetings = allMeetings.filter(m => m.status === 'Completed' && m.duration_minutes)
    const avgDuration = completedMeetings.length > 0
      ? Math.round(completedMeetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / completedMeetings.length)
      : 0

    // Daily trend
    const dailyTrend: Record<string, { meetings: number; completed: number; cancelled: number }> = {}
    allMeetings.forEach(m => {
      const date = m.scheduled_date?.split('T')[0] || m.scheduled_date
      if (!dailyTrend[date]) {
        dailyTrend[date] = { meetings: 0, completed: 0, cancelled: 0 }
      }
      dailyTrend[date].meetings++
      if (m.status === 'Completed') dailyTrend[date].completed++
      if (m.status === 'Cancelled') dailyTrend[date].cancelled++
    })

    const trends = Object.entries(dailyTrend)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ANA-4: Customer Engagement Scores
    const customerMeetings: Record<string, { scheduled: number; attended: number; name: string }> = {}
    allMeetings.forEach(m => {
      if (m.customer_id) {
        if (!customerMeetings[m.customer_id]) {
          customerMeetings[m.customer_id] = { scheduled: 0, attended: 0, name: '' }
        }
        customerMeetings[m.customer_id].scheduled++
        if (m.status === 'Completed') {
          customerMeetings[m.customer_id].attended++
        }
      }
    })

    // Fetch customer names
    const customerIds = Object.keys(customerMeetings)
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('dse_customers')
        .select('id, full_name')
        .in('id', customerIds.slice(0, 50))

      customers?.forEach(c => {
        if (customerMeetings[c.id]) {
          customerMeetings[c.id].name = c.full_name
        }
      })
    }

    const customerEngagement = Object.entries(customerMeetings)
      .map(([id, stats]) => ({
        customer_id: id,
        customer_name: stats.name || 'Unknown',
        meetings_scheduled: stats.scheduled,
        meetings_attended: stats.attended,
        attendance_rate: stats.scheduled > 0 ? Math.round((stats.attended / stats.scheduled) * 100) : 0,
        engagement_score: Math.min(100, stats.attended * 20 + (stats.scheduled > 0 ? (stats.attended / stats.scheduled) * 50 : 0)),
      }))
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, 20)

    // Reschedule count (BL-7)
    const rescheduledMeetings = allMeetings.filter(m => m.status === 'Rescheduled')
    const noShowMeetings = allMeetings.filter(m => m.status === 'No Show')

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDateStr, end_date: endDateStr, days: periodDays },
        meeting_funnel: meetingFunnel,
        best_time_slots: bestTimeSlots,
        distributions: {
          by_type: typeDistribution,
          by_purpose: purposeDistribution,
          by_outcome: outcomeDistribution,
        },
        performance: {
          total_meetings: allMeetings.length,
          completed: allMeetings.filter(m => m.status === 'Completed').length,
          cancelled: allMeetings.filter(m => m.status === 'Cancelled').length,
          no_show: noShowMeetings.length,
          rescheduled: rescheduledMeetings.length,
          avg_duration_minutes: avgDuration,
          meetings_per_day: periodDays > 0 ? Math.round((allMeetings.length / periodDays) * 10) / 10 : 0,
        },
        trends,
        customer_engagement: customerEngagement,
      },
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching schedule analytics', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
