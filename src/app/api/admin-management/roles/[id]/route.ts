import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { uuidParamSchema, formatValidationErrors } from '@/lib/validation/admin-validation'
import { customRoleSchema } from '@/lib/roles/role-management'

/**
 * PUT /api/admin-management/roles/[id]
 * Update a custom role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params

    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID', details: formatValidationErrors(paramValidation.error) },
        { status: 400 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
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
      .update({
        display_name: role.display_name,
        description: role.description,
        permissions: role.permissions,
        inherits_from: role.inherits_from,
        is_active: role.is_active,
      })
      .eq('id', id)
      .eq('is_system', false)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ success: true, role: data }, { status: 200 })
  } catch (error) {
    return handleApiError(error, 'update role')
  }
}

/**
 * DELETE /api/admin-management/roles/[id]
 * Delete a custom role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params

    const { error } = await supabase
      .from('admin_custom_roles')
      .delete()
      .eq('id', id)
      .eq('is_system', false)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Role deleted successfully' }, { status: 200 })
  } catch (error) {
    return handleApiError(error, 'delete role')
  }
}
