
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
async function verifyEmployee(_request: NextRequest): Promise<{ authorized: boolean; error?: string }> {
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

  return { authorized: true }
}

/**
 * GET /api/employees/managers
 * Fetch list of employees who can be reporting managers
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

    // Get search query from URL params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    // Fetch employees with manager roles
    let query = supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        sub_role
      `)
      .eq('role', 'EMPLOYEE')
      .order('full_name', { ascending: true })

    // Apply search filter if provided
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Limit results
    query = query.limit(20)

    const { data: managers, error } = await query

    if (error) {
      logger.error('Error fetching managers', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch managers' },
        { status: 500 }
      )
    }

    // Format response
    const formattedManagers = (managers || []).map(manager => ({
      id: manager.id,
      name: manager.full_name,
      email: manager.email,
      role: manager.sub_role,
      label: `${manager.full_name} (${manager.sub_role || 'Employee'})`
    }))

    return NextResponse.json({
      success: true,
      data: formattedManagers
    })
  } catch (error) {
    logger.error('Error in GET /api/employees/managers', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
