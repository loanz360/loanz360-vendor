
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read for current user
 * Operates on notification_recipients table (broadcast notification system)
 * Access: All authenticated users
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Update notification_recipients directly (correct table for broadcast notifications)
    // The old RPC mark_all_notifications_as_read operated on the wrong table
    const { data, error } = await supabase
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_archived', false)
      .select('id')

    if (error) {
      apiLogger.error('Error marking all notifications as read', error)
      return NextResponse.json(
        { error: 'Failed to mark all notifications as read' },
        { status: 500 }
      )
    }

    const updatedCount = data?.length || 0

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      message: `${updatedCount} notification${updatedCount !== 1 ? 's' : ''} marked as read`,
    })
  } catch (error) {
    apiLogger.error('Error marking all notifications as read', error)
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}
