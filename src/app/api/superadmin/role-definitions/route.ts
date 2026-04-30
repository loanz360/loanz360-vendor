import { parseBody } from '@/lib/utils/parse-body'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  fetchAllRoleDefinitions,
  fetchRoleDefinitionsByType,
  createSubRole,
  updateSubRole,
  deactivateSubRole
} from '@/lib/api/role-definitions-api'
import type { RoleDefinition } from '@/lib/constants/role-definitions'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Force this route to use Node.js runtime
 * This route uses tokens.ts which requires Node.js crypto module
 */
export const runtime = 'nodejs'

/**
 * SECURITY: Verify Super Admin authentication from cookies
 * Only Super Admin can manage role definitions
 */
async function verifySuperAdmin(_request: NextRequest): Promise<{ authorized: boolean; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  // Verify token signature and expiration
  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  // Check if token/session is blacklisted
  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  // Verify Super Admin role
  if (sessionData.role !== 'SUPER_ADMIN') {
    return { authorized: false, error: 'Forbidden - Super Admin access required' }
  }

  return { authorized: true }
}

/**
 * GET /api/superadmin/role-definitions
 * Fetch all role definitions or filter by type (Super Admin only)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // SECURITY: Verify Super Admin authentication
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER' | null

    let roles: RoleDefinition[]

    if (type) {
      roles = await fetchRoleDefinitionsByType(type)
    } else {
      roles = await fetchAllRoleDefinitions()
    }

    return NextResponse.json({
      success: true,
      data: roles,
      count: roles.length
    })
  } catch (error) {
    logger.error('Error fetching role definitions', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role definitions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/role-definitions
 * Create new sub-role (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify Super Admin authentication
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.key || !body.name || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: key, name, type' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['PARTNER', 'EMPLOYEE', 'CUSTOMER'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be PARTNER, EMPLOYEE, or CUSTOMER' },
        { status: 400 }
      )
    }

    const roleData: Omit<RoleDefinition, 'displayOrder'> = {
      key: body.key.toUpperCase().replace(/\s+/g, '_'),
      name: body.name,
      type: body.type,
      description: body.description || '',
      isActive: body.isActive !== false, // Default to true
      permissions: body.permissions || {}
    }

    const result = await createSubRole(roleData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Sub-role created successfully'
    }, { status: 201 })
  } catch (error) {
    logger.error('Error creating sub-role', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to create sub-role' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/role-definitions
 * Update existing sub-role (Super Admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY: Verify Super Admin authentication
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    if (!body.key) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: key' },
        { status: 400 }
      )
    }

    const { key, ...updates } = body

    const result = await updateSubRole(key, updates)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Sub-role updated successfully'
    })
  } catch (error) {
    logger.error('Error updating sub-role', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to update sub-role' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/role-definitions?key=ROLE_KEY
 * Deactivate sub-role (Super Admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Verify Super Admin authentication
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: key' },
        { status: 400 }
      )
    }

    const result = await deactivateSubRole(key)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sub-role deactivated successfully'
    })
  } catch (error) {
    logger.error('Error deactivating sub-role', error as Error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate sub-role' },
      { status: 500 }
    )
  }
}
