export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'

/**
 * Verify employee authentication
 */
async function verifyEmployee(_request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  // Allow EMPLOYEE, HR, SUPER_ADMIN, and ADMIN roles (case-insensitive)
  const roleUpper = sessionData.role?.toUpperCase()
  if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR' && roleUpper !== 'SUPER_ADMIN' && roleUpper !== 'ADMIN') {
    return { authorized: false, error: 'Forbidden - Employee or Admin access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * GET /api/employees/profile/audit-log
 * Get audit trail for employee profile changes
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = createSupabaseAdmin()

    // Get audit logs for the user
    const { data: auditLogs, error: auditError, count } = await supabase
      .from('profile_audit_log')
      .select(`
        id,
        action,
        field_name,
        old_value,
        new_value,
        change_timestamp,
        changed_by
      `, { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('change_timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (auditError) {
      logger.error('Error fetching audit logs', auditError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Get changed_by user details
    const changedByIds = [...new Set(auditLogs?.map(log => log.changed_by).filter(Boolean))]
    const { data: changedByUsers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', changedByIds)

    const changedByMap = new Map(changedByUsers?.map(u => [u.id, u.full_name]))

    // Format audit logs with user names
    const formattedLogs = auditLogs?.map(log => ({
      id: log.id,
      action: log.action,
      fieldName: log.field_name,
      oldValue: log.old_value,
      newValue: log.new_value,
      timestamp: log.change_timestamp,
      changedBy: changedByMap.get(log.changed_by) || 'System',
      changedById: log.changed_by
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/employees/profile/audit-log', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
