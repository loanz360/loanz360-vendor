import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'
import { timingSafeEqual } from 'crypto'


/** Compare two strings using timing-safe comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

/** Run promises with concurrency limit */
async function promiseAllWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = []
  const executing = new Set<Promise<void>>()

  for (const task of tasks) {
    const p = task().then(result => { results.push(result) }).finally(() => executing.delete(p))
    executing.add(p)
    if (executing.size >= maxConcurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * GET /api/cro/follow-up-reminders
 * Cron-triggered: Finds follow-ups due within their reminder window
 * and sends push notifications to assigned CROs.
 *
 * Designed to run every 5 minutes via Vercel Cron or external scheduler.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret or authenticated CRO user
  // Accept from Authorization header (Bearer token) or query parameter
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace('Bearer ', '') || ''
  const cronKey = request.nextUrl.searchParams.get('key')
  const cronSecret = process.env.CRON_SECRET

  let isCronAuth = false
  if (cronSecret) {
    const isVercelCron = bearerToken ? safeCompare(bearerToken, cronSecret) : false
    const isExternalCron = cronKey ? safeCompare(cronKey, cronSecret) : false
    isCronAuth = isVercelCron || isExternalCron
  }

  try {
    // Use service role client for cron auth (no user session), regular client otherwise
    const supabase = isCronAuth
      ? createServiceRoleClient()
      : await createClient()

    // If not cron-authenticated, require user auth with CRO role verification
    if (!isCronAuth) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      // Role verification - only CRO roles can access this endpoint
      const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
      const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
      if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
        return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
      }
    }
    const now = new Date()

    // Find pending follow-ups where reminder is enabled and reminder time has arrived
    // Grace period: include follow-ups up to 10 minutes past their scheduled time
    // to catch recently-missed ones
    const gracePeriod = new Date(now.getTime() - 10 * 60 * 1000)
    const { data: dueFollowups, error: fetchError } = await supabase
      .from('crm_followups')
      .select(`
        id, lead_id, scheduled_at, title, notes,
        reminder_minutes_before, owner_id
      `)
      .eq('status', 'Pending')
      .eq('reminder_enabled', true)
      .is('deleted_at', null)
      .gte('scheduled_at', gracePeriod.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      apiLogger.error('Error fetching follow-ups:', fetchError)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    if (!dueFollowups || dueFollowups.length === 0) {
      return NextResponse.json({ success: true, data: { processed: 0, sent: 0 } })
    }

    // Filter to those within their reminder window
    const readyToNotify = dueFollowups.filter(f => {
      const scheduledTime = new Date(f.scheduled_at).getTime()
      const reminderMinutes = f.reminder_minutes_before || 15
      const reminderTime = scheduledTime - (reminderMinutes * 60 * 1000)
      return now.getTime() >= reminderTime
    })

    if (readyToNotify.length === 0) {
      return NextResponse.json({ success: true, data: { processed: 0, sent: 0 } })
    }

    // Get lead details for customer names and phone numbers (for customer SMS)
    const leadIds = [...new Set(readyToNotify.map(f => f.lead_id).filter(Boolean))]
    const { data: leads } = leadIds.length > 0
      ? await supabase
          .from('crm_leads')
          .select('id, customer_name, phone, cro_id')
          .in('id', leadIds)
      : { data: [] }

    const leadMap = new Map((leads || []).map(l => [l.id, l]))

    // Get CRO user IDs for push notifications
    const croIds = [...new Set([
      ...readyToNotify.map(f => f.owner_id).filter(Boolean),
      ...(leads || []).map(l => l.cro_id).filter(Boolean),
    ])]

    if (croIds.length === 0) {
      return NextResponse.json({ success: true, data: { processed: readyToNotify.length, sent: 0 } })
    }

    // Fetch active push subscriptions for these CROs
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, id, endpoint, subscription')
      .in('user_id', croIds)
      .eq('is_active', true)

    const subsByUser = new Map<string, Array<{ id: string; endpoint: string; subscription: unknown }>>()
    ;(subscriptions || []).forEach(sub => {
      const existing = subsByUser.get(sub.user_id) || []
      existing.push(sub)
      subsByUser.set(sub.user_id, existing)
    })

    let sentCount = 0
    let failedCount = 0
    const processedIds: string[] = []

    // Build push notification tasks for batch execution with concurrency limiting
    const pushTasks = readyToNotify
      .filter(followup => {
        const lead = leadMap.get(followup.lead_id)
        const targetUserId = followup.owner_id || lead?.cro_id
        if (!targetUserId) return false
        const userSubs = subsByUser.get(targetUserId)
        return userSubs && userSubs.length > 0
      })
      .map(followup => () => {
        const lead = leadMap.get(followup.lead_id)
        const targetUserId = followup.owner_id || lead?.cro_id
        const customerName = lead?.customer_name || 'Customer'
        const scheduledAt = new Date(followup.scheduled_at)
        const minutesUntil = Math.max(0, Math.round((scheduledAt.getTime() - now.getTime()) / 60000))

        const title = minutesUntil <= 1
          ? `Call Now: ${customerName}`
          : `Reminder: ${customerName} in ${minutesUntil} min`

        const body = followup.title
          ? `Follow-up: ${followup.title}`
          : 'Scheduled follow-up call'

        processedIds.push(followup.id)

        return fetch(new URL('/api/notifications/push/send', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body,
            user_ids: [targetUserId],
            data: {
              type: 'followup_reminder',
              followup_id: followup.id,
              lead_id: followup.lead_id,
              url: `/employees/cro/followups-v2`,
            },
            actions: minutesUntil <= 1
              ? [{ action: 'call', title: 'Call Now' }, { action: 'dismiss', title: 'Dismiss' }]
              : [{ action: 'view', title: 'View Details' }],
          }),
        })
          .then(async res => {
            const pushResult = await res.json()
            if (pushResult.success) sentCount++
            else failedCount++
          })
          .catch(() => { failedCount++ })
      })

    // Execute push notifications with max 5 concurrent requests
    await promiseAllWithConcurrency(pushTasks, 5)

    // Disable reminders after sending to avoid duplicates (batch)
    if (processedIds.length > 0) {
      await supabase
        .from('crm_followups')
        .update({ reminder_enabled: false })
        .in('id', processedIds)
        .then(() => {}).catch(() => { /* Non-critical side effect */ })
    }

    // Send SMS reminders to customers with upcoming follow-ups
    let customerSmsSent = 0
    for (const followup of readyToNotify) {
      const lead = leadMap.get(followup.lead_id)
      if (!lead?.phone) continue

      const customerName = lead.customer_name || 'Customer'
      const scheduledAt = new Date(followup.scheduled_at)
      const formattedTime = scheduledAt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      try {
        // Send SMS to customer via internal API (uses the unified SMS service)
        const smsResponse = await fetch(new URL('/api/notifications/send-sms', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lead.phone,
            templateCode: 'FOLLOWUP_REMINDER_CUSTOMER',
            variables: {
              customer_name: customerName,
              time: formattedTime,
              purpose: followup.title || 'your loan application',
            },
          }),
        })

        const smsResult = await smsResponse.json()
        if (smsResult.success) {
          customerSmsSent++
        }

        // Mark SMS sent on followup record
        await supabase
          .from('crm_followups')
          .update({ sms_sent_to_customer: true })
          .eq('id', followup.id)
          .then(() => {}).catch(() => { /* Non-critical side effect */ })
      } catch {
        // SMS failure is non-critical — CRO still gets push notification
      }
    }

    // Also create in-app notifications for CROs without push subscriptions
    const crosWithoutPush = croIds.filter(id => !subsByUser.has(id))
    for (const followup of readyToNotify) {
      const lead = leadMap.get(followup.lead_id)
      const targetUserId = followup.owner_id || lead?.cro_id
      if (!targetUserId || !crosWithoutPush.includes(targetUserId)) continue

      const customerName = lead?.customer_name || 'Customer'
      await supabase
        .from('in_app_notifications')
        .insert({
          user_id: targetUserId,
          title: `Follow-up Reminder: ${customerName}`,
          message: followup.title || 'Scheduled follow-up call',
          type: 'info',
          category: 'followup',
          action_url: `/employees/cro/followups-v2`,
          metadata: { followup_id: followup.id, lead_id: followup.lead_id },
        })
        .then(() => {}).catch(() => { /* Non-critical side effect */ })
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: processedIds.length,
        sent: sentCount,
        failed: failedCount,
        inAppFallback: crosWithoutPush.length,
        customerSmsSent,
      },
    })
  } catch (error) {
    apiLogger.error('Follow-up reminder cron error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
