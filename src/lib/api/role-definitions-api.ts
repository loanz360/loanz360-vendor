/**
 * Role Definitions API Layer
 * This provides a unified API for managing sub-roles via secure server-side API routes
 */

import type { RoleDefinition } from '@/lib/constants/role-definitions'
import { clientLogger } from '@/lib/utils/client-logger'

/**
 * Get CSRF token from server
 */
async function getCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token')
    const { token } = await response.json()
    return token
  } catch (error) {
    clientLogger.error('Failed to get CSRF token', { error })
    throw new Error('CSRF token unavailable')
  }
}

/**
 * Database row type from role_definitions table
 */
interface RoleDefinitionRow {
  id: string
  role_key: string
  role_name: string
  role_type: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER'
  description: string | null
  is_active: boolean
  display_order: number
  permissions: Record<string, boolean> | null
  created_at: string
  updated_at: string
}

/**
 * Convert database row to RoleDefinition
 */
function mapRowToRoleDefinition(row: RoleDefinitionRow): RoleDefinition {
  return {
    key: row.role_key,
    name: row.role_name,
    type: row.role_type,
    description: row.description || '',
    isActive: row.is_active,
    displayOrder: row.display_order,
    permissions: row.permissions || undefined
  }
}

/**
 * Get all role definitions via API
 */
export async function fetchAllRoleDefinitions(): Promise<RoleDefinition[]> {
  try {
    const response = await fetch('/api/role-definitions')

    if (!response.ok) {
      clientLogger.error('Error fetching role definitions', { status: response.status })
      return []
    }

    const { data } = await response.json()
    return data.map(mapRowToRoleDefinition)
  } catch (error) {
    clientLogger.error('Error fetching role definitions', { error })
    return []
  }
}

/**
 * Get role definitions by type via API
 */
export async function fetchRoleDefinitionsByType(type: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER'): Promise<RoleDefinition[]> {
  try {
    const response = await fetch(`/api/role-definitions?type=${type}`)

    if (!response.ok) {
      clientLogger.error('Error fetching role definitions by type', { type, status: response.status })
      return []
    }

    const { data } = await response.json()
    return data.map(mapRowToRoleDefinition)
  } catch (error) {
    clientLogger.error('Error fetching role definitions by type', { type, error })
    return []
  }
}

/**
 * Get role definition by key via API
 * Note: This gracefully returns undefined if the role doesn't exist in the database,
 * allowing the caller to fall back to hardcoded configuration.
 */
export async function fetchRoleDefinitionByKey(key: string): Promise<RoleDefinition | undefined> {
  try {
    clientLogger.debug('Fetching role by key', { key })
    const response = await fetch(`/api/role-definitions?key=${key}`)

    if (!response.ok) {
      // Don't log as error - role might not exist in database which is OK
      // The caller will fall back to hardcoded config
      clientLogger.debug('Role not found in database, will use fallback', { key, status: response.status })
      return undefined
    }

    const { data } = await response.json()

    if (!data) {
      // Role not in database - this is OK, caller will use hardcoded config
      clientLogger.debug('Role key not found in database', { key })
      return undefined
    }

    clientLogger.debug('Role found in database', { key })
    return mapRowToRoleDefinition(data)
  } catch (error) {
    // Network error or parsing error - still return undefined to allow fallback
    clientLogger.debug('Error fetching role, will use fallback', { key })
    return undefined
  }
}

/**
 * Create new sub-role via API (Super Admin only)
 */
export async function createSubRole(roleData: Omit<RoleDefinition, 'displayOrder'>): Promise<{ success: boolean; data?: RoleDefinition; error?: string }> {
  try {
    // Validate role data
    if (!roleData.key || !roleData.name || !roleData.type) {
      return { success: false, error: 'Missing required fields' }
    }

    // Get CSRF token
    const csrfToken = await getCSRFToken()

    const response = await fetch('/api/role-definitions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({
        role_key: roleData.key,
        role_name: roleData.name,
        role_type: roleData.type,
        description: roleData.description,
        is_active: roleData.isActive ?? true
      })
    })

    if (!response.ok) {
      const { error } = await response.json()
      clientLogger.error('Error creating sub-role', { status: response.status, error })
      return { success: false, error: error || 'Failed to create sub-role' }
    }

    const { data } = await response.json()
    return { success: true, data: mapRowToRoleDefinition(data) }
  } catch (error) {
    clientLogger.error('Error creating sub-role', { error })
    return { success: false, error: 'Failed to create sub-role' }
  }
}

