import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/notifications
 * Get list of notifications for current user
 * Query params:
 *   - limit: number (default: 20, max: 100)
 *   - offset: number (default: 0)
 *   - is_read: boolean (optional filter)
 *   - type: notification_type (optional filter)
 *   - priority: notification_priority (optional filter)
 * Access: All authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const isRead = searchParams.get('is_read')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    // Apply filters
    if (isRead !== null) {
      query = query.eq('is_read', isRead === 'true')
    }

    if (type) {
      query = query.eq('type', type)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    // Execute query with pagination
    const { data: notifications, error: notificationsError, count } = await query
      .range(offset, offset + limit - 1)

    if (notificationsError) {
      throw notificationsError
    }

    // Also fetch from in_app_notifications (system-generated payout/workflow notifications)
    let inAppItems: Record<string, unknown>[] = []
    try {
      let inAppQuery = supabase
        .from('in_app_notifications')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (isRead !== null) {
        inAppQuery = inAppQuery.eq('is_read', isRead === 'true')
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
          data: n.metadata || {},
          action_url: n.action_url,
          action_label: n.action_label,
          is_read: n.is_read || false,
          read_at: n.read_at || null,
          is_archived: false,
          created_at: n.created_at,
          source: 'system',
        }))
      }
    } catch {
      // Silently ignore if in_app_notifications table doesn't exist yet
    }

    // Merge and sort by created_at descending
    const allNotifications = [...(notifications || []), ...inAppItems]
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: allNotifications,
      pagination: {
        total: (count || 0) + inAppItems.length,
        limit,
        offset,
        hasMore: (count || 0) + inAppItems.length > offset + limit,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching notifications', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 * Create a new notification (admin/system only)
 * Access: Admins only
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: employee } = await supabase
      .from('employees')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const allowedRoles = ['ADMIN_EXECUTIVE', 'ADMIN_MANAGER', 'HR_EXECUTIVE', 'HR_MANAGER']
    if (!employee || !allowedRoles.includes(employee.sub_role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or HR access required' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      user_id,
      type,
      title,
      message,
      priority = 'medium',
      data = {},
      action_url,
      action_label,
      channels = ['in_app'],
    } = body

    // Validate required fields
    if (!user_id || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, type, title, message' },
        { status: 400 }
      )
    }

    // Create notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        priority,
        data,
        action_url,
        action_label,
        channels,
        created_by: user.id,
      })
      .select()
      .maybeSingle()

    if (notificationError) {
      throw notificationError
    }

    return NextResponse.json({
      success: true,
      data: notification,
      message: 'Notification created successfully',
    })
  } catch (error) {
    apiLogger.error('Error creating notification', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications
 * Archive all notifications for current user
 * Access: All authenticated users
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Archive all notifications
    const { error: archiveError } = await supabase
      .from('notifications')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_archived', false)

    if (archiveError) {
      throw archiveError
    }

    return NextResponse.json({
      success: true,
      message: 'All notifications archived successfully',
    })
  } catch (error) {
    apiLogger.error('Error archiving notifications', error)
    return NextResponse.json(
      { error: 'Failed to archive notifications' },
      { status: 500 }
    )
  }
}
