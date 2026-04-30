/**
 * WorkDrive Admin Service
 * Administrative operations for Super Admin and Admin
 */

import { createClient } from '@supabase/supabase-js'
import {
  WorkDriveFile,
  WorkDriveShare,
  WorkDriveAuditLog,
  WorkDriveStorageQuota,
  StorageStats,
  GlobalSettings,
  ROLE_QUOTA_DEFAULTS,
} from '@/types/workdrive'
import { formatFileSize } from './workdrive-storage'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// STORAGE MANAGEMENT
// ============================================================================

/**
 * Get organization-wide storage overview
 */
export async function getStorageOverview(): Promise<{
  stats: StorageStats | null
  error?: string
}> {
  try {
    // Get total files and storage
    const { data: filesData, error: filesError } = await supabase
      .from('workdrive_files')
      .select('file_size_bytes, file_category, created_at')
      .eq('is_deleted', false)

    if (filesError) {
      return { stats: null, error: filesError.message }
    }

    // Get total folders
    const { count: folderCount } = await supabase
      .from('workdrive_folders')
      .select('*', { count: 'exact', head: true })

    // Calculate totals
    const totalFiles = filesData?.length || 0
    const usedStorage = filesData?.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0) || 0

    // Get by file type
    const byFileType: Record<string, { count: number; size: number }> = {}
    filesData?.forEach((file) => {
      const category = file.file_category || 'other'
      if (!byFileType[category]) {
        byFileType[category] = { count: 0, size: 0 }
      }
      byFileType[category].count++
      byFileType[category].size += file.file_size_bytes || 0
    })

    // Get by department
    const { data: userStorage } = await supabase
      .from('workdrive_storage_quotas')
      .select('entity_id, storage_used_bytes')
      .eq('entity_type', 'user')

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, department')

    const departmentMap: Record<string, { size: number; users: Set<string> }> = {}
    userStorage?.forEach((quota) => {
      const profile = profiles?.find((p) => p.id === quota.entity_id)
      const dept = profile?.department || 'Unknown'
      if (!departmentMap[dept]) {
        departmentMap[dept] = { size: 0, users: new Set() }
      }
      departmentMap[dept].size += quota.storage_used_bytes || 0
      departmentMap[dept].users.add(quota.entity_id)
    })

    // Get growth trend (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const growthTrend: { date: string; size: number }[] = []
    const dateGroups: Record<string, number> = {}

    filesData?.forEach((file) => {
      const date = new Date(file.created_at).toISOString().split('T')[0]
      if (!dateGroups[date]) {
        dateGroups[date] = 0
      }
      dateGroups[date] += file.file_size_bytes || 0
    })

    Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .forEach(([date, size]) => {
        growthTrend.push({ date, size })
      })

    // Get largest files
    const { data: largestFiles } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('is_deleted', false)
      .order('file_size_bytes', { ascending: false })
      .limit(10)

    // Get recent uploads
    const { data: recentUploads } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get org storage limit from settings
    const { data: limitSetting } = await supabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'total_org_storage_tb')
      .maybeSingle()

    const totalStorageTB = parseInt(limitSetting?.setting_value || '2')
    const totalStorageBytes = totalStorageTB * 1024 * 1024 * 1024 * 1024

    return {
      stats: {
        total_storage_bytes: totalStorageBytes,
        used_storage_bytes: usedStorage,
        available_storage_bytes: totalStorageBytes - usedStorage,
        usage_percent: (usedStorage / totalStorageBytes) * 100,
        total_files: totalFiles,
        total_folders: folderCount || 0,
        by_file_type: Object.entries(byFileType).map(([type, data]) => ({
          type,
          count: data.count,
          size: data.size,
        })),
        by_department: Object.entries(departmentMap).map(([department, data]) => ({
          department,
          size: data.size,
          users: data.users.size,
        })),
        growth_trend: growthTrend,
        largest_files: (largestFiles || []) as WorkDriveFile[],
        recent_uploads: (recentUploads || []) as WorkDriveFile[],
      },
    }
  } catch (error) {
    console.error('Get storage overview error:', error)
    return {
      stats: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get user storage statistics
 */
export async function getUserStorageStats(userId: string): Promise<{
  quota: WorkDriveStorageQuota | null
  files: WorkDriveFile[]
  error?: string
}> {
  try {
    const { data: quota, error: quotaError } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'user')
      .eq('entity_id', userId)
      .maybeSingle()

    if (quotaError && quotaError.code !== 'PGRST116') {
      return { quota: null, files: [], error: quotaError.message }
    }

    const { data: files } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('created_by', userId)
      .eq('is_deleted', false)
      .order('file_size_bytes', { ascending: false })
      .limit(100)

    return {
      quota: quota || null,
      files: (files || []) as WorkDriveFile[],
    }
  } catch (error) {
    console.error('Get user storage stats error:', error)
    return {
      quota: null,
      files: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get department storage statistics
 */
export async function getDepartmentStorageStats(): Promise<{
  departments: Array<{
    name: string
    storage_used: number
    storage_limit: number
    user_count: number
    file_count: number
  }>
  error?: string
}> {
  try {
    // Get all users with their departments
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, department, role')

    // Get all quotas
    const { data: quotas } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'user')

    // Group by department
    const departments: Record<string, {
      storage_used: number
      storage_limit: number
      user_count: number
      file_count: number
    }> = {}

    profiles?.forEach((profile) => {
      const dept = profile.department || 'Unknown'
      const quota = quotas?.find((q) => q.entity_id === profile.id)

      if (!departments[dept]) {
        departments[dept] = {
          storage_used: 0,
          storage_limit: 0,
          user_count: 0,
          file_count: 0,
        }
      }

      departments[dept].user_count++
      if (quota) {
        departments[dept].storage_used += quota.storage_used_bytes || 0
        departments[dept].storage_limit += quota.storage_limit_bytes || 0
        departments[dept].file_count += quota.file_count || 0
      }
    })

    return {
      departments: Object.entries(departments).map(([name, data]) => ({
        name,
        ...data,
      })),
    }
  } catch (error) {
    console.error('Get department storage stats error:', error)
    return {
      departments: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update user quota
 */
export async function updateUserQuota(params: {
  userId: string
  newLimitBytes: number
  updatedBy: string
  reason?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('workdrive_storage_quotas')
      .upsert(
        {
          entity_type: 'user',
          entity_id: params.userId,
          storage_limit_bytes: params.newLimitBytes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entity_type,entity_id' }
      )

    if (error) {
      return { success: false, error: error.message }
    }

    // Log the change
    await supabase.from('workdrive_audit_logs').insert({
      user_id: params.updatedBy,
      action: 'quota_update',
      resource_type: 'workspace',
      resource_id: params.userId,
      details: {
        new_limit: params.newLimitBytes,
        new_limit_formatted: formatFileSize(params.newLimitBytes),
        reason: params.reason,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Update user quota error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get all users with their storage info
 */
export async function getAllUsersWithStorage(params?: {
  page?: number
  limit?: number
  search?: string
  role?: string
  department?: string
  quotaStatus?: 'normal' | 'warning' | 'exceeded'
}): Promise<{
  users: Array<{
    id: string
    email: string
    full_name: string
    role: string
    sub_role?: string
    department?: string
    storage_used: number
    storage_limit: number
    file_count: number
    usage_percent: number
    quota_status: 'normal' | 'warning' | 'exceeded'
    workdrive_enabled: boolean
  }>
  total: number
  error?: string
}> {
  try {
    const page = params?.page || 1
    const limit = params?.limit || 50
    const offset = (page - 1) * limit

    // Get profiles
    let profileQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact' })

    if (params?.search) {
      profileQuery = profileQuery.or(
        `full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`
      )
    }
    if (params?.role) {
      profileQuery = profileQuery.eq('role', params.role)
    }
    if (params?.department) {
      profileQuery = profileQuery.eq('department', params.department)
    }

    profileQuery = profileQuery.range(offset, offset + limit - 1)

    const { data: profiles, count, error: profileError } = await profileQuery

    if (profileError) {
      return { users: [], total: 0, error: profileError.message }
    }

    // Get quotas for these users
    const userIds = profiles?.map((p) => p.id) || []
    const { data: quotas } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'user')
      .in('entity_id', userIds)

    // Combine data
    const users = profiles?.map((profile) => {
      const quota = quotas?.find((q) => q.entity_id === profile.id)
      const storageUsed = quota?.storage_used_bytes || 0
      const storageLimit = quota?.storage_limit_bytes || ROLE_QUOTA_DEFAULTS[profile.role] || ROLE_QUOTA_DEFAULTS.CUSTOMER
      const usagePercent = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0

      let quotaStatus: 'normal' | 'warning' | 'exceeded' = 'normal'
      if (usagePercent >= 100) {
        quotaStatus = 'exceeded'
      } else if (usagePercent >= 80) {
        quotaStatus = 'warning'
      }

      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name || profile.email,
        role: profile.role,
        sub_role: profile.sub_role,
        department: profile.department,
        storage_used: storageUsed,
        storage_limit: storageLimit,
        file_count: quota?.file_count || 0,
        usage_percent: usagePercent,
        quota_status: quotaStatus,
        workdrive_enabled: quota !== undefined,
      }
    }) || []

    // Filter by quota status if specified
    let filteredUsers = users
    if (params?.quotaStatus) {
      filteredUsers = users.filter((u) => u.quota_status === params.quotaStatus)
    }

    return {
      users: filteredUsers,
      total: count || 0,
    }
  } catch (error) {
    console.error('Get all users with storage error:', error)
    return {
      users: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Enable WorkDrive for a user
 */
export async function enableUserWorkDrive(
  userId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's role for default quota
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, sub_role')
      .eq('id', userId)
      .maybeSingle()

    const roleKey = profile?.sub_role?.toUpperCase().replace(/ /g, '_') || profile?.role
    const defaultQuota = ROLE_QUOTA_DEFAULTS[roleKey || 'CUSTOMER'] || ROLE_QUOTA_DEFAULTS.CUSTOMER

    // Create quota record
    const { error } = await supabase.from('workdrive_storage_quotas').upsert(
      {
        entity_type: 'user',
        entity_id: userId,
        storage_limit_bytes: defaultQuota,
        storage_used_bytes: 0,
        file_count: 0,
      },
      { onConflict: 'entity_type,entity_id' }
    )

    if (error) {
      return { success: false, error: error.message }
    }

    // Log action
    await supabase.from('workdrive_audit_logs').insert({
      user_id: adminId,
      action: 'settings_update',
      resource_type: 'workspace',
      resource_id: userId,
      details: { action: 'enable_workdrive', target_user: userId },
    })

    return { success: true }
  } catch (error) {
    console.error('Enable user WorkDrive error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Disable WorkDrive for a user
 */
export async function disableUserWorkDrive(
  userId: string,
  adminId: string,
  deleteFiles: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (deleteFiles) {
      // Delete all user's files from S3 and database
      // This is a destructive operation - should require confirmation
      const { data: files } = await supabase
        .from('workdrive_files')
        .select('id, s3_key, thumbnail_s3_key')
        .eq('created_by', userId)

      // Delete from database (S3 cleanup can be done async)
      if (files && files.length > 0) {
        await supabase
          .from('workdrive_files')
          .delete()
          .eq('created_by', userId)
      }
    }

    // Remove quota record (effectively disables WorkDrive)
    await supabase
      .from('workdrive_storage_quotas')
      .delete()
      .eq('entity_type', 'user')
      .eq('entity_id', userId)

    // Log action
    await supabase.from('workdrive_audit_logs').insert({
      user_id: adminId,
      action: 'settings_update',
      resource_type: 'workspace',
      resource_id: userId,
      details: {
        action: 'disable_workdrive',
        target_user: userId,
        files_deleted: deleteFiles,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Disable user WorkDrive error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Get all admin settings
 */
export async function getAdminSettings(): Promise<{
  settings: GlobalSettings | null
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('workdrive_admin_settings')
      .select('*')

    if (error) {
      return { settings: null, error: error.message }
    }

    // Convert to GlobalSettings object
    const settings: Record<string, unknown> = {}
    data?.forEach((setting) => {
      let value = setting.setting_value
      // Parse JSON values
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {
          // Intentionally empty: value is kept as string if not valid JSON
        }
      }
      settings[setting.setting_key] = value
    })

    return { settings: settings as GlobalSettings }
  } catch (error) {
    console.error('Get admin settings error:', error)
    return {
      settings: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update an admin setting
 */
export async function updateAdminSetting(params: {
  key: string
  value: unknown; updatedBy: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const stringValue = typeof params.value === 'string'
      ? params.value
      : JSON.stringify(params.value)

    const { error } = await supabase
      .from('workdrive_admin_settings')
      .update({
        setting_value: stringValue,
        updated_by: params.updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', params.key)

    if (error) {
      return { success: false, error: error.message }
    }

    // Log the change
    await supabase.from('workdrive_audit_logs').insert({
      user_id: params.updatedBy,
      action: 'settings_update',
      resource_type: 'workspace',
      resource_id: params.key,
      details: {
        setting_key: params.key,
        new_value: params.value,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Update admin setting error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// SHARES MANAGEMENT
// ============================================================================

/**
 * Get all active shares (for admin view)
 */
export async function getAllActiveShares(params?: {
  page?: number
  limit?: number
  shareType?: 'link' | 'email' | 'internal'
  userId?: string
}): Promise<{
  shares: WorkDriveShare[]
  total: number
  error?: string
}> {
  try {
    const page = params?.page || 1
    const limit = params?.limit || 50
    const offset = (page - 1) * limit

    let query = supabase
      .from('workdrive_shares')
      .select('*, shared_by_profile:profiles!workdrive_shares_shared_by_fkey(full_name, email)', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (params?.shareType) {
      query = query.eq('share_type', params.shareType)
    }
    if (params?.userId) {
      query = query.eq('shared_by', params.userId)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return { shares: [], total: 0, error: error.message }
    }

    // Enhance with file/folder names
    const shares = await Promise.all(
      (data || []).map(async (share) => {
        let resourceName = ''
        if (share.file_id) {
          const { data: file } = await supabase
            .from('workdrive_files')
            .select('name')
            .eq('id', share.file_id)
            .maybeSingle()
          resourceName = file?.name || 'Unknown File'
        } else if (share.folder_id) {
          const { data: folder } = await supabase
            .from('workdrive_folders')
            .select('name')
            .eq('id', share.folder_id)
            .maybeSingle()
          resourceName = folder?.name || 'Unknown Folder'
        }

        return {
          ...share,
          resource_name: resourceName,
          resource_type: share.file_id ? 'file' : 'folder',
          shared_by_name: share.shared_by_profile?.full_name || share.shared_by_profile?.email,
        }
      })
    )

    return {
      shares: shares as WorkDriveShare[],
      total: count || 0,
    }
  } catch (error) {
    console.error('Get all active shares error:', error)
    return {
      shares: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Revoke all shares for a user
 */
export async function revokeAllUserShares(
  userId: string,
  adminId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const { data: shares } = await supabase
      .from('workdrive_shares')
      .select('id')
      .eq('shared_by', userId)
      .eq('is_active', true)

    const count = shares?.length || 0

    const { error } = await supabase
      .from('workdrive_shares')
      .update({ is_active: false })
      .eq('shared_by', userId)

    if (error) {
      return { success: false, count: 0, error: error.message }
    }

    // Log action
    await supabase.from('workdrive_audit_logs').insert({
      user_id: adminId,
      action: 'unshare',
      resource_type: 'workspace',
      resource_id: userId,
      details: {
        action: 'revoke_all_user_shares',
        target_user: userId,
        shares_revoked: count,
      },
    })

    return { success: true, count }
  } catch (error) {
    console.error('Revoke all user shares error:', error)
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// AUDIT MANAGEMENT
// ============================================================================

/**
 * Get full audit logs (admin view)
 */
export async function getFullAuditLogs(params?: {
  page?: number
  limit?: number
  userId?: string
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
  search?: string
}): Promise<{
  logs: WorkDriveAuditLog[]
  total: number
  error?: string
}> {
  try {
    const page = params?.page || 1
    const limit = params?.limit || 100
    const offset = (page - 1) * limit

    let query = supabase
      .from('workdrive_audit_logs')
      .select('*, user_profile:profiles!workdrive_audit_logs_user_id_fkey(full_name, email, role)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (params?.userId) {
      query = query.eq('user_id', params.userId)
    }
    if (params?.action) {
      query = query.eq('action', params.action)
    }
    if (params?.resourceType) {
      query = query.eq('resource_type', params.resourceType)
    }
    if (params?.startDate) {
      query = query.gte('created_at', params.startDate)
    }
    if (params?.endDate) {
      query = query.lte('created_at', params.endDate)
    }
    if (params?.search) {
      query = query.ilike('resource_name', `%${params.search}%`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return { logs: [], total: 0, error: error.message }
    }

    const logs = (data || []).map((log) => ({
      ...log,
      user_name: log.user_profile?.full_name || log.user_profile?.email,
      user_email: log.user_profile?.email,
      user_role: log.user_profile?.role,
    }))

    return {
      logs: logs as WorkDriveAuditLog[],
      total: count || 0,
    }
  } catch (error) {
    console.error('Get full audit logs error:', error)
    return {
      logs: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Export audit logs as CSV
 */
export async function exportAuditLogs(params?: {
  userId?: string
  action?: string
  startDate?: string
  endDate?: string
}): Promise<{ csv: string; error?: string }> {
  try {
    let query = supabase
      .from('workdrive_audit_logs')
      .select('*, user_profile:profiles!workdrive_audit_logs_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(10000)

    if (params?.userId) {
      query = query.eq('user_id', params.userId)
    }
    if (params?.action) {
      query = query.eq('action', params.action)
    }
    if (params?.startDate) {
      query = query.gte('created_at', params.startDate)
    }
    if (params?.endDate) {
      query = query.lte('created_at', params.endDate)
    }

    const { data, error } = await query

    if (error) {
      return { csv: '', error: error.message }
    }

    // Generate CSV
    const headers = [
      'Timestamp',
      'User',
      'Email',
      'Action',
      'Resource Type',
      'Resource Name',
      'IP Address',
      'Details',
    ]

    const rows = (data || []).map((log) => [
      log.created_at,
      log.user_profile?.full_name || 'Unknown',
      log.user_profile?.email || 'Unknown',
      log.action,
      log.resource_type,
      log.resource_name || '',
      log.ip_address || '',
      JSON.stringify(log.details || {}),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return { csv }
  } catch (error) {
    console.error('Export audit logs error:', error)
    return {
      csv: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// MAINTENANCE & CLEANUP
// ============================================================================

/**
 * Cleanup expired trash items
 */
export async function cleanupExpiredTrash(): Promise<{
  success: boolean
  deletedCount: number
  error?: string
}> {
  try {
    // Get files to delete
    const { data: files } = await supabase
      .from('workdrive_files')
      .select('id, s3_key, thumbnail_s3_key')
      .eq('is_deleted', true)
      .lt('permanent_delete_at', new Date().toISOString())

    if (!files || files.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Delete from database (S3 cleanup should be done via background job)
    const fileIds = files.map((f) => f.id)
    const { error } = await supabase
      .from('workdrive_files')
      .delete()
      .in('id', fileIds)

    if (error) {
      return { success: false, deletedCount: 0, error: error.message }
    }

    return { success: true, deletedCount: files.length }
  } catch (error) {
    console.error('Cleanup expired trash error:', error)
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Cleanup expired shares
 */
export async function cleanupExpiredShares(): Promise<{
  success: boolean
  deactivatedCount: number
  error?: string
}> {
  try {
    const { data: shares } = await supabase
      .from('workdrive_shares')
      .select('id')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())

    if (!shares || shares.length === 0) {
      return { success: true, deactivatedCount: 0 }
    }

    const shareIds = shares.map((s) => s.id)
    const { error } = await supabase
      .from('workdrive_shares')
      .update({ is_active: false })
      .in('id', shareIds)

    if (error) {
      return { success: false, deactivatedCount: 0, error: error.message }
    }

    return { success: true, deactivatedCount: shares.length }
  } catch (error) {
    console.error('Cleanup expired shares error:', error)
    return {
      success: false,
      deactivatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Recalculate all user quotas
 */
export async function recalculateAllQuotas(): Promise<{
  success: boolean
  updatedCount: number
  error?: string
}> {
  try {
    // Get all users with files
    const { data: userFiles } = await supabase
      .from('workdrive_files')
      .select('created_by, file_size_bytes')
      .eq('is_deleted', false)

    // Group by user
    const userTotals: Record<string, { size: number; count: number }> = {}
    userFiles?.forEach((file) => {
      if (!file.created_by) return
      if (!userTotals[file.created_by]) {
        userTotals[file.created_by] = { size: 0, count: 0 }
      }
      userTotals[file.created_by].size += file.file_size_bytes || 0
      userTotals[file.created_by].count++
    })

    // Update quotas
    let updatedCount = 0
    for (const [userId, totals] of Object.entries(userTotals)) {
      const { error } = await supabase
        .from('workdrive_storage_quotas')
        .update({
          storage_used_bytes: totals.size,
          file_count: totals.count,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('entity_type', 'user')
        .eq('entity_id', userId)

      if (!error) {
        updatedCount++
      }
    }

    return { success: true, updatedCount }
  } catch (error) {
    console.error('Recalculate all quotas error:', error)
    return {
      success: false,
      updatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
