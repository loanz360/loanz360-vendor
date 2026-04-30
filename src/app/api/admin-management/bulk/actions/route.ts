import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/bulk/actions
 * Perform bulk actions on multiple admins
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const {
      action, // 'update_status', 'disable_2fa', 'delete', 'assign_modules'
      admin_ids,
      params,
      performed_by_user_id
    } = body

    // Validate required fields
    if (!action || !admin_ids || !Array.isArray(admin_ids) || admin_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'action and admin_ids (array) are required' },
        { status: 400 }
      )
    }

    const result = {
      success: true,
      total: admin_ids.length,
      processed: 0,
      failed: 0,
      errors: [] as Array<{ admin_id: string; error: string }>
    }

    switch (action) {
      case 'update_status': {
        const { new_status, reason } = params || {}

        if (!new_status || !['active', 'inactive', 'suspended'].includes(new_status)) {
          return NextResponse.json(
            { success: false, error: 'Valid new_status (active/inactive/suspended) is required' },
            { status: 400 }
          )
        }

        for (const adminId of admin_ids) {
          try {
            const { data: admin } = await supabase
              .from('admins')
              .select('id, admin_unique_id, status')
              .eq('id', adminId)
              .eq('is_deleted', false)
              .maybeSingle()

            if (!admin) {
              result.failed++
              result.errors.push({ admin_id: adminId, error: 'Admin not found' })
              continue
            }

            await supabase
              .from('admins')
              .update({
                status: new_status,
                updated_at: new Date().toISOString()
              })
              .eq('id', adminId)

            // Create audit log
            await supabase.rpc('create_admin_audit_log', {
              p_admin_id: adminId,
              p_action_type: 'status_changed',
              p_action_description: `Status changed from ${admin.status} to ${new_status} (bulk operation)${reason ? ` - Reason: ${reason}` : ''}`,
              p_changes: JSON.stringify({
                before: { status: admin.status },
                after: { status: new_status },
                reason: reason || 'Bulk update'
              }),
              p_performed_by: performed_by_user_id,
              p_ip_address: request.headers.get('x-forwarded-for') || 'bulk_operation',
              p_user_agent: request.headers.get('user-agent') || 'bulk_operation'
            })

            result.processed++
          } catch (error: unknown) {
            result.failed++
            result.errors.push({ admin_id: adminId, error: 'Operation failed' })
          }
        }
        break
      }

      case 'disable_2fa': {
        const { reason } = params || {}

        for (const adminId of admin_ids) {
          try {
            const { data: admin } = await supabase
              .from('admins')
              .select('id, admin_unique_id, two_factor_enabled')
              .eq('id', adminId)
              .eq('is_deleted', false)
              .maybeSingle()

            if (!admin) {
              result.failed++
              result.errors.push({ admin_id: adminId, error: 'Admin not found' })
              continue
            }

            if (!admin.two_factor_enabled) {
              result.processed++
              continue
            }

            await supabase
              .from('admins')
              .update({
                two_factor_enabled: false,
                two_factor_secret: null,
                two_factor_backup_codes: null,
                two_factor_enabled_at: null,
                two_factor_last_used_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', adminId)

            // Revoke trusted devices
            await supabase
              .from('admin_trusted_devices')
              .update({ is_active: false })
              .eq('admin_id', adminId)

            // Create audit log
            await supabase.rpc('create_admin_audit_log', {
              p_admin_id: adminId,
              p_action_type: 'security_2fa_disabled',
              p_action_description: `2FA disabled (bulk operation)${reason ? ` - Reason: ${reason}` : ''}`,
              p_changes: JSON.stringify({
                two_factor_enabled: false,
                reason: reason || 'Bulk operation'
              }),
              p_performed_by: performed_by_user_id,
              p_ip_address: request.headers.get('x-forwarded-for') || 'bulk_operation',
              p_user_agent: request.headers.get('user-agent') || 'bulk_operation'
            })

            result.processed++
          } catch (error: unknown) {
            result.failed++
            result.errors.push({ admin_id: adminId, error: 'Operation failed' })
          }
        }
        break
      }

      case 'delete': {
        const { reason } = params || {}

        for (const adminId of admin_ids) {
          try {
            const { data: admin } = await supabase
              .from('admins')
              .select('id, admin_unique_id, full_name')
              .eq('id', adminId)
              .eq('is_deleted', false)
              .maybeSingle()

            if (!admin) {
              result.failed++
              result.errors.push({ admin_id: adminId, error: 'Admin not found' })
              continue
            }

            await supabase
              .from('admins')
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: performed_by_user_id,
                status: 'inactive',
                updated_at: new Date().toISOString()
              })
              .eq('id', adminId)

            // Terminate all sessions
            await supabase
              .from('admin_sessions')
              .update({ is_active: false })
              .eq('admin_id', adminId)

            // Create audit log
            await supabase.rpc('create_admin_audit_log', {
              p_admin_id: adminId,
              p_action_type: 'admin_deleted',
              p_action_description: `Admin ${admin.admin_unique_id} (${admin.full_name}) was deleted (bulk operation)${reason ? ` - Reason: ${reason}` : ''}`,
              p_changes: JSON.stringify({
                is_deleted: true,
                reason: reason || 'Bulk deletion'
              }),
              p_performed_by: performed_by_user_id,
              p_ip_address: request.headers.get('x-forwarded-for') || 'bulk_operation',
              p_user_agent: request.headers.get('user-agent') || 'bulk_operation'
            })

            result.processed++
          } catch (error: unknown) {
            result.failed++
            result.errors.push({ admin_id: adminId, error: 'Operation failed' })
          }
        }
        break
      }

      case 'assign_modules': {
        const { module_keys, is_enabled = true } = params || {}

        if (!module_keys || !Array.isArray(module_keys) || module_keys.length === 0) {
          return NextResponse.json(
            { success: false, error: 'module_keys (array) is required' },
            { status: 400 }
          )
        }

        const totalOperations = admin_ids.length * module_keys.length
        result.total = totalOperations

        for (const adminId of admin_ids) {
          for (const moduleKey of module_keys) {
            try {
              // Get module details
              const { data: module } = await supabase
                .from('system_modules')
                .select('module_name')
                .eq('module_key', moduleKey)
                .maybeSingle()

              if (!module) {
                result.failed++
                result.errors.push({
                  admin_id: `${adminId}-${moduleKey}`,
                  error: `Module ${moduleKey} not found`
                })
                continue
              }

              // Check existing permission
              const { data: existing } = await supabase
                .from('admin_module_permissions')
                .select('id')
                .eq('admin_id', adminId)
                .eq('module_key', moduleKey)
                .maybeSingle()

              if (existing) {
                // Update existing
                await supabase
                  .from('admin_module_permissions')
                  .update({
                    is_enabled: is_enabled,
                    modified_at: new Date().toISOString(),
                    modified_by: performed_by_user_id
                  })
                  .eq('id', existing.id)
              } else {
                // Insert new
                await supabase
                  .from('admin_module_permissions')
                  .insert({
                    admin_id: adminId,
                    module_key: moduleKey,
                    module_name: module.module_name,
                    is_enabled: is_enabled,
                    granted_by: performed_by_user_id,
                    modified_by: performed_by_user_id
                  })
              }

              result.processed++
            } catch (error: unknown) {
              result.failed++
              result.errors.push({
                admin_id: `${adminId}-${moduleKey}`,
                error: 'Internal server error'
              })
            }
          }
        }

        // Create audit log for bulk module assignment
        await supabase.rpc('create_admin_audit_log', {
          p_admin_id: performed_by_user_id,
          p_action_type: 'bulk_module_assignment',
          p_action_description: `Bulk ${is_enabled ? 'enabled' : 'disabled'} ${module_keys.length} module(s) for ${admin_ids.length} admin(s)`,
          p_changes: JSON.stringify({
            admin_count: admin_ids.length,
            module_keys,
            is_enabled
          }),
          p_performed_by: performed_by_user_id,
          p_ip_address: request.headers.get('x-forwarded-for') || 'bulk_operation',
          p_user_agent: request.headers.get('user-agent') || 'bulk_operation'
        })
        break
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    result.success = result.failed === 0

    return NextResponse.json({
      success: result.success,
      message: `Bulk ${action} completed. Processed: ${result.processed}, Failed: ${result.failed}`,
      data: result
    })
  } catch (error: unknown) {
    apiLogger.error('[Bulk Actions API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
