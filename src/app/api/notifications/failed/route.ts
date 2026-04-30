
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
 * GET /api/notifications/failed
 * List failed notifications with filters, search, and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Check Super Admin session first
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
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    // Build query for failed notifications from notification_delivery_log
    let query = supabaseAdmin
      .from('notification_delivery_log')
      .select('*', { count: 'exact' })
      .in('status', ['failed', 'bounced', 'dead_letter', 'retrying'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type && type !== 'all') {
      query = query.eq('channel', type)
    }

    if (status && status !== 'all') {
      if (status === 'failed') {
        query = query.in('status', ['failed', 'bounced'])
      } else {
        query = query.eq('status', status)
      }
    }

    if (search) {
      query = query.or(`recipient.ilike.%${search}%,error_message.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    const { data: logs, count, error } = await query

    if (error) {
      console.error('Error fetching failed notifications:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch failed notifications' },
        { status: 500 }
      )
    }

    // Map delivery log fields to the frontend FailedNotification interface
    const notifications = (logs || []).map((log: typeof logs[number]) => ({
      id: log.id,
      type: log.channel || 'email',
      recipient: log.recipient || '',
      subject: log.subject || null,
      message: log.message_body || log.message || '',
      error_message: log.error_message || 'Unknown error',
      error_code: log.error_code || null,
      retry_count: log.retry_count || 0,
      max_retries: log.max_retries || 3,
      created_at: log.created_at,
      last_retry_at: log.last_retry_at || null,
      provider: log.provider || null,
      status: log.status === 'bounced' ? 'failed' : log.status,
    }))

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      notifications,
      total: totalCount,
      total_pages: totalPages,
      page,
      limit,
    })
  } catch (error) {
    console.error('Error in failed notifications GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
