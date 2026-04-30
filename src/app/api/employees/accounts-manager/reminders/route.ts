import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


interface ReminderConfig {
  daily_digest_enabled: boolean
  digest_time: string
  overdue_alerts: boolean
  absent_team_alert: boolean
  weekly_report: boolean
  weekly_report_day: string
}

const DEFAULT_CONFIG: ReminderConfig = {
  daily_digest_enabled: true,
  digest_time: '09:00',
  overdue_alerts: true,
  absent_team_alert: true,
  weekly_report: true,
  weekly_report_day: 'monday',
}

/** Get IST date string (YYYY-MM-DD) */
function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

/** Get IST datetime for start-of-day */
function getISTStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/**
 * GET /api/employees/accounts-manager/reminders
 * Returns current reminder config and pending reminder counts.
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    const today = getISTDate()
    const todayStart = getISTStartOfDay(today)

    // Fetch config from app_config table
    const { data: configRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', `reminder_config_${user.id}`)
      .maybeSingle()

    const config: ReminderConfig = configRow?.value
      ? { ...DEFAULT_CONFIG, ...(configRow.value as Partial<ReminderConfig>) }
      : DEFAULT_CONFIG

    // Fetch pending reminder counts in parallel
    const [overdueResult, teamResult, attentionResult] = await Promise.all([
      // Overdue items: CP applications older than 3 days still pending
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'IN_REVIEW'])
        .lt('created_at', getISTStartOfDay((() => {
          const now = new Date()
          const istOffset = 5.5 * 60 * 60 * 1000
          const d = new Date(now.getTime() + istOffset - 3 * 24 * 60 * 60 * 1000)
          return d.toISOString().split('T')[0]
        })())),

      // Team members who have NOT logged in today
      supabase
        .from('users')
        .select('id, full_name, last_login_at', { count: 'exact' })
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
        .eq('status', 'active')
        .or(`last_login_at.is.null,last_login_at.lt.${todayStart}`),

      // Applications needing attention (flagged or escalated)
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['FLAGGED', 'ESCALATED', 'NEEDS_REVISION']),
    ])

    const pendingReminders = {
      overdue_items: overdueResult.count ?? 0,
      absent_team_members: teamResult.count ?? 0,
      absent_members: (teamResult.data ?? []).map((m: { id: string; full_name: string; last_login_at: string | null }) => ({
        id: m.id,
        name: m.full_name,
        last_login_at: m.last_login_at,
      })),
      applications_needing_attention: attentionResult.count ?? 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        config,
        pending_reminders: pendingReminders,
      },
    })
  } catch (error) {
    logger.error('Reminders GET error', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/accounts-manager/reminders
 * Trigger manual digest or update config.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    const bodySchema = z.object({


      action: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action, config: newConfig } = body as {
      action: 'send_digest' | 'update_config'
      config?: Partial<ReminderConfig>
    }

    if (!action || !['send_digest', 'update_config'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use send_digest or update_config.' },
        { status: 400 }
      )
    }

    if (action === 'update_config') {
      if (!newConfig || typeof newConfig !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Config object is required for update_config action.' },
          { status: 400 }
        )
      }

      // Merge with defaults
      const { data: existingRow } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', `reminder_config_${user.id}`)
        .maybeSingle()

      const mergedConfig = {
        ...DEFAULT_CONFIG,
        ...(existingRow?.value as Partial<ReminderConfig> | null),
        ...newConfig,
      }

      const { error: upsertError } = await supabase
        .from('app_config')
        .upsert({
          key: `reminder_config_${user.id}`,
          value: mergedConfig,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

      if (upsertError) {
        logger.error('Failed to save reminder config', { error: upsertError })
        return NextResponse.json(
          { success: false, error: 'Failed to save configuration' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Reminder configuration updated',
        data: { config: mergedConfig },
      })
    }

    // action === 'send_digest'
    const today = getISTDate()
    const todayStart = getISTStartOfDay(today)
    const threeDaysAgo = getISTStartOfDay((() => {
      const now = new Date()
      const istOffset = 5.5 * 60 * 60 * 1000
      const d = new Date(now.getTime() + istOffset - 3 * 24 * 60 * 60 * 1000)
      return d.toISOString().split('T')[0]
    })())

    const [overdueResult, absentResult, attentionResult] = await Promise.all([
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'IN_REVIEW'])
        .lt('created_at', threeDaysAgo),

      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
        .eq('status', 'active')
        .or(`last_login_at.is.null,last_login_at.lt.${todayStart}`),

      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['FLAGGED', 'ESCALATED', 'NEEDS_REVISION']),
    ])

    const overdueCount = overdueResult.count ?? 0
    const absentCount = absentResult.count ?? 0
    const attentionCount = attentionResult.count ?? 0

    const formattedDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    // Create notification record
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        title: `Daily Accounts Digest - ${formattedDate}`,
        message: `${overdueCount} overdue items, ${absentCount} team members not yet active, ${attentionCount} applications need attention`,
        type: 'REMINDER',
        priority: overdueCount > 0 ? 'HIGH' : 'NORMAL',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (notifError) {
      logger.error('Failed to create digest notification', { error: notifError })
      return NextResponse.json(
        { success: false, error: 'Failed to create digest notification' },
        { status: 500 }
      )
    }

    // Insert recipient record
    if (notification) {
      await supabase.from('notification_recipients').insert({
        notification_id: notification.id,
        user_id: user.id,
        read: false,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Daily digest sent successfully',
      data: {
        notification_id: notification?.id,
        summary: {
          overdue_items: overdueCount,
          absent_team_members: absentCount,
          applications_needing_attention: attentionCount,
          date: formattedDate,
        },
      },
    })
  } catch (error) {
    logger.error('Reminders POST error', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
