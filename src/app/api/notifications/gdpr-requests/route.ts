
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
 * GET /api/notifications/gdpr-requests
 * List GDPR data requests
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

    const { data: requests, error } = await supabaseAdmin
      .from('notification_gdpr_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error fetching GDPR requests:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch GDPR requests' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requests: requests || [],
    })
  } catch (error) {
    console.error('Error in GDPR requests GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
