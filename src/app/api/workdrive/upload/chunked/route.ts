import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * WorkDrive Chunked Upload API
 * POST - Initialize, upload chunks, or complete chunked upload
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { formatFileSize, getOrCreatePersonalWorkspace, logAudit } from '@/lib/workdrive'
import { ROLE_QUOTA_DEFAULTS } from '@/types/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'loanz360-documents'
const MIN_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB minimum for S3 multipart

// In-memory store for upload sessions (in production, use Redis)
const uploadSessions: Map<string, {
  uploadId: string
  s3Key: string
  parts: Array<{ ETag: string; PartNumber: number }>
  userId: string
  fileName: string
  totalSize: number
  totalChunks: number
  uploadedChunks: number
  workspaceId: string
  folderId?: string
  mimeType: string
  createdAt: number
}> = new Map()

// Cleanup old sessions every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  uploadSessions.forEach((session, key) => {
    if (session.createdAt < oneHourAgo) {
      // Abort S3 upload
      s3Client.send(new AbortMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: session.s3Key,
        UploadId: session.uploadId,
      })).catch(() => { /* Non-critical side effect */ })
      uploadSessions.delete(key)
    }
  })
}, 60 * 60 * 1000)

async function getUserQuotaInfo(userId: string) {
  const { data: quota } = await supabase
    .from('workdrive_storage_quotas')
    .select('*')
    .eq('entity_type', 'user')
    .eq('entity_id', userId)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  const roleKey = profile?.sub_role?.toUpperCase().replace(/ /g, '_') || profile?.role
  const defaultQuota = ROLE_QUOTA_DEFAULTS[roleKey || 'CUSTOMER'] || ROLE_QUOTA_DEFAULTS.CUSTOMER

  const storageLimit = quota?.storage_limit_bytes ?? defaultQuota
  const storageUsed = quota?.storage_used_bytes ?? 0

  return {
    storageUsed,
    storageLimit,
    storageAvailable: storageLimit > 0 ? Math.max(0, storageLimit - storageUsed) : -1,
    isUnlimited: storageLimit < 0,
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
    if (rateLimitResponse) return rateLimitResponse
const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    // Handle multipart form data (chunk upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const action = formData.get('action') as string
      const sessionId = formData.get('sessionId') as string

      if (action === 'uploadChunk') {
        const chunk = formData.get('chunk') as File
        const chunkIndex = parseInt(formData.get('chunkIndex') as string)

        if (!sessionId || !chunk || isNaN(chunkIndex)) {
          return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        const session = uploadSessions.get(sessionId)
        if (!session) {
          return NextResponse.json({ success: false, error: 'Upload session not found' }, { status: 404 })
        }

        if (session.userId !== user.id) {
          return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
        }

        // Upload chunk to S3
        const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
        const partNumber = chunkIndex + 1

        const uploadPartResult = await s3Client.send(new UploadPartCommand({
          Bucket: BUCKET_NAME,
          Key: session.s3Key,
          UploadId: session.uploadId,
          PartNumber: partNumber,
          Body: chunkBuffer,
        }))

        session.parts.push({
          ETag: uploadPartResult.ETag!,
          PartNumber: partNumber,
        })
        session.uploadedChunks++

        return NextResponse.json({
          success: true,
          chunkIndex,
          uploadedChunks: session.uploadedChunks,
          totalChunks: session.totalChunks,
          progress: (session.uploadedChunks / session.totalChunks) * 100,
        })
      }
    }

    // Handle JSON requests (init and complete)
    const bodySchema = z.object({

      action: z.string().optional(),

      fileName: z.string().optional(),

      fileSize: z.string().optional(),

      mimeType: z.string().optional(),

      totalChunks: z.string().optional(),

      workspaceId: z.string().uuid().optional(),

      folderId: z.string().uuid().optional(),

      sessionId: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action } = body

    if (action === 'init') {
      const { fileName, fileSize, mimeType, totalChunks, workspaceId, folderId } = body

      if (!fileName || !fileSize || !mimeType || !totalChunks) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
      }

      // Check quota
      const quotaInfo = await getUserQuotaInfo(user.id)
      if (!quotaInfo.isUnlimited && fileSize > quotaInfo.storageAvailable) {
        return NextResponse.json({ success: false, error: 'Insufficient storage space',
          code: 'QUOTA_EXCEEDED',
          details: {
            fileSize,
            availableSpace: quotaInfo.storageAvailable,
          },
        }, { status: 400 })
      }

      // Check max file size (for chunked uploads, allow larger files - 5GB)
      const maxFileSizeBytes = 5 * 1024 * 1024 * 1024
      if (fileSize > maxFileSizeBytes) {
        return NextResponse.json({ success: false, error: 'File size exceeds maximum allowed size of 5GB',
          code: 'FILE_TOO_LARGE',
        }, { status: 400 })
      }

      // Get or create workspace
      let effectiveWorkspaceId = workspaceId
      if (!effectiveWorkspaceId) {
        const { workspace } = await getOrCreatePersonalWorkspace(user.id)
        if (workspace) effectiveWorkspaceId = workspace.id
      }

      if (!effectiveWorkspaceId) {
        return NextResponse.json({ success: false, error: 'Failed to get workspace' }, { status: 500 })
      }

      // Sanitize file name - check for Windows reserved names
      const WINDOWS_RESERVED_NAMES = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
      ]
      let safeFileName = fileName
      const baseNameForCheck = safeFileName.split('.')[0].toUpperCase()
      if (WINDOWS_RESERVED_NAMES.includes(baseNameForCheck)) {
        safeFileName = `_${safeFileName}`
      }
      // Remove null bytes and control characters
      safeFileName = safeFileName.replace(/[\x00-\x1f\x7f]/g, '')
      // Replace problematic characters
      safeFileName = safeFileName.replace(/[<>:"|?*\\\/]/g, '_')
      if (!safeFileName) safeFileName = 'unnamed_file'

      // Generate S3 key
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const sanitizedFileName = safeFileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const s3Key = `workdrive/users/${user.id}/${effectiveWorkspaceId}/${folderId || 'root'}/${timestamp}-${random}-${sanitizedFileName}`

      // Initialize S3 multipart upload
      const createUploadResult = await s3Client.send(new CreateMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: mimeType,
        Metadata: {
          userId: user.id,
          originalFileName: fileName,
          workspaceId: effectiveWorkspaceId,
          folderId: folderId || '',
        },
      }))

      const sessionId = `${user.id}-${timestamp}-${random}`

      uploadSessions.set(sessionId, {
        uploadId: createUploadResult.UploadId!,
        s3Key,
        parts: [],
        userId: user.id,
        fileName,
        totalSize: fileSize,
        totalChunks,
        uploadedChunks: 0,
        workspaceId: effectiveWorkspaceId,
        folderId,
        mimeType,
        createdAt: Date.now(),
      })

      return NextResponse.json({
        success: true,
        sessionId,
        uploadId: createUploadResult.UploadId,
        chunkSize: MIN_CHUNK_SIZE,
      })
    }

    if (action === 'complete') {
      const { sessionId } = body

      const session = uploadSessions.get(sessionId)
      if (!session) {
        return NextResponse.json({ success: false, error: 'Upload session not found' }, { status: 404 })
      }

      if (session.userId !== user.id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
      }

      // Sort parts by part number
      session.parts.sort((a, b) => a.PartNumber - b.PartNumber)

      // Complete multipart upload
      await s3Client.send(new CompleteMultipartUploadCommand({
        Bucket: BUCKET_NAME,
        Key: session.s3Key,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: session.parts,
        },
      }))

      // Create database record
      const fileExtension = session.fileName.split('.').pop()?.toLowerCase() || ''
      const fileCategory = getFileCategory(session.mimeType)

      const { data: newFile, error: dbError } = await supabase
        .from('workdrive_files')
        .insert({
          workspace_id: session.workspaceId,
          folder_id: session.folderId,
          name: session.fileName,
          original_name: session.fileName,
          file_type: fileExtension,
          file_category: fileCategory,
          mime_type: session.mimeType,
          file_size_bytes: session.totalSize,
          s3_key: session.s3Key,
          s3_bucket: BUCKET_NAME,
          s3_region: process.env.AWS_REGION || 'ap-south-1',
          created_by: user.id,
          modified_by: user.id,
          metadata: {
            upload_type: 'chunked',
            chunk_count: session.totalChunks,
          },
        })
        .select()
        .maybeSingle()

      if (dbError) {
        apiLogger.error('Database error', dbError)
        return NextResponse.json({ success: false, error: 'Failed to save file record' }, { status: 500 })
      }

      // Log audit
      await logAudit({
        userId: user.id,
        action: 'upload',
        resourceType: 'file',
        resourceId: newFile.id,
        resourceName: session.fileName,
        details: {
          file_size: session.totalSize,
          upload_type: 'chunked',
          chunk_count: session.totalChunks,
        },
      })

      // Cleanup session
      uploadSessions.delete(sessionId)

      return NextResponse.json({
        success: true,
        file: newFile,
      })
    }

    if (action === 'abort') {
      const { sessionId } = body

      const session = uploadSessions.get(sessionId)
      if (session && session.userId === user.id) {
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: BUCKET_NAME,
          Key: session.s3Key,
          UploadId: session.uploadId,
        })).catch(() => { /* Non-critical side effect */ })
        uploadSessions.delete(sessionId)
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Chunked upload error', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word')) return 'document'
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('compressed')) return 'archive'
  return 'other'
}
