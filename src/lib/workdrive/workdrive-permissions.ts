/**
 * WorkDrive Permission Service
 * Handles permission checks and access control
 */

import { createClient } from '@supabase/supabase-js'
import {
  PermissionLevel,
  PermissionCheck,
  ResourceType,
  GranteeType,
  PERMISSION_HIERARCHY,
  ROLE_QUOTA_DEFAULTS,
} from '@/types/workdrive'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Role hierarchy for admin checks
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN']
const MANAGER_ROLES = [
  'CRO',
  'BUSINESS_DEVELOPMENT_MANAGER',
  'CHANNEL_PARTNER_MANAGER',
  'ACCOUNTS_MANAGER',
  'HR_MANAGER',
]

/**
 * Check if user is a super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return false
  return data.role === 'SUPER_ADMIN'
}

/**
 * Check if user is an admin (super admin or admin)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return false
  return ADMIN_ROLES.includes(data.role)
}

/**
 * Check if user is a manager
 */
export async function isManager(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return false
  return ADMIN_ROLES.includes(data.role) || MANAGER_ROLES.includes(data.sub_role || '')
}

/**
 * Get user's role
 */
export async function getUserRole(userId: string): Promise<{
  role: string
  subRole?: string
} | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return {
    role: data.role,
    subRole: data.sub_role,
  }
}

/**
 * Get default quota for user based on role
 */
export async function getUserDefaultQuota(userId: string): Promise<number> {
  const userRole = await getUserRole(userId)
  if (!userRole) return ROLE_QUOTA_DEFAULTS.CUSTOMER // Default to minimum

  // Check sub_role first, then role
  const quotaKey = userRole.subRole?.toUpperCase().replace(/ /g, '_') || userRole.role
  return ROLE_QUOTA_DEFAULTS[quotaKey] || ROLE_QUOTA_DEFAULTS.CUSTOMER
}

/**
 * Check user's permission on a resource
 */
