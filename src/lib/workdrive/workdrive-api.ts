/**
 * WorkDrive API Service
 * Database operations for WorkDrive
 */

import { createClient } from '@supabase/supabase-js'
import {
  WorkDriveFile,
  WorkDriveFolder,
  WorkDriveWorkspace,
  WorkDriveShare,
  WorkDriveComment,
  WorkDriveAuditLog,
  WorkDriveStorageQuota,
  ListFilesRequest,
  ListFilesResponse,
  BreadcrumbItem,
  CreateFolderRequest,
  CreateShareRequest,
  AuditAction,
  ResourceType,
  FileCategory,
  FILE_CATEGORY_MAP,
  ROLE_QUOTA_DEFAULTS,
} from '@/types/workdrive'
import {
  uploadWorkDriveFile,
  deleteWorkDriveFile,
  getWorkDriveFileUrl,
  getFileCategory,
  getFileExtension,
  formatFileSize,
} from './workdrive-storage'
import { checkPermission, getUserDefaultQuota } from './workdrive-permissions'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

/**
 * Get or create personal workspace for user
 */
export async function getOrCreatePersonalWorkspace(
  userId: string
): Promise<{ workspace: WorkDriveWorkspace | null; error?: string }> {
  try {
    // Check if personal workspace exists
    const { data: existing } = await supabase
      .from('workdrive_workspaces')
      .select('*')
      .eq('owner_id', userId)
      .eq('type', 'personal')
      .maybeSingle()

    if (existing) {
      return { workspace: existing }
    }

    // Get user's default quota
    const defaultQuota = await getUserDefaultQuota(userId)

    // Create personal workspace
    const { data: newWorkspace, error } = await supabase
      .from('workdrive_workspaces')
      .insert({
        name: 'My Drive',
        type: 'personal',
        owner_id: userId,
        storage_limit_bytes: defaultQuota,
        settings: {
          default_permission: 'viewer',
          allow_external_sharing: false,
        },
      })
      .select()
      .maybeSingle()

    if (error) {
      return { workspace: null, error: error.message }
    }

    // Create default quota record
    await supabase.from('workdrive_storage_quotas').insert({
      entity_type: 'user',
      entity_id: userId,
      storage_limit_bytes: defaultQuota,
      storage_used_bytes: 0,
      file_count: 0,
    })

    return { workspace: newWorkspace }
  } catch (error) {
    console.error('Get/Create workspace error:', error)
    return {
      workspace: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get user's workspaces
 */
export async function getUserWorkspaces(
  userId: string
): Promise<{ workspaces: WorkDriveWorkspace[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('workdrive_workspaces')
      .select('*')
      .or(`owner_id.eq.${userId},type.eq.organization`)
      .eq('is_active', true)
      .order('type', { ascending: true })

    if (error) {
      return { workspaces: [], error: error.message }
    }

    return { workspaces: data || [] }
  } catch (error) {
    console.error('Get workspaces error:', error)
    return {
      workspaces: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * List files and folders
 */
export async function listFiles(
  userId: string,
  params: ListFilesRequest
): Promise<ListFilesResponse> {
  try {
    const page = params.page || 1
    const limit = params.limit || 50
    const offset = (page - 1) * limit

    // Build files query
    let filesQuery = supabase
      .from('workdrive_files')
      .select('*, created_by_profile:profiles!workdrive_files_created_by_fkey(full_name, email)', { count: 'exact' })

    // Build folders query
    let foldersQuery = supabase
      .from('workdrive_folders')
      .select('*', { count: 'exact' })

    // Apply filters
    if (params.workspace_id) {
      filesQuery = filesQuery.eq('workspace_id', params.workspace_id)
      foldersQuery = foldersQuery.eq('workspace_id', params.workspace_id)
    }

    if (params.folder_id) {
      filesQuery = filesQuery.eq('folder_id', params.folder_id)
      foldersQuery = foldersQuery.eq('parent_folder_id', params.folder_id)
    } else {
      filesQuery = filesQuery.is('folder_id', null)
      foldersQuery = foldersQuery.is('parent_folder_id', null)
    }

    // Filter deleted files
    if (!params.include_deleted) {
      filesQuery = filesQuery.eq('is_deleted', false)
    }

    // Search filter
    if (params.search) {
      filesQuery = filesQuery.ilike('name', `%${params.search}%`)
      foldersQuery = foldersQuery.ilike('name', `%${params.search}%`)
    }

    // File type filter
    if (params.file_type) {
      filesQuery = filesQuery.eq('file_type', params.file_type)
    }

    // Sorting
    const sortBy = params.sort_by || 'name'
    const sortOrder = params.sort_order === 'desc' ? false : true

    filesQuery = filesQuery.order(sortBy, { ascending: sortOrder })
    foldersQuery = foldersQuery.order('name', { ascending: true })

    // Pagination for files
    filesQuery = filesQuery.range(offset, offset + limit - 1)

    // Execute queries
    const [filesResult, foldersResult] = await Promise.all([
      filesQuery,
      foldersQuery,
    ])

    // Get current folder info for breadcrumb
    let currentFolder: WorkDriveFolder | undefined
    let breadcrumb: BreadcrumbItem[] = []

    if (params.folder_id) {
      const { data: folder } = await supabase
        .from('workdrive_folders')
        .select('*')
        .eq('id', params.folder_id)
        .maybeSingle()

      if (folder) {
        currentFolder = folder
        breadcrumb = await buildBreadcrumb(folder)
      }
    }

    // Add workspace to breadcrumb
    if (params.workspace_id) {
      const { data: workspace } = await supabase
        .from('workdrive_workspaces')
        .select('id, name')
        .eq('id', params.workspace_id)
        .maybeSingle()

      if (workspace) {
        breadcrumb.unshift({
          id: workspace.id,
          name: workspace.name,
          type: 'workspace',
        })
      }
    }

    // Process files to add download URLs
    const files = await Promise.all(
      (filesResult.data || []).map(async (file) => {
        const urlResult = await getWorkDriveFileUrl({ s3Key: file.s3_key })
        return {
          ...file,
          download_url: urlResult.url,
          created_by_name: file.created_by_profile?.full_name || file.created_by_profile?.email,
        }
      })
    )

    return {
      files: files as WorkDriveFile[],
      folders: (foldersResult.data || []) as WorkDriveFolder[],
      total_files: filesResult.count || 0,
      total_folders: foldersResult.count || 0,
      page,
      limit,
      has_more: (filesResult.count || 0) > offset + limit,
      breadcrumb,
      current_folder: currentFolder,
    }
  } catch (error) {
    console.error('List files error:', error)
    return {
      files: [],
      folders: [],
      total_files: 0,
      total_folders: 0,
      page: 1,
      limit: 50,
      has_more: false,
      breadcrumb: [],
    }
  }
}

/**
 * Build breadcrumb from folder
 */
async function buildBreadcrumb(folder: WorkDriveFolder): Promise<BreadcrumbItem[]> {
  const breadcrumb: BreadcrumbItem[] = []
  let currentFolder: WorkDriveFolder | null = folder
  const visited = new Set<string>()
  const MAX_DEPTH = 20

  while (currentFolder && breadcrumb.length < MAX_DEPTH) {
    // Prevent infinite loop from circular parent references
    if (visited.has(currentFolder.id)) break
    visited.add(currentFolder.id)

    breadcrumb.unshift({
      id: currentFolder.id,
      name: currentFolder.name,
      type: 'folder',
    })

    if (currentFolder.parent_folder_id) {
      const { data } = await supabase
        .from('workdrive_folders')
        .select('*')
        .eq('id', currentFolder.parent_folder_id)
        .maybeSingle()

      currentFolder = data
    } else {
      currentFolder = null
    }
  }

  return breadcrumb
}

/**
 * Upload a file
 */
export async function uploadFile(params: {
  userId: string
  workspaceId: string
  folderId?: string
  file: Buffer
  fileName: string
  mimeType: string
}): Promise<{ file: WorkDriveFile | null; error?: string }> {
  try {
    // Check quota
    const { data: quota } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'user')
      .eq('entity_id', params.userId)
      .maybeSingle()

    if (quota && quota.storage_limit_bytes > 0) {
      const newUsage = quota.storage_used_bytes + params.file.length
      if (newUsage > quota.storage_limit_bytes) {
        return {
          file: null,
          error: `Storage quota exceeded. Used: ${formatFileSize(quota.storage_used_bytes)}, Limit: ${formatFileSize(quota.storage_limit_bytes)}`,
        }
      }
    }

    // Upload to S3
    const uploadResult = await uploadWorkDriveFile({
      file: params.file,
      fileName: params.fileName,
      mimeType: params.mimeType,
      userId: params.userId,
      workspaceId: params.workspaceId,
      folderId: params.folderId,
      compress: true,
      generateThumbnail: params.mimeType.startsWith('image/'),
    })

    if (!uploadResult.success) {
      return { file: null, error: uploadResult.error }
    }

    // Create database record
    const fileCategory = getFileCategory(params.mimeType)
    const fileType = getFileExtension(params.fileName)

    const { data: newFile, error } = await supabase
      .from('workdrive_files')
      .insert({
        workspace_id: params.workspaceId,
        folder_id: params.folderId,
        name: params.fileName,
        original_name: params.fileName,
        file_type: fileType,
        file_category: fileCategory,
        mime_type: params.mimeType,
        file_size_bytes: uploadResult.fileSize,
        s3_key: uploadResult.s3Key,
        s3_bucket: uploadResult.s3Bucket,
        s3_region: uploadResult.s3Region,
        thumbnail_s3_key: uploadResult.thumbnailS3Key,
        is_compressed: uploadResult.isCompressed,
        compression_ratio: uploadResult.compressionRatio,
        created_by: params.userId,
        modified_by: params.userId,
        metadata: {
          original_size: uploadResult.originalSize,
          upload_source: 'web',
        },
      })
      .select()
      .maybeSingle()

    if (error) {
      // Cleanup S3 file on database error
      await deleteWorkDriveFile({
        s3Key: uploadResult.s3Key!,
        thumbnailS3Key: uploadResult.thumbnailS3Key,
      })
      return { file: null, error: error.message }
    }

    // Log audit
    await logAudit({
      userId: params.userId,
      action: 'upload',
      resourceType: 'file',
      resourceId: newFile.id,
      resourceName: params.fileName,
      details: {
        file_size: uploadResult.fileSize,
        file_type: fileType,
        compressed: uploadResult.isCompressed,
        compression_ratio: uploadResult.compressionRatio,
      },
    })

    return { file: newFile }
  } catch (error) {
    console.error('Upload file error:', error)
    return {
      file: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get file by ID
 */
export async function getFile(
  fileId: string
): Promise<{ file: WorkDriveFile | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('workdrive_files')
      .select('*, created_by_profile:profiles!workdrive_files_created_by_fkey(full_name, email)')
      .eq('id', fileId)
      .maybeSingle()

    if (error) {
      return { file: null, error: error.message }
    }

    // Get download URL
    const urlResult = await getWorkDriveFileUrl({ s3Key: data.s3_key })

    return {
      file: {
        ...data,
        download_url: urlResult.url,
        created_by_name: data.created_by_profile?.full_name || data.created_by_profile?.email,
      },
    }
  } catch (error) {
    console.error('Get file error:', error)
    return {
      file: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete file (soft delete)
 */
export async function deleteFile(
  userId: string,
  fileId: string,
  permanent: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permission
    const permission = await checkPermission({
      userId,
      resourceType: 'file',
      resourceId: fileId,
    })

    if (!permission.can_delete) {
      return { success: false, error: 'Permission denied' }
    }

    // Get file info
    const { data: file } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('id', fileId)
      .maybeSingle()

    if (!file) {
      return { success: false, error: 'File not found' }
    }

    if (permanent) {
      // Permanent delete - remove from S3 and database
      await deleteWorkDriveFile({
        s3Key: file.s3_key,
        thumbnailS3Key: file.thumbnail_s3_key,
      })

      const { error } = await supabase
        .from('workdrive_files')
        .delete()
        .eq('id', fileId)

      if (error) {
        return { success: false, error: error.message }
      }

      await logAudit({
        userId,
        action: 'permanent_delete',
        resourceType: 'file',
        resourceId: fileId,
        resourceName: file.name,
      })
    } else {
      // Soft delete
      const { error } = await supabase
        .from('workdrive_files')
        .update({
          is_deleted: true,
          deleted_by: userId,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', fileId)

      if (error) {
        return { success: false, error: error.message }
      }

      await logAudit({
        userId,
        action: 'delete',
        resourceType: 'file',
        resourceId: fileId,
        resourceName: file.name,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Delete file error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Restore file from trash
 */
export async function restoreFile(
  userId: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('workdrive_files')
      .update({
        is_deleted: false,
        deleted_by: null,
        deleted_at: null,
        permanent_delete_at: null,
      })
      .eq('id', fileId)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAudit({
      userId,
      action: 'restore',
      resourceType: 'file',
      resourceId: fileId,
    })

    return { success: true }
  } catch (error) {
    console.error('Restore file error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Rename file
 */
export async function renameFile(
  userId: string,
  fileId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const permission = await checkPermission({
      userId,
      resourceType: 'file',
      resourceId: fileId,
    })

    if (!permission.can_edit) {
      return { success: false, error: 'Permission denied' }
    }

    const { data: file } = await supabase
      .from('workdrive_files')
      .select('name')
      .eq('id', fileId)
      .maybeSingle()

    const { error } = await supabase
      .from('workdrive_files')
      .update({
        name: newName,
        modified_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAudit({
      userId,
      action: 'rename',
      resourceType: 'file',
      resourceId: fileId,
      resourceName: newName,
      details: { old_name: file?.name, new_name: newName },
    })

    return { success: true }
  } catch (error) {
    console.error('Rename file error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

/**
 * Create folder
 */
export async function createFolder(
  userId: string,
  params: CreateFolderRequest
): Promise<{ folder: WorkDriveFolder | null; error?: string }> {
  try {
    const { data: folder, error } = await supabase
      .from('workdrive_folders')
      .insert({
        workspace_id: params.workspace_id,
        parent_folder_id: params.parent_folder_id,
        name: params.name,
        color: params.color || '#6B7280',
        created_by: userId,
      })
      .select()
      .maybeSingle()

    if (error) {
      return { folder: null, error: error.message }
    }

    await logAudit({
      userId,
      action: 'folder_create',
      resourceType: 'folder',
      resourceId: folder.id,
      resourceName: params.name,
    })

    return { folder }
  } catch (error) {
    console.error('Create folder error:', error)
    return {
      folder: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete folder
 */
export async function deleteFolder(
  userId: string,
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: folder } = await supabase
      .from('workdrive_folders')
      .select('name')
      .eq('id', folderId)
      .maybeSingle()

    const { error } = await supabase
      .from('workdrive_folders')
      .delete()
      .eq('id', folderId)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAudit({
      userId,
      action: 'folder_delete',
      resourceType: 'folder',
      resourceId: folderId,
      resourceName: folder?.name,
    })

    return { success: true }
  } catch (error) {
    console.error('Delete folder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// SHARING OPERATIONS
// ============================================================================

/**
 * Create share
 */
export async function createShare(
  userId: string,
  params: CreateShareRequest
): Promise<{ share: WorkDriveShare | null; error?: string }> {
  try {
    // Generate share token
    const shareToken = generateShareToken()
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/workdrive/share/${shareToken}`

    // Calculate expiry
    let expiresAt: string | undefined
    if (params.expires_in_days) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + params.expires_in_days)
      expiresAt = expiry.toISOString()
    }

    const { data: share, error } = await supabase
      .from('workdrive_shares')
      .insert({
        file_id: params.file_id,
        folder_id: params.folder_id,
        share_type: params.share_type,
        share_token: shareToken,
        share_url: shareUrl,
        is_password_protected: !!params.password,
        password_hash: params.password ? await hashPassword(params.password) : null,
        expires_at: expiresAt,
        max_downloads: params.max_downloads,
        max_views: params.max_views,
        allow_download: params.allow_download ?? true,
        watermark_enabled: params.watermark_enabled ?? false,
        notify_on_access: params.notify_on_access ?? false,
        shared_by: userId,
        shared_with_emails: params.shared_with_emails,
      })
      .select()
      .maybeSingle()

    if (error) {
      return { share: null, error: error.message }
    }

    await logAudit({
      userId,
      action: 'share',
      resourceType: params.file_id ? 'file' : 'folder',
      resourceId: params.file_id || params.folder_id!,
      details: {
        share_type: params.share_type,
        shared_with: params.shared_with_emails,
        expires_at: expiresAt,
      },
    })

    return { share }
  } catch (error) {
    console.error('Create share error:', error)
    return {
      share: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get share by token
 */
export async function getShareByToken(
  token: string
): Promise<{ share: WorkDriveShare | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('workdrive_shares')
      .select('*')
      .eq('share_token', token)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return { share: null, error: 'Share not found' }
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { share: null, error: 'Share link has expired' }
    }

    // Check view limit
    if (data.max_views && data.view_count >= data.max_views) {
      return { share: null, error: 'Share link view limit reached' }
    }

    return { share: data }
  } catch (error) {
    console.error('Get share error:', error)
    return {
      share: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Revoke share
 */
export async function revokeShare(
  userId: string,
  shareId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('workdrive_shares')
      .update({ is_active: false })
      .eq('id', shareId)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAudit({
      userId,
      action: 'unshare',
      resourceType: 'file',
      resourceId: shareId,
    })

    return { success: true }
  } catch (error) {
    console.error('Revoke share error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// AUDIT OPERATIONS
// ============================================================================

/**
 * Log audit event
 */
export async function logAudit(params: {
  userId: string
  action: AuditAction
  resourceType: ResourceType
  resourceId: string
  resourceName?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  try {
    await supabase.from('workdrive_audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      resource_name: params.resourceName,
      details: params.details || {},
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}

/**
 * Get audit logs
 */
export async function getAuditLogs(params: {
  userId?: string
  resourceId?: string
  action?: AuditAction
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}): Promise<{ logs: WorkDriveAuditLog[]; total: number; error?: string }> {
  try {
    let query = supabase
      .from('workdrive_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (params.userId) {
      query = query.eq('user_id', params.userId)
    }
    if (params.resourceId) {
      query = query.eq('resource_id', params.resourceId)
    }
    if (params.action) {
      query = query.eq('action', params.action)
    }
    if (params.startDate) {
      query = query.gte('created_at', params.startDate)
    }
    if (params.endDate) {
      query = query.lte('created_at', params.endDate)
    }

    const page = params.page || 1
    const limit = params.limit || 50
    const offset = (page - 1) * limit

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return { logs: [], total: 0, error: error.message }
    }

    return { logs: data || [], total: count || 0 }
  } catch (error) {
    console.error('Get audit logs error:', error)
    return {
      logs: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// FAVORITES & RECENT
// ============================================================================

/**
 * Add to favorites
 */
export async function addToFavorites(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('workdrive_favorites').upsert(
      {
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
      },
      { onConflict: 'user_id,resource_type,resource_id' }
    )

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Add favorite error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Remove from favorites
 */
export async function removeFromFavorites(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('workdrive_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Remove favorite error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get user's favorites
 */
export async function getFavorites(
  userId: string
): Promise<{ favorites: (WorkDriveFile | WorkDriveFolder)[]; error?: string }> {
  try {
    const { data: favs } = await supabase
      .from('workdrive_favorites')
      .select('*')
      .eq('user_id', userId)

    if (!favs || favs.length === 0) {
      return { favorites: [] }
    }

    const fileIds = favs.filter((f) => f.resource_type === 'file').map((f) => f.resource_id)
    const folderIds = favs.filter((f) => f.resource_type === 'folder').map((f) => f.resource_id)

    const [filesResult, foldersResult] = await Promise.all([
      fileIds.length > 0
        ? supabase.from('workdrive_files').select('*').in('id', fileIds)
        : Promise.resolve({ data: [] }),
      folderIds.length > 0
        ? supabase.from('workdrive_folders').select('*').in('id', folderIds)
        : Promise.resolve({ data: [] }),
    ])

    return {
      favorites: [
        ...((filesResult.data || []) as WorkDriveFile[]),
        ...((foldersResult.data || []) as WorkDriveFolder[]),
      ],
    }
  } catch (error) {
    console.error('Get favorites error:', error)
    return {
      favorites: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get recent files
 */
export async function getRecentFiles(
  userId: string,
  limit: number = 50
): Promise<{ files: WorkDriveFile[]; error?: string }> {
  try {
    const { data: recent } = await supabase
      .from('workdrive_recent_files')
      .select('file_id')
      .eq('user_id', userId)
      .order('accessed_at', { ascending: false })
      .limit(limit)

    if (!recent || recent.length === 0) {
      return { files: [] }
    }

    const fileIds = recent.map((r) => r.file_id)

    const { data: files } = await supabase
      .from('workdrive_files')
      .select('*')
      .in('id', fileIds)
      .eq('is_deleted', false)

    return { files: (files || []) as WorkDriveFile[] }
  } catch (error) {
    console.error('Get recent files error:', error)
    return {
      files: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Track file access
 */
export async function trackFileAccess(
  userId: string,
  fileId: string,
  accessType: 'view' | 'edit' | 'download'
): Promise<void> {
  try {
    await supabase.from('workdrive_recent_files').upsert(
      {
        user_id: userId,
        file_id: fileId,
        access_type: accessType,
        accessed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,file_id' }
    )
  } catch (error) {
    console.error('Track file access error:', error)
  }
}

// ============================================================================
// TRASH OPERATIONS
// ============================================================================

/**
 * Get trash files
 */
export async function getTrashFiles(
  userId: string
): Promise<{ files: WorkDriveFile[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('is_deleted', true)
      .eq('deleted_by', userId)
      .order('deleted_at', { ascending: false })

    if (error) {
      return { files: [], error: error.message }
    }

    return { files: data || [] }
  } catch (error) {
    console.error('Get trash files error:', error)
    return {
      files: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Empty trash
 */
export async function emptyTrash(
  userId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get files to delete
    const { data: files } = await supabase
      .from('workdrive_files')
      .select('id, s3_key, thumbnail_s3_key')
      .eq('is_deleted', true)
      .eq('deleted_by', userId)

    if (!files || files.length === 0) {
      return { success: true, count: 0 }
    }

    // Delete from S3
    for (const file of files) {
      await deleteWorkDriveFile({
        s3Key: file.s3_key,
        thumbnailS3Key: file.thumbnail_s3_key,
      })
    }

    // Delete from database
    const { error } = await supabase
      .from('workdrive_files')
      .delete()
      .eq('is_deleted', true)
      .eq('deleted_by', userId)

    if (error) {
      return { success: false, count: 0, error: error.message }
    }

    return { success: true, count: files.length }
  } catch (error) {
    console.error('Empty trash error:', error)
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(bytes[i] % chars.length)
  }
  return token
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export { formatFileSize }
