
/**
 * WorkDrive Trash API
 * GET - List trash items (files and folders)
 * DELETE - Empty trash
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTrashFiles, emptyTrash } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/trash
 * List files and folders in trash
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
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

    // Get trashed files
    const result = await getTrashFiles(user.id)

    // Get trashed folders
    const { data: trashedFolders, error: foldersError } = await supabase
      .from('workdrive_folders')
      .select('*')
      .eq('is_deleted', true)
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      files: result.files,
      folders: trashedFolders || [],
    })
  } catch (error) {
    apiLogger.error('Get trash error', error)
    return NextResponse.json(
      { error: 'Failed to get trash' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workdrive/trash
 * Empty trash
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
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

    const result = await emptyTrash(user.id)

    // Also permanently delete trashed folders
    await supabase
      .from('workdrive_folders')
      .delete()
      .eq('is_deleted', true)
      .eq('owner_id', user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to empty trash' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted_count: result.count,
    })
  } catch (error) {
    apiLogger.error('Empty trash error', error)
    return NextResponse.json(
      { error: 'Failed to empty trash' },
      { status: 500 }
    )
  }
}
