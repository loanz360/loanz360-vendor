/**
 * Role Management Library
 *
 * Features:
 * - Custom role creation and management
 * - Permission templates
 * - Role hierarchy
 * - Role assignment
 * - Permission inheritance
 * - Role analytics
 */

import { z } from 'zod'

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * Default system roles
 */
export const SYSTEM_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'viewer',
] as const

export type SystemRole = (typeof SYSTEM_ROLES)[number]

/**
 * Permission categories
 */
export const PERMISSION_CATEGORIES = {
  ADMINS: 'admins',
  LEADS: 'leads',
  EMPLOYEES: 'employees',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  AUDIT: 'audit',
} as const

/**
 * Permission actions
 */
export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  EXPORT: 'export',
  IMPORT: 'import',
} as const

/**
 * Permission schema
 */
export const permissionSchema = z.object({
  category: z.string(),
  action: z.string(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
})

export type Permission = z.infer<typeof permissionSchema>

/**
 * Custom role schema
 */
export const customRoleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Role name is required').max(100),
  display_name: z.string().min(1, 'Display name is required').max(255),
  description: z.string().optional(),
  permissions: z.array(permissionSchema),
  inherits_from: z.string().optional(),
  is_system: z.boolean().default(false),
  is_active: z.boolean().default(true),
  user_count: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type CustomRole = z.infer<typeof customRoleSchema>

/**
 * Role assignment schema
 */
export const roleAssignmentSchema = z.object({
  admin_id: z.string().uuid(),
  role_id: z.string().uuid(),
  assigned_by: z.string().uuid().optional(),
  assigned_at: z.string().optional(),
  expires_at: z.string().optional(),
})

export type RoleAssignment = z.infer<typeof roleAssignmentSchema>

// ============================================================================
// PERMISSION TEMPLATES
// ============================================================================

/**
 * Default permission sets for system roles
 */
export const PERMISSION_TEMPLATES: Record<SystemRole, Permission[]> = {
  super_admin: [
    // Full access to everything
    { category: 'admins', action: 'create', enabled: true },
    { category: 'admins', action: 'read', enabled: true },
    { category: 'admins', action: 'update', enabled: true },
    { category: 'admins', action: 'delete', enabled: true },
    { category: 'admins', action: 'export', enabled: true },
    { category: 'admins', action: 'import', enabled: true },
    { category: 'leads', action: 'create', enabled: true },
    { category: 'leads', action: 'read', enabled: true },
    { category: 'leads', action: 'update', enabled: true },
    { category: 'leads', action: 'delete', enabled: true },
    { category: 'leads', action: 'export', enabled: true },
    { category: 'leads', action: 'import', enabled: true },
    { category: 'employees', action: 'create', enabled: true },
    { category: 'employees', action: 'read', enabled: true },
    { category: 'employees', action: 'update', enabled: true },
    { category: 'employees', action: 'delete', enabled: true },
    { category: 'employees', action: 'export', enabled: true },
    { category: 'employees', action: 'import', enabled: true },
    { category: 'reports', action: 'create', enabled: true },
    { category: 'reports', action: 'read', enabled: true },
    { category: 'reports', action: 'export', enabled: true },
    { category: 'settings', action: 'read', enabled: true },
    { category: 'settings', action: 'update', enabled: true },
    { category: 'audit', action: 'read', enabled: true },
    { category: 'audit', action: 'export', enabled: true },
  ],
  admin: [
    // Admin management (limited)
    { category: 'admins', action: 'read', enabled: true },
    { category: 'admins', action: 'update', enabled: true },
    // Full lead access
    { category: 'leads', action: 'create', enabled: true },
    { category: 'leads', action: 'read', enabled: true },
    { category: 'leads', action: 'update', enabled: true },
    { category: 'leads', action: 'delete', enabled: true },
    { category: 'leads', action: 'export', enabled: true },
    { category: 'leads', action: 'import', enabled: true },
    // Full employee access
    { category: 'employees', action: 'create', enabled: true },
    { category: 'employees', action: 'read', enabled: true },
    { category: 'employees', action: 'update', enabled: true },
    { category: 'employees', action: 'delete', enabled: true },
    { category: 'employees', action: 'export', enabled: true },
    // Reports
    { category: 'reports', action: 'create', enabled: true },
    { category: 'reports', action: 'read', enabled: true },
    { category: 'reports', action: 'export', enabled: true },
    // Limited settings
    { category: 'settings', action: 'read', enabled: true },
    // Audit logs
    { category: 'audit', action: 'read', enabled: true },
  ],
  manager: [
    // Read-only admin access
    { category: 'admins', action: 'read', enabled: true },
    // Lead management
    { category: 'leads', action: 'create', enabled: true },
    { category: 'leads', action: 'read', enabled: true },
    { category: 'leads', action: 'update', enabled: true },
    { category: 'leads', action: 'export', enabled: true },
    // Employee management (limited)
    { category: 'employees', action: 'read', enabled: true },
    { category: 'employees', action: 'update', enabled: true },
    // Reports
    { category: 'reports', action: 'read', enabled: true },
    { category: 'reports', action: 'export', enabled: true },
    // Settings (read-only)
    { category: 'settings', action: 'read', enabled: true },
  ],
  viewer: [
    // Read-only access
    { category: 'admins', action: 'read', enabled: true },
    { category: 'leads', action: 'read', enabled: true },
    { category: 'employees', action: 'read', enabled: true },
    { category: 'reports', action: 'read', enabled: true },
    { category: 'settings', action: 'read', enabled: true },
  ],
}

/**
 * Get permission template for a role
 */
export function getPermissionTemplate(role: SystemRole): Permission[] {
  return PERMISSION_TEMPLATES[role] || []
}

/**
 * Get all available permissions
 */
export function getAllPermissions(): Permission[] {
  const categories = Object.values(PERMISSION_CATEGORIES)
  const actions = Object.values(PERMISSION_ACTIONS)

  const permissions: Permission[] = []

  categories.forEach((category) => {
    actions.forEach((action) => {
      // Skip invalid combinations
      if (category === 'audit' && ['create', 'update', 'delete', 'import'].includes(action)) {
        return
      }

      permissions.push({
        category,
        action,
        enabled: false,
      })
    })
  })

  return permissions
}

// ============================================================================
// PERMISSION UTILITIES
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  permissions: Permission[],
  category: string,
  action: string
): boolean {
  return permissions.some(
    (p) => p.category === category && p.action === action && p.enabled
  )
}

