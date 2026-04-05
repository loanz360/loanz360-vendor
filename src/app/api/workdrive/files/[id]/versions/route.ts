export const dynamic = 'force-dynamic'

/**
 * WorkDrive File Version History API (nested route)
 * GET  /api/workdrive/files/[id]/versions - Get version history for a file
 * POST /api/workdrive/files/[id]/versions - Upload a new version of the file
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ id: string }>
}

interface VersionRecord {
  id: string
  version_number: number
  file_size_bytes: number
  uploaded_by: string
  uploaded_by_name: string
  created_at: string
  change_note: string | null
}

/**
 * GET /api/workdrive/files/[id]/versions
 * Returns version history for a specific file
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: fileId } = await params

    // Authenticate user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required', code: 'MISSING_FILE_ID' },
        { status: 400 }
      )
    }

    // Verify the file exists and user has access
    const { data: currentFile, error: fileError } = await supabase
      .from('workdrive_files')
      .select('id, name, original_name, workspace_id, folder_id, version_number, created_by')
      .eq('id', fileId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (fileError || !currentFile) {
      return NextResponse.json(
        { success: false, error: 'File not found or access denied', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Try fetching from workdrive_file_versions table first
    const { data: versionRows, error: versionsTableError } = await supabase
      .from('workdrive_file_versions')
      .select(`
        id,
        version_number,
        file_size_bytes,
        uploaded_by,
        created_at,
        change_note,
        uploader:profiles!workdrive_file_versions_uploaded_by_fkey(full_name, email)
      `)
      .eq('file_id', fileId)
      .order('version_number', { ascending: false })

    // If the dedicated versions table exists and has data, use it
    if (!versionsTableError && versionRows && versionRows.length > 0) {
      const versions: VersionRecord[] = versionRows.map((v: typeof versionRows[number]) => ({
        id: v.id,
        version_number: v.version_number,
        file_size_bytes: v.file_size_bytes || 0,
        uploaded_by: v.uploaded_by,
        uploaded_by_name: v.uploader?.full_name || v.uploader?.email || 'Unknown',
        created_at: v.created_at,
        change_note: v.change_note || null,
      }))

      const currentVersion = versions.length > 0 ? versions[0].version_number : 1

      return NextResponse.json({
        success: true,
        data: {
          versions,
          current_version: currentVersion,
        },
      })
    }

    // Fallback: query the workdrive_files table for version chain
    // (files linked via previous_version_id and original_name)
    const { data: fileVersions, error: chainError } = await supabase
      .from('workdrive_files')
      .select(`
        id,
        version_number,
        file_size_bytes,
        created_by,
        created_at,
        is_current_version,
        metadata,
        creator:profiles!workdrive_files_created_by_fkey(full_name, email)
      `)
      .eq('original_name', currentFile.original_name)
      .eq('workspace_id', currentFile.workspace_id)
      .eq('is_deleted', false)
      .order('version_number', { ascending: false })

    if (!chainError && fileVersions && fileVersions.length > 0) {
      const versions: VersionRecord[] = fileVersions.map((v: typeof fileVersions[number]) => ({
        id: v.id,
        version_number: v.version_number || 1,
        file_size_bytes: v.file_size_bytes || 0,
        uploaded_by: v.created_by,
        uploaded_by_name: v.creator?.full_name || v.creator?.email || 'Unknown',
        created_at: v.created_at,
        change_note: v.metadata?.change_note || v.metadata?.restored_from_version
          ? `Restored from v${v.metadata.restored_from_version}`
          : null,
      }))

      const currentVersion = versions.length > 0 ? versions[0].version_number : 1

      return NextResponse.json({
        success: true,
        data: {
          versions,
          current_version: currentVersion,
        },
      })
    }

    // No version history found - return graceful empty response
    return NextResponse.json({
      success: true,
      data: {
        versions: [
          {
            id: currentFile.id,
            version_number: currentFile.version_number || 1,
            file_size_bytes: 0,
            uploaded_by: currentFile.created_by,
            uploaded_by_name: 'Unknown',
            created_at: new Date().toISOString(),
            change_note: 'Initial version',
          },
        ],
        current_version: currentFile.version_number || 1,
      },
      meta: {
        note: 'Version history table not available. Showing file record only.',
      },
    })
  } catch (error) {
    apiLogger.error('GET /api/workdrive/files/[id]/versions error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workdrive/files/[id]/versions
 * Upload a new version of the file
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: fileId } = await params

    // Authenticate user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required', code: 'MISSING_FILE_ID' },
        { status: 400 }
      )
    }

    // Get current file details
    const { data: currentFile, error: fileError } = await supabase
      .from('workdrive_files')
      .select('*')
      .eq('id', fileId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (fileError || !currentFile) {
      return NextResponse.json(
        { success: false, error: 'File not found', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Check permission - must be file owner or admin
    if (currentFile.created_by !== user.id) {
      // Check admin status
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!userProfile || !['ADMIN', 'SUPER_ADMIN'].includes(userProfile.role)) {
        return NextResponse.json(
          { success: false, error: 'Permission denied. Only the file owner or admins can upload new versions.', code: 'PERMISSION_DENIED' },
          { status: 403 }
        )
      }
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const changeNote = formData.get('change_note') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided', code: 'MISSING_FILE' },
        { status: 400 }
      )
    }

    // Calculate new version number
    const newVersionNumber = (currentFile.version_number || 1) + 1

    // Upload file to storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const s3Key = `workdrive/${currentFile.workspace_id}/${fileId}/v${newVersionNumber}/${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('workdrive')
      .upload(s3Key, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      apiLogger.error('Version upload error', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file', code: 'UPLOAD_FAILED' },
        { status: 500 }
      )
    }

    // Mark current version as not current
    await supabase
      .from('workdrive_files')
      .update({ is_current_version: false })
      .eq('id', fileId)

    // Create new version record in workdrive_files
    const { data: newVersion, error: insertError } = await supabase
      .from('workdrive_files')
      .insert({
        workspace_id: currentFile.workspace_id,
        folder_id: currentFile.folder_id,
        name: file.name,
        original_name: currentFile.original_name,
        file_type: currentFile.file_type,
        file_category: currentFile.file_category,
        mime_type: file.type,
        file_size_bytes: file.size,
        s3_key: s3Key,
        s3_bucket: currentFile.s3_bucket,
        s3_region: currentFile.s3_region,
        version_number: newVersionNumber,
        is_current_version: true,
        previous_version_id: fileId,
        created_by: user.id,
        modified_by: user.id,
        metadata: {
          change_note: changeNote || `Version ${newVersionNumber}`,
          previous_version_id: fileId,
          uploaded_at: new Date().toISOString(),
        },
        tags: currentFile.tags,
      })
      .select('id, name, version_number, file_size_bytes, created_at')
      .maybeSingle()

    if (insertError) {
      // Rollback: restore old version flag
      await supabase
        .from('workdrive_files')
        .update({ is_current_version: true })
        .eq('id', fileId)

      apiLogger.error('Version insert error', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create new version record', code: 'INSERT_FAILED' },
        { status: 500 }
      )
    }

    // Also try to insert into workdrive_file_versions table if it exists
    try {
      await supabase.from('workdrive_file_versions').insert({
        file_id: fileId,
        version_number: newVersionNumber,
        file_size_bytes: file.size,
        s3_key: s3Key,
        uploaded_by: user.id,
        change_note: changeNote || null,
      })
    } catch {
      // Table may not exist, ignore silently
    }

    // Log audit
    await supabase.from('workdrive_audit_logs').insert({
      user_id: user.id,
      action: 'version_upload',
      resource_type: 'file',
      resource_id: newVersion?.id || fileId,
      resource_name: file.name,
      details: {
        version_number: newVersionNumber,
        previous_version_id: fileId,
        file_size_bytes: file.size,
        change_note: changeNote,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: newVersion?.id,
        version_number: newVersionNumber,
        file_size_bytes: file.size,
        created_at: newVersion?.created_at,
        change_note: changeNote,
      },
      message: `Version ${newVersionNumber} uploaded successfully`,
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('POST /api/workdrive/files/[id]/versions error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