export async function checkPermission(params: {
  userId: string
  resourceType: ResourceType
  resourceId: string
  requiredLevel?: PermissionLevel
}): Promise<PermissionCheck> {
  const defaultPermission: PermissionCheck = {
    can_view: false,
    can_download: false,
    can_edit: false,
    can_delete: false,
    can_share: false,
    can_manage_permissions: false,
    permission_level: 'viewer',
    is_owner: false,
  }

  try {
    // Check if user is super admin (full access)
    if (await isSuperAdmin(params.userId)) {
      return {
        can_view: true,
        can_download: true,
        can_edit: true,
        can_delete: true,
        can_share: true,
        can_manage_permissions: true,
        permission_level: 'owner',
        is_owner: false, // Not actual owner, but has full access
      }
    }

    // Check ownership based on resource type
    let isOwner = false
    let createdBy: string | null = null

    if (params.resourceType === 'file') {
      const { data } = await supabase
        .from('workdrive_files')
        .select('created_by, workspace_id')
        .eq('id', params.resourceId)
        .maybeSingle()

      if (data) {
        createdBy = data.created_by
        isOwner = data.created_by === params.userId

        // Also check workspace ownership
        if (!isOwner) {
          const { data: workspace } = await supabase
            .from('workdrive_workspaces')
            .select('owner_id')
            .eq('id', data.workspace_id)
            .maybeSingle()

          if (workspace?.owner_id === params.userId) {
            isOwner = true
          }
        }
      }
    } else if (params.resourceType === 'folder') {
      const { data } = await supabase
        .from('workdrive_folders')
        .select('created_by, workspace_id')
        .eq('id', params.resourceId)
        .maybeSingle()

      if (data) {
        createdBy = data.created_by
        isOwner = data.created_by === params.userId
      }
    } else if (params.resourceType === 'workspace') {
      const { data } = await supabase
        .from('workdrive_workspaces')
        .select('owner_id')
        .eq('id', params.resourceId)
        .maybeSingle()

      if (data) {
        createdBy = data.owner_id
        isOwner = data.owner_id === params.userId
      }
    }

    // Owner has full permissions
    if (isOwner) {
      return {
        can_view: true,
        can_download: true,
        can_edit: true,
        can_delete: true,
        can_share: true,
        can_manage_permissions: true,
        permission_level: 'owner',
        is_owner: true,
      }
    }

    // Check explicit permissions
    const { data: permissions } = await supabase
      .from('workdrive_permissions')
      .select('*')
      .eq('resource_type', params.resourceType)
      .eq('resource_id', params.resourceId)
      .or(`grantee_id.eq.${params.userId},grantee_type.eq.role`)

    if (!permissions || permissions.length === 0) {
      // Check if admin has access to non-admin files
      if (await isAdmin(params.userId)) {
        // Admins can view and manage non-admin files
        const ownerRole = createdBy ? await getUserRole(createdBy) : null
        if (!ownerRole || !ADMIN_ROLES.includes(ownerRole.role)) {
          return {
            can_view: true,
            can_download: true,
            can_edit: true,
            can_delete: true,
            can_share: true,
            can_manage_permissions: true,
            permission_level: 'admin',
            is_owner: false,
          }
        }
      }

      return defaultPermission
    }

    // Find highest permission level
    let highestLevel: PermissionLevel = 'viewer'
    let canDownload = false
    let canShare = false
    let canDelete = false
    let canManagePermissions = false

    for (const perm of permissions) {
      // Check if permission is expired
      if (perm.expires_at && new Date(perm.expires_at) < new Date()) {
        continue
      }

      if (PERMISSION_HIERARCHY[perm.permission_level] > PERMISSION_HIERARCHY[highestLevel]) {
        highestLevel = perm.permission_level
      }

      canDownload = canDownload || perm.can_download
      canShare = canShare || perm.can_share
      canDelete = canDelete || perm.can_delete
      canManagePermissions = canManagePermissions || perm.can_manage_permissions
    }

    // Determine capabilities based on permission level
    const permCheck: PermissionCheck = {
      can_view: PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY['viewer'],
      can_download: canDownload || PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY['viewer'],
      can_edit: PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY['editor'],
      can_delete: canDelete || PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY['admin'],
      can_share: canShare || PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY['editor'],
      can_manage_permissions: canManagePermissions || PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY['admin'],
      permission_level: highestLevel,
      is_owner: false,
    }

    // Check if required level is met
    if (params.requiredLevel) {
      const hasRequired = PERMISSION_HIERARCHY[highestLevel] >= PERMISSION_HIERARCHY[params.requiredLevel]
      if (!hasRequired) {
        return defaultPermission
      }
    }

    return permCheck
  } catch (error) {
    console.error('Permission check error:', error)
    return defaultPermission
  }
}

/**
 * Grant permission to a user/team/role
 */
