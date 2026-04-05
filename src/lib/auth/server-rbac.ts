/**
 * Server-Side Role-Based Access Control (RBAC)
 *
 * SECURITY: This module provides server-side role validation to prevent
 * client-side authorization bypass attacks. All role checks MUST be performed
 * server-side before allowing access to sensitive operations.
 *
 * Fortune 500 Compliance: Implements proper access control separation
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { cookies } from 'next/headers'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'LOAN_OFFICER' | 'USER' | 'BORROWER'

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  sessionId?: string
}

/**
 * Role hierarchy for permission checks
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'SUPER_ADMIN': 5,
  'ADMIN': 4,
  'LOAN_OFFICER': 3,
  'USER': 2,
  'BORROWER': 1,
}

/**
 * Check if user has required role (server-side only)
 *
 * @param user - Authenticated user object
 * @param requiredRole - Minimum required role
 * @returns boolean - true if user has required role or higher
 */
export function hasRole(user: AuthenticatedUser | null, requiredRole: UserRole): boolean {
  if (!user || !user.role) {
    logger.warn('Role check failed - no user or role', { requiredRole })
    return false
  }

  const userLevel = ROLE_HIERARCHY[user.role] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0

  const hasAccess = userLevel >= requiredLevel

  if (!hasAccess) {
    logger.warn('Role check failed - insufficient permissions', {
      userId: user.id,
      userRole: user.role,
      requiredRole,
      userLevel,
      requiredLevel
    })
  }

  return hasAccess
}

/**
 * Check if user has ANY of the specified roles
 *
 * @param user - Authenticated user object
 * @param allowedRoles - Array of allowed roles
 * @returns boolean - true if user has any of the allowed roles
 */
export function hasAnyRole(user: AuthenticatedUser | null, allowedRoles: UserRole[]): boolean {
  if (!user || !user.role) {
    return false
  }

  return allowedRoles.includes(user.role)
}

/**
 * Check if user has EXACT role (not hierarchical)
 *
 * @param user - Authenticated user object
 * @param exactRole - Exact role required
 * @returns boolean - true if user has exact role
 */
export function hasExactRole(user: AuthenticatedUser | null, exactRole: UserRole): boolean {
  if (!user || !user.role) {
    return false
  }

  return user.role === exactRole
}

/**
 * Server-side RBAC middleware wrapper
 * Returns 403 Forbidden if user doesn't have required role
 *
 * Usage in API routes:
 * ```typescript
 * const user = await getUserFromRequest(request)
 * const rbacCheck = requireRole(user, 'ADMIN')
 * if (rbacCheck) return rbacCheck // Returns 403 response
 *
 * // User has required role, continue...
 * ```
 */
export function requireRole(
  user: AuthenticatedUser | null,
  requiredRole: UserRole,
  customMessage?: string
): NextResponse | null {
  if (!user) {
    logger.warn('RBAC check failed - no authenticated user', { requiredRole })
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    )
  }

  if (!hasRole(user, requiredRole)) {
    logger.warn('RBAC check failed - insufficient permissions', {
      userId: user.id,
      userRole: user.role,
      requiredRole
    })

    return NextResponse.json(
      {
        error: customMessage || 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRole,
        userRole: user.role
      },
      { status: 403 }
    )
  }

  // User has required role
  return null
}

/**
 * Require any of multiple roles
 */
