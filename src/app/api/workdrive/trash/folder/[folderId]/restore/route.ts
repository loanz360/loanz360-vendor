export const dynamic = 'force-dynamic'

/**
 * WorkDrive Trash Folder Restore API
 * POST - Restore folder from trash
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
  params: Promise<{ folderId: string }>
}

/**
 * POST /api/workdrive/trash/folder/[folderId]/restore
 * Restore folder from trash
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Restore the folder
    const { error: updateError } = await supabase
      .from('workdrive_folders')
      .update({
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', folderId)

    if (updateError) {
      apiLogger.error('Restore folder DB error', updateError)
      return NextResponse.json(
        { error: 'Failed to restore folder' },
        { status: 500 }
      )
    }

    // Also restore files within this folder
    await supabase
      .from('workdrive_files')
      .update({
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
      })
      .eq('folder_id', folderId)
      .eq('is_deleted', true)
      .eq('deleted_by', user.id)

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'restore',
      resourceType: 'folder',
      resourceId: folderId,
      resourceName: folder.name,
      details: { restored_from: 'trash' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Restore folder error', error)
    return NextResponse.json(
      { error: 'Failed to restore folder' },
      { status: 500 }
    )
  }
}
