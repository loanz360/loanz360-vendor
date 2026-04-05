export const dynamic = 'force-dynamic'

/**
 * Work Management Notifications API
 * Unified notification center for Attendance, Payroll, WorkDrive, and Email modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Fetch notifications with filtering
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // attendance, leave, payroll, document, email, system
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))

    let query = supabase
      .from('work_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    // Filter out expired notifications
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    query = query.range(offset, offset + limit - 1)

    const { data: notifications, error, count } = await query

    if (error) {
      // Handle table not existing
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: { notifications: [], unreadCount: 0, totalCount: 0 }
        })
      }
      throw error
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('work_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
        totalCount: count || 0,
      }
    })
  } catch (error) {
    apiLogger.error('Get work notifications error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notification_ids, mark_all_read } = body

    if (mark_all_read) {
      // Mark all unread as read
      const { error } = await supabase
        .from('work_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      })
    }

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'notification_ids array or mark_all_read required' },
        { status: 400 }
      )
    }

    // Mark specific notifications as read (only user's own)
    const { error } = await supabase
      .from('work_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', notification_ids)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `${notification_ids.length} notification(s) marked as read`
    })
  } catch (error) {
    apiLogger.error('Update work notifications error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}

// DELETE - Delete old/expired notifications
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')

    if (notificationId) {
      // Delete specific notification
      const { error } = await supabase
        .from('work_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)

      if (error) throw error

      return NextResponse.json({ success: true, message: 'Notification deleted' })
    }

    // Delete all read notifications older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { error } = await supabase
      .from('work_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('is_read', true)
      .lt('created_at', thirtyDaysAgo.toISOString())

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Old notifications cleaned up' })
  } catch (error) {
    apiLogger.error('Delete work notifications error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete notifications' },
      { status: 500 }
    )
  }
}
