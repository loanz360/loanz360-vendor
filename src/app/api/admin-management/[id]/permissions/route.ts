import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  uuidParamSchema,
  updatePermissionSchema,
  bulkUpdatePermissionsSchema,
  formatValidationErrors,
} from '@/lib/validation/admin-validation'
import {
  handleApiError,
  parseSupabaseError,
} from '@/lib/errors/api-errors'
import {
  withLock,
  executeBatch,
} from '@/lib/database/transaction-helper'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/permissions
 * Get all module permissions for an admin
 *
 * Security: UUID validation
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data

    // Check if admin exists
    const { data: admin } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Fetch all system modules
    const { data: systemModules } = await supabase
      .from('system_modules')
      .select('*')
      .eq('is_active', true)
      .order('module_order', { ascending: true })

    // Fetch admin's current permissions
    const { data: adminPermissions } = await supabase
      .from('admin_module_permissions')
      .select('*')
      .eq('admin_id', id)

    // Create a map of admin permissions
    const permissionsMap = new Map()
    adminPermissions?.forEach(p => {
      permissionsMap.set(p.module_key, p)
    })

    // Merge system modules with admin permissions
    const modulePermissions = systemModules?.map(module => {
      const adminPerm = permissionsMap.get(module.module_key)
      return {
        module_key: module.module_key,
        module_name: module.module_name,
        module_description: module.module_description,
        module_icon: module.module_icon,
        module_path: module.module_path,
        module_category: module.module_category,
        is_enabled: adminPerm?.is_enabled || false,
        permission_id: adminPerm?.id || null,
        granted_at: adminPerm?.granted_at || null,
        modified_at: adminPerm?.modified_at || null
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        admin,
        permissions: modulePermissions || [],
        total_modules: systemModules?.length || 0,
        enabled_modules: modulePermissions?.filter(p => p.is_enabled).length || 0
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error fetching permissions', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin-management/[id]/permissions
 * Update module permissions for an admin
 *
 * Security: UUID validation, module_key validation, input sanitization
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate and sanitize input
    const validationResult = updatePermissionSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      )
    }

    const { module_key, is_enabled, updated_by_user_id } = validationResult.data

    // Check if admin exists
    const { data: admin } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Check if module exists
    const { data: module } = await supabase
      .from('system_modules')
      .select('*')
      .eq('module_key', module_key)
      .maybeSingle()

    if (!module) {
      return NextResponse.json(
        {
          success: false,
          error: 'Module not found'
        },
        { status: 404 }
      )
    }

    // Check if permission record exists
    const { data: existingPermission } = await supabase
      .from('admin_module_permissions')
      .select('*')
      .eq('admin_id', id)
      .eq('module_key', module_key)
      .maybeSingle()

    let updatedPermission

    if (existingPermission) {
      // Update existing permission
      const { data, error: updateError } = await supabase
        .from('admin_module_permissions')
        .update({
          is_enabled,
          modified_at: new Date().toISOString(),
          modified_by: updated_by_user_id
        })
        .eq('id', existingPermission.id)
        .select()
        .maybeSingle()

      if (updateError) throw updateError
      updatedPermission = data
    } else {
      // Create new permission record
      const { data, error: insertError } = await supabase
        .from('admin_module_permissions')
        .insert({
          admin_id: id,
          module_key,
          module_name: module.module_name,
          is_enabled,
          granted_by: updated_by_user_id,
          modified_by: updated_by_user_id
        })
        .select()
        .maybeSingle()

      if (insertError) throw insertError
      updatedPermission = data
    }

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: is_enabled ? 'module_access_granted' : 'module_access_revoked',
      p_action_description: `Module "${module.module_name}" was ${is_enabled ? 'enabled' : 'disabled'} for admin ${admin.admin_unique_id} (${admin.full_name})`,
      p_changes: JSON.stringify({
        module_key,
        module_name: module.module_name,
        before: { is_enabled: existingPermission?.is_enabled || false },
        after: { is_enabled }
      }),
      p_performed_by: updated_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: updatedPermission,
      message: `Module ${is_enabled ? 'enabled' : 'disabled'} successfully`
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error updating permissions', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin-management/[id]/permissions/bulk
 * Bulk update multiple module permissions for an admin
 *
 * Security: UUID validation, bulk input validation (max 100 items)
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2

    // Validate and sanitize bulk input
    const validationResult = bulkUpdatePermissionsSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      )
    }

    const { permissions, updated_by_user_id } = validationResult.data

    // Check if admin exists
    const { data: admin } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Fetch all system modules
    const { data: systemModules } = await supabase
      .from('system_modules')
      .select('*')

    const modulesMap = new Map()
    systemModules?.forEach(m => modulesMap.set(m.module_key, m))

    // Fetch existing permissions
    const { data: existingPermissions } = await supabase
      .from('admin_module_permissions')
      .select('*')
      .eq('admin_id', id)

    const existingPermsMap = new Map()
    existingPermissions?.forEach(p => existingPermsMap.set(p.module_key, p))

    const updates = []
    const inserts = []

    // Process each permission
    for (const perm of permissions) {
      const { module_key, is_enabled } = perm

      if (!module_key || is_enabled === undefined) continue

      const module = modulesMap.get(module_key)
      if (!module) continue

      const existing = existingPermsMap.get(module_key)

      if (existing) {
        // Update existing
        updates.push({
          id: existing.id,
          is_enabled,
          modified_at: new Date().toISOString(),
          modified_by: updated_by_user_id
        })
      } else {
        // Insert new
        inserts.push({
          admin_id: id,
          module_key,
          module_name: module.module_name,
          is_enabled,
          granted_by: updated_by_user_id,
          modified_by: updated_by_user_id
        })
      }
    }

    // Use distributed lock to prevent concurrent bulk updates for the same admin
    const result = await withLock(
      supabase,
      `bulk_permissions_${id}`,
      async () => {
        // Execute updates with batch processing
        const updateOperations = updates.map((update) => async () => {
          const { error } = await supabase
            .from('admin_module_permissions')
            .update(update)
            .eq('id', update.id)

          if (error) {
            throw parseSupabaseError(error)
          }

          return { success: true, id: update.id }
        })

        const { results: updateResults, errors: updateErrors } = await executeBatch(
          updateOperations,
          { stopOnError: false }
        )

        // Execute inserts
        let insertResult = null
        if (inserts.length > 0) {
          const { data, error: insertError } = await supabase
            .from('admin_module_permissions')
            .insert(inserts)
            .select()

          if (insertError) {
            throw parseSupabaseError(insertError)
          }

          insertResult = data
        }

        return {
          updateResults,
          updateErrors,
          insertResult,
          updatedCount: updateResults.length,
          insertedCount: inserts.length,
        }
      },
      10000 // 10 second timeout for lock acquisition
    )

    // Create audit log (non-critical - don't fail if it errors)
    const { error: auditError } = await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'permission_changed',
      p_action_description: `Bulk permissions update for admin ${admin.admin_unique_id} (${admin.full_name})`,
      p_changes: JSON.stringify({
        updates: result.updatedCount,
        inserts: result.insertedCount,
        errors: result.updateErrors.length,
        permissions,
      }),
      p_performed_by: updated_by_user_id,
      p_ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown',
    })

    if (auditError) {
      apiLogger.error('[Admin Management API] Error creating audit log', auditError)
      // Continue anyway - audit log is non-critical
    }

    return NextResponse.json({
      success: true,
      message: 'Permissions updated successfully',
      data: {
        updated: result.updatedCount,
        inserted: result.insertedCount,
        errors: result.updateErrors.length,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error bulk updating permissions', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}
