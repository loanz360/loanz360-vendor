
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { customRoleSchema } from '@/lib/roles/role-management'

/**
 * GET /api/admin-management/roles
 * Get all custom roles
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    const { data: roles, error } = await supabase
      .from('admin_custom_roles')
      .select(`
        *,
        user_count:admin_role_assignments(count)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, roles: roles || [] }, { status: 200 })
  } catch (error) {
    return handleApiError(error, 'fetch roles')
  }
}

/**
 * POST /api/admin-management/roles
 * Create a new custom role
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const body = await request.json()
    const validation = customRoleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid role data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const role = validation.data

    const { data, error } = await supabase
      .from('admin_custom_roles')
      .insert({
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        permissions: role.permissions,
        inherits_from: role.inherits_from,
        is_active: role.is_active,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ success: true, role: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'create role')
  }
}
