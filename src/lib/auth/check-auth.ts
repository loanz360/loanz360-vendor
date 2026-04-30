/**
 * Centralized authentication check utility
 * Used across API routes to verify user authentication and authorization
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET_VALUE = process.env.JWT_SECRET
if (!JWT_SECRET_VALUE) {
  console.error('CRITICAL: JWT_SECRET environment variable is not set')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_VALUE || '')

export interface AuthResult {
  authorized: boolean
  user?: {
    id: string
    email: string
    role: string
  }
  error?: string
}

/**
 * Check authentication and authorization for API routes
 * @param allowedRoles - Array of roles allowed to access the endpoint
 * @param request - Optional NextRequest object (will be extracted from context if not provided)
 * @returns AuthResult object with authorization status and user details
 */
export async function checkAuth(
  allowedRoles: string[],
  request?: NextRequest
): Promise<AuthResult> {
  try {
    // Request must be explicitly provided
    const req = request

    if (!req) {
      return {
        authorized: false,
        error: 'Request context not available'
      }
    }

    // Extract token from Authorization header or cookie
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('admin_token')?.value

    if (!token) {
      return {
        authorized: false,
        error: 'Authentication required - No token provided'
      }
    }

    // Verify JWT token
    let userId: string
    if (!JWT_SECRET_VALUE) {
      return {
        authorized: false,
        error: 'Server configuration error - JWT_SECRET not set'
      }
    }
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      userId = payload.sub as string

      if (!userId) {
        return {
          authorized: false,
          error: 'Invalid token payload'
        }
      }
    } catch (jwtError) {
      return {
        authorized: false,
        error: 'Invalid or expired token'
      }
    }

    // Fetch user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle()

    if (userError || !user) {
      return {
        authorized: false,
        error: 'User not found'
      }
    }

    // Check if user role is in allowed roles
    if (!allowedRoles.includes(user.role)) {
      return {
        authorized: false,
        error: `Unauthorized - Required role: ${allowedRoles.join(' or ')}, User role: ${user.role}`
      }
    }

    // Authorization successful
    return {
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    }
  } catch (error: unknown) {
    console.error('Auth check error:', error)
    return {
      authorized: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Authentication check failed'
    }
  }
}

/**
 * Middleware wrapper to inject request into global context
 * This allows checkAuth to work without explicit request parameter
 */
export function withAuthContext(handler: Function) {
  return async (request: NextRequest, context?: unknown) => {
    try {
      return await handler(request, context)
    } finally {
      // no-op cleanup
    }
  }
}

/**
 * Quick check for SUPER_ADMIN role
 */
export async function checkSuperAdmin(request?: NextRequest): Promise<AuthResult> {
  return checkAuth(['SUPER_ADMIN'], request)
}

/**
 * Quick check for ADMIN or SUPER_ADMIN roles
 */
export async function checkAdmin(request?: NextRequest): Promise<AuthResult> {
  return checkAuth(['ADMIN', 'SUPER_ADMIN'], request)
}

/**
 * Extract user ID from request without full authorization check
 * Useful for logging and tracking
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    return (payload.sub as string) || null
  } catch (error) {
    return null
  }
}
