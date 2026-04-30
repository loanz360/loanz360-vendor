import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Helper function to verify Digital Sales access
 */
async function verifyDigitalSalesAccess(supabase: unknown, userId: string) {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile?.subrole?.toUpperCase() === 'DIGITAL_SALES') {
    return true
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  return userProfile?.sub_role?.toUpperCase() === 'DIGITAL_SALES'
}

/**
 * GET /api/employees/digital-sales/schedule/analytics
 * Retrieves comprehensive analytics for Digital Sales schedule
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

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // day, week, month, quarter, year
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    // Calculate date ranges
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date = new Date(now)

    if (start_date && end_date) {
      periodStart = new Date(start_date)
      periodEnd = new Date(end_date)
    } else {
      switch (period) {
        case 'day':
          periodStart = new Date(now.setHours(0, 0, 0, 0))
          break
        case 'week':
          periodStart = new Date(now)
          periodStart.setDate(periodStart.getDate() - 7)
          break
        case 'quarter':
          periodStart = new Date(now)
          periodStart.setMonth(periodStart.getMonth() - 3)
          break
        case 'year':
          periodStart = new Date(now)
          periodStart.setFullYear(periodStart.getFullYear() - 1)
          break
        case 'month':
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          break
      }
    }

    const periodStartStr = periodStart.toISOString().split('T')[0]
    const periodEndStr = periodEnd.toISOString().split('T')[0]

    // =========================================
    // MEETINGS ANALYTICS
    // =========================================

    const { data: meetings } = await supabase
      .from('ds_meetings')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', periodStartStr)
      .lte('scheduled_date', periodEndStr)
      .eq('is_deleted', false)

    const meetingsTotal = meetings?.length || 0
    const meetingsCompleted = meetings?.filter(m => m.status === 'COMPLETED').length || 0
    const meetingsCancelled = meetings?.filter(m => m.status === 'CANCELLED').length || 0
    const meetingsNoShow = meetings?.filter(m => m.status === 'NO_SHOW').length || 0

    // Attendance rate
    const conductedMeetings = meetings?.filter(m =>
      ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(m.status)
    ).length || 0
    const attendanceRate = conductedMeetings > 0
      ? Math.round((meetingsCompleted / conductedMeetings) * 100)
      : 100

    // Average duration
    const completedWithDuration = meetings?.filter(m =>
      m.status === 'COMPLETED' && m.duration_minutes
    ) || []
    const avgDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / completedWithDuration.length)
      : 30

    // By meeting type
    const byType: Record<string, number> = {}
    meetings?.forEach(m => {
      const type = m.meeting_type || 'OTHER'
      byType[type] = (byType[type] || 0) + 1
    })

    // By meeting purpose
    const byPurpose: Record<string, number> = {}
    meetings?.forEach(m => {
      const purpose = m.meeting_purpose || 'OTHER'
      byPurpose[purpose] = (byPurpose[purpose] || 0) + 1
    })

    // By outcome
    const byOutcome: Record<string, number> = {}
    meetings?.filter(m => m.outcome).forEach(m => {
      const outcome = m.outcome || 'NO_OUTCOME'
      byOutcome[outcome] = (byOutcome[outcome] || 0) + 1
    })

    // =========================================
    // TASKS ANALYTICS
    // =========================================

    const { data: tasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('created_at', periodStartStr)
      .lte('created_at', periodEndStr + 'T23:59:59')
      .eq('is_deleted', false)

    const tasksTotal = tasks?.length || 0
    const tasksCompleted = tasks?.filter(t => t.status === 'COMPLETED').length || 0
    const tasksPending = tasks?.filter(t => t.status === 'PENDING').length || 0
    const tasksOverdue = tasks?.filter(t => {
      const today = new Date().toISOString().split('T')[0]
      return t.due_date < today && !['COMPLETED', 'CANCELLED'].includes(t.status)
    }).length || 0

    // Task completion rate
    const taskCompletionRate = tasksTotal > 0
      ? Math.round((tasksCompleted / tasksTotal) * 100)
      : 100

    // Average completion time (for tasks that have been completed)
    const completedTasks = tasks?.filter(t =>
      t.status === 'COMPLETED' && t.completed_at
    ) || []
    let avgCompletionTimeHours = 0
    if (completedTasks.length > 0) {
      const totalHours = completedTasks.reduce((sum, t) => {
        const created = new Date(t.created_at)
        const completed = new Date(t.completed_at)
        const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60)
        return sum + hours
      }, 0)
      avgCompletionTimeHours = Math.round(totalHours / completedTasks.length)
    }

    // By category
    const byCategory: Record<string, number> = {}
    tasks?.forEach(t => {
      const category = t.category || 'GENERAL'
      byCategory[category] = (byCategory[category] || 0) + 1
    })

    // By priority
    const byPriority: Record<string, number> = {}
    tasks?.forEach(t => {
      const priority = t.priority || 'MEDIUM'
      byPriority[priority] = (byPriority[priority] || 0) + 1
    })

    // =========================================
    // PRODUCTIVITY METRICS
    // =========================================

    // Calculate number of days in period
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    const workingDays = Math.max(1, Math.ceil(daysDiff * 5 / 7)) // Approximate working days

    const meetingsPerDay = workingDays > 0 ? Math.round((meetingsTotal / workingDays) * 10) / 10 : 0
    const tasksCompletedPerDay = workingDays > 0 ? Math.round((tasksCompleted / workingDays) * 10) / 10 : 0

    // Follow-up rate
    const followUpMeetings = meetings?.filter(m => m.requires_follow_up).length || 0
    const followUpRate = meetingsCompleted > 0
      ? Math.round((followUpMeetings / meetingsCompleted) * 100)
      : 0

    // Unique leads contacted
    const uniqueLeadsContacted = new Set(meetings?.filter(m => m.lead_id).map(m => m.lead_id)).size

    // =========================================
    // TRENDS (Daily breakdown for charts)
    // =========================================

    const trends: { date: string; meetings: number; tasks_completed: number; leads_contacted: number }[] = []

    // Generate daily data points
    const currentDate = new Date(periodStart)
    while (currentDate <= periodEnd) {
      const dateStr = currentDate.toISOString().split('T')[0]

      const dayMeetings = meetings?.filter(m => m.scheduled_date === dateStr).length || 0
      const dayTasksCompleted = tasks?.filter(t =>
        t.status === 'COMPLETED' &&
        t.completed_at &&
        t.completed_at.startsWith(dateStr)
      ).length || 0
      const dayLeadsContacted = new Set(
        meetings?.filter(m => m.scheduled_date === dateStr && m.lead_id).map(m => m.lead_id)
      ).size

      trends.push({
        date: dateStr,
        meetings: dayMeetings,
        tasks_completed: dayTasksCompleted,
        leads_contacted: dayLeadsContacted
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // =========================================
    // RESPONSE TIME (Average time to first contact)
    // =========================================

    // This would require lead creation date - simplified here
    const responseTimeHours = 24 // Placeholder

    return NextResponse.json({
      success: true,
      data: {
        period: {
          start_date: periodStartStr,
          end_date: periodEndStr,
          days: daysDiff,
          working_days: workingDays
        },
        meetings: {
          total: meetingsTotal,
          completed: meetingsCompleted,
          cancelled: meetingsCancelled,
          no_show: meetingsNoShow,
          attendance_rate: attendanceRate,
          avg_duration_minutes: avgDuration,
          by_type: byType,
          by_purpose: byPurpose,
          by_outcome: byOutcome
        },
        tasks: {
          total: tasksTotal,
          completed: tasksCompleted,
          pending: tasksPending,
          overdue: tasksOverdue,
          completion_rate: taskCompletionRate,
          avg_completion_time_hours: avgCompletionTimeHours,
          by_category: byCategory,
          by_priority: byPriority
        },
        productivity: {
          meetings_per_day: meetingsPerDay,
          tasks_completed_per_day: tasksCompletedPerDay,
          follow_up_rate: followUpRate,
          response_time_hours: responseTimeHours,
          leads_contacted: uniqueLeadsContacted
        },
        trends
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching Digital Sales analytics', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
