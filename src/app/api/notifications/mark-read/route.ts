export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationId, markAll } = await request.json()

    if (markAll) {
      // Mark all unread notifications as read for current user
      // Update all three tables for consistency
      const { data, error } = await supabase
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .select()

      // Also update the notifications table (used by GET /api/notifications)
      await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .then(() => {})
        .catch(() => { /* Non-critical side effect */ })

      // Also update in_app_notifications (system-generated payout/workflow notifications)
      await supabase
        .from('in_app_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('admin_id', user.id)
        .eq('is_read', false)
        .then(() => {})
        .catch(() => { /* Non-critical side effect */ })

      if (error) throw error
      return NextResponse.json({ success: true, count: data?.length || 0 })
    }

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'Missing notificationId' }, { status: 400 })
    }

    // Mark specific notification as read for current user
    // Try notification_recipients first
    const { data, error } = await supabase
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('notification_id', notificationId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    // Also update the notifications table
    await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .then(() => {})
      .catch(() => { /* Non-critical side effect */ })

    // Also try in_app_notifications (for system-generated notifications)
    await supabase
      .from('in_app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('admin_id', user.id)
      .then(() => {})
      .catch(() => { /* Non-critical side effect */ })

    if (error) throw error

    return NextResponse.json({ success: true, updated: data })
  } catch (error) {
    return handleApiError(error, 'mark notification read')
  }
}
