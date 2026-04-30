import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { uploadWorkDriveFile, getOrCreatePersonalWorkspace, logAudit, formatFileSize, getFileCategory, getFileExtension, generateWorkDriveS3Key } from '@/lib/workdrive'
import { ROLE_QUOTA_DEFAULTS } from '@/types/workdrive'
import { apiLogger } from '@/lib/utils/logger'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'loanz360-documents'

const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]

function sanitizeFileName(name: string): string {
  // Remove path separators
  let sanitized = name.replace(/[/\\]/g, '_')
  // Check Windows reserved names
  const baseName = sanitized.split('.')[0].toUpperCase()
  if (WINDOWS_RESERVED_NAMES.includes(baseName)) {
    sanitized = `_${sanitized}`
  }
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '')
  // Replace other problematic characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_')
  return sanitized || 'unnamed_file'
}

/**
 * GET /api/workdrive/files
 * Fetch files and folders for the current user's workdrive
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        files: [],
        folders: []
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id') || null
    const view = searchParams.get('view') || 'my-drive'

    // Check if workdrive_files table exists
    const { data: files, error: filesError } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('owner_id', user.id)
      .eq('parent_folder_id', folderId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    const { data: folders, error: foldersError } = await supabase
      .from('workdrive_folders')
      .select('*')
      .eq('owner_id', user.id)
      .eq('parent_folder_id', folderId)
      .eq('is_deleted', false)
      .order('name', { ascending: true })

    // If tables don't exist, return empty arrays (graceful degradation)
    if (filesError?.code === '42P01' || foldersError?.code === '42P01') {
      // Table doesn't exist - return empty data
      return NextResponse.json({
        success: true,
        files: [],
        folders: [],
        storageUsed: 0,
        storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
        message: 'WorkDrive tables not configured'
      })
    }

    // Calculate actual storage used by this user
    let storageUsed = 0
    let storageLimit = 10 * 1024 * 1024 * 1024 // 10GB default
    try {
      const { data: storageData } = await supabase
        .from('workdrive_files')
        .select('file_size_bytes')
        .eq('owner_id', user.id)
        .eq('is_deleted', false)

      if (storageData) {
        storageUsed = storageData.reduce((sum: number, f: { file_size_bytes: number | null }) => sum + (f.file_size_bytes || 0), 0)
      }

      // Check user quota if configured
      const { data: quotaData } = await supabase
        .from('workdrive_user_quotas')
        .select('storage_limit_bytes')
        .eq('user_id', user.id)
        .maybeSingle()

      if (quotaData?.storage_limit_bytes) {
        storageLimit = quotaData.storage_limit_bytes
      }
    } catch {
      // Graceful degradation - storage info unavailable
    }

    return NextResponse.json({
      success: true,
      files: files || [],
      folders: folders || [],
      storageUsed,
      storageLimit
    })

  } catch (error) {
    apiLogger.error('WorkDrive files error', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      files: [],
      folders: []
    }, { status: 500 })
  }
}

/**
 * POST /api/workdrive/files
 * Upload a file to the user's workdrive
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folder_id') as string | null

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided',
      }, { status: 400 })
    }

    // Sanitize file name
    const originalName = file.name
    const sanitizedName = sanitizeFileName(originalName)

    // Validate file size (get max from admin settings)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: maxSizeSetting } = await serviceSupabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'max_file_size_mb')
      .maybeSingle()

    const maxFileSizeMB = parseInt(maxSizeSetting?.setting_value || '100')
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024

    if (file.size > maxFileSizeBytes) {
      return NextResponse.json({
        success: false,
        error: `File size exceeds maximum allowed size of ${maxFileSizeMB}MB`,
        code: 'FILE_TOO_LARGE',
      }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cannot upload empty files',
      }, { status: 400 })
    }

    // Check blocked extensions
    const { data: blockedExtSetting } = await serviceSupabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'blocked_file_extensions')
      .maybeSingle()

    let blockedExtensions: string[] = []
    try {
      blockedExtensions = JSON.parse(blockedExtSetting?.setting_value || '[]')
    } catch { /* ignore parse errors */ }

    const fileExt = sanitizedName.split('.').pop()?.toLowerCase() || ''
    if (blockedExtensions.includes(fileExt)) {
      return NextResponse.json({
        success: false,
        error: `File type .${fileExt} is not allowed`,
        code: 'BLOCKED_FILE_TYPE',
      }, { status: 400 })
    }

    // Check quota
    const { data: quota } = await serviceSupabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'user')
      .eq('entity_id', user.id)
      .maybeSingle()

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const roleKey = profile?.sub_role?.toUpperCase().replace(/ /g, '_') || profile?.role
    const defaultQuota = ROLE_QUOTA_DEFAULTS[roleKey || 'CUSTOMER'] || ROLE_QUOTA_DEFAULTS.CUSTOMER

    const storageLimit = quota?.storage_limit_bytes ?? defaultQuota
    const storageUsed = quota?.storage_used_bytes ?? 0
    const isUnlimited = storageLimit < 0

    if (!isUnlimited && (storageUsed + file.size) > storageLimit) {
      return NextResponse.json({
        success: false,
        error: `Insufficient storage space. Need ${formatFileSize(file.size)} but only ${formatFileSize(Math.max(0, storageLimit - storageUsed))} available.`,
        code: 'QUOTA_EXCEEDED',
      }, { status: 400 })
    }

    // Get or create workspace
    const { workspace } = await getOrCreatePersonalWorkspace(user.id)
    if (!workspace) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get workspace',
      }, { status: 500 })
    }

    // Generate S3 key and upload
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const s3SafeName = sanitizedName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `workdrive/users/${user.id}/${workspace.id}/${folderId || 'root'}/${timestamp}-${random}-${s3SafeName}`

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        userId: user.id,
        originalFileName: originalName,
        workspaceId: workspace.id,
        folderId: folderId || '',
      },
    }))

    // Create database record
    const mimeType = file.type || 'application/octet-stream'
    const fileCategory = mimeType.startsWith('image/') ? 'image' :
      mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') ? 'document' :
      mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv') ? 'spreadsheet' :
      mimeType.includes('presentation') || mimeType.includes('powerpoint') ? 'presentation' :
      mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('compressed') ? 'archive' :
      'other'

    const { data: newFile, error: dbError } = await serviceSupabase
      .from('workdrive_files')
      .insert({
        workspace_id: workspace.id,
        folder_id: folderId || null,
        name: sanitizedName,
        original_name: originalName,
        file_type: fileExt,
        file_category: fileCategory,
        mime_type: mimeType,
        file_size_bytes: file.size,
        s3_key: s3Key,
        s3_bucket: BUCKET_NAME,
        s3_region: process.env.AWS_REGION || 'ap-south-1',
        created_by: user.id,
        owner_id: user.id,
        modified_by: user.id,
        metadata: {
          upload_type: 'direct',
        },
      })
      .select()
      .maybeSingle()

    if (dbError) {
      apiLogger.error('Database error saving file record', dbError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save file record',
      }, { status: 500 })
    }

    // Update storage quota
    await serviceSupabase
      .from('workdrive_storage_quotas')
      .upsert({
        entity_type: 'user',
        entity_id: user.id,
        storage_used_bytes: storageUsed + file.size,
        file_count: (quota?.file_count || 0) + 1,
        storage_limit_bytes: storageLimit,
      }, { onConflict: 'entity_type,entity_id' })

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'upload',
      resourceType: 'file',
      resourceId: newFile?.id || '',
      resourceName: sanitizedName,
      details: {
        file_size: file.size,
        upload_type: 'direct',
        mime_type: mimeType,
      },
    })

    return NextResponse.json({
      success: true,
      file: newFile,
    })

  } catch (error) {
    apiLogger.error('WorkDrive file upload error', error)
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
    }, { status: 500 })
  }
}
