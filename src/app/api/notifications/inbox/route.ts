
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { verifySessionToken } from '@/lib/auth/tokens'

/**
 * GET /api/notifications/inbox
 * Get notifications for current user
 * Supports both Supabase session auth and JWT cookie auth for consistency
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    let userId: string | null = null

    // Try Supabase session auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (user && !authError) {
      userId = user.id
    }

    // Fallback to JWT cookie auth if Supabase session not available
    if (!userId) {
      try {
        const cookieStore = await cookies()
        const authToken = cookieStore.get('auth-token')?.value
        if (authToken) {
          const sessionData = verifySessionToken(authToken)
          if (sessionData?.userId) {
            userId = sessionData.userId
          }
        }
      } catch {
        // Cookie auth fallback failed silently
      }
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const filter = searchParams.get('filter') // 'all', 'unread', 'read', 'archived', 'important'
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')

    // Use !inner join when filtering on system_notifications columns
    // This ensures DB handles filtering BEFORE pagination
    const needsInnerJoin = filter === 'important' || type || priority || search
    const joinSyntax = needsInnerJoin
      ? 'notification:system_notifications!inner(*)'
      : 'notification:system_notifications(*)'

    let query = supabase
      .from('notification_recipients')
      .select(`
        *,
        ${joinSyntax}
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Apply archive/read filters
    if (filter === 'unread') {
      query = query.eq('is_read', false).eq('is_archived', false)
    } else if (filter === 'read') {
      query = query.eq('is_read', true).eq('is_archived', false)
    } else if (filter === 'archived') {
      query = query.eq('is_archived', true)
    } else if (filter === 'important') {
      query = query.eq('is_archived', false)
      query = query.in('notification.priority', ['urgent', 'high'])
    } else {
      query = query.eq('is_archived', false)
    }

    // Apply type filter at DB level
    if (type) {
      query = query.eq('notification.notification_type', type)
    }

    // Apply priority filter at DB level
    if (priority) {
      query = query.eq('notification.priority', priority)
    }

    // Apply search filter at DB level using ilike
    if (search) {
      const searchPattern = `%${search}%`
      query = query.or(
        `title.ilike.${searchPattern},message.ilike.${searchPattern}`,
        { referencedTable: 'system_notifications' }
      )
    }

    // Apply pagination AFTER all DB-level filters
    query = query.range(offset, offset + limit - 1)

    const { data: recipients, error: recipientsError, count } = await query

    if (recipientsError) {
      apiLogger.error('Error fetching notifications', recipientsError)

      // Check if table doesn't exist (PostgreSQL error code 42P01)
      if (recipientsError.code === '42P01' ||
          (recipientsError.message?.includes('relation') && recipientsError.message?.includes('does not exist'))) {
        // Return success with empty array and clear message about missing table
        return NextResponse.json(
          {
            success: true,
            notifications: [],
            total: 0,
            limit,
            offset,
            message: 'Notification tables have not been created yet. Please run the notification system migration to enable notifications.',
            info: 'notification_recipients table does not exist'
          },
          { status: 200 }
        )
      }

      // For other errors, return proper error response
      apiLogger.error('Database error details', recipientsError)
      logApiError(recipientsError as Error, request, { action: 'fetchNotifications' })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications. Please try again later.' },
        { status: 500 }
      )
    }

    // Transform data to flat notification structure for frontend
    const notifications = (recipients || []).map(r => ({
      ...r.notification,
      recipient_id: r.id,
      is_read: r.is_read,
      read_at: r.read_at,
      is_archived: r.is_archived,
      archived_at: r.archived_at,
      starred: r.starred,
      source: 'admin' as const,
    }))

    // Also fetch from in_app_notifications (system-generated payout/workflow notifications)
    // BUG-N2 fix: Use user_id (not admin_id) to support all roles including employees
    // BUG-N3/N4 fix: Fetch count separately for accurate totals, apply proper pagination
    let inAppNotifications: typeof notifications = []
    let inAppTotalCount = 0
    try {
      // First get accurate total count for in_app_notifications
      let inAppCountQuery = supabase
        .from('in_app_notifications')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},admin_id.eq.${userId},recipient_id.eq.${userId}`)

      if (filter === 'unread') {
        inAppCountQuery = inAppCountQuery.eq('is_read', false)
      } else if (filter === 'read') {
        inAppCountQuery = inAppCountQuery.eq('is_read', true)
      }

      if (search) {
        const searchPattern = `%${search}%`
        inAppCountQuery = inAppCountQuery.or(`title.ilike.${searchPattern},message.ilike.${searchPattern}`)
      }

      const { count: inAppCount } = await inAppCountQuery
      inAppTotalCount = inAppCount || 0

      // Only fetch in_app data for page 1 (they are merged with system notifications)
      // For subsequent pages, system notifications pagination handles it
      if (offset === 0 || inAppTotalCount > offset) {
        let inAppQuery = supabase
          .from('in_app_notifications')
          .select('*')
          .or(`user_id.eq.${userId},admin_id.eq.${userId},recipient_id.eq.${userId}`)
          .order('created_at', { ascending: false })

        if (filter === 'unread') {
          inAppQuery = inAppQuery.eq('is_read', false)
        } else if (filter === 'read') {
          inAppQuery = inAppQuery.eq('is_read', true)
        }

        if (search) {
          const searchPattern = `%${search}%`
          inAppQuery = inAppQuery.or(`title.ilike.${searchPattern},message.ilike.${searchPattern}`)
        }

        inAppQuery = inAppQuery.range(0, limit - 1)

        const { data: inAppData } = await inAppQuery

        if (inAppData) {
          inAppNotifications = inAppData.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            notification_type: n.type || n.category || 'system',
            priority: n.priority || 'normal',
            action_url: n.action_url,
            action_label: n.action_label,
            icon: n.icon,
            created_at: n.created_at,
            recipient_id: n.id,
            is_read: n.is_read || false,
            read_at: n.read_at || null,
            is_archived: false,
            archived_at: null,
            starred: false,
            source: 'system' as const,
          }))
        }
      }
    } catch {
      // Silently ignore if in_app_notifications table doesn't exist yet
    }

    // Merge and sort by created_at descending, then apply consistent pagination
    const allNotifications = [...notifications, ...inAppNotifications]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)

    // Accurate total: sum of both sources' actual counts
    const accurateTotal = (count || 0) + inAppTotalCount

    return NextResponse.json({
      success: true,
      notifications: allNotifications,
      total: accurateTotal,
      limit,
      offset
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/notifications/inbox', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