export function requireAnyRole(
  user: AuthenticatedUser | null,
  allowedRoles: UserRole[],
  customMessage?: string
): NextResponse | null {
  if (!user) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    )
  }

  if (!hasAnyRole(user, allowedRoles)) {
    logger.warn('RBAC check failed - user does not have any allowed role', {
      userId: user.id,
      userRole: user.role,
      allowedRoles
    })

    return NextResponse.json(
      {
        error: customMessage || 'Insufficient permissions',
        code: 'FORBIDDEN',
        allowedRoles,
        userRole: user.role
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Check if user can access resource owned by specific user
 * Users can access their own resources, admins can access any
 */
export function canAccessResource(
  currentUser: AuthenticatedUser | null,
  resourceOwnerId: string
): boolean {
  if (!currentUser) {
    return false
  }

  // User can access their own resources
  if (currentUser.id === resourceOwnerId) {
    return true
  }

  // Admins and Super Admins can access any resource
  return hasRole(currentUser, 'ADMIN')
}

/**
 * Require resource access (user owns resource OR has admin role)
 */
export function requireResourceAccess(
  currentUser: AuthenticatedUser | null,
  resourceOwnerId: string,
  resourceType: string = 'resource'
): NextResponse | null {
  if (!currentUser) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    )
  }

  if (!canAccessResource(currentUser, resourceOwnerId)) {
    logger.warn('Resource access denied', {
      userId: currentUser.id,
      userRole: currentUser.role,
      resourceOwnerId,
      resourceType
    })

    return NextResponse.json(
      {
        error: `You do not have permission to access this ${resourceType}`,
        code: 'FORBIDDEN'
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Get user from request by verifying session token
 * Extracts user from auth-token cookie and validates session
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Get cookie store
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      logger.debug('No auth token found in request', {
        path: request.nextUrl.pathname
      })
      return null
    }

    // Verify and decode the session token
    const sessionData = verifySessionToken(authToken)
    if (!sessionData) {
      logger.warn('Invalid or expired session token', {
        path: request.nextUrl.pathname
      })
      return null
    }

    // Check if token is blacklisted
    const tokenBlacklisted = await isTokenBlacklisted(authToken)
    if (tokenBlacklisted) {
      logger.warn('Blacklisted token used', {
        path: request.nextUrl.pathname,
        userId: sessionData.userId
      })
      return null
    }

    // Check if session is revoked
    const sessionRevoked = await isSessionRevoked(sessionData.sessionId)
    if (sessionRevoked) {
      logger.warn('Revoked session used', {
        path: request.nextUrl.pathname,
        userId: sessionData.userId,
        sessionId: sessionData.sessionId
      })
      return null
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000)
    if (sessionData.expiresAt < now) {
      logger.warn('Expired session used', {
        path: request.nextUrl.pathname,
        userId: sessionData.userId,
        expiresAt: sessionData.expiresAt,
        now
      })
      return null
    }

    // Map role to UserRole type
    const role = sessionData.role.toUpperCase().replace(/-/g, '_') as UserRole

    // Return authenticated user
    return {
      id: sessionData.userId,
      email: sessionData.email,
      role: role,
      sessionId: sessionData.sessionId
    }
  } catch (error) {
    logger.error('Error extracting user from request', error as Error, {
      path: request.nextUrl.pathname
    })
    return null
  }
}

/**
 * Permission constants for common operations
 */
export const PERMISSIONS = {
  // Super Admin only
  MANAGE_ADMINS: 'SUPER_ADMIN' as UserRole,
  SYSTEM_CONFIG: 'SUPER_ADMIN' as UserRole,
  VIEW_ALL_DATA: 'SUPER_ADMIN' as UserRole,

  // Admin or higher
  MANAGE_USERS: 'ADMIN' as UserRole,
  VIEW_REPORTS: 'ADMIN' as UserRole,
  MANAGE_LOANS: 'ADMIN' as UserRole,

  // Loan Officer or higher
  PROCESS_LOANS: 'LOAN_OFFICER' as UserRole,
  APPROVE_LOANS: 'LOAN_OFFICER' as UserRole,

  // User or higher
  VIEW_OWN_LOANS: 'USER' as UserRole,
  CREATE_APPLICATION: 'USER' as UserRole,
} as const

/**
 * Example usage in API route:
 *
 * ```typescript
 * import { requireRole, PERMISSIONS } from '@/lib/auth/server-rbac'
 *
 * export async function POST(request: NextRequest) {
 *   const user = await getUserFromRequest(request)
 *
 *   // Check if user has admin role
 *   const rbacCheck = requireRole(user, PERMISSIONS.MANAGE_USERS)
 *   if (rbacCheck) return rbacCheck // Returns 403 if unauthorized
 *
 *   // User has permission, proceed with operation...
 * }
 * ```
 */
