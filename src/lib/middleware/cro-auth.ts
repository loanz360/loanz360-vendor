/**
 * CRO Authentication Middleware
 * Centralized auth check for all CRO Performance API routes
 * Eliminates duplicated role verification across 6+ API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/** Roles allowed to access CRO performance endpoints */
const CRO_ALLOWED_ROLES = [
  'CRO',
  'CUSTOMER RELATIONSHIP OFFICER',
  'CRO_TEAM_LEADER',
  'CRO_STATE_MANAGER',
  'SUPER_ADMIN',
  'ADMIN',
]

export interface CROAuthResult {
  user: {
    id: string
    email?: string
    user_metadata: Record<string, any>
  }
  role: string
}

export interface CROAuthOptions {
  /** Additional roles beyond default CRO roles */
  additionalRoles?: string[]
  /** Whether to log access attempts */
  logAccess?: boolean
}

/**
 * Verify that the request is from an authenticated user with CRO access
 * Returns auth result or error response
 *
 * Usage:
 *   const authResult = await requireCROAuth(request)
 *   if ('response' in authResult) return authResult.response
 *   const { user } = authResult
 */
export async function requireCROAuth(
  request: NextRequest,
  options: CROAuthOptions = {}
): Promise<{ user: CROAuthResult['user']; role: string } | { response: NextResponse }> {
  const { additionalRoles = [], logAccess = false } = options

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      if (logAccess) {
        apiLogger.warn('Unauthorized CRO access attempt', {
          path: request.nextUrl.pathname,
        })
      }
      return {
        response: NextResponse.json(
          { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
          { status: 401 }
        ),
      }
    }

    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = [...CRO_ALLOWED_ROLES, ...additionalRoles]

    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return {
        response: NextResponse.json(
          { success: false, error: 'Forbidden: CRO access required', code: 'FORBIDDEN' },
          { status: 403 }
        ),
      }
    }

    return { user, role: userRole.toUpperCase() }
  } catch (error) {
    apiLogger.error('CRO auth middleware error', error)
    return {
      response: NextResponse.json(
        { success: false, error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 500 }
      ),
    }
  }
}

/** Type guard to check if auth succeeded */
export function isCROAuthed(
  result: { user: CROAuthResult['user']; role: string } | { response: NextResponse }
): result is { user: CROAuthResult['user']; role: string } {
  return 'user' in result
}
