
/**
 * WorkDrive File Download API
 * GET - Download file (returns presigned URL)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getFile,
  getWorkDriveFileUrl,
  trackFileAccess,
  logAudit,
  checkPermission,
} from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ fileId: string }>
}

/**
 * GET /api/workdrive/files/[fileId]/download
 * Get download URL for file
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params

    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permission = await checkPermission({
      userId: user.id,
      resourceType: 'file',
      resourceId: fileId,
    })

    if (!permission.can_download) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Get file details
    const fileResult = await getFile(fileId)

    if (!fileResult.file) {
      return NextResponse.json(
        { error: fileResult.error || 'File not found' },
        { status: 404 }
      )
    }

    // Generate presigned URL
    const urlResult = await getWorkDriveFileUrl({
      s3Key: fileResult.file.s3_key,
      expiresIn: 3600, // 1 hour
    })

    if (!urlResult.success || !urlResult.url) {
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    // Track file access
    await trackFileAccess(user.id, fileId, 'download')

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'download',
      resourceType: 'file',
      resourceId: fileId,
      resourceName: fileResult.file.name,
      details: {
        file_size: fileResult.file.file_size_bytes,
        file_type: fileResult.file.file_type,
      },
    })

    return NextResponse.json({
      success: true,
      download_url: urlResult.url,
      expires_at: urlResult.expiresAt,
      file_name: fileResult.file.name,
      file_size: fileResult.file.file_size_bytes,
      mime_type: fileResult.file.mime_type,
    })
  } catch (error) {
    apiLogger.error('Download file error', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}