/**
 * Update existing sub-role via API (Super Admin only)
 */
export async function updateSubRole(key: string, updates: Partial<RoleDefinition>): Promise<{ success: boolean; data?: RoleDefinition; error?: string }> {
  try {
    // Build update object
    const updateData: any = {}
    if (updates.name !== undefined) updateData.role_name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder

    // Get CSRF token
    const csrfToken = await getCSRFToken()

    const response = await fetch(`/api/role-definitions/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify(updateData)
    })

    if (!response.ok) {
      const { error } = await response.json()
      clientLogger.error('Error updating sub-role', { status: response.status, error })
      return { success: false, error: error || 'Failed to update sub-role' }
    }

    const { data } = await response.json()
    return { success: true, data: mapRowToRoleDefinition(data) }
  } catch (error) {
    clientLogger.error('Error updating sub-role', { error })
    return { success: false, error: 'Failed to update sub-role' }
  }
}

/**
 * Deactivate sub-role (Super Admin only)
 * We don't delete to maintain data integrity
 */
export async function deactivateSubRole(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await updateSubRole(key, { isActive: false })
    return { success: result.success, error: result.error }
  } catch (error) {
    clientLogger.error('Error deactivating sub-role', { error })
    return { success: false, error: 'Failed to deactivate sub-role' }
  }
}

/**
 * Activate sub-role (Super Admin only)
 */
export async function activateSubRole(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await updateSubRole(key, { isActive: true })
    return { success: result.success, error: result.error }
  } catch (error) {
    clientLogger.error('Error activating sub-role', { error })
    return { success: false, error: 'Failed to activate sub-role' }
  }
}

/**
 * Delete sub-role via API (Super Admin only)
 * Permanently removes role from database
 */
export async function deleteSubRole(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get CSRF token
    const csrfToken = await getCSRFToken()

    const response = await fetch(`/api/role-definitions/${key}`, {
      method: 'DELETE',
      headers: {
        'x-csrf-token': csrfToken
      }
    })

    if (!response.ok) {
      const { error } = await response.json()
      clientLogger.error('Error deleting sub-role', { status: response.status, error })
      return { success: false, error: error || 'Failed to delete sub-role' }
    }

    return { success: true }
  } catch (error) {
    clientLogger.error('Error deleting sub-role', { error })
    return { success: false, error: 'Failed to delete sub-role' }
  }
}

/**
 * Reorder sub-roles (Super Admin only)
 * Note: This function performs multiple updates and should be moved to a dedicated API endpoint
 */
export async function reorderSubRoles(type: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER', orderedKeys: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    // Perform updates sequentially via API
    for (let i = 0; i < orderedKeys.length; i++) {
      const result = await updateSubRole(orderedKeys[i], { displayOrder: i })
      if (!result.success) {
        return { success: false, error: `Failed to reorder role ${orderedKeys[i]}` }
      }
    }

    return { success: true }
  } catch (error) {
    clientLogger.error('Error reordering sub-roles', { error })
    return { success: false, error: 'Failed to reorder sub-roles' }
  }
}

/**
 * Get active sub-roles only via API (for registration forms)
 */
export async function fetchActiveSubRolesByType(type: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER'): Promise<RoleDefinition[]> {
  try {
    const response = await fetch(`/api/role-definitions?type=${type}&active=true`)

    if (!response.ok) {
      clientLogger.error('Error fetching active role definitions', { type, status: response.status })
      return []
    }

    const { data } = await response.json()
    return data.map(mapRowToRoleDefinition)
  } catch (error) {
    clientLogger.error('Error fetching active role definitions', { type, error })
    return []
  }
}
