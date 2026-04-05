/**
 * Permission Checker Utility
 * Helper functions to check admin permissions on the frontend
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export type PermissionAction =
  | 'read'
  | 'write'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'export'
  | 'import'
  | 'assign'
  | 'manage_users'
  | 'configure'
  | 'audit'
  | 'bulk_actions'

export interface GranularPermission {
  id: string
  admin_id: string
  module_key: string
  can_read: boolean
  can_write: boolean
  can_update: boolean
  can_delete: boolean
  can_approve: boolean
  can_reject: boolean
  can_export: boolean
  can_import: boolean
  can_assign: boolean
  can_manage_users: boolean
  can_configure: boolean
  can_audit: boolean
  can_bulk_actions: boolean
  resource_restriction: 'all' | 'own_only' | 'branch' | 'region' | 'department' | 'custom'
  restricted_to_branches: string[] | null
  restricted_to_regions: string[] | null
  restricted_to_departments: string[] | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  is_temporary: boolean
}

/**
 * Check if admin has a specific permission for a module
 */
export async function checkPermission(
  adminId: string,
  moduleKey: string,
  action: PermissionAction,
  resourceId?: string
): Promise<boolean> {
  const supabase = createClientComponentClient()

  try {
    // Get admin's permission for this module
    const { data: permission, error } = await supabase
      .from('admin_granular_permissions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('module_key', moduleKey)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !permission) {
      return false
    }

    // Check if permission is expired
    if (permission.valid_until) {
      const expiryDate = new Date(permission.valid_until)
      if (expiryDate < new Date()) {
        return false
      }
    }

    // Check if permission is not yet valid
    if (permission.valid_from) {
      const validFrom = new Date(permission.valid_from)
      if (validFrom > new Date()) {
        return false
      }
    }

    // Check the specific action
    let hasActionPermission = false
    switch (action) {
      case 'read':
        hasActionPermission = permission.can_read
        break
      case 'write':
        hasActionPermission = permission.can_write
        break
      case 'update':
        hasActionPermission = permission.can_update
        break
      case 'delete':
        hasActionPermission = permission.can_delete
        break
      case 'approve':
        hasActionPermission = permission.can_approve
        break
      case 'reject':
        hasActionPermission = permission.can_reject
        break
      case 'export':
        hasActionPermission = permission.can_export
        break
      case 'import':
        hasActionPermission = permission.can_import
        break
      case 'assign':
        hasActionPermission = permission.can_assign
        break
      case 'manage_users':
        hasActionPermission = permission.can_manage_users
        break
      case 'configure':
        hasActionPermission = permission.can_configure
        break
      case 'audit':
        hasActionPermission = permission.can_audit
        break
      case 'bulk_actions':
        hasActionPermission = permission.can_bulk_actions
        break
      default:
        return false
    }

    if (!hasActionPermission) {
      return false
    }

    // Check resource-level restrictions if resourceId is provided
    if (resourceId && permission.resource_restriction !== 'all') {
      // This would require additional logic based on your resource structure
      // For now, we'll return true if action is permitted
      // In production, implement resource-level checks here
      return true
    }

    return true
  } catch (error) {
    console.error('[Permission Checker] Error checking permission:', error)
    return false
  }
}

/**
 * Get all permissions for an admin
 */
