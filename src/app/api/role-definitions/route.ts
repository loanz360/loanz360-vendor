export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { validateCSRFToken } from '@/lib/security/csrf'
import {
  validateRoleKey,
  validateRoleName,
  validateRoleType,
  validateDescription,
  sanitizeString
} from '@/lib/validation/input-validator'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'

/**
 * GET /api/role-definitions
 * Fetch all role definitions (requires authentication)
 * Allows: SUPER_ADMIN, ADMIN, HR, EMPLOYEE, PARTNER, CUSTOMER
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // First try admin auth (SUPER_ADMIN, ADMIN, HR)
    const adminAuth = await verifyAuth(request)

    // If admin auth fails, try regular auth (for customers, partners, employees)
    if (!adminAuth.authorized) {
      let isAuthenticated = false

      // Check for regular user session via auth-token cookie (employees/partners)
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const authToken = cookieStore.get('auth-token')?.value

      if (authToken) {
        const { verifySessionToken } = await import('@/lib/auth/tokens')
        const sessionData = verifySessionToken(authToken)

        if (sessionData) {
          // Any authenticated user can read role definitions
          // Role definitions are not sensitive data
          logger.debug('Role definitions accessed by regular user', {
            context: 'role-definitions-GET',
            role: sessionData.role
          })
          isAuthenticated = true
        }
      }

      // If no auth-token, check for Supabase Auth session (customers)
      if (!isAuthenticated) {
        try {
          const supabase = await createClient()
          const { data: { user }, error: authError } = await supabase.auth.getUser()

          if (!authError && user) {
            // Customer is authenticated via Supabase Auth
            logger.debug('Role definitions accessed by Supabase Auth user', {
              context: 'role-definitions-GET',
              userId: user.id
            })
            isAuthenticated = true
          }
        } catch (supabaseError) {
          logger.debug('Supabase auth check failed', {
            context: 'role-definitions-GET',
            error: supabaseError
          })
        }
      }

      if (!isAuthenticated) {
        return NextResponse.json(
          { error: adminAuth.error || 'Unauthorized' },
          { status: adminAuth.status || 401 }
        )
      }
    }

    // Use admin client for database operations
    const supabase = createSupabaseAdmin()

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // PARTNER, EMPLOYEE, CUSTOMER
    const key = searchParams.get('key') // Specific role key
    const activeOnly = searchParams.get('active') === 'true'

    // Build query - handle single key fetch separately from list fetch
    if (key) {
      // Fetch single role by key
      const { data, error } = await supabase
        .from('role_definitions')
        .select('*')
        .eq('role_key', key)
        .maybeSingle() // Use maybeSingle to return null instead of error when not found

      if (error) {
        logger.error('Database error fetching role definition by key', error instanceof Error ? error : undefined, {
          context: 'role-definitions-GET',
          key
        })
        return NextResponse.json(
          { error: 'Failed to fetch role definition' },
          { status: 500 }
        )
      }

      // Return data even if null (role not found)
      return NextResponse.json({ data })
    }

    // Build query for list fetch
    let query = supabase
      .from('role_definitions')
      .select('*')

    if (type) {
      query = query.eq('role_type', type)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    query = query.order('display_order', { ascending: true })

    const { data, error } = await query

    if (error) {
      logger.error('Database error fetching role definitions', error instanceof Error ? error : undefined, {
        context: 'role-definitions-GET',
        type,
        activeOnly
      })
      return NextResponse.json(
        { error: 'Failed to fetch role definitions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    logger.error('Error in role-definitions API', error instanceof Error ? error : undefined, {
      context: 'role-definitions-GET'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/role-definitions
 * Create new role definition (requires SUPER_ADMIN role)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token
    const isValidCSRF = await validateCSRFToken(request)
    if (!isValidCSRF) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    let { role_key, role_name, role_type, description, is_active } = body

    // Sanitize inputs
    role_key = sanitizeString(role_key)
    role_name = sanitizeString(role_name)
    role_type = sanitizeString(role_type)
    description = description ? sanitizeString(description) : null

    // Validate role_key
    const keyValidation = validateRoleKey(role_key)
    if (!keyValidation.valid) {
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 400 }
      )
    }

    // Validate role_name
    const nameValidation = validateRoleName(role_name)
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      )
    }

    // Validate role_type
    const typeValidation = validateRoleType(role_type)
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: typeValidation.error },
        { status: 400 }
      )
    }

    // Validate description (optional)
    const descValidation = validateDescription(description)
    if (!descValidation.valid) {
      return NextResponse.json(
        { error: descValidation.error },
        { status: 400 }
      )
    }

    // Check if role key already exists
    const { data: existing } = await supabase
      .from('role_definitions')
      .select('role_key')
      .eq('role_key', role_key)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Role key already exists' },
        { status: 409 }
      )
    }

    // Calculate next display order
    const { data: roles } = await supabase
      .from('role_definitions')
      .select('display_order')
      .eq('role_type', role_type)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = roles && roles.length > 0 ? roles[0].display_order + 1 : 0

    // Insert new role definition
    const { data, error } = await supabase
      .from('role_definitions')
      .insert({
        role_key,
        role_name,
        role_type,
        description: description || null,
        is_active: is_active ?? true,
        display_order: nextOrder
      })
      .select()
      .maybeSingle()

    if (error) {
      logger.error('Database error creating role definition', error instanceof Error ? error : undefined, {
        context: 'role-definitions-POST',
        role_key,
        role_type
      })
      return NextResponse.json(
        { error: 'Failed to create role definition' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    logger.error('Error in role-definitions POST API', error instanceof Error ? error : undefined, {
      context: 'role-definitions-POST'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