export async function grantPermission(params: {
  resourceType: ResourceType
  resourceId: string
  granteeType: GranteeType
  granteeId: string
  permissionLevel: PermissionLevel
  grantedBy: string
  canDownload?: boolean
  canShare?: boolean
  canDelete?: boolean
  canManagePermissions?: boolean
  expiresAt?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('workdrive_permissions').upsert(
      {
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        grantee_type: params.granteeType,
        grantee_id: params.granteeId,
        permission_level: params.permissionLevel,
        granted_by: params.grantedBy,
        can_download: params.canDownload ?? true,
        can_share: params.canShare ?? (PERMISSION_HIERARCHY[params.permissionLevel] >= PERMISSION_HIERARCHY['editor']),
        can_delete: params.canDelete ?? (PERMISSION_HIERARCHY[params.permissionLevel] >= PERMISSION_HIERARCHY['admin']),
        can_manage_permissions: params.canManagePermissions ?? (PERMISSION_HIERARCHY[params.permissionLevel] >= PERMISSION_HIERARCHY['admin']),
        expires_at: params.expiresAt,
      },
      {
        onConflict: 'resource_type,resource_id,grantee_type,grantee_id',
      }
    )

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Grant permission error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Revoke permission from a user/team/role
 */
export async function revokePermission(params: {
  resourceType: ResourceType
  resourceId: string
  granteeType: GranteeType
  granteeId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('workdrive_permissions')
      .delete()
      .eq('resource_type', params.resourceType)
      .eq('resource_id', params.resourceId)
      .eq('grantee_type', params.granteeType)
      .eq('grantee_id', params.granteeId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Revoke permission error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all permissions for a resource
 */
export async function getResourcePermissions(params: {
  resourceType: ResourceType
  resourceId: string
}): Promise<{
  success: boolean
  permissions?: unknown[]
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('workdrive_permissions')
      .select(`
        *,
        granted_by_user:auth.users!workdrive_permissions_granted_by_fkey(email, raw_user_meta_data)
      `)
      .eq('resource_type', params.resourceType)
      .eq('resource_id', params.resourceId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, permissions: data || [] }
  } catch (error) {
    console.error('Get permissions error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if user can perform action on resource
 */
export async function canPerformAction(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  action: 'view' | 'download' | 'edit' | 'delete' | 'share' | 'manage_permissions'
): Promise<boolean> {
  const permission = await checkPermission({
    userId,
    resourceType,
    resourceId,
  })

  switch (action) {
    case 'view':
      return permission.can_view
    case 'download':
      return permission.can_download
    case 'edit':
      return permission.can_edit
    case 'delete':
      return permission.can_delete
    case 'share':
      return permission.can_share
    case 'manage_permissions':
      return permission.can_manage_permissions
    default:
      return false
  }
}

/**
 * Inherit permissions from parent folder
 */
export async function inheritFolderPermissions(params: {
  childResourceType: ResourceType
  childResourceId: string
  parentFolderId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Get parent folder permissions
    const { data: parentPerms, error: fetchError } = await supabase
      .from('workdrive_permissions')
      .select('*')
      .eq('resource_type', 'folder')
      .eq('resource_id', params.parentFolderId)

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    if (!parentPerms || parentPerms.length === 0) {
      return { success: true } // No permissions to inherit
    }

    // Create inherited permissions for child
    const inheritedPerms = parentPerms.map((perm) => ({
      resource_type: params.childResourceType,
      resource_id: params.childResourceId,
      grantee_type: perm.grantee_type,
      grantee_id: perm.grantee_id,
      permission_level: perm.permission_level,
      can_download: perm.can_download,
      can_share: perm.can_share,
      can_delete: perm.can_delete,
      can_manage_permissions: perm.can_manage_permissions,
      granted_by: perm.granted_by,
      expires_at: perm.expires_at,
      is_inherited: true,
      inherited_from: params.parentFolderId,
    }))

    const { error: insertError } = await supabase
      .from('workdrive_permissions')
      .upsert(inheritedPerms, {
        onConflict: 'resource_type,resource_id,grantee_type,grantee_id',
      })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Inherit permissions error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get users who have access to a resource
 */
export async function getResourceAccessList(params: {
  resourceType: ResourceType
  resourceId: string
}): Promise<{
  success: boolean
  users?: Array<{
    userId: string
    email: string
    name: string
    permissionLevel: PermissionLevel
    isOwner: boolean
  }>
  error?: string
}> {
  try {
    // Get owner
    let ownerId: string | null = null
    if (params.resourceType === 'file') {
      const { data } = await supabase
        .from('workdrive_files')
        .select('created_by')
        .eq('id', params.resourceId)
        .maybeSingle()
      ownerId = data?.created_by
    } else if (params.resourceType === 'folder') {
      const { data } = await supabase
        .from('workdrive_folders')
        .select('created_by')
        .eq('id', params.resourceId)
        .maybeSingle()
      ownerId = data?.created_by
    }

    // Get all user permissions
    const { data: permissions } = await supabase
      .from('workdrive_permissions')
      .select('grantee_id, permission_level')
      .eq('resource_type', params.resourceType)
      .eq('resource_id', params.resourceId)
      .eq('grantee_type', 'user')

    const userIds = new Set<string>()
    if (ownerId) userIds.add(ownerId)
    permissions?.forEach((p) => userIds.add(p.grantee_id))

    if (userIds.size === 0) {
      return { success: true, users: [] }
    }

    // Get user details
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', Array.from(userIds))

    const result = users?.map((user) => {
      const perm = permissions?.find((p) => p.grantee_id === user.id)
      return {
        userId: user.id,
        email: user.email,
        name: user.full_name || user.email,
        permissionLevel: user.id === ownerId ? 'owner' : (perm?.permission_level || 'viewer'),
        isOwner: user.id === ownerId,
      }
    }) || []

    return { success: true, users: result as unknown[] }
  } catch (error) {
    console.error('Get access list error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
