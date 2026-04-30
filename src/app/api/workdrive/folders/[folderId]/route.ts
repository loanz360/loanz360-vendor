
/**
 * WorkDrive Folder Operations API
 * GET - Get folder details
 * PUT - Update folder (rename)
 * DELETE - Delete folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteFolder, logAudit, checkPermission } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ folderId: string }>
}

/**
 * GET /api/workdrive/folders/[folderId]
 * Get folder details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params

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

    const { data: folder, error } = await supabase
      .from('workdrive_folders')
      .select('*')
      .eq('id', folderId)
      .maybeSingle()

    if (error || !folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      )
    }

    // Get folder stats
    const [filesCount, foldersCount] = await Promise.all([
      supabase
        .from('workdrive_files')
        .select('id', { count: 'exact', head: true })
        .eq('folder_id', folderId)
        .eq('is_deleted', false),
      supabase
        .from('workdrive_folders')
        .select('id', { count: 'exact', head: true })
        .eq('parent_folder_id', folderId),
    ])

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        file_count: filesCount.count || 0,
        folder_count: foldersCount.count || 0,
      },
    })
  } catch (error) {
    apiLogger.error('Get folder error', error)
    return NextResponse.json(
      { error: 'Failed to get folder' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/workdrive/folders/[folderId]
 * Update folder (rename, change color)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params

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

    const body = await request.json()
    const { name, color } = body

    // Check permission
    const permission = await checkPermission({
      userId: user.id,
      resourceType: 'folder',
      resourceId: folderId,
    })

    if (!permission.can_edit) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Get current folder
    const { data: folder } = await supabase
      .from('workdrive_folders')
      .select('name')
      .eq('id', folderId)
      .maybeSingle()

    // Update folder
    const updateData: Record<string, string> = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (color) updateData.color = color

    const { error } = await supabase
      .from('workdrive_folders')
      .update(updateData)
      .eq('id', folderId)

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 400 }
      )
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'rename',
      resourceType: 'folder',
      resourceId: folderId,
      resourceName: name || folder?.name,
      details: { old_name: folder?.name, new_name: name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Update folder error', error)
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workdrive/folders/[folderId]
 * Delete folder
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params

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
      resourceType: 'folder',
      resourceId: folderId,
    })

    if (!permission.can_delete) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Check if folder has contents
    const [filesCount, foldersCount] = await Promise.all([
      supabase
        .from('workdrive_files')
        .select('id', { count: 'exact', head: true })
        .eq('folder_id', folderId)
        .eq('is_deleted', false),
      supabase
        .from('workdrive_folders')
        .select('id', { count: 'exact', head: true })
        .eq('parent_folder_id', folderId),
    ])

    if ((filesCount.count || 0) > 0 || (foldersCount.count || 0) > 0) {
      return NextResponse.json(
        { error: 'Folder is not empty. Delete contents first.' },
        { status: 400 }
      )
    }

    const result = await deleteFolder(user.id, folderId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete folder' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Delete folder error', error)
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
