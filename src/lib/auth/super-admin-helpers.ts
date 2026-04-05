/**
 * Super Admin Helper Functions
 * Utility functions for super admin authentication and authorization
 */

import type { NextRequest } from 'next/server'
import { verifySessionToken } from './tokens'
import { cookies } from 'next/headers'
import { logger } from '@/lib/utils/logger'

export interface SuperAdminAuthResult {
  authenticated: boolean
  admin?: {
    id: string
    email: string
    full_name: string
    two_factor_enabled: boolean
  }
  error?: string
}

/**
 * Get authenticated super admin from request
 * Verifies token and retrieves super admin data
 */
export async function getSuperAdminFromRequest(
  _request: NextRequest
): Promise<SuperAdminAuthResult> {
  try {
    // Get token from HTTP-Only cookie
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('auth_token')

    if (!authCookie?.value) {
      return { authenticated: false, error: 'No authentication token' }
    }

    // Verify token
    const tokenData = await verifySessionToken(authCookie.value)

    if (!tokenData) {
      return { authenticated: false, error: 'Invalid token' }
    }

    // Check if user is super admin
    if (tokenData.role !== 'SUPER_ADMIN') {
      return { authenticated: false, error: 'Not a super admin' }
    }

    // Get super admin data (we could use userId directly, but let's verify via profile)
    // Since super admins don't have regular user profiles, we need to query super_admins table
    // For now, return the basic info from token
    return {
      authenticated: true,
      admin: {
        id: tokenData.userId,
        email: tokenData.email || '',
        full_name: (tokenData as { full_name?: string }).full_name || 'Super Admin',
        two_factor_enabled: false, // Will be populated from DB if needed
      },
    }
  } catch (error) {
    logger.error('Error getting super admin from request', error as Error)
    return { authenticated: false, error: 'Authentication failed' }
  }
}

/**
 * Get super admin ID from request
 * Quick helper to just get the admin ID
 */
export async function getSuperAdminId(
  request: NextRequest
): Promise<string | null> {
  const result = await getSuperAdminFromRequest(request)
  return result.authenticated ? result.admin?.id || null : null
}

/**
 * Require super admin authentication
 * Throws error if not authenticated as super admin
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<SuperAdminAuthResult> {
  const result = await getSuperAdminFromRequest(request)

  if (!result.authenticated) {
    throw new Error(result.error || 'Super admin authentication required')
  }

  return result
}
