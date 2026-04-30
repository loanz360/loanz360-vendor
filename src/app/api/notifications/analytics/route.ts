
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
 * GET /api/notifications/analytics
 * Get notification analytics and statistics
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
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

      // Check if user is Super Admin or HR via profiles/employees
      const { data: userData } = await supabase
        .from('profiles')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = userData?.role === 'SUPER_ADMIN'
      const roleUpper = userData?.role?.toUpperCase()
      isHR = roleUpper === 'HR' || (roleUpper === 'EMPLOYEE' && userData?.sub_role?.toUpperCase() === 'HR')
    }

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin and HR can access analytics' },
        { status: 403 }
      )
    }

    // Use admin client for all queries (works for both Super Admin and HR)
    const supabaseAdmin = createSupabaseAdmin()

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get total notifications sent
    let query = supabaseAdmin
      .from('system_notifications')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // HR can only see their own notifications
    if (isHR && userId) {
      query = query.eq('sent_by', userId)
    }

    const { count: totalSent } = await query

    // Get total recipients
    const { data: notifications } = await supabaseAdmin
      .from('system_notifications')
      .select('total_recipients, read_count')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const totalRecipients = notifications?.reduce((sum, n) => sum + (n.total_recipients || 0), 0) || 0
    const totalRead = notifications?.reduce((sum, n) => sum + (n.read_count || 0), 0) || 0
    const overallReadRate = totalRecipients > 0 ? Math.round((totalRead / totalRecipients) * 100) : 0

    // Get notifications by type
    const { data: byType } = await supabaseAdmin
      .from('system_notifications')
      .select('notification_type')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const typeStats = byType?.reduce((acc: Record<string, number>, n) => {
      acc[n.notification_type] = (acc[n.notification_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get notifications by priority
    const { data: byPriority } = await supabaseAdmin
      .from('system_notifications')
      .select('priority')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const priorityStats = byPriority?.reduce((acc: Record<string, number>, n) => {
      acc[n.priority] = (acc[n.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get notifications by target category
    const { data: byCategory } = await supabaseAdmin
      .from('system_notifications')
      .select('target_category, total_recipients')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const categoryStats = byCategory?.reduce((acc: Record<string, number>, n) => {
      const category = n.target_category || 'all'
      acc[category] = (acc[category] || 0) + (n.total_recipients || 0)
      return acc
    }, {} as Record<string, number>)

    // Get daily trend data
    const { data: dailyData } = await supabaseAdmin
      .from('system_notifications')
      .select('created_at, total_recipients, read_count')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    // Group by day
    const dailyTrend: Record<string, { sent: number; recipients: number; read: number }> = {}
    dailyData?.forEach(n => {
      const day = new Date(n.created_at).toISOString().split('T')[0]
      if (!dailyTrend[day]) {
        dailyTrend[day] = { sent: 0, recipients: 0, read: 0 }
      }
      dailyTrend[day].sent += 1
      dailyTrend[day].recipients += n.total_recipients || 0
      dailyTrend[day].read += n.read_count || 0
    })

    // Get top performing notifications (highest read rate)
    const { data: topNotifications } = await supabaseAdmin
      .from('system_notifications')
      .select('id, title, total_recipients, read_count, notification_type, priority, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .gt('total_recipients', 0)
      .order('read_count', { ascending: false })
      .limit(5)

    const topPerforming = topNotifications?.map(n => ({
      ...n,
      read_rate: n.total_recipients > 0 ? Math.round((n.read_count / n.total_recipients) * 100) : 0
    }))

    // Get recent activity
    const { data: recentActivity } = await supabaseAdmin
      .from('system_notifications')
      .select('id, title, sent_by_name, total_recipients, notification_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      overview: {
        total_sent: totalSent || 0,
        total_recipients: totalRecipients,
        total_read: totalRead,
        read_rate: overallReadRate
      },
      by_type: typeStats || {},
      by_priority: priorityStats || {},
      by_category: categoryStats || {},
      daily_trend: Object.entries(dailyTrend).map(([date, stats]: [string, any]) => ({
        date,
        ...stats,
        read_rate: stats.recipients > 0 ? Math.round((stats.read / stats.recipients) * 100) : 0
      })),
      top_performing: topPerforming || [],
      recent_activity: recentActivity || []
    })
  } catch (error) {
    apiLogger.error('Error fetching notification analytics', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
