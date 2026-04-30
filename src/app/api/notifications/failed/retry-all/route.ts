
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Helper to check Super Admin session from cookie
 */
async function checkSuperAdminSession(request: NextRequest): Promise<{ isValid: boolean; adminId?: string }> {
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (!superAdminSession) {
    return { isValid: false }
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: session, error } = await supabaseAdmin
    .from('super_admin_sessions')
    .select('super_admin_id, expires_at')
    .eq('session_id', superAdminSession)
    .maybeSingle()

  if (error || !session) {
    return { isValid: false }
  }

  if (new Date(session.expires_at) < new Date()) {
    return { isValid: false }
  }

  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, is_active, is_locked')
    .eq('id', session.super_admin_id)
    .maybeSingle()

  if (!admin || !admin.is_active || admin.is_locked) {
    return { isValid: false }
  }

  return { isValid: true, adminId: admin.id }
}

/**
 * POST /api/notifications/failed/retry-all
 * Retry all failed notifications (optionally filtered by type)
 */
export async function POST(request: NextRequest) {
  try {
    const superAdminCheck = await checkSuperAdminSession(request)
    let isSuperAdmin = superAdminCheck.isValid

    if (!isSuperAdmin) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const { data: userData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = userData?.role === 'SUPER_ADMIN'
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse optional type filter from body
    let typeFilter: string | undefined
    try {
      const body = await request.json()
      typeFilter = body?.type
    } catch {
      // No body or invalid JSON is fine
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Build query for retryable failed notifications (exclude dead_letter)
    let query = supabaseAdmin
      .from('notification_delivery_log')
      .select('id, retry_count, max_retries')
      .in('status', ['failed', 'bounced'])

    if (typeFilter) {
      query = query.eq('channel', typeFilter)
    }

    const { data: failedNotifications, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching failed notifications for retry-all:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    if (!failedNotifications || failedNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No failed notifications to retry',
        data: { retried: 0, moved_to_dead_letter: 0 },
      })
    }

    let retriedCount = 0
    let deadLetterCount = 0

    // Process each notification
    for (const notification of failedNotifications) {
      const maxRetries = notification.max_retries || 3
      const newRetryCount = (notification.retry_count || 0) + 1
      const newStatus = newRetryCount >= maxRetries ? 'dead_letter' : 'retrying'

      const { error: updateError } = await supabaseAdmin
        .from('notification_delivery_log')
        .update({
          status: newStatus,
          retry_count: newRetryCount,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)

      if (!updateError) {
        if (newStatus === 'dead_letter') {
          deadLetterCount++
        } else {
          retriedCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Retried ${retriedCount} notifications, ${deadLetterCount} moved to dead letter queue`,
      data: {
        retried: retriedCount,
        moved_to_dead_letter: deadLetterCount,
        total_processed: retriedCount + deadLetterCount,
      },
    })
  } catch (error) {
    console.error('Error in retry-all POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