export async function getAdminPermissions(
  adminId: string
): Promise<GranularPermission[]> {
  const supabase = createClientComponentClient()

  try {
    const { data: permissions, error } = await supabase
      .from('admin_granular_permissions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return permissions || []
  } catch (error) {
    console.error('[Permission Checker] Error fetching permissions:', error)
    return []
  }
}

/**
 * Get all permissions for a specific module
 */
export async function getModulePermissions(
  adminId: string,
  moduleKey: string
): Promise<GranularPermission | null> {
  const supabase = createClientComponentClient()

  try {
    const { data: permission, error } = await supabase
      .from('admin_granular_permissions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('module_key', moduleKey)
      .eq('is_active', true)
      .maybeSingle()

    if (error) return null

    // Check if expired
    if (permission.valid_until) {
      const expiryDate = new Date(permission.valid_until)
      if (expiryDate < new Date()) {
        return null
      }
    }

    return permission
  } catch (error) {
    console.error('[Permission Checker] Error fetching module permissions:', error)
    return null
  }
}

/**
 * Check multiple permissions at once
 */
export async function checkMultiplePermissions(
  adminId: string,
  checks: Array<{ moduleKey: string; action: PermissionAction }>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}

  for (const check of checks) {
    const key = `${check.moduleKey}:${check.action}`
    results[key] = await checkPermission(adminId, check.moduleKey, check.action)
  }

  return results
}

/**
 * Check if admin has any of the specified permissions
 */
export async function hasAnyPermission(
  adminId: string,
  moduleKey: string,
  actions: PermissionAction[]
): Promise<boolean> {
  for (const action of actions) {
    const hasPermission = await checkPermission(adminId, moduleKey, action)
    if (hasPermission) {
      return true
    }
  }
  return false
}

/**
 * Check if admin has all of the specified permissions
 */
export async function hasAllPermissions(
  adminId: string,
  moduleKey: string,
  actions: PermissionAction[]
): Promise<boolean> {
  for (const action of actions) {
    const hasPermission = await checkPermission(adminId, moduleKey, action)
    if (!hasPermission) {
      return false
    }
  }
  return true
}

/**
 * Get permission summary for an admin (count of permissions per action type)
 */
export async function getPermissionSummary(
  adminId: string
): Promise<Record<PermissionAction, number>> {
  const permissions = await getAdminPermissions(adminId)

  const summary: Record<PermissionAction, number> = {
    read: 0,
    write: 0,
    update: 0,
    delete: 0,
    approve: 0,
    reject: 0,
    export: 0,
    import: 0,
    assign: 0,
    manage_users: 0,
    configure: 0,
    audit: 0,
    bulk_actions: 0
  }

  permissions.forEach((perm) => {
    if (perm.can_read) summary.read++
    if (perm.can_write) summary.write++
    if (perm.can_update) summary.update++
    if (perm.can_delete) summary.delete++
    if (perm.can_approve) summary.approve++
    if (perm.can_reject) summary.reject++
    if (perm.can_export) summary.export++
    if (perm.can_import) summary.import++
    if (perm.can_assign) summary.assign++
    if (perm.can_manage_users) summary.manage_users++
    if (perm.can_configure) summary.configure++
    if (perm.can_audit) summary.audit++
    if (perm.can_bulk_actions) summary.bulk_actions++
  })

  return summary
}

/**
 * Format permission actions as human-readable labels
 */
export function formatPermissionAction(action: PermissionAction): string {
  const labels: Record<PermissionAction, string> = {
    read: 'View',
    write: 'Create',
    update: 'Edit',
    delete: 'Delete',
    approve: 'Approve',
    reject: 'Reject',
    export: 'Export',
    import: 'Import',
    assign: 'Assign',
    manage_users: 'Manage Users',
    configure: 'Configure',
    audit: 'Audit',
    bulk_actions: 'Bulk Actions'
  }

  return labels[action] || action
}

/**
 * Get all available permission actions
 */
export function getAllPermissionActions(): PermissionAction[] {
  return [
    'read',
    'write',
    'update',
    'delete',
    'approve',
    'reject',
    'export',
    'import',
    'assign',
    'manage_users',
    'configure',
    'audit',
    'bulk_actions'
  ]
}

/**
 * React hook for permission checking (use in components)
 */
export function usePermission(
  adminId: string | undefined,
  moduleKey: string,
  action: PermissionAction
) {
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!adminId) {
      setHasPermission(false)
      setIsLoading(false)
      return
    }

    checkPermission(adminId, moduleKey, action)
      .then(setHasPermission)
      .finally(() => setIsLoading(false))
  }, [adminId, moduleKey, action])

  return { hasPermission, isLoading }
}

// Import React hooks for the custom hook
import { useState, useEffect } from 'react'
