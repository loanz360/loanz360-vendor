
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get real-time dashboard stats
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Get today's calls stats
    const { data: todayCalls, error: callsError } = await supabase
      .from('ts_calls')
      .select('id, status, outcome, scheduled_time, actual_duration_minutes')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_date', todayISO.split('T')[0])
      .lte('scheduled_date', todayISO.split('T')[0])

    if (callsError) throw callsError

    const completedCalls = todayCalls?.filter(c => c.status === 'COMPLETED').length || 0
    const scheduledCalls = todayCalls?.filter(c => c.status === 'SCHEDULED').length || 0
    const totalMinutes = todayCalls?.reduce((sum, c) => sum + (c.actual_duration_minutes || 0), 0) || 0

    // Calculate conversions
    const conversions = todayCalls?.filter(c =>
      ['CONVERTED', 'INTERESTED', 'APPLICATION_STARTED'].includes(c.outcome || '')
    ).length || 0

    // Get current hour calls
    const currentHour = now.getHours()
    const hourStart = `${currentHour.toString().padStart(2, '0')}:00:00`
    const hourEnd = `${(currentHour + 1).toString().padStart(2, '0')}:00:00`

    const thisHourCalls = todayCalls?.filter(c => {
      const time = c.scheduled_time
      return time >= hourStart && time < hourEnd
    }).length || 0

    // Get pending tasks count
    const { count: pendingTasks } = await supabase
      .from('ts_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('sales_executive_id', user.id)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .lte('due_date', now.toISOString().split('T')[0])

    // Get upcoming reminders count
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    const { count: upcomingReminders } = await supabase
      .from('ts_reminders')
      .select('*', { count: 'exact', head: true })
      .eq('sales_executive_id', user.id)
      .eq('is_acknowledged', false)
      .lte('remind_at', oneHourFromNow.toISOString())

    // Get active follow-ups
    const { count: activeFollowups } = await supabase
      .from('ts_followup_instances')
      .select('*', { count: 'exact', head: true })
      .eq('sales_executive_id', user.id)
      .eq('status', 'ACTIVE')

    // Get user points
    const { data: userPoints } = await supabase
      .from('ts_user_points')
      .select('current_points, current_level, level_name, current_streak_days')
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    // Get daily target progress
    const { data: dailyTarget } = await supabase
      .from('ts_daily_targets')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('target_date', todayISO.split('T')[0])
      .maybeSingle()

    // Calculate target progress
    const targetCalls = dailyTarget?.target_calls || 50
    const targetConversions = dailyTarget?.target_conversions || 5
    const callProgress = Math.round((completedCalls / targetCalls) * 100)
    const conversionProgress = Math.round((conversions / targetConversions) * 100)

    // Recent activity (last 5 events)
    const { data: recentCalls } = await supabase
      .from('ts_calls')
      .select('id, title, status, outcome, updated_at')
      .eq('sales_executive_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5)

    const recentActivity = (recentCalls || []).map(call => ({
      id: call.id,
      type: 'CALL',
      title: call.title,
      status: call.status,
      outcome: call.outcome,
      timestamp: call.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        timestamp: now.toISOString(),
        calls: {
          completed_today: completedCalls,
          scheduled_today: scheduledCalls,
          this_hour: thisHourCalls,
          total_minutes: totalMinutes,
          conversions: conversions
        },
        tasks: {
          pending_due: pendingTasks || 0
        },
        reminders: {
          upcoming: upcomingReminders || 0
        },
        followups: {
          active: activeFollowups || 0
        },
        gamification: {
          points: userPoints?.current_points || 0,
          level: userPoints?.current_level || 1,
          level_name: userPoints?.level_name || 'Rookie',
          streak: userPoints?.current_streak_days || 0
        },
        targets: {
          calls: {
            current: completedCalls,
            target: targetCalls,
            progress: Math.min(callProgress, 100)
          },
          conversions: {
            current: conversions,
            target: targetConversions,
            progress: Math.min(conversionProgress, 100)
          }
        },
        recent_activity: recentActivity
      }
    })
  } catch (error) {
    apiLogger.error('Real-time stats error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch real-time stats' },
      { status: 500 }
    )
  }
}
