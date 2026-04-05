/**
 * Unified Authentication Helper
 * Supports both Supabase Auth sessions and Super Admin custom sessions
 */

import { NextRequest } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface AuthResult {
  authorized: boolean
  userId?: string
  email?: string
  role?: string
  isSuperAdmin?: boolean
  error?: string
}

/**
 * Verify authentication from either Supabase Auth or Super Admin session
 * This allows Super Admin endpoints to work with the custom session system
 * @param request - NextRequest object
 * @param allowedRoles - Optional array of allowed roles (e.g. ['SUPER_ADMIN', 'ADMIN']). If provided, checks role membership.
 */
export async function verifyUnifiedAuth(request: NextRequest, allowedRoles?: string[]): Promise<AuthResult> {
  try {
    // First, check for Super Admin session cookie
    const cookieStore = await cookies()
    const superAdminSessionId = cookieStore.get('super_admin_session')?.value

    if (superAdminSessionId) {
      // Verify Super Admin session
      const supabaseAdmin = createSupabaseAdmin()

      const { data: session, error: sessionError } = await supabaseAdmin
        .from('super_admin_sessions')
        .select(`
          id,
          super_admin_id,
          is_active,
          expires_at,
          super_admins!inner (
            id,
            email,
            full_name,
            is_active,
            is_locked
          )
        `)
        .eq('session_id', superAdminSessionId)
        .eq('is_active', true)
        .maybeSingle()

      if (!sessionError && session) {
        // Check if session is expired
        const expiresAt = new Date(session.expires_at)
        const now = new Date()

        if (expiresAt > now) {
          // Check if super admin account is active
          const superAdmin = Array.isArray(session.super_admins)
            ? session.super_admins[0]
            : session.super_admins

          const isActive = superAdmin.is_active !== false
          const isLocked = superAdmin.is_locked === true

          if (isActive && !isLocked) {
            // Check allowed roles if specified
            if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes('SUPER_ADMIN')) {
              return {
                authorized: false,
                error: `Forbidden - Required role: ${allowedRoles.join(' or ')}`
              }
            }

            return {
              authorized: true,
              userId: session.super_admin_id,
              email: superAdmin.email,
              role: 'SUPER_ADMIN',
              isSuperAdmin: true
            }
          }
        }
      }
    }

    // If no Super Admin session, check for regular Supabase Auth session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        authorized: false,
        error: 'Unauthorized - No valid session found'
      }
    }

    // Get user role from profiles or users table
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      // Try users table as fallback
      const { data: userDataAlt, error: userErrorAlt } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (userErrorAlt) {
        return {
          authorized: false,
          error: 'User profile not found'
        }
      }

      const altRole = userDataAlt?.role || 'USER'

      // Check allowed roles if specified
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(altRole)) {
        return {
          authorized: false,
          error: `Forbidden - Required role: ${allowedRoles.join(' or ')}`
        }
      }

      return {
        authorized: true,
        userId: user.id,
        email: user.email || '',
        role: altRole,
        isSuperAdmin: altRole === 'SUPER_ADMIN'
      }
    }

    const resolvedRole = userData?.role || 'USER'

    // Check allowed roles if specified
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(resolvedRole)) {
      return {
        authorized: false,
        error: `Forbidden - Required role: ${allowedRoles.join(' or ')}`
      }
    }

    return {
      authorized: true,
      userId: user.id,
      email: user.email || '',
      role: resolvedRole,
      isSuperAdmin: resolvedRole === 'SUPER_ADMIN'
    }

  } catch (error) {
    console.error('Unified auth error:', error)
    return {
      authorized: false,
      error: 'Authentication verification failed'
    }
  }
}

/**
 * Require Super Admin access
 * Returns auth result, throws 401/403 if not authorized
 */
export async function requireSuperAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await verifyUnifiedAuth(request)

  if (!auth.authorized) {
    throw new Error('UNAUTHORIZED')
  }

  if (!auth.isSuperAdmin && auth.role !== 'SUPER_ADMIN') {
    throw new Error('FORBIDDEN')
  }

  return auth
}
