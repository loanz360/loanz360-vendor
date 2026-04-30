import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * WorkDrive File Versions API
 * GET - Get version history for a file
 * POST - Create a new version (upload new file version)
 * PUT - Restore a previous version
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin, isSuperAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface FileVersion {
  id: string
  name: string
  version_number: number
  file_size_bytes: number
  s3_key: string
  created_by: string
  created_by_name?: string
  created_at: string
  is_current_version: boolean
  checksum?: string
  metadata?: Record<string, unknown>
}

/**
 * GET /api/workdrive/versions?fileId=xxx
 * Get version history for a file
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'File ID is required' }, { status: 400 })
    }

    // Get the current file to find the original name (to find all versions)
    const { data: currentFile, error: fileError } = await supabase
      .from('workdrive_files')
      .select('id, name, original_name, workspace_id, folder_id, previous_version_id')
      .eq('id', fileId)
      .maybeSingle()

    if (fileError || !currentFile) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
    }

    // Find the root file (first version) by traversing back
    let rootFileId = fileId
    let currentVersionId: string | null = currentFile.previous_version_id

    while (currentVersionId) {
      const { data: prevFile } = await supabase
        .from('workdrive_files')
        .select('id, previous_version_id')
        .eq('id', currentVersionId)
        .maybeSingle()

      if (!prevFile) break
      rootFileId = prevFile.id
      currentVersionId = prevFile.previous_version_id
    }

    // Now get all versions by following the chain forward
    // First, get all files with the same original_name in the same location
    const { data: allVersions, error: versionsError } = await supabase
      .from('workdrive_files')
      .select(`
        id,
        name,
        version_number,
        file_size_bytes,
        s3_key,
        created_by,
        created_at,
        is_current_version,
        checksum,
        metadata,
        previous_version_id,
        created_by_profile:profiles!workdrive_files_created_by_fkey(full_name, email)
      `)
      .eq('original_name', currentFile.original_name)
      .eq('workspace_id', currentFile.workspace_id)
      .is('folder_id', currentFile.folder_id)
      .eq('is_deleted', false)
      .order('version_number', { ascending: false })

    if (versionsError) {
      apiLogger.error('Error fetching versions', versionsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch versions' }, { status: 500 })
    }

    // Format response
    const versions: FileVersion[] = (allVersions || []).map((v: typeof allVersions[number]) => ({
      id: v.id,
      name: v.name,
      version_number: v.version_number,
      file_size_bytes: v.file_size_bytes,
      s3_key: v.s3_key,
      created_by: v.created_by,
      created_by_name: v.created_by_profile?.full_name || v.created_by_profile?.email || 'Unknown',
      created_at: v.created_at,
      is_current_version: v.is_current_version,
      checksum: v.checksum,
      metadata: v.metadata,
    }))

    // Get version settings
    const { data: settings } = await supabase
      .from('workdrive_admin_settings')
      .select('setting_value')
      .in('setting_key', ['max_versions_per_file', 'auto_versioning'])

    const maxVersions = settings?.find((s) => s.setting_key === 'max_versions_per_file')?.setting_value || '10'
    const autoVersioning = settings?.find((s) => s.setting_key === 'auto_versioning')?.setting_value || 'true'

    return NextResponse.json({
      versions,
      currentVersionId: fileId,
      totalVersions: versions.length,
      maxVersions: parseInt(maxVersions),
      autoVersioning: autoVersioning === 'true',
    })
  } catch (error) {
    apiLogger.error('Get versions error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/workdrive/versions
 * Restore a previous version
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const bodySchema = z.object({


      fileId: z.string().uuid(),


      versionId: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { fileId, versionId } = body

    if (!fileId || !versionId) {
      return NextResponse.json({ success: false, error: 'File ID and Version ID are required' }, { status: 400 })
    }

    // Get current file
    const { data: currentFile, error: currentError } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('id', fileId)
      .eq('is_current_version', true)
      .maybeSingle()

    if (currentError || !currentFile) {
      return NextResponse.json({ success: false, error: 'Current file not found' }, { status: 404 })
    }

    // Get version to restore
    const { data: versionToRestore, error: versionError } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('id', versionId)
      .maybeSingle()

    if (versionError || !versionToRestore) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    // Check permission - user must be file owner, admin, or super admin
    const canRestore =
      currentFile.created_by === user.id ||
      await isAdmin(user.id) ||
      await isSuperAdmin(user.id)

    if (!canRestore) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 })
    }

    // Start transaction - mark old current as not current
    const { error: updateOldError } = await supabase
      .from('workdrive_files')
      .update({ is_current_version: false })
      .eq('id', fileId)

    if (updateOldError) {
      apiLogger.error('Error updating old version', updateOldError)
      return NextResponse.json({ success: false, error: 'Failed to update old version' }, { status: 500 })
    }

    // Create a new file entry as the restored version (copy from old version)
    const newVersionNumber = currentFile.version_number + 1

    const { data: restoredFile, error: restoreError } = await supabase
      .from('workdrive_files')
      .insert({
        workspace_id: currentFile.workspace_id,
        folder_id: currentFile.folder_id,
        name: versionToRestore.name,
        original_name: currentFile.original_name,
        file_type: versionToRestore.file_type,
        file_category: versionToRestore.file_category,
        mime_type: versionToRestore.mime_type,
        file_size_bytes: versionToRestore.file_size_bytes,
        s3_key: versionToRestore.s3_key, // Reuse the same S3 key
        s3_bucket: versionToRestore.s3_bucket,
        s3_region: versionToRestore.s3_region,
        thumbnail_s3_key: versionToRestore.thumbnail_s3_key,
        version_number: newVersionNumber,
        is_current_version: true,
        previous_version_id: fileId,
        checksum: versionToRestore.checksum,
        is_compressed: versionToRestore.is_compressed,
        compression_ratio: versionToRestore.compression_ratio,
        created_by: user.id,
        modified_by: user.id,
        metadata: {
          ...versionToRestore.metadata,
          restored_from_version: versionToRestore.version_number,
          restored_at: new Date().toISOString(),
          restored_by: user.id,
        },
        tags: currentFile.tags,
      })
      .select()
      .maybeSingle()

    if (restoreError) {
      // Rollback - restore old current version flag
      await supabase
        .from('workdrive_files')
        .update({ is_current_version: true })
        .eq('id', fileId)

      apiLogger.error('Error creating restored version', restoreError)
      return NextResponse.json({ success: false, error: 'Failed to restore version' }, { status: 500 })
    }

    // Log audit
    await supabase.from('workdrive_audit_logs').insert({
      user_id: user.id,
      action: 'version_restore',
      resource_type: 'file',
      resource_id: restoredFile.id,
      resource_name: restoredFile.name,
      details: {
        original_version: versionToRestore.version_number,
        new_version: newVersionNumber,
        restored_from_id: versionId,
        previous_current_id: fileId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Restored to version ${versionToRestore.version_number}`,
      newFile: {
        id: restoredFile.id,
        name: restoredFile.name,
        version_number: restoredFile.version_number,
      },
    })
  } catch (error) {
    apiLogger.error('Restore version error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/workdrive/versions?versionId=xxx
 * Delete a specific version (not the current one)
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const { searchParams } = new URL(request.url)
    const versionId = searchParams.get('versionId')

    if (!versionId) {
      return NextResponse.json({ success: false, error: 'Version ID is required' }, { status: 400 })
    }

    // Get version to delete
    const { data: version, error: versionError } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('id', versionId)
      .maybeSingle()

    if (versionError || !version) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 })
    }

    // Can't delete current version
    if (version.is_current_version) {
      return NextResponse.json({ success: false, error: 'Cannot delete current version. Upload a new version first.'
      }, { status: 400 })
    }

    // Check permission - user must be file owner, admin, or super admin
    const canDelete =
      version.created_by === user.id ||
      await isAdmin(user.id) ||
      await isSuperAdmin(user.id)

    if (!canDelete) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 })
    }

    // Update any files that reference this version as previous
    await supabase
      .from('workdrive_files')
      .update({ previous_version_id: version.previous_version_id })
      .eq('previous_version_id', versionId)

    // Soft delete the version (mark as deleted)
    const { error: deleteError } = await supabase
      .from('workdrive_files')
      .update({
        is_deleted: true,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', versionId)

    if (deleteError) {
      apiLogger.error('Error deleting version', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete version' }, { status: 500 })
    }

    // Log audit
    await supabase.from('workdrive_audit_logs').insert({
      user_id: user.id,
      action: 'delete',
      resource_type: 'file',
      resource_id: versionId,
      resource_name: version.name,
      details: {
        version_number: version.version_number,
        action_type: 'version_delete',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Version ${version.version_number} deleted`,
    })
  } catch (error) {
    apiLogger.error('Delete version error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
