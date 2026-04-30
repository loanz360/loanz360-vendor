import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/permissions/granular
 * Get all granular (action-level) permissions for an admin
 */
export async function GET(
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
    const { searchParams } = new URL(request.url)

    const includeExpired = searchParams.get('include_expired') === 'true'
    const moduleKey = searchParams.get('module_key')

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('admin_granular_permissions')
      .select(`
        *,
        system_modules!inner(module_key, module_name, module_description, module_icon)
      `)
      .eq('admin_id', id)

    if (!includeExpired) {
      query = query.eq('is_active', true)
    }

    if (moduleKey) {
      query = query.eq('module_key', moduleKey)
    }

    const { data: permissions, error: permissionsError } = await query
      .order('created_at', { ascending: false })

    if (permissionsError) throw permissionsError

    // Add computed fields
    const permissionsWithStatus = permissions?.map(perm => ({
      ...perm,
      is_expired: perm.valid_until && new Date(perm.valid_until) < new Date(),
      days_until_expiry: perm.valid_until
        ? Math.ceil((new Date(perm.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      permission_count: [
        perm.can_read,
        perm.can_write,
        perm.can_update,
        perm.can_delete,
        perm.can_approve,
        perm.can_reject,
        perm.can_export,
        perm.can_import,
        perm.can_assign,
        perm.can_manage_users,
        perm.can_configure,
        perm.can_audit,
        perm.can_bulk_actions
      ].filter(Boolean).length
    }))

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name,
          email: admin.email
        },
        permissions: permissionsWithStatus || [],
        summary: {
          total_modules: permissionsWithStatus?.length || 0,
          active_permissions: permissionsWithStatus?.filter(p => p.is_active && !p.is_expired).length || 0,
          expired_permissions: permissionsWithStatus?.filter(p => p.is_expired).length || 0,
          temporary_permissions: permissionsWithStatus?.filter(p => p.is_temporary).length || 0
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Get Granular Permissions API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin-management/[id]/permissions/granular
 * Grant granular permission to an admin
 */
export async function POST(
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
    const bodySchema = z.object({

      module_key: z.string().optional(),

      permissions: z.array(z.unknown()).optional(),

      resource_restriction: z.string().optional().default('all'),

      restricted_to_branches: z.string().optional(),

      restricted_to_regions: z.string().optional(),

      restricted_to_departments: z.string().optional(),

      valid_until: z.string().optional(),

      notes: z.string().optional(),

      granted_by_user_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      module_key,
      permissions,
      resource_restriction = 'all',
      restricted_to_branches,
      restricted_to_regions,
      restricted_to_departments,
      valid_until,
      notes,
      granted_by_user_id
    } = body

    // Validate required fields
    if (!module_key || !permissions) {
      return NextResponse.json(
        { success: false, error: 'module_key and permissions are required' },
        { status: 400 }
      )
    }

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Grant permission using database function
    const { data: permissionId, error: grantError } = await supabase
      .rpc('grant_admin_permission', {
        p_admin_id: id,
        p_module_key: module_key,
        p_permissions: permissions,
        p_granted_by: granted_by_user_id,
        p_resource_restriction: resource_restriction,
        p_valid_until: valid_until,
        p_notes: notes
      })

    if (grantError) throw grantError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'permission_granted',
      p_action_description: `Granular permissions granted for module ${module_key} to admin ${admin.admin_unique_id}`,
      p_changes: JSON.stringify({
        module_key,
        permissions,
        resource_restriction,
        valid_until
      }),
      p_performed_by: granted_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Granular permission granted successfully',
      data: {
        permission_id: permissionId,
        module_key,
        is_temporary: !!valid_until
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Grant Granular Permission API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin-management/[id]/permissions/granular
 * Revoke granular permission from an admin
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
    const { searchParams } = new URL(request.url)

    const moduleKey = searchParams.get('module_key')
    const revokedBy = searchParams.get('revoked_by')
    const reason = searchParams.get('reason')

    if (!moduleKey) {
      return NextResponse.json(
        { success: false, error: 'module_key is required' },
        { status: 400 }
      )
    }

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Revoke permission using database function
    const { data: success, error: revokeError } = await supabase
      .rpc('revoke_admin_permission', {
        p_admin_id: id,
        p_module_key: moduleKey,
        p_revoked_by: revokedBy,
        p_reason: reason
      })

    if (revokeError) throw revokeError

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Permission not found or already revoked' },
        { status: 404 }
      )
    }

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'permission_revoked',
      p_action_description: `Granular permission for module ${moduleKey} was revoked from admin ${admin.admin_unique_id}`,
      p_changes: JSON.stringify({
        module_key: moduleKey,
        reason: reason || 'Not specified'
      }),
      p_performed_by: revokedBy,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Granular permission revoked successfully',
      data: {
        module_key: moduleKey
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Revoke Granular Permission API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
