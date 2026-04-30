
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCSRFToken } from '@/lib/security/csrf'
import {
  validateRoleName,
  validateDescription,
  sanitizeString
} from '@/lib/validation/input-validator'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * PUT /api/role-definitions/[key]
 * Update existing role definition (requires SUPER_ADMIN role)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

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
    const { key } = await params

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
    let { role_name, description, is_active, display_order } = body

    // Sanitize inputs
    if (role_name !== undefined) role_name = sanitizeString(role_name)
    if (description !== undefined) description = sanitizeString(description)

    // Validate role_name if provided
    if (role_name !== undefined) {
      const nameValidation = validateRoleName(role_name)
      if (!nameValidation.valid) {
        return NextResponse.json(
          { error: nameValidation.error },
          { status: 400 }
        )
      }
    }

    // Validate description if provided
    if (description !== undefined) {
      const descValidation = validateDescription(description)
      if (!descValidation.valid) {
        return NextResponse.json(
          { error: descValidation.error },
          { status: 400 }
        )
      }
    }

    // Validate display_order if provided
    if (display_order !== undefined) {
      if (typeof display_order !== 'number' || display_order < 0) {
        return NextResponse.json(
          { error: 'Display order must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (role_name !== undefined) updates.role_name = role_name
    if (description !== undefined) updates.description = description
    if (is_active !== undefined) updates.is_active = is_active
    if (display_order !== undefined) updates.display_order = display_order

    // Update role definition
    const { data, error } = await supabase
      .from('role_definitions')
      .update(updates)
      .eq('role_key', key)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Role definition not found' },
          { status: 404 }
        )
      }
      logger.error('Database error updating role definition', error instanceof Error ? error : undefined, {
        context: 'role-definitions-PUT',
        role_key: key
      })
      return NextResponse.json(
        { error: 'Failed to update role definition' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    logger.error('Error in role-definitions PUT API', error instanceof Error ? error : undefined, {
      context: 'role-definitions-PUT'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/role-definitions/[key]
 * Delete role definition (requires SUPER_ADMIN role)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
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
    const { key } = await params

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

    // Delete role definition
    const { error } = await supabase
      .from('role_definitions')
      .delete()
      .eq('role_key', key)

    if (error) {
      logger.error('Database error deleting role definition', error instanceof Error ? error : undefined, {
        context: 'role-definitions-DELETE',
        role_key: key
      })
      return NextResponse.json(
        { error: 'Failed to delete role definition' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error in role-definitions DELETE API', error instanceof Error ? error : undefined, {
      context: 'role-definitions-DELETE'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
