import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/ai-crm/cro/notifications
 *
 * Creates an in-app notification for a CRO and sends a push notification.
 * Designed to be called internally (fire-and-forget) from other APIs
 * like the public document upload endpoint.
 *
 * Body: {
 *   type: 'document_uploaded' | 'lead_assigned' | 'deal_status' | 'follow_up_due',
 *   cro_id: string,
 *   title: string,
 *   message: string,
 *   entity_type?: 'lead' | 'deal' | 'contact',
 *   entity_id?: string,
 *   action_url?: string,
 *   priority?: 'low' | 'normal' | 'high' | 'urgent',
 * }
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      type,
      cro_id,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      priority = 'normal',
    } = body

    if (!type || !cro_id || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, cro_id, title, message' },
        { status: 400 }
      )
    }

    // Determine action URL based on notification type
    let resolvedActionUrl = action_url
    if (!resolvedActionUrl && entity_type && entity_id) {
      const entityUrlMap: Record<string, string> = {
        lead: `/employees/cro/ai-crm/leads/${entity_id}`,
        deal: `/employees/cro/ai-crm/pipeline`,
        contact: `/employees/cro/ai-crm/contacts`,
      }
      resolvedActionUrl = entityUrlMap[entity_type] || '/employees/cro/ai-crm'
    }

    // 1. Create system notification
    const { data: notification, error: notifError } = await supabase
      .from('system_notifications')
      .insert({
        title,
        message,
        notification_type: type === 'document_uploaded' ? 'alert' : 'update',
        priority,
        delivery_channels: ['in_app', 'push'],
        target_type: 'individual',
        target_individual_ids: [cro_id],
        action_url: resolvedActionUrl,
        metadata: {
          source: 'crm',
          entity_type,
          entity_id,
          notification_subtype: type,
        },
        created_by: cro_id,
      })
      .select('id')
      .maybeSingle()

    if (notifError) {
      apiLogger.error('Error creating notification:', notifError)
      // Still try to create the recipient record with a generated ID
    }

    // 2. Create notification recipient record
    if (notification) {
      await supabase.from('notification_recipients').insert({
        notification_id: notification.id,
        user_id: cro_id,
        is_read: false,
      })
    }

    // 3. Send push notification (fire-and-forget via internal API)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/notifications/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_ids: [cro_id],
        notification_id: notification?.id,
        title,
        body: message,
        icon: '/icons/icon-192.png',
        url: resolvedActionUrl || '/employees/cro/ai-crm',
        data: {
          type,
          entity_type,
          entity_id,
        },
        actions: [
          { action: 'view', title: 'View' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      }),
    }).catch(() => { /* Non-critical side effect */ })

    return NextResponse.json({
      success: true,
      data: {
        notification_id: notification?.id,
        type,
        push_triggered: true,
      },
      message: 'Notification created and push triggered',
    })
  } catch (error) {
    apiLogger.error('Error in CRO notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai-crm/cro/notifications
 *
 * Returns CRO's recent notifications (in-app).
 * Query params: ?limit=20&unread_only=true
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const unreadOnly = searchParams.get('unread_only') === 'true'

    // Get notification IDs for this user
    let recipientQuery = supabase
      .from('notification_recipients')
      .select('notification_id, is_read, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      recipientQuery = recipientQuery.eq('is_read', false)
    }

    const { data: recipients, error: recipientError } = await recipientQuery

    if (recipientError || !recipients || recipients.length === 0) {
      return NextResponse.json({
        success: true,
        data: { notifications: [], unread_count: 0 },
      })
    }

    const notificationIds = recipients.map((r) => r.notification_id)
    const readMap = new Map(recipients.map((r) => [r.notification_id, { is_read: r.is_read, read_at: r.read_at }]))

    // Fetch full notification data
    const { data: notifications } = await supabase
      .from('system_notifications')
      .select('id, title, message, notification_type, priority, action_url, metadata, created_at')
      .in('id', notificationIds)
      .order('created_at', { ascending: false })

    const enriched = (notifications || []).map((n) => ({
      ...n,
      is_read: readMap.get(n.id)?.is_read || false,
      read_at: readMap.get(n.id)?.read_at || null,
    }))

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({
      success: true,
      data: {
        notifications: enriched,
        unread_count: unreadCount || 0,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching CRO notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai-crm/cro/notifications
 *
 * Mark notification(s) as read.
 * Body: { notification_id: string } or { mark_all_read: true }
 */
export async function PATCH(request: NextRequest) {
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

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { notification_id, mark_all_read } = body

    if (mark_all_read) {
      await supabase
        .from('notification_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      })
    }

    if (!notification_id) {
      return NextResponse.json(
        { success: false, error: 'Missing notification_id or mark_all_read' },
        { status: 400 }
      )
    }

    await supabase
      .from('notification_recipients')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notification_id)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    })
  } catch (error) {
    apiLogger.error('Error marking notification read:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
