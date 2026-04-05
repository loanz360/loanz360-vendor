/**
 * WorkDrive Storage Service
 * Handles S3 operations for WorkDrive files
 */

import {
  uploadToS3,
  getFromS3,
  deleteFromS3,
  generatePresignedUrl,
  listS3Files,
  copyS3File,
  fileExistsInS3,
} from '@/lib/aws/s3-client'
import { processFileUpload } from '@/lib/aws/compression'
import {
  WorkDriveFile,
  FileCategory,
  FILE_CATEGORY_MAP,
} from '@/types/workdrive'

// S3 key prefix for WorkDrive
const WORKDRIVE_PREFIX = 'workdrive'

/**
 * Generate S3 key for WorkDrive file
 */
export function generateWorkDriveS3Key(params: {
  userId: string
  workspaceId: string
  folderId?: string
  fileName: string
}): string {
  const timestamp = Date.now()
  const randomStr = crypto.getRandomValues(new Uint8Array(4)).reduce((s, b) => s + b.toString(36).padStart(2, '0'), '').substring(0, 8)
  const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')

  const parts = [
    WORKDRIVE_PREFIX,
    'users',
    params.userId,
    params.workspaceId,
  ]

  if (params.folderId) {
    parts.push(params.folderId)
  }

  parts.push(`${timestamp}-${randomStr}-${sanitizedFileName}`)

  return parts.join('/')
}

/**
 * Generate S3 key for WorkDrive thumbnail
 */
export function generateThumbnailS3Key(fileS3Key: string): string {
  const parts = fileS3Key.split('/')
  const fileName = parts.pop()
  return [...parts, 'thumbnails', `thumb-${fileName}`].join('/')
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory {
  return FILE_CATEGORY_MAP[mimeType] || 'other'
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * Upload file to WorkDrive
 */
export async function uploadWorkDriveFile(params: {
  file: Buffer
  fileName: string
  mimeType: string
  userId: string
  workspaceId: string
  folderId?: string
  compress?: boolean
  generateThumbnail?: boolean
}): Promise<{
  success: boolean
  s3Key?: string
  s3Bucket?: string
  s3Region?: string
  thumbnailS3Key?: string
  fileSize?: number
  originalSize?: number
  compressionRatio?: number
  isCompressed?: boolean
  error?: string
}> {
  try {
    // Process file (validate & compress)
    const processResult = await processFileUpload({
      buffer: params.file,
      fileName: params.fileName,
      mimeType: params.mimeType,
      maxSizeMB: 15,
      compress: params.compress !== false,
      generateThumbnail: params.generateThumbnail,
    })

    if (!processResult.success) {
      return {
        success: false,
        error: processResult.error || 'File processing failed',
      }
    }

    // Generate S3 key
    const s3Key = generateWorkDriveS3Key({
      userId: params.userId,
      workspaceId: params.workspaceId,
      folderId: params.folderId,
      fileName: params.fileName,
    })

    // Upload main file to S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: processResult.processedFile!,
      contentType: processResult.mimeType,
      metadata: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        folderId: params.folderId || '',
        originalFileName: params.fileName,
        originalSize: processResult.originalSize.toString(),
        compressed: processResult.compressionRatio > 0 ? 'true' : 'false',
        source: 'workdrive',
      },
    })

    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'S3 upload failed',
      }
    }

    // Upload thumbnail if generated
    let thumbnailS3Key: string | undefined
    if (processResult.thumbnail) {
      thumbnailS3Key = generateThumbnailS3Key(s3Key)
      await uploadToS3({
        key: thumbnailS3Key,
        body: processResult.thumbnail,
        contentType: 'image/jpeg',
        metadata: {
          parentFile: s3Key,
          type: 'thumbnail',
        },
      })
    }

    return {
      success: true,
      s3Key: uploadResult.s3Key,
      s3Bucket: uploadResult.bucket,
      s3Region: uploadResult.region,
      thumbnailS3Key,
      fileSize: processResult.processedSize,
      originalSize: processResult.originalSize,
      compressionRatio: processResult.compressionRatio,
      isCompressed: processResult.compressionRatio > 0,
    }
  } catch (error) {
    console.error('WorkDrive upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    }
  }
}

/**
 * Download file from WorkDrive
 */
export async function downloadWorkDriveFile(s3Key: string): Promise<{
  success: boolean
  data?: Buffer
  contentType?: string
  error?: string
}> {
  try {
    const result = await getFromS3(s3Key)
    return result
  } catch (error) {
    console.error('WorkDrive download error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown download error',
    }
  }
}

/**
 * Generate presigned URL for file access
 */