/**
 * Merge permissions (for role inheritance)
 */
export function mergePermissions(
  basePermissions: Permission[],
  additionalPermissions: Permission[]
): Permission[] {
  const merged = new Map<string, Permission>()

  // Add base permissions
  basePermissions.forEach((p) => {
    const key = `${p.category}:${p.action}`
    merged.set(key, p)
  })

  // Merge additional permissions (override if enabled)
  additionalPermissions.forEach((p) => {
    const key = `${p.category}:${p.action}`
    const existing = merged.get(key)

    if (!existing || p.enabled) {
      merged.set(key, p)
    }
  })

  return Array.from(merged.values())
}

/**
 * Calculate permission coverage (percentage of all permissions enabled)
 */
export function calculatePermissionCoverage(permissions: Permission[]): number {
  const allPermissions = getAllPermissions()
  const enabledCount = permissions.filter((p) => p.enabled).length
  return (enabledCount / allPermissions.length) * 100
}

/**
 * Group permissions by category
 */
export function groupPermissionsByCategory(
  permissions: Permission[]
): Record<string, Permission[]> {
  return permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = []
    }
    acc[permission.category].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)
}

// ============================================================================
// ROLE UTILITIES
// ============================================================================

/**
 * Check if a role name is valid (alphanumeric, underscores, hyphens)
 */
export function isValidRoleName(name: string): boolean {
  return /^[a-z0-9_-]+$/.test(name)
}

/**
 * Check if a role name is reserved (system role)
 */
export function isSystemRole(name: string): boolean {
  return SYSTEM_ROLES.includes(name as SystemRole)
}

/**
 * Generate role display name from name
 */
