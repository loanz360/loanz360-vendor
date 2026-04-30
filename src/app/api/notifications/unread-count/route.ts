
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for current user
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Count unread from multiple notification tables
    let unreadCount = 0

    try {
      // 1. Count from notification_recipients (admin-sent notifications)
      const { count: recipientCount, error: countError } = await supabase
        .from('notification_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false)

      if (!countError) {
        unreadCount += recipientCount || 0
      }

      // 2. Count from in_app_notifications (system-generated payout/workflow notifications)
      const { count: inAppCount, error: inAppError } = await supabase
        .from('in_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', user.id)
        .eq('is_read', false)

      if (!inAppError) {
        unreadCount += inAppCount || 0
      }
    } catch {
      // Return 0 on any error
      unreadCount = 0
    }

    // Return both formats for backwards compatibility
    // - 'count' is used by notification-bell.tsx
    // - 'unread_count' is used by PartnerNotificationInbox.tsx
    return NextResponse.json({
      success: true,
      count: unreadCount,
      unread_count: unreadCount
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/notifications/unread-count', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
