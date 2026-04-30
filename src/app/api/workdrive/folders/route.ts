
/**
 * WorkDrive Folders API
 * GET - List folders
 * POST - Create folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createFolder,
  getOrCreatePersonalWorkspace,
} from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/folders
 * List folders
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const parentFolderId = searchParams.get('parent_folder_id')

    // Get or create personal workspace if no workspace specified
    let effectiveWorkspaceId = workspaceId
    if (!effectiveWorkspaceId) {
      const { workspace } = await getOrCreatePersonalWorkspace(user.id)
      if (workspace) {
        effectiveWorkspaceId = workspace.id
      }
    }

    // Build query
    let query = supabase
      .from('workdrive_folders')
      .select('*')
      .order('name', { ascending: true })

    if (effectiveWorkspaceId) {
      query = query.eq('workspace_id', effectiveWorkspaceId)
    }

    if (parentFolderId) {
      query = query.eq('parent_folder_id', parentFolderId)
    } else {
      query = query.is('parent_folder_id', null)
    }

    const { data: folders, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      folders: folders || [],
    })
  } catch (error) {
    apiLogger.error('List folders error', error)
    return NextResponse.json(
      { error: 'Failed to list folders' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workdrive/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
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
    const { name, workspace_id, parent_folder_id, color } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate folder name in the same parent
    const { data: existingFolders } = await supabase
      .from('workdrive_folders')
      .select('id')
      .eq('name', name)
      .eq('owner_id', user.id)
      .eq('is_deleted', false)
      .eq('parent_folder_id', parent_folder_id || null)
      .limit(1)

    if (existingFolders && existingFolders.length > 0) {
      return NextResponse.json(
        { error: `A folder named "${name}" already exists in this location` },
        { status: 409 }
      )
    }

    // Get or create personal workspace if no workspace specified
    let effectiveWorkspaceId = workspace_id
    if (!effectiveWorkspaceId) {
      const { workspace } = await getOrCreatePersonalWorkspace(user.id)
      if (workspace) {
        effectiveWorkspaceId = workspace.id
      } else {
        return NextResponse.json(
          { error: 'Failed to get workspace' },
          { status: 500 }
        )
      }
    }

    const result = await createFolder(user.id, {
      workspace_id: effectiveWorkspaceId,
      parent_folder_id: parent_folder_id || undefined,
      name,
      color,
    })

    if (!result.folder) {
      return NextResponse.json(
        { error: result.error || 'Failed to create folder' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      folder: result.folder,
    })
  } catch (error) {
    apiLogger.error('Create folder error', error)
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
