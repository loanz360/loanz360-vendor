import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount
} from '@/lib/tickets/realtime-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/realtime/notifications
 * Get notifications for current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'list'
    const limit = parseInt(searchParams.get('limit') || '50')
    const unreadOnly = searchParams.get('unread_only') === 'true'

    if (mode === 'count') {
      const count = await getUnreadCount(user.id)
      return NextResponse.json({ unread_count: count })
    }

    const notifications = await getUserNotifications(user.id, limit, unreadOnly)
    const unreadCount = await getUnreadCount(user.id)

    return NextResponse.json({
      notifications,
      unread_count: unreadCount
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/realtime/notifications
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action, notification_id } = body

    switch (action) {
      case 'mark_read':
        if (!notification_id) {
          return NextResponse.json({ success: false, error: 'notification_id required' }, { status: 400 })
        }
        const success = await markNotificationRead(notification_id)
        return NextResponse.json({ success })

      case 'mark_all_read':
        const allSuccess = await markAllNotificationsRead(user.id)
        return NextResponse.json({ success: allSuccess })

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
