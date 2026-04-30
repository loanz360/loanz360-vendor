import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/digital-sales/schedule/dashboard
 * Retrieves comprehensive dashboard summary for Digital Sales schedules
 * Includes meetings, tasks, reminders, and analytics
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

    // Verify user is Digital Sales
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    const isDigitalSales = profile?.subrole?.toUpperCase() === 'DIGITAL_SALES'

    if (!isDigitalSales) {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (!userProfile || userProfile.sub_role?.toUpperCase() !== 'DIGITAL_SALES') {
        return NextResponse.json(
          { success: false, error: 'Access denied. This feature is only available for Digital Sales executives.' },
          { status: 403 }
        )
      }
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 8)

    // Calculate date ranges
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const monthEndStr = monthEnd.toISOString().split('T')[0]

    // =========================================
    // MEETINGS DATA
    // =========================================

    // Today's meetings
    const { data: todayMeetings } = await supabase
      .from('ds_meetings')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('scheduled_date', today)
      .eq('is_deleted', false)

    const todayMeetingsTotal = todayMeetings?.length || 0
    const todayMeetingsCompleted = todayMeetings?.filter(m => m.status === 'COMPLETED').length || 0
    const todayMeetingsUpcoming = todayMeetings?.filter(m =>
      ['SCHEDULED', 'CONFIRMED'].includes(m.status) && m.start_time >= currentTime
    ).length || 0

    // This week's meetings
    const { data: weekMeetings } = await supabase
      .from('ds_meetings')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', today)
      .lte('scheduled_date', weekEndStr)
      .eq('is_deleted', false)

    const weekMeetingsTotal = weekMeetings?.length || 0
    const weekMeetingsCompleted = weekMeetings?.filter(m => m.status === 'COMPLETED').length || 0

    // This month's meetings
    const { data: monthMeetings } = await supabase
      .from('ds_meetings')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', monthStartStr)
      .lte('scheduled_date', monthEndStr)
      .eq('is_deleted', false)

    const monthMeetingsTotal = monthMeetings?.length || 0
    const monthMeetingsCompleted = monthMeetings?.filter(m => m.status === 'COMPLETED').length || 0

    // Calculate attendance rate
    const scheduledMeetings = monthMeetings?.filter(m =>
      ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(m.status)
    ).length || 0
    const attendanceRate = scheduledMeetings > 0
      ? Math.round((monthMeetingsCompleted / scheduledMeetings) * 100)
      : 100

    // Average meeting duration
    const completedWithDuration = monthMeetings?.filter(m =>
      m.status === 'COMPLETED' && m.duration_minutes
    ) || []
    const avgMeetingDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / completedWithDuration.length)
      : 30

    // =========================================
    // TASKS DATA
    // =========================================

    // Today's tasks
    const { data: todayTasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('due_date', today)
      .eq('is_deleted', false)

    const todayTasksDue = todayTasks?.length || 0
    const todayTasksCompleted = todayTasks?.filter(t => t.status === 'COMPLETED').length || 0

    // Overdue tasks
    const { data: overdueTasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .lt('due_date', today)
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELLED')
      .eq('is_deleted', false)
      .order('due_date', { ascending: true })
      .limit(10)

    const todayTasksOverdue = overdueTasks?.length || 0

    // This week's tasks
    const { data: weekTasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('due_date', today)
      .lte('due_date', weekEndStr)
      .eq('is_deleted', false)

    const weekTasksTotal = weekTasks?.length || 0
    const weekTasksCompleted = weekTasks?.filter(t => t.status === 'COMPLETED').length || 0

    // This month's tasks
    const { data: monthTasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr)
      .eq('is_deleted', false)

    const monthTasksCompleted = monthTasks?.filter(t => t.status === 'COMPLETED').length || 0
    const monthTasksTotal = monthTasks?.length || 0
    const taskCompletionRate = monthTasksTotal > 0
      ? Math.round((monthTasksCompleted / monthTasksTotal) * 100)
      : 100

    // =========================================
    // REMINDERS DATA
    // =========================================

    // Today's reminders
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const { data: todayReminders } = await supabase
      .from('ds_reminders')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('remind_at', now.toISOString())
      .lte('remind_at', todayEnd.toISOString())
      .eq('status', 'PENDING')
      .eq('is_deleted', false)

    const todayRemindersCount = todayReminders?.length || 0

    // =========================================
    // UPCOMING MEETINGS (Next 5)
    // =========================================

    const { data: upcomingMeetings } = await supabase
      .from('ds_meetings')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage)
      `)
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', today)
      .in('status', ['SCHEDULED', 'CONFIRMED'])
      .eq('is_deleted', false)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5)

    // =========================================
    // PENDING TASKS (High Priority & Due Soon)
    // =========================================

    const { data: pendingTasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .eq('is_deleted', false)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })
      .limit(5)

    // =========================================
    // ACTIVE REMINDERS
    // =========================================

    const { data: activeReminders } = await supabase
      .from('ds_reminders')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('status', 'PENDING')
      .eq('is_deleted', false)
      .gte('remind_at', now.toISOString())
      .order('remind_at', { ascending: true })
      .limit(5)

    // =========================================
    // FOLLOW-UP REQUIRED
    // =========================================

    const { data: followUpMeetings } = await supabase
      .from('ds_meetings')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage)
      `)
      .eq('sales_executive_id', user.id)
      .eq('requires_follow_up', true)
      .eq('status', 'COMPLETED')
      .eq('is_deleted', false)
      .order('scheduled_date', { ascending: false })
      .limit(5)

    // =========================================
    // CALCULATE CONVERSION RATE (Leads contacted this month)
    // =========================================

    // Get unique leads contacted this month
    const uniqueLeadsContacted = new Set(
      monthMeetings?.filter(m => m.lead_id).map(m => m.lead_id)
    ).size

    // Calculate conversion rate based on outcomes
    const successfulOutcomes = monthMeetings?.filter(m =>
      ['SUCCESSFUL', 'DEAL_CLOSED', 'CONVERTED_TO_LEAD'].includes(m.outcome)
    ).length || 0
    const conversionRate = monthMeetingsCompleted > 0
      ? Math.round((successfulOutcomes / monthMeetingsCompleted) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        today: {
          meetings: todayMeetingsTotal,
          meetings_completed: todayMeetingsCompleted,
          meetings_upcoming: todayMeetingsUpcoming,
          tasks_due: todayTasksDue,
          tasks_completed: todayTasksCompleted,
          tasks_overdue: todayTasksOverdue,
          reminders: todayRemindersCount
        },
        this_week: {
          meetings: weekMeetingsTotal,
          meetings_completed: weekMeetingsCompleted,
          tasks_total: weekTasksTotal,
          tasks_completed: weekTasksCompleted,
          leads_contacted: new Set(weekMeetings?.filter(m => m.lead_id).map(m => m.lead_id)).size,
          follow_ups_done: weekMeetings?.filter(m => m.meeting_purpose === 'FOLLOW_UP' && m.status === 'COMPLETED').length || 0
        },
        this_month: {
          meetings: monthMeetingsTotal,
          meetings_completed: monthMeetingsCompleted,
          attendance_rate: attendanceRate,
          tasks_completed: monthTasksCompleted,
          completion_rate: taskCompletionRate,
          avg_meeting_duration: avgMeetingDuration,
          conversion_rate: conversionRate
        },
        upcoming_meetings: upcomingMeetings || [],
        pending_tasks: pendingTasks || [],
        active_reminders: activeReminders || [],
        overdue_tasks: overdueTasks || [],
        follow_up_required: followUpMeetings || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching Digital Sales schedule dashboard', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
