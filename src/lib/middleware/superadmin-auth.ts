/**
 * SuperAdmin Authentication Middleware
 * Centralized auth check for all SuperAdmin API routes
 * E8: Single authentication check to eliminate auth bypasses
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnifiedAuth, AuthResult } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export interface SuperAdminAuthOptions {
  /** Additional roles beyond SUPER_ADMIN that are allowed */
  allowedRoles?: string[]
  /** Whether to log the access attempt */
  logAccess?: boolean
  /** Max requests per minute (rate limiting) */
  maxRequestsPerMinute?: number
}

/**
 * Verify that the request is from an authenticated SuperAdmin
 * Returns the auth result or a 401/403 response
 */
export async function requireSuperAdminAuth(
  request: NextRequest,
  options: SuperAdminAuthOptions = {}
): Promise<{ auth: AuthResult } | { response: NextResponse }> {
  const { allowedRoles = ['SUPER_ADMIN'], logAccess = false } = options

  try {
    const auth = await verifyUnifiedAuth(request, allowedRoles)

    if (!auth.authorized) {
      if (logAccess) {
        apiLogger.warn('Unauthorized SuperAdmin access attempt', {
          path: request.nextUrl.pathname,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        })
      }

      return {
        response: NextResponse.json(
          { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
          { status: 401 }
        ),
      }
    }

    if (auth.role !== 'SUPER_ADMIN' && !auth.isSuperAdmin) {
      return {
        response: NextResponse.json(
          { success: false, error: 'Forbidden - SuperAdmin access required', code: 'FORBIDDEN' },
          { status: 403 }
        ),
      }
    }

    return { auth }
  } catch (error) {
    apiLogger.error('SuperAdmin auth middleware error', error)
    return {
      response: NextResponse.json(
        { success: false, error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Helper to extract auth from middleware result
 * Usage:
 *   const result = await requireSuperAdminAuth(request)
 *   if ('response' in result) return result.response
 *   const { auth } = result
 */
export function isSuperAdminAuthed(
  result: { auth: AuthResult } | { response: NextResponse }
): result is { auth: AuthResult } {
  return 'auth' in result
}
