
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { verifySessionToken } from '@/lib/auth/tokens'

/**
 * GET /api/notifications/count
 * Get notification counts for current user (unread, important, archived, total)
 * Access: All authenticated users (supports Supabase session + JWT cookie auth)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    let userId: string | null = null

    // Try Supabase session auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (user && !authError) {
      userId = user.id
    }

    // Fallback to JWT cookie auth
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

    // Fetch all counts in parallel for better performance
    const [
      unreadResult,
      importantResult,
      archivedResult,
      totalResult
    ] = await Promise.all([
      // Unread count - notifications that haven't been read
      supabase
        .from('notification_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_archived', false),

      // Important count - urgent/high priority notifications (using !inner join filter)
      supabase
        .from('notification_recipients')
        .select(`
          *,
          notification:system_notifications!inner(priority)
        `, { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', false)
        .in('notification.priority', ['urgent', 'high']),

      // Archived count - archived notifications
      supabase
        .from('notification_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', true),

      // Total count - all non-archived notifications
      supabase
        .from('notification_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', false)
    ])

    // Also try the legacy RPC for backward compatibility
    let legacyCount = 0
    try {
      const { data: rpcData } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
      })
      legacyCount = rpcData || 0
    } catch {
      // RPC might not exist, use direct query result
    }

    return NextResponse.json({
      success: true,
      // Individual counts
      unread: unreadResult.count || legacyCount || 0,
      important: importantResult.count || 0,
      archived: archivedResult.count || 0,
      total: totalResult.count || 0,
      // Legacy field for backward compatibility
      count: unreadResult.count || legacyCount || 0,
    })
  } catch (error) {
    apiLogger.error('Error fetching notification counts', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification counts' },
      { status: 500 }
    )
  }
}
