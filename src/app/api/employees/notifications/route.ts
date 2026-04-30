import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch user notifications
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'
    const onlyUnread = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Count from both notifications and in_app_notifications tables
    const countFromBothTables = async () => {
      let total = 0
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      total += notifCount || 0

      try {
        const { count: inAppCount } = await supabase
          .from('in_app_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('admin_id', user.id)
          .eq('is_read', false)
        total += inAppCount || 0
      } catch { /* table may not exist */ }

      return total
    }

    // Fast path: only return unread count (used by header badge)
    if (countOnly) {
      const unreadCount = await countFromBothTables()
      return NextResponse.json({
        success: true,
        unread_count: unreadCount
      })
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (onlyUnread) {
      query = query.eq('is_read', false)
    }

    const { data: notifications, error } = await query

    if (error) throw error

    // Also fetch from in_app_notifications
    let inAppItems: Record<string, unknown>[] = []
    try {
      let inAppQuery = supabase
        .from('in_app_notifications')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (onlyUnread) {
        inAppQuery = inAppQuery.eq('is_read', false)
      }

      const { data: inAppData } = await inAppQuery
      if (inAppData) {
        inAppItems = inAppData.map(n => ({
          id: n.id,
          user_id: user.id,
          type: n.type || n.category || 'system',
          title: n.title,
          message: n.message,
          priority: 'medium',
          action_url: n.action_url,
          action_label: n.action_label,
          is_read: n.is_read || false,
          read_at: n.read_at || null,
          is_archived: false,
          created_at: n.created_at,
          source: 'in_app',
        }))
      }
    } catch { /* table may not exist */ }

    // Merge and sort
    const allNotifications = [...(notifications || []), ...inAppItems]
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(0, limit)

    const unreadCount = await countFromBothTables()

    return NextResponse.json({
      success: true,
      data: allNotifications,
      unread_count: unreadCount
    })

  } catch (error: unknown) {
    apiLogger.error('Fetch notifications error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// PATCH - Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bodySchema = z.object({


      notification_ids: z.string().optional(),


      mark_all: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { notification_ids, mark_all } = body

    if (mark_all) {
      // Mark all as read in both tables
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error

      // Also mark in_app_notifications as read
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('admin_id', user.id)
        .eq('is_read', false)
        .then(() => {})
        .catch(() => { /* Non-critical side effect */ })
    } else if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read in both tables
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', notification_ids)
        .eq('user_id', user.id)

      if (error) throw error

      // Also try in_app_notifications
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', notification_ids)
        .eq('admin_id', user.id)
        .then(() => {})
        .catch(() => { /* Non-critical side effect */ })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    apiLogger.error('Mark notification read error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
