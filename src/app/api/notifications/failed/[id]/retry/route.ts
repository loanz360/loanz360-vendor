export const dynamic = 'force-dynamic'

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
 * POST /api/notifications/failed/[id]/retry
 * Retry a single failed notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Notification ID is required' },
        { status: 400 }
      )
    }

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

    const supabaseAdmin = createSupabaseAdmin()

    // Get the failed notification
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notification_delivery_log')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !notification) {
      return NextResponse.json(
        { success: false, error: 'Failed notification not found' },
        { status: 404 }
      )
    }

    // Check if notification is in dead_letter state (max retries exceeded)
    if (notification.status === 'dead_letter') {
      return NextResponse.json(
        { success: false, error: 'Cannot retry a dead letter notification. Max retries exceeded.' },
        { status: 400 }
      )
    }

    const maxRetries = notification.max_retries || 3
    const currentRetryCount = (notification.retry_count || 0) + 1

    // Determine new status based on retry count
    const newStatus = currentRetryCount >= maxRetries ? 'dead_letter' : 'retrying'

    // Update the notification status and increment retry count
    const { error: updateError } = await supabaseAdmin
      .from('notification_delivery_log')
      .update({
        status: newStatus,
        retry_count: currentRetryCount,
        last_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error retrying notification:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to retry notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: newStatus === 'dead_letter'
        ? 'Notification moved to dead letter queue (max retries reached)'
        : 'Notification queued for retry',
      data: {
        id,
        status: newStatus,
        retry_count: currentRetryCount,
        max_retries: maxRetries,
      },
    })
  } catch (error) {
    console.error('Error in retry notification POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
