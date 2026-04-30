import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/ai-crm/cro/calendar-sync
 *
 * Returns the CRO's calendar connection status and upcoming synced events.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if CRO has a connected Google Calendar
    const { data: provider } = await supabase
      .from('calendar_providers')
      .select('id, provider, provider_email, is_active, sync_status, last_sync_at')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle()

    if (!provider) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          provider: null,
          upcoming_events: [],
          synced_tasks: 0,
        },
      })
    }

    // Get upcoming calendar events from this provider
    const now = new Date().toISOString()
    const oneWeekLater = new Date(Date.now() + 7 * 86400000).toISOString()

    const { data: events } = await supabase
      .from('calendar_events')
      .select('id, title, description, start_time, end_time, status, meeting_link, lead_id, interaction_type')
      .eq('calendar_provider_id', provider.id)
      .gte('start_time', now)
      .lte('start_time', oneWeekLater)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true })
      .limit(20)

    // Count tasks synced to calendar
    const { count: syncedTasks } = await supabase
      .from('tasks_reminders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('calendar_event_id', 'is', null)

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        provider: {
          id: provider.id,
          email: provider.provider_email,
          sync_status: provider.sync_status,
          last_sync_at: provider.last_sync_at,
        },
        upcoming_events: events || [],
        synced_tasks: syncedTasks || 0,
      },
    })
  } catch (error) {
    apiLogger.error('Error in calendar-sync GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai-crm/cro/calendar-sync
 *
 * Syncs CRO follow-up tasks to Google Calendar.
 *
 * Body: {
 *   action: 'sync_task' | 'sync_all_pending' | 'remove_task',
 *   task_id?: string,           // For sync_task / remove_task
 * }
 *
 * Converts tasks_reminders entries into Google Calendar events
 * via the existing GoogleCalendarService.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action, task_id } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action' },
        { status: 400 }
      )
    }

    // Get CRO's Google Calendar provider
    const { data: provider } = await supabase
      .from('calendar_providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle()

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Google Calendar not connected. Please connect your Google account first.' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const cookieHeader = request.headers.get('cookie') || ''

    if (action === 'sync_task') {
      if (!task_id) {
        return NextResponse.json(
          { success: false, error: 'Missing task_id for sync_task action' },
          { status: 400 }
        )
      }

      const result = await syncTaskToCalendar(supabase, provider.id, user.id, task_id, baseUrl, cookieHeader)
      return NextResponse.json(result)
    }

    if (action === 'sync_all_pending') {
      // Get all pending tasks without calendar events
      const { data: tasks } = await supabase
        .from('tasks_reminders')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .is('calendar_event_id', null)
        .limit(50)

      if (!tasks || tasks.length === 0) {
        return NextResponse.json({
          success: true,
          data: { synced: 0 },
          message: 'No pending tasks to sync',
        })
      }

      let synced = 0
      let failed = 0

      for (const task of tasks) {
        const result = await syncTaskToCalendar(supabase, provider.id, user.id, task.id, baseUrl, cookieHeader)
        if (result.success) synced++
        else failed++
      }

      return NextResponse.json({
        success: true,
        data: { synced, failed, total: tasks.length },
        message: `Synced ${synced} tasks to Google Calendar`,
      })
    }

    if (action === 'remove_task') {
      if (!task_id) {
        return NextResponse.json(
          { success: false, error: 'Missing task_id for remove_task action' },
          { status: 400 }
        )
      }

      // Get task's calendar event ID
      const { data: task } = await supabase
        .from('tasks_reminders')
        .select('calendar_event_id')
        .eq('id', task_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!task?.calendar_event_id) {
        return NextResponse.json(
          { success: false, error: 'Task has no calendar event' },
          { status: 404 }
        )
      }

      // Cancel the calendar event via existing API
      fetch(`${baseUrl}/api/calendar/event/${task.calendar_event_id}`, {
        method: 'DELETE',
        headers: { Cookie: cookieHeader },
      }).catch(() => { /* Non-critical side effect */ })

      // Clear calendar_event_id from task
      await supabase
        .from('tasks_reminders')
        .update({ calendar_event_id: null })
        .eq('id', task_id)

      return NextResponse.json({
        success: true,
        message: 'Calendar event removed from task',
      })
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    )
  } catch (error) {
    apiLogger.error('Error in calendar-sync POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Sync a single follow-up task to Google Calendar
 */
async function syncTaskToCalendar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerId: string,
  userId: string,
  taskId: string,
  baseUrl: string,
  cookieHeader: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    // Fetch the task
    const { data: task, error: taskError } = await supabase
      .from('tasks_reminders')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .maybeSingle()

    if (taskError || !task) {
      return { success: false, error: 'Task not found' }
    }

    if (task.calendar_event_id) {
      return { success: true, data: { already_synced: true, calendar_event_id: task.calendar_event_id } }
    }

    // Build calendar event from task
    const dueDate = task.due_date || new Date().toISOString().split('T')[0]
    const dueTime = task.due_time || '10:00'
    const startTime = new Date(`${dueDate}T${dueTime}:00`).toISOString()
    const endTime = new Date(new Date(`${dueDate}T${dueTime}:00`).getTime() + 30 * 60 * 1000).toISOString()

    const description = [
      task.description || '',
      '',
      `Priority: ${task.priority || 'normal'}`,
      task.entity_type ? `Entity: ${task.entity_type}` : '',
      task.customer_name ? `Customer: ${task.customer_name}` : '',
      task.customer_phone ? `Phone: ${task.customer_phone}` : '',
      '',
      `Source: LOANZ 360 CRM Follow-up`,
      `Task ID: ${task.id}`,
    ]
      .filter(Boolean)
      .join('\n')

    // Create event via existing calendar API
    const response = await fetch(`${baseUrl}/api/calendar/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        provider_id: providerId,
        title: `[CRM] ${task.title || task.description || 'Follow-up Task'}`,
        description,
        start_time: startTime,
        end_time: endTime,
        timezone: 'Asia/Kolkata',
        interaction_type: 'follow_up',
        reminder_minutes: [15, 5],
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      return { success: false, error: errData.error || 'Failed to create calendar event' }
    }

    const result = await response.json()
    const calendarEventId = result.data?.id || result.data?.event?.id

    // Update task with calendar event ID
    if (calendarEventId) {
      await supabase
        .from('tasks_reminders')
        .update({ calendar_event_id: calendarEventId })
        .eq('id', taskId)
    }

    return {
      success: true,
      data: {
        calendar_event_id: calendarEventId,
        start_time: startTime,
        end_time: endTime,
      },
    }
  } catch (error) {
    apiLogger.error('Error syncing task to calendar:', error)
    return { success: false, error: 'Failed to sync task to calendar' }
  }
}
