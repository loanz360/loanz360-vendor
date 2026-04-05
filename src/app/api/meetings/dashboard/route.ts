import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/dashboard
 * Retrieves dashboard summary for meetings module
 *
 * Returns:
 * - Today's meetings summary
 * - This week's summary
 * - This month's summary
 * - Upcoming meetings (next 7 days)
 * - Pending reminders
 * - Recent notes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get today's meetings
    const { data: todayMeetings } = await supabase
      .from('meetings')
      .select('id, status')
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .gte('scheduled_date', today.toISOString())
      .lt('scheduled_date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())

    // Get this week's meetings
    const { data: weekMeetings } = await supabase
      .from('meetings')
      .select('id, status')
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .gte('scheduled_date', weekStart.toISOString())

    // Get this month's meetings with statistics
    const { data: monthMeetingsData } = await supabase.rpc('get_meeting_statistics', {
      p_user_id: user.id,
      p_start_date: monthStart.toISOString().split('T')[0],
      p_end_date: now.toISOString().split('T')[0]
    })

    // Get upcoming meetings (next 7 days)
    const { data: upcomingMeetings } = await supabase.rpc('get_upcoming_meetings', {
      p_user_id: user.id,
      p_days_ahead: 7
    })

    // Get pending reminders
    const { data: pendingReminders } = await supabase.rpc('get_pending_reminders', {
      p_user_id: user.id
    })

    // Get recent notes (last 5)
    const { data: recentNotes } = await supabase
      .from('meeting_notes')
      .select(
        `
        *,
        meeting:meetings!meeting_notes_meeting_id_fkey(title),
        author:users!meeting_notes_created_by_fkey(full_name, email)
      `
      )
      .eq('created_by', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(5)

    // Calculate summaries
    const todaySummary = {
      total: todayMeetings?.length || 0,
      completed: todayMeetings?.filter((m) => m.status === 'COMPLETED').length || 0,
      upcoming:
        todayMeetings?.filter((m) => ['SCHEDULED', 'CONFIRMED'].includes(m.status)).length || 0
    }

    const weekSummary = {
      total: weekMeetings?.length || 0,
      completed: weekMeetings?.filter((m) => m.status === 'COMPLETED').length || 0,
      upcoming:
        weekMeetings?.filter((m) => ['SCHEDULED', 'CONFIRMED'].includes(m.status)).length || 0
    }

    const monthStats = monthMeetingsData?.[0] || {
      total_scheduled: 0,
      total_completed: 0,
      attendance_rate: 0,
      conversion_rate: 0
    }

    const monthSummary = {
      total: monthStats.total_scheduled + monthStats.total_completed,
      completed: monthStats.total_completed,
      conversion_rate: monthStats.conversion_rate,
      attendance_rate: monthStats.attendance_rate
    }

    const dashboard = {
      today: todaySummary,
      this_week: weekSummary,
      this_month: monthSummary,
      upcoming_meetings: upcomingMeetings || [],
      pending_reminders: pendingReminders || [],
      recent_notes: recentNotes || []
    }

    return NextResponse.json(dashboard)
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/meetings/dashboard', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
