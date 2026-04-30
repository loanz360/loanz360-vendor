import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/tele-sales/schedule/dashboard
 * Retrieves comprehensive dashboard summary for TeleSales schedules
 * Includes calls, tasks, reminders, and daily targets
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

    // Verify user is TeleSales
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    const isTeleSales = profile?.subrole?.toUpperCase().replace(/[\s-]/g, '_') === 'TELE_SALES'

    if (!isTeleSales) {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      const normalizedSubRole = userProfile?.sub_role?.toUpperCase().replace(/[\s-]/g, '_')
      if (!userProfile || normalizedSubRole !== 'TELE_SALES') {
        return NextResponse.json(
          { success: false, error: 'Access denied. This feature is only available for TeleSales executives.' },
          { status: 403 }
        )
      }
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 8)

    // Calculate date ranges
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()))
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const monthEndStr = monthEnd.toISOString().split('T')[0]

    // =========================================
    // CALLS DATA
    // =========================================

    // Today's calls
    const { data: todayCalls } = await supabase
      .from('ts_calls')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('scheduled_date', today)
      .eq('is_deleted', false)

    const todayCallsScheduled = todayCalls?.length || 0
    const todayCallsCompleted = todayCalls?.filter(c => c.status === 'COMPLETED').length || 0
    const todayCallsRemaining = todayCalls?.filter(c =>
      ['SCHEDULED', 'CALLBACK_REQUESTED'].includes(c.status) && c.scheduled_time >= currentTime
    ).length || 0
    const todayConnects = todayCalls?.filter(c => c.call_disposition === 'ANSWERED').length || 0

    // Calculate today's talk time
    const todayTalkTimeSeconds = todayCalls?.reduce((sum, c) => sum + (c.actual_duration_seconds || 0), 0) || 0
    const todayTalkTimeMinutes = Math.round(todayTalkTimeSeconds / 60)

    // Today's callbacks due
    const todayCallbacksDue = todayCalls?.filter(c =>
      c.requires_follow_up && c.follow_up_date === today
    ).length || 0

    // This week's calls
    const { data: weekCalls } = await supabase
      .from('ts_calls')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', weekEndStr)
      .eq('is_deleted', false)

    const weekCallsTotal = weekCalls?.length || 0
    const weekCallsCompleted = weekCalls?.filter(c => c.status === 'COMPLETED').length || 0
    const weekConnects = weekCalls?.filter(c => c.call_disposition === 'ANSWERED').length || 0
    const weekTalkTimeSeconds = weekCalls?.reduce((sum, c) => sum + (c.actual_duration_seconds || 0), 0) || 0
    const weekConversions = weekCalls?.filter(c => c.outcome === 'CONVERTED').length || 0
    const weekAvgDuration = weekCallsCompleted > 0
      ? Math.round(weekTalkTimeSeconds / weekCallsCompleted)
      : 0

    // This month's calls
    const { data: monthCalls } = await supabase
      .from('ts_calls')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', monthStartStr)
      .lte('scheduled_date', monthEndStr)
      .eq('is_deleted', false)

    const monthCallsTotal = monthCalls?.length || 0
    const monthCallsCompleted = monthCalls?.filter(c => c.status === 'COMPLETED').length || 0
    const monthConnects = monthCalls?.filter(c => c.call_disposition === 'ANSWERED').length || 0
    const monthConversions = monthCalls?.filter(c => c.outcome === 'CONVERTED').length || 0
    const monthTalkTimeSeconds = monthCalls?.reduce((sum, c) => sum + (c.actual_duration_seconds || 0), 0) || 0

    const connectRate = monthCallsCompleted > 0 ? Math.round((monthConnects / monthCallsCompleted) * 100) : 0
    const conversionRate = monthConnects > 0 ? Math.round((monthConversions / monthConnects) * 100) : 0

    // Average quality score
    const callsWithQuality = monthCalls?.filter(c => c.call_quality_score) || []
    const avgQualityScore = callsWithQuality.length > 0
      ? Math.round((callsWithQuality.reduce((sum, c) => sum + (c.call_quality_score || 0), 0) / callsWithQuality.length) * 10) / 10
      : 0

    // =========================================
    // TASKS DATA
    // =========================================

    // Today's tasks
    const { data: todayTasks } = await supabase
      .from('ts_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('due_date', today)
      .eq('is_deleted', false)

    const todayTasksDue = todayTasks?.length || 0
    const todayTasksCompleted = todayTasks?.filter(t => t.status === 'COMPLETED').length || 0

    // Overdue tasks
    const { data: overdueTasks } = await supabase
      .from('ts_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .lt('due_date', today)
      .neq('status', 'COMPLETED')
      .neq('status', 'CANCELLED')
      .eq('is_deleted', false)
      .order('due_date', { ascending: true })
      .limit(10)

    const todayTasksOverdue = overdueTasks?.length || 0

    // This week's tasks completed
    const { data: weekTasks } = await supabase
      .from('ts_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('due_date', weekStartStr)
      .lte('due_date', weekEndStr)
      .eq('status', 'COMPLETED')
      .eq('is_deleted', false)

    const weekTasksCompleted = weekTasks?.length || 0

    // This month's tasks completed
    const { data: monthTasks } = await supabase
      .from('ts_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr)
      .eq('status', 'COMPLETED')
      .eq('is_deleted', false)

    const monthTasksCompleted = monthTasks?.length || 0

    // =========================================
    // REMINDERS DATA
    // =========================================

    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const { data: todayReminders } = await supabase
      .from('ts_reminders')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('remind_at', now.toISOString())
      .lte('remind_at', todayEnd.toISOString())
      .eq('status', 'PENDING')
      .eq('is_deleted', false)

    const todayRemindersCount = todayReminders?.length || 0

    // =========================================
    // DAILY TARGETS
    // =========================================

    const { data: dailyTargets } = await supabase
      .from('ts_daily_targets')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('target_date', today)
      .maybeSingle()

    // Update daily targets with actual data if exists
    if (dailyTargets) {
      await supabase
        .from('ts_daily_targets')
        .update({
          calls_completed: todayCallsCompleted,
          connects_achieved: todayConnects,
          talk_time_achieved_minutes: todayTalkTimeMinutes,
          conversions_achieved: todayCalls?.filter(c => c.outcome === 'CONVERTED').length || 0,
          callbacks_completed: todayCalls?.filter(c =>
            c.call_type === 'SCHEDULED_CALLBACK' && c.status === 'COMPLETED'
          ).length || 0,
          avg_call_duration_seconds: todayCallsCompleted > 0
            ? Math.round(todayTalkTimeSeconds / todayCallsCompleted)
            : 0
        })
        .eq('id', dailyTargets.id)
    }

    // =========================================
    // UPCOMING CALLS (Next 10)
    // =========================================

    const { data: upcomingCalls } = await supabase
      .from('ts_calls')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage, loan_type, loan_amount)
      `)
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', today)
      .in('status', ['SCHEDULED', 'CALLBACK_REQUESTED', 'RESCHEDULED'])
      .eq('is_deleted', false)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(10)

    // =========================================
    // PENDING TASKS (High Priority & Due Soon)
    // =========================================

    const { data: pendingTasks } = await supabase
      .from('ts_tasks')
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
      .from('ts_reminders')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('status', 'PENDING')
      .eq('is_deleted', false)
      .gte('remind_at', now.toISOString())
      .order('remind_at', { ascending: true })
      .limit(5)

    // =========================================
    // CALLBACKS DUE
    // =========================================

    const { data: callbacksDue } = await supabase
      .from('ts_calls')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage)
      `)
      .eq('sales_executive_id', user.id)
      .eq('requires_follow_up', true)
      .lte('follow_up_date', today)
      .neq('status', 'COMPLETED')
      .eq('is_deleted', false)
      .order('follow_up_date', { ascending: true })
      .limit(10)

    return NextResponse.json({
      success: true,
      data: {
        today: {
          calls_scheduled: todayCallsScheduled,
          calls_completed: todayCallsCompleted,
          calls_remaining: todayCallsRemaining,
          connects: todayConnects,
          talk_time_minutes: todayTalkTimeMinutes,
          tasks_due: todayTasksDue,
          tasks_completed: todayTasksCompleted,
          tasks_overdue: todayTasksOverdue,
          reminders: todayRemindersCount,
          callbacks_due: todayCallbacksDue
        },
        this_week: {
          calls_total: weekCallsTotal,
          calls_completed: weekCallsCompleted,
          connects: weekConnects,
          talk_time_minutes: Math.round(weekTalkTimeSeconds / 60),
          conversions: weekConversions,
          tasks_completed: weekTasksCompleted,
          avg_call_duration_seconds: weekAvgDuration
        },
        this_month: {
          calls_total: monthCallsTotal,
          calls_completed: monthCallsCompleted,
          connect_rate: connectRate,
          conversion_rate: conversionRate,
          avg_quality_score: avgQualityScore,
          tasks_completed: monthTasksCompleted,
          total_talk_time_hours: Math.round((monthTalkTimeSeconds / 3600) * 10) / 10
        },
        targets: dailyTargets || null,
        upcoming_calls: upcomingCalls || [],
        pending_tasks: pendingTasks || [],
        active_reminders: activeReminders || [],
        overdue_tasks: overdueTasks || [],
        callbacks_due: callbacksDue || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales schedule dashboard', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
