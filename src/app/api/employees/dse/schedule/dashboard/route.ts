import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'
import { SLA_RULES, getTodayDateString } from '@/lib/types/dse-schedule.types'


/**
 * GET /api/employees/dse/schedule/dashboard
 * Retrieves comprehensive dashboard summary for DSE schedules
 * Includes SLA alerts, suggested meetings, and analytics
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

    // Unified role verification - accepts both DSE and DSM
    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 403 }
      )
    }

    const today = getTodayDateString()
    const now = new Date()

    // Calculate date ranges
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const monthEndStr = monthEnd.toISOString().split('T')[0]

    // Parallel queries for better performance
    const [
      todayResult,
      weekResult,
      monthStatsResult,
      next7DaysResult,
      upcomingTodayResult,
      pendingRemindersResult,
    ] = await Promise.all([
      // Today's meetings - only fetch needed fields
      supabase
        .from('dse_meetings')
        .select('status', { count: 'exact' })
        .eq('organizer_id', user.id)
        .eq('scheduled_date', today),

      // This week's meetings
      supabase
        .from('dse_meetings')
        .select('status, customer_id, lead_id', { count: 'exact' })
        .eq('organizer_id', user.id)
        .gte('scheduled_date', today)
        .lte('scheduled_date', weekEndStr),

      // This month's meetings for statistics
      supabase
        .from('dse_meetings')
        .select('status, meeting_type, meeting_purpose, duration_minutes', { count: 'exact' })
        .eq('organizer_id', user.id)
        .gte('scheduled_date', monthStartStr)
        .lte('scheduled_date', monthEndStr),

      // Next 7 days upcoming meetings
      supabase
        .from('dse_meetings')
        .select('*, dse_customers(full_name, company_name), dse_leads(customer_name, lead_stage)')
        .eq('organizer_id', user.id)
        .gte('scheduled_date', today)
        .lte('scheduled_date', weekEndStr)
        .in('status', ['Scheduled', 'Confirmed'])
        .order('scheduled_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(10),

      // Today's upcoming meetings
      supabase
        .from('dse_meetings')
        .select('*, dse_customers(full_name, company_name), dse_leads(customer_name, lead_stage)')
        .eq('organizer_id', user.id)
        .eq('scheduled_date', today)
        .gte('start_time', now.toTimeString().split(' ')[0])
        .in('status', ['Scheduled', 'Confirmed'])
        .order('start_time', { ascending: true })
        .limit(5),

      // Pending reminders
      supabase
        .from('dse_reminders')
        .select('*, dse_meetings(title, scheduled_date, start_time)')
        .eq('owner_id', user.id)
        .eq('status', 'Active')
        .gte('reminder_datetime', now.toISOString())
        .order('reminder_datetime', { ascending: true })
        .limit(5),
    ])

    const todayMeetings = todayResult.data || []
    const weekMeetings = weekResult.data || []
    const monthMeetings = monthStatsResult.data || []

    // Calculate today stats
    const todayCompleted = todayMeetings.filter(m => m.status === 'Completed').length
    const todayUpcoming = todayMeetings.filter(m => ['Scheduled', 'Confirmed'].includes(m.status)).length
    const todayCancelled = todayMeetings.filter(m => m.status === 'Cancelled').length

    // Calculate week stats
    const weekCompleted = weekMeetings.filter(m => m.status === 'Completed').length
    const weekCustomerMeetings = weekMeetings.filter(m => m.customer_id).length
    const weekLeadMeetings = weekMeetings.filter(m => m.lead_id).length

    // Calculate month stats
    const monthCompleted = monthMeetings.filter(m => m.status === 'Completed').length
    const monthCancelled = monthMeetings.filter(m => m.status === 'Cancelled').length
    const monthNoShow = monthMeetings.filter(m => m.status === 'No Show').length

    // Attendance rate
    const resolvedMeetings = monthMeetings.filter(m =>
      ['Completed', 'Cancelled', 'No Show'].includes(m.status)
    ).length
    const attendanceRate = resolvedMeetings > 0
      ? Math.round((monthCompleted / resolvedMeetings) * 100)
      : 100

    // Average duration
    const completedWithDuration = monthMeetings.filter(m =>
      m.status === 'Completed' && m.duration_minutes
    )
    const avgDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / completedWithDuration.length)
      : 60

    // Meeting type & purpose distribution
    const meetingTypeStats: Record<string, number> = {}
    const meetingPurposeStats: Record<string, number> = {}
    monthMeetings.forEach(m => {
      const type = m.meeting_type || 'Other'
      meetingTypeStats[type] = (meetingTypeStats[type] || 0) + 1
      const purpose = m.meeting_purpose || 'Other'
      meetingPurposeStats[purpose] = (meetingPurposeStats[purpose] || 0) + 1
    })

    // Meeting Funnel Analytics (ANA-1)
    const allMonthMeetings = monthMeetings
    const funnelScheduled = allMonthMeetings.length
    const funnelConfirmed = allMonthMeetings.filter(m => m.status !== 'Cancelled').length
    const funnelAttended = allMonthMeetings.filter(m => ['Completed', 'In Progress'].includes(m.status)).length
    const funnelPositive = allMonthMeetings.filter(m => m.status === 'Completed').length

    // SLA Alerts (BL-3) - check customers not contacted within SLA timeframe
    let slaAlerts: unknown[] = []
    try {
      const { data: customers } = await supabase
        .from('dse_customers')
        .select('id, full_name, priority')
        .eq('dse_user_id', user.id)
        .eq('customer_status', 'Active')
        .limit(100)

      if (customers && customers.length > 0) {
        const customerIds = customers.map(c => c.id)
        const { data: lastMeetings } = await supabase
          .from('dse_meetings')
          .select('customer_id, scheduled_date')
          .eq('organizer_id', user.id)
          .in('customer_id', customerIds)
          .eq('status', 'Completed')
          .order('scheduled_date', { ascending: false })

        const lastMeetingMap: Record<string, string> = {}
        lastMeetings?.forEach(m => {
          if (m.customer_id && !lastMeetingMap[m.customer_id]) {
            lastMeetingMap[m.customer_id] = m.scheduled_date
          }
        })

        slaAlerts = customers
          .map(customer => {
            const lastDate = lastMeetingMap[customer.id]
            const daysSince = lastDate
              ? Math.floor((now.getTime() - new Date(lastDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
              : 999
            const rules = SLA_RULES[customer.priority] || SLA_RULES['Default']
            const slaStatus = daysSince > rules.frequency_days ? 'breach'
              : daysSince > rules.warning_days ? 'warning'
              : 'ok'

            if (slaStatus === 'ok') return null
            return {
              customer_id: customer.id,
              customer_name: customer.full_name,
              priority: customer.priority,
              days_since_last_contact: daysSince,
              required_frequency_days: rules.frequency_days,
              sla_status: slaStatus,
              last_meeting_date: lastDate || null,
              suggested_action: slaStatus === 'breach'
                ? 'Urgent: Schedule meeting immediately'
                : 'Schedule meeting within ' + (rules.frequency_days - daysSince) + ' days',
            }
          })
          .filter(Boolean)
          .sort((a: unknown, b: unknown) => b.days_since_last_contact - a.days_since_last_contact)
          .slice(0, 10)
      }
    } catch (slaError) {
      apiLogger.error('Error calculating SLA alerts', slaError)
    }

    // Suggested Meetings (BL-1) - leads that need follow-up
    let suggestedMeetings: unknown[] = []
    try {
      const { data: leads } = await supabase
        .from('dse_leads')
        .select('id, customer_name, lead_stage, updated_at')
        .eq('dse_user_id', user.id)
        .in('lead_stage', ['New', 'Qualified', 'Proposal', 'Negotiation', 'Documentation'])
        .order('updated_at', { ascending: true })
        .limit(20)

      if (leads) {
        const stageToMeeting: Record<string, { purpose: string; type: string; reason: string }> = {
          'New': { purpose: 'Introduction', type: 'Phone Call', reason: 'New lead needs initial contact' },
          'Qualified': { purpose: 'Product Demo', type: 'In Person', reason: 'Qualified lead ready for product demo' },
          'Proposal': { purpose: 'Proposal Discussion', type: 'In Person', reason: 'Proposal stage - discuss terms' },
          'Negotiation': { purpose: 'Negotiation', type: 'In Person', reason: 'Negotiation in progress' },
          'Documentation': { purpose: 'Document Collection', type: 'Site Visit', reason: 'Documents pending collection' },
        }

        suggestedMeetings = leads
          .map(lead => {
            const daysSince = Math.floor(
              (now.getTime() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
            )
            const mapping = stageToMeeting[lead.lead_stage]
            if (!mapping || daysSince < 2) return null

            return {
              lead_id: lead.id,
              lead_name: lead.customer_name,
              lead_stage: lead.lead_stage,
              suggested_purpose: mapping.purpose,
              suggested_type: mapping.type,
              reason: mapping.reason,
              priority: daysSince > 7 ? 'high' : daysSince > 3 ? 'medium' : 'low',
              days_since_last_contact: daysSince,
            }
          })
          .filter(Boolean)
          .sort((a: unknown, b: unknown) => b.days_since_last_contact - a.days_since_last_contact)
          .slice(0, 5)
      }
    } catch (suggestError) {
      apiLogger.error('Error calculating suggested meetings', suggestError)
    }

    return NextResponse.json({
      success: true,
      data: {
        today: {
          total: todayResult.count || 0,
          completed: todayCompleted,
          upcoming: todayUpcoming,
          cancelled: todayCancelled,
        },
        this_week: {
          total: weekResult.count || 0,
          completed: weekCompleted,
          upcoming: weekMeetings.filter(m => ['Scheduled', 'Confirmed'].includes(m.status)).length,
          customer_meetings: weekCustomerMeetings,
          lead_meetings: weekLeadMeetings,
        },
        this_month: {
          total: monthStatsResult.count || 0,
          completed: monthCompleted,
          cancelled: monthCancelled,
          no_show: monthNoShow,
          attendance_rate: attendanceRate,
          avg_duration_minutes: avgDuration,
        },
        upcoming_today: upcomingTodayResult.data || [],
        next_7_days: next7DaysResult.data || [],
        pending_reminders: pendingRemindersResult.data || [],
        analytics: {
          meeting_types: meetingTypeStats,
          meeting_purposes: meetingPurposeStats,
          meeting_funnel: {
            scheduled: funnelScheduled,
            confirmed: funnelConfirmed,
            attended: funnelAttended,
            positive_outcome: funnelPositive,
            deal_closed: 0, // Would need to join with leads to get this
            conversion_rate: funnelScheduled > 0 ? Math.round((funnelPositive / funnelScheduled) * 100) : 0,
          },
        },
        sla_alerts: slaAlerts,
        suggested_meetings: suggestedMeetings,
      },
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE schedule dashboard', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
