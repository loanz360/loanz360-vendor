/**
 * Role-Based Access Control (RBAC) System
 * Implements comprehensive permission management for the application
 */

import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'

// Define all available roles in the system
export enum Role {
  SUPER_ADMIN = 'super_admin',
  HR_MANAGER = 'hr_manager',
  CONTEST_MANAGER = 'contest_manager',
  PARTNER_BUSINESS_ASSOCIATE = 'business_associate',
  PARTNER_BUSINESS_PARTNER = 'business_partner',
  PARTNER_CHANNEL_PARTNER = 'channel_partner',
}

// Define all available permissions
export enum Permission {
  // Contest Management
  CONTEST_CREATE = 'contest:create',
  CONTEST_READ = 'contest:read',
  CONTEST_UPDATE = 'contest:update',
  CONTEST_DELETE = 'contest:delete',
  CONTEST_PUBLISH = 'contest:publish',

  // Contest - Active Management
  CONTEST_EDIT_ACTIVE = 'contest:edit_active',
  CONTEST_DELETE_ACTIVE = 'contest:delete_active',

  // Participant Management
  PARTICIPANT_ADD = 'participant:add',
  PARTICIPANT_REMOVE = 'participant:remove',
  PARTICIPANT_VIEW = 'participant:view',

  // Leaderboard
  LEADERBOARD_VIEW_ALL = 'leaderboard:view_all',
  LEADERBOARD_VIEW_OWN = 'leaderboard:view_own',
  LEADERBOARD_REFRESH = 'leaderboard:refresh',

  // Analytics
  ANALYTICS_VIEW_ALL = 'analytics:view_all',
  ANALYTICS_VIEW_OWN = 'analytics:view_own',
  ANALYTICS_EXPORT = 'analytics:export',
  ANALYTICS_REFRESH = 'analytics:refresh',

  // Audit
  AUDIT_VIEW = 'audit:view',
  AUDIT_EXPORT = 'audit:export',

  // Partner Performance
  PERFORMANCE_VIEW_ALL = 'performance:view_all',
  PERFORMANCE_VIEW_OWN = 'performance:view_own',
}

// Role-Permission Matrix
const rolePermissions: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    // Super admin has all permissions
    Permission.CONTEST_CREATE,
    Permission.CONTEST_READ,
    Permission.CONTEST_UPDATE,
    Permission.CONTEST_DELETE,
    Permission.CONTEST_PUBLISH,
    Permission.CONTEST_EDIT_ACTIVE,
    Permission.CONTEST_DELETE_ACTIVE,
    Permission.PARTICIPANT_ADD,
    Permission.PARTICIPANT_REMOVE,
    Permission.PARTICIPANT_VIEW,
    Permission.LEADERBOARD_VIEW_ALL,
    Permission.LEADERBOARD_VIEW_OWN,
    Permission.LEADERBOARD_REFRESH,
    Permission.ANALYTICS_VIEW_ALL,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.ANALYTICS_EXPORT,
    Permission.ANALYTICS_REFRESH,
    Permission.AUDIT_VIEW,
    Permission.AUDIT_EXPORT,
    Permission.PERFORMANCE_VIEW_ALL,
    Permission.PERFORMANCE_VIEW_OWN,
  ],

  [Role.HR_MANAGER]: [
    Permission.CONTEST_CREATE,
    Permission.CONTEST_READ,
    Permission.CONTEST_UPDATE,
    Permission.CONTEST_PUBLISH,
    Permission.PARTICIPANT_ADD,
    Permission.PARTICIPANT_REMOVE,
    Permission.PARTICIPANT_VIEW,
    Permission.LEADERBOARD_VIEW_ALL,
    Permission.LEADERBOARD_REFRESH,
    Permission.ANALYTICS_VIEW_ALL,
    Permission.ANALYTICS_EXPORT,
    Permission.ANALYTICS_REFRESH,
    Permission.PERFORMANCE_VIEW_ALL,
  ],

  [Role.CONTEST_MANAGER]: [
    Permission.CONTEST_CREATE,
    Permission.CONTEST_READ,
    Permission.CONTEST_UPDATE,
    Permission.PARTICIPANT_ADD,
    Permission.PARTICIPANT_VIEW,
    Permission.LEADERBOARD_VIEW_ALL,
    Permission.ANALYTICS_VIEW_ALL,
    Permission.ANALYTICS_EXPORT,
    Permission.PERFORMANCE_VIEW_ALL,
  ],

  [Role.PARTNER_BUSINESS_ASSOCIATE]: [
    Permission.CONTEST_READ,
    Permission.LEADERBOARD_VIEW_ALL,
    Permission.LEADERBOARD_VIEW_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.PERFORMANCE_VIEW_OWN,
  ],

  [Role.PARTNER_BUSINESS_PARTNER]: [
    Permission.CONTEST_READ,
    Permission.LEADERBOARD_VIEW_ALL,
    Permission.LEADERBOARD_VIEW_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.PERFORMANCE_VIEW_OWN,
  ],

  [Role.PARTNER_CHANNEL_PARTNER]: [
    Permission.CONTEST_READ,
    Permission.LEADERBOARD_VIEW_ALL,
    Permission.LEADERBOARD_VIEW_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.PERFORMANCE_VIEW_OWN,
  ],
}

