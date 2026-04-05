export const dynamic = 'force-dynamic'

/**
 * WorkDrive Trash File Permanent Delete API
 * DELETE - Permanently delete a file from trash
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteWorkDriveFile, logAudit } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ fileId: string }>
}

/**
 * DELETE /api/workdrive/trash/[fileId]
 * Permanently delete a file from trash
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { fileId } = await params

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the file exists, is deleted, and belongs to the user
    const { data: file, error: fetchError } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('id', fileId)
      .eq('is_deleted', true)
      .eq('deleted_by', user.id)
      .maybeSingle()

    if (fetchError || !file) {
      return NextResponse.json(
        { error: 'File not found in trash' },
        { status: 404 }
      )
    }

    // Delete from S3
    await deleteWorkDriveFile({
      s3Key: file.s3_key,
      thumbnailS3Key: file.thumbnail_s3_key,
    })

    // Delete from database permanently
    const { error: deleteError } = await supabase
      .from('workdrive_files')
      .delete()
      .eq('id', fileId)

    if (deleteError) {
      apiLogger.error('Permanent delete DB error', deleteError)
      return NextResponse.json(
        { error: 'Failed to permanently delete file' },
        { status: 500 }
      )
    }

    // Update storage quota
    const { data: quota } = await supabase
      .from('workdrive_storage_quotas')
      .select('*')
      .eq('entity_type', 'user')
      .eq('entity_id', user.id)
      .maybeSingle()

    if (quota) {
      await supabase
        .from('workdrive_storage_quotas')
        .update({
          storage_used_bytes: Math.max(0, (quota.storage_used_bytes || 0) - (file.file_size_bytes || 0)),
          file_count: Math.max(0, (quota.file_count || 0) - 1),
        })
        .eq('entity_type', 'user')
        .eq('entity_id', user.id)
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'permanent_delete',
      resourceType: 'file',
      resourceId: fileId,
      resourceName: file.name,
      details: { file_size: file.file_size_bytes },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Permanent delete file error', error)
    return NextResponse.json(
      { error: 'Failed to permanently delete file' },
      { status: 500 }
    )
  }
}
