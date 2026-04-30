import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'
import { apiLogger } from '@/lib/utils/logger'
import { VENDOR_SUB_ROLES } from '@/config/roles'
import { encodeHtmlEntities } from '@/lib/utils/sanitize'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/vendor-management/subroles
 * Fetch all vendor sub-roles from DB, fallback to config if table doesn't exist
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Try to fetch from database
    const { data: roles, error } = await supabase
      .from('vendor_sub_roles')
      .select('*')
      .order('name', { ascending: true })

    // If table doesn't exist or query fails, fall back to config
    if (error) {
      apiLogger.warn('vendor_sub_roles table not available, falling back to config', { error: 'An unexpected error occurred' })

      const fallbackRoles = VENDOR_SUB_ROLES.map((role, index) => ({
        id: `config-${index}`,
        role_key: role.key,
        name: role.label,
        description: role.description || '',
        category: role.category,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      return NextResponse.json({
        success: true,
        data: { roles: fallbackRoles, source: 'config' },
      })
    }

    return NextResponse.json({
      success: true,
      data: { roles: roles || [], source: 'database' },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/vendor-management/subroles', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/vendor-management/subroles
 * Create a new vendor sub-role
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, category, status } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Role name is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Generate role_key from name
    const role_key = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

    const { data: role, error } = await supabase
      .from('vendor_sub_roles')
      .insert({
        role_key,
        name: encodeHtmlEntities(name),
        description: description ? encodeHtmlEntities(description) : null,
        category: category ? encodeHtmlEntities(category) : 'General',
        status: status || 'Active',
      })
      .select()
      .maybeSingle()

    if (error) {
      // Handle table not found gracefully
      if (error.code === '42P01') {
        return NextResponse.json(
          { success: false, error: 'vendor_sub_roles table not found. Please run the migration first.' },
          { status: 503 }
        )
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A role with this name already exists' },
          { status: 409 }
        )
      }
      apiLogger.error('Error creating vendor sub-role', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to create role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: role,
      message: 'Vendor sub-role created successfully',
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/superadmin/vendor-management/subroles', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
