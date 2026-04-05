export const dynamic = 'force-dynamic'

/**
 * WorkDrive Trash Folder Permanent Delete API
 * DELETE - Permanently delete a folder from trash
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
  params: Promise<{ folderId: string }>
}

/**
 * DELETE /api/workdrive/trash/folder/[folderId]
 * Permanently delete a folder from trash along with its files
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the folder exists, is deleted, and belongs to the user
    const { data: folder, error: fetchError } = await supabase
      .from('workdrive_folders')
      .select('*')
      .eq('id', folderId)
      .eq('is_deleted', true)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (fetchError || !folder) {
      return NextResponse.json(
        { error: 'Folder not found in trash' },
        { status: 404 }
      )
    }

    // Get all files in this folder to delete from S3
    const { data: folderFiles } = await supabase
      .from('workdrive_files')
      .select('id, s3_key, thumbnail_s3_key, file_size_bytes')
      .eq('folder_id', folderId)

    let totalFreedBytes = 0

    // Delete files from S3
    if (folderFiles && folderFiles.length > 0) {
      for (const file of folderFiles) {
        await deleteWorkDriveFile({
          s3Key: file.s3_key,
          thumbnailS3Key: file.thumbnail_s3_key,
        })
        totalFreedBytes += file.file_size_bytes || 0
      }

      // Delete files from database
      await supabase
        .from('workdrive_files')
        .delete()
        .eq('folder_id', folderId)
    }

    // Delete folder from database
    const { error: deleteError } = await supabase
      .from('workdrive_folders')
      .delete()
      .eq('id', folderId)

    if (deleteError) {
      apiLogger.error('Permanent delete folder DB error', deleteError)
      return NextResponse.json(
        { error: 'Failed to permanently delete folder' },
        { status: 500 }
      )
    }

    // Update storage quota
    if (totalFreedBytes > 0) {
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
            storage_used_bytes: Math.max(0, (quota.storage_used_bytes || 0) - totalFreedBytes),
            file_count: Math.max(0, (quota.file_count || 0) - (folderFiles?.length || 0)),
          })
          .eq('entity_type', 'user')
          .eq('entity_id', user.id)
      }
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'permanent_delete',
      resourceType: 'folder',
      resourceId: folderId,
      resourceName: folder.name,
      details: {
        files_deleted: folderFiles?.length || 0,
        bytes_freed: totalFreedBytes,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Permanent delete folder error', error)
    return NextResponse.json(
      { error: 'Failed to permanently delete folder' },
      { status: 500 }
    )
  }
}
