
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

  // Allow both EMPLOYEE and HR roles to access employee self-service features
  const roleUpper = sessionData.role?.toUpperCase()
  if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
    return { authorized: false, error: 'Forbidden - Employee access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * GET /api/employees/hierarchy
 * Get employee's position in org hierarchy (manager and direct reports)
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

    const supabase = createSupabaseAdmin()

    // Get current employee's profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select(`
        user_id,
        reporting_manager_id,
        reporting_manager_name,
        department
      `)
      .eq('user_id', auth.userId)
      .maybeSingle()

    // Get current employee's user data
    const { data: currentUser } = await supabase
      .from('users')
      .select('full_name, email, sub_role, avatar_url')
      .eq('id', auth.userId)
      .maybeSingle()

    // Get manager details if exists
    let manager = null
    if (currentProfile?.reporting_manager_id) {
      const { data: managerUser } = await supabase
        .from('users')
        .select('id, full_name, email, sub_role, avatar_url')
        .eq('id', currentProfile.reporting_manager_id)
        .maybeSingle()

      const { data: managerProfile } = await supabase
        .from('profiles')
        .select('department')
        .eq('user_id', currentProfile.reporting_manager_id)
        .maybeSingle()

      if (managerUser) {
        manager = {
          id: managerUser.id,
          name: managerUser.full_name,
          email: managerUser.email,
          role: managerUser.sub_role,
          department: managerProfile?.department,
          avatarUrl: managerUser.avatar_url
        }
      }
    }

    // Get direct reports (employees who report to current user)
    const { data: reportProfiles } = await supabase
      .from('profiles')
      .select(`
        user_id,
        department
      `)
      .eq('reporting_manager_id', auth.userId)

    const directReports = []
    if (reportProfiles && reportProfiles.length > 0) {
      const reportUserIds = reportProfiles.map(p => p.user_id)

      const { data: reportUsers } = await supabase
        .from('users')
        .select('id, full_name, email, sub_role, avatar_url')
        .in('id', reportUserIds)

      for (const reportUser of reportUsers || []) {
        const profile = reportProfiles.find(p => p.user_id === reportUser.id)
        directReports.push({
          id: reportUser.id,
          name: reportUser.full_name,
          email: reportUser.email,
          role: reportUser.sub_role,
          department: profile?.department,
          avatarUrl: reportUser.avatar_url
        })
      }
    }

    // Get peers (employees with same manager)
    const peers = []
    if (currentProfile?.reporting_manager_id) {
      const { data: peerProfiles } = await supabase
        .from('profiles')
        .select('user_id, department')
        .eq('reporting_manager_id', currentProfile.reporting_manager_id)
        .neq('user_id', auth.userId)
        .limit(10)

      if (peerProfiles && peerProfiles.length > 0) {
        const peerUserIds = peerProfiles.map(p => p.user_id)

        const { data: peerUsers } = await supabase
          .from('users')
          .select('id, full_name, email, sub_role, avatar_url')
          .in('id', peerUserIds)

        for (const peerUser of peerUsers || []) {
          const profile = peerProfiles.find(p => p.user_id === peerUser.id)
          peers.push({
            id: peerUser.id,
            name: peerUser.full_name,
            email: peerUser.email,
            role: peerUser.sub_role,
            department: profile?.department,
            avatarUrl: peerUser.avatar_url
          })
        }
      }
    }

    const hierarchyData = {
      currentEmployee: {
        id: auth.userId,
        name: currentUser?.full_name,
        email: currentUser?.email,
        role: currentUser?.sub_role,
        department: currentProfile?.department,
        avatarUrl: currentUser?.avatar_url
      },
      manager,
      directReports,
      peers,
      stats: {
        directReportCount: directReports.length,
        peerCount: peers.length,
        hasManager: !!manager
      }
    }

    return NextResponse.json({
      success: true,
      data: hierarchyData
    })
  } catch (error) {
    logger.error('Error in GET /api/employees/hierarchy', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