export function generateDisplayName(name: string): string {
  return name
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Get role hierarchy level (0 = super_admin, higher = less privileges)
 */
export function getRoleLevel(role: string): number {
  const levels: Record<string, number> = {
    super_admin: 0,
    admin: 1,
    manager: 2,
    viewer: 3,
  }

  return levels[role] ?? 999
}

/**
 * Check if role A can manage role B (based on hierarchy)
 */
export function canManageRole(managerRole: string, targetRole: string): boolean {
  return getRoleLevel(managerRole) < getRoleLevel(targetRole)
}

/**
 * Get roles that a given role can manage
 */
export function getManageableRoles(role: string): string[] {
  const roleLevel = getRoleLevel(role)
  return SYSTEM_ROLES.filter((r) => getRoleLevel(r) > roleLevel)
}

// ============================================================================
// ROLE COMPARISON
// ============================================================================

/**
 * Compare two permission sets
 */
export interface PermissionDiff {
  added: Permission[]
  removed: Permission[]
  modified: Permission[]
  unchanged: Permission[]
}

export function comparePermissions(
  oldPermissions: Permission[],
  newPermissions: Permission[]
): PermissionDiff {
  const oldMap = new Map(
    oldPermissions.map((p) => [`${p.category}:${p.action}`, p])
  )
  const newMap = new Map(
    newPermissions.map((p) => [`${p.category}:${p.action}`, p])
  )

  const added: Permission[] = []
  const removed: Permission[] = []
  const modified: Permission[] = []
  const unchanged: Permission[] = []

  // Find added and modified
  newMap.forEach((newPerm, key) => {
    const oldPerm = oldMap.get(key)

    if (!oldPerm) {
      added.push(newPerm)
    } else if (oldPerm.enabled !== newPerm.enabled) {
      modified.push(newPerm)
    } else {
      unchanged.push(newPerm)
    }
  })

  // Find removed
  oldMap.forEach((oldPerm, key) => {
    if (!newMap.has(key)) {
      removed.push(oldPerm)
    }
  })

  return { added, removed, modified, unchanged }
}

// ============================================================================
// ROLE ANALYTICS
// ============================================================================

/**
 * Calculate role usage statistics
 */
export interface RoleStats {
  role: string
  userCount: number
  percentage: number
  permissionCoverage: number
}

export function calculateRoleStats(
  roles: CustomRole[],
  totalUsers: number
): RoleStats[] {
  return roles.map((role) => ({
    role: role.name,
    userCount: role.user_count || 0,
    percentage: totalUsers > 0 ? ((role.user_count || 0) / totalUsers) * 100 : 0,
    permissionCoverage: calculatePermissionCoverage(role.permissions),
  }))
}

/**
 * Find roles with similar permissions
 */
export function findSimilarRoles(
  targetRole: CustomRole,
  allRoles: CustomRole[],
  threshold: number = 0.8
): CustomRole[] {
  return allRoles
    .filter((role) => role.id !== targetRole.id)
    .map((role) => {
      const similarity = calculatePermissionSimilarity(
        targetRole.permissions,
        role.permissions
      )
      return { role, similarity }
    })
    .filter(({ similarity }) => similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ role }) => role)
}

/**
 * Calculate similarity between two permission sets (0-1)
 */
function calculatePermissionSimilarity(
  permissions1: Permission[],
  permissions2: Permission[]
): number {
  const set1 = new Set(
    permissions1.filter((p) => p.enabled).map((p) => `${p.category}:${p.action}`)
  )
  const set2 = new Set(
    permissions2.filter((p) => p.enabled).map((p) => `${p.category}:${p.action}`)
  )

  const intersection = new Set([...set1].filter((x) => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return union.size > 0 ? intersection.size / union.size : 0
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate role data
 */
export function validateRole(role: Partial<CustomRole>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Name validation
  if (!role.name) {
    errors.push('Role name is required')
  } else if (!isValidRoleName(role.name)) {
    errors.push('Role name can only contain lowercase letters, numbers, underscores, and hyphens')
  } else if (isSystemRole(role.name)) {
    errors.push('Cannot use system role names')
  }

  // Display name validation
  if (!role.display_name) {
    errors.push('Display name is required')
  }

  // Permissions validation
  if (!role.permissions || role.permissions.length === 0) {
    errors.push('At least one permission must be enabled')
  } else if (!role.permissions.some((p) => p.enabled)) {
    errors.push('At least one permission must be enabled')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
