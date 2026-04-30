
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
 * POST /api/notifications/unsubscribes/[id]/resubscribe
 * Resubscribe a user by marking their unsubscribe record with resubscribed_at
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Unsubscribe ID is required' },
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

    // Verify the record exists and is currently unsubscribed
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notification_unsubscribes')
      .select('id, user_id, channel, resubscribed_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Unsubscribe record not found' },
        { status: 404 }
      )
    }

    if (existing.resubscribed_at) {
      return NextResponse.json(
        { success: false, error: 'User is already resubscribed' },
        { status: 400 }
      )
    }

    // Mark as resubscribed
    const { error: updateError } = await supabaseAdmin
      .from('notification_unsubscribes')
      .update({
        resubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error resubscribing user:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to resubscribe user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User resubscribed successfully',
      data: {
        id,
        user_id: existing.user_id,
        channel: existing.channel,
      },
    })
  } catch (error) {
    console.error('Error in resubscribe POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