export async function getWorkDriveFileUrl(params: {
  s3Key: string
  expiresIn?: number
  operation?: 'get' | 'put'
}): Promise<{
  success: boolean
  url?: string
  expiresAt?: Date
  error?: string
}> {
  try {
    return await generatePresignedUrl({
      key: params.s3Key,
      expiresIn: params.expiresIn || 3600, // 1 hour default
      operation: params.operation || 'get',
    })
  } catch (error) {
    console.error('WorkDrive presigned URL error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete file from WorkDrive S3
 */
export async function deleteWorkDriveFile(params: {
  s3Key: string
  thumbnailS3Key?: string
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Delete main file
    const mainDelete = await deleteFromS3(params.s3Key)
    if (!mainDelete.success) {
      return mainDelete
    }

    // Delete thumbnail if exists
    if (params.thumbnailS3Key) {
      await deleteFromS3(params.thumbnailS3Key)
    }

    return { success: true }
  } catch (error) {
    console.error('WorkDrive delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delete error',
    }
  }
}

/**
 * Copy file within WorkDrive
 */
export async function copyWorkDriveFile(params: {
  sourceS3Key: string
  destinationUserId: string
  destinationWorkspaceId: string
  destinationFolderId?: string
  newFileName: string
}): Promise<{
  success: boolean
  newS3Key?: string
  error?: string
}> {
  try {
    const newS3Key = generateWorkDriveS3Key({
      userId: params.destinationUserId,
      workspaceId: params.destinationWorkspaceId,
      folderId: params.destinationFolderId,
      fileName: params.newFileName,
    })

    const result = await copyS3File({
      sourceKey: params.sourceS3Key,
      destinationKey: newS3Key,
    })

    if (result.success) {
      return {
        success: true,
        newS3Key: result.newKey,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  } catch (error) {
    console.error('WorkDrive copy error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown copy error',
    }
  }
}

/**
 * List files in a WorkDrive path
 */
export async function listWorkDriveFiles(params: {
  userId: string
  workspaceId?: string
  folderId?: string
  maxKeys?: number
}): Promise<{
  success: boolean
  files?: Array<{ key: string; size: number; lastModified: Date }>
  error?: string
}> {
  try {
    const prefix = params.folderId
      ? `${WORKDRIVE_PREFIX}/users/${params.userId}/${params.workspaceId}/${params.folderId}/`
      : params.workspaceId
      ? `${WORKDRIVE_PREFIX}/users/${params.userId}/${params.workspaceId}/`
      : `${WORKDRIVE_PREFIX}/users/${params.userId}/`

    return await listS3Files({
      prefix,
      maxKeys: params.maxKeys || 1000,
    })
  } catch (error) {
    console.error('WorkDrive list error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown list error',
    }
  }
}

/**
 * Check if file exists in WorkDrive
 */
export async function workDriveFileExists(s3Key: string): Promise<{
  exists: boolean
  size?: number
  lastModified?: Date
  error?: string
}> {
  return await fileExistsInS3(s3Key)
}

/**
 * Format bytes to human readable size
 * NOTE: For client-side use, import from '@/lib/workdrive/workdrive-utils' instead
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Calculate storage usage for a user
 */
export async function calculateUserStorageUsage(userId: string): Promise<{
  success: boolean
  totalBytes?: number
  fileCount?: number
  error?: string
}> {
  try {
    const result = await listWorkDriveFiles({
      userId,
      maxKeys: 10000,
    })

    if (!result.success || !result.files) {
      return {
        success: false,
        error: result.error || 'Failed to list files',
      }
    }

    const totalBytes = result.files.reduce((sum, file) => sum + file.size, 0)

    return {
      success: true,
      totalBytes,
      fileCount: result.files.length,
    }
  } catch (error) {
    console.error('Storage calculation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Validate file type against allowed types
 */
export function validateFileType(
  fileName: string,
  mimeType: string,
  allowedTypes: string[],
  blockedExtensions: string[]
): { valid: boolean; error?: string } {
  const extension = getFileExtension(fileName).toLowerCase()

  // Check blocked extensions
  if (blockedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not allowed for security reasons`,
    }
  }

  // Check allowed types
  if (allowedTypes.length > 0 && !allowedTypes.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not in the allowed list`,
    }
  }

  return { valid: true }
}

/**
 * Generate unique file name to avoid conflicts
 */
export function generateUniqueFileName(
  originalName: string,
  existingNames: string[]
): string {
  if (!existingNames.includes(originalName)) {
    return originalName
  }

  const extension = getFileExtension(originalName)
  const baseName = originalName.replace(`.${extension}`, '')

  let counter = 1
  let newName = `${baseName} (${counter}).${extension}`

  while (existingNames.includes(newName)) {
    counter++
    newName = `${baseName} (${counter}).${extension}`
  }

  return newName
}