/**
 * Get user role from database
 */
export async function getUserRole(userId: string): Promise<Role | null> {
  try {
    const supabase = await createClient()

    // First check if user is super admin
    const { data: adminData } = await supabase
      .from('employees')
      .select('user_role')
      .eq('user_id', userId)
      .eq('user_role', 'super_admin')
      .maybeSingle()

    if (adminData) {
      return Role.SUPER_ADMIN
    }

    // Check if HR manager
    const { data: hrData } = await supabase
      .from('employees')
      .select('user_role')
      .eq('user_id', userId)
      .eq('user_role', 'hr_manager')
      .maybeSingle()

    if (hrData) {
      return Role.HR_MANAGER
    }

    // Check if contest manager
    const { data: contestData } = await supabase
      .from('employees')
      .select('user_role')
      .eq('user_id', userId)
      .eq('user_role', 'contest_manager')
      .maybeSingle()

    if (contestData) {
      return Role.CONTEST_MANAGER
    }

    // Check partner type
    const { data: partnerData } = await supabase
      .from('partners')
      .select('sub_role')
      .eq('user_id', userId)
      .maybeSingle()

    if (partnerData?.sub_role) {
      switch (partnerData.sub_role) {
        case 'business_associate':
          return Role.PARTNER_BUSINESS_ASSOCIATE
        case 'business_partner':
          return Role.PARTNER_BUSINESS_PARTNER
        case 'channel_partner':
          return Role.PARTNER_CHANNEL_PARTNER
      }
    }

    return null
  } catch (error) {
    logger.error('Error getting user role', error instanceof Error ? error : undefined)
    return null
  }
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role]
  return permissions ? permissions.includes(permission) : false
}

/**
 * Check if user has a specific permission
 */
export async function userHasPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserRole(userId)
  if (!role) return false
  return roleHasPermission(role, permission)
}

/**
 * Check if user has any of the specified permissions
 */
export async function userHasAnyPermission(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId)
  if (!role) return false

  return permissions.some(permission => roleHasPermission(role, permission))
}

/**
 * Check if user has all of the specified permissions
 */
export async function userHasAllPermissions(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId)
  if (!role) return false

  return permissions.every(permission => roleHasPermission(role, permission))
}

/**
 * Middleware to check permissions
 */
export async function requirePermission(
  userId: string,
  permission: Permission
): Promise<{ authorized: boolean; role: Role | null; error?: string }> {
  const role = await getUserRole(userId)

  if (!role) {
    return {
      authorized: false,
      role: null,
      error: 'User role not found',
    }
  }

  const hasPermission = roleHasPermission(role, permission)

  if (!hasPermission) {
    return {
      authorized: false,
      role,
      error: `Insufficient permissions. Required: ${permission}`,
    }
  }

  return {
    authorized: true,
    role,
  }
}

/**
 * Middleware to check if user is admin (super_admin, hr_manager, or contest_manager)
 */
export async function requireAdmin(userId: string): Promise<{
  authorized: boolean
  role: Role | null
  error?: string
}> {
  const role = await getUserRole(userId)

  if (!role) {
    return {
      authorized: false,
      role: null,
      error: 'User role not found',
    }
  }

  const isAdmin = [
    Role.SUPER_ADMIN,
    Role.HR_MANAGER,
    Role.CONTEST_MANAGER,
  ].includes(role)

  if (!isAdmin) {
    return {
      authorized: false,
      role,
      error: 'Admin access required',
    }
  }

  return {
    authorized: true,
    role,
  }
}

/**
 * Check if user is super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === Role.SUPER_ADMIN
}

/**
 * Check if user is partner
 */
export async function isPartner(userId: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role ? [
    Role.PARTNER_BUSINESS_ASSOCIATE,
    Role.PARTNER_BUSINESS_PARTNER,
    Role.PARTNER_CHANNEL_PARTNER,
  ].includes(role) : false
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return rolePermissions[role] || []
}

/**
 * Get all user permissions
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const role = await getUserRole(userId)
  if (!role) return []
  return getRolePermissions(role)
}
