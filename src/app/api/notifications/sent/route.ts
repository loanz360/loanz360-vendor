export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

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

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    return { isValid: false }
  }

  // Verify admin is active
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
 * GET /api/notifications/sent
 * Get sent notifications for Super Admin/HR
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // First check for Super Admin session
    const superAdminCheck = await checkSuperAdminSession(request)
    let isSuperAdmin = superAdminCheck.isValid
    let isHR = false
    let userId: string | null = superAdminCheck.adminId || null

    // If not a Super Admin, check regular user authentication
    if (!isSuperAdmin) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      userId = user.id

      // Get employee profile to check permissions
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = employee?.role === 'super_admin'
      isHR = employee?.role === 'hr' || employee?.role === 'HR'
    }

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Use admin client for all queries
    const supabaseAdmin = createSupabaseAdmin()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    // Build query
    let query = supabaseAdmin
      .from('system_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // HR can only see their own sent notifications
    if (isHR && userId) {
      query = query.eq('sent_by', userId)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('notification_type', type)
    }

    if (search) {
      const safeSearch = search.replace(/[%_\\'"(),.]/g, '')
      if (safeSearch) {
        query = query.or(`title.ilike.%${safeSearch}%,message.ilike.%${safeSearch}%`)
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: notifications, error: notificationsError, count } = await query

    if (notificationsError) {
      apiLogger.error('Error fetching notifications', notificationsError)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      notifications: notifications || [],
      total: count || 0,
      limit,
      offset
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/notifications/sent', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
