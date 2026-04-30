
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
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
 * DELETE /api/notifications/failed/[id]
 * Delete a failed notification from the delivery log
 */
export async function DELETE(
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

    // Verify the record exists and is in a failed state
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notification_delivery_log')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Failed notification not found' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('notification_delivery_log')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting failed notification:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Failed notification deleted successfully',
    })
  } catch (error) {
    console.error('Error in failed notification DELETE:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
