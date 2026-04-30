
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
 * GET /api/notifications/unsubscribes/stats
 * Get unsubscribe and GDPR statistics for the dashboard cards
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
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

    // Get active unsubscribes (not resubscribed)
    const { data: unsubscribes, error: unsubError } = await supabaseAdmin
      .from('notification_unsubscribes')
      .select('channel')
      .is('resubscribed_at', null)

    if (unsubError) {
      console.error('Error fetching unsubscribe stats:', unsubError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stats' },
        { status: 500 }
      )
    }

    const unsubs = unsubscribes || []

    const byChannel = {
      email: unsubs.filter(u => u.channel === 'email').length,
      sms: unsubs.filter(u => u.channel === 'sms').length,
      push: unsubs.filter(u => u.channel === 'push').length,
      all: unsubs.filter(u => u.channel === 'all').length,
    }

    // Get GDPR request stats
    const { data: gdprRequests, error: gdprError } = await supabaseAdmin
      .from('notification_gdpr_requests')
      .select('status')

    let gdprPending = 0
    let gdprCompleted = 0

    if (!gdprError && gdprRequests) {
      gdprPending = gdprRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length
      gdprCompleted = gdprRequests.filter(r => r.status === 'completed').length
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_unsubscribed: unsubs.length,
        by_channel: byChannel,
        gdpr_pending: gdprPending,
        gdpr_completed: gdprCompleted,
      },
    })
  } catch (error) {
    console.error('Error in unsubscribe stats GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
