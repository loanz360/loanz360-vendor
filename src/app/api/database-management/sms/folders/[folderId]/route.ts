export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/database-management/sms/folders/[folderId]
 * Get folder details with contact count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sms_database_folders')
      .select('*')
      .eq('id', params.folderId)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching SMS folder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/database-management/sms/folders/[folderId]
 * Update folder
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()

    // Update folder
    const { data, error } = await supabase
      .from('sms_database_folders')
      .update({
        name: body.name,
        description: body.description,
        color: body.color,
        icon: body.icon,
        is_starred: body.is_starred,
        is_archived: body.is_archived,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.folderId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating SMS folder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/database-management/sms/folders/[folderId]
 * Delete folder
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Check if folder has contacts
    const { count } = await supabase
      .from('sms_database_contact_folders')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', params.folderId)

    if (count && count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete folder with ${count} contact(s). Move or remove contacts first.`
        },
        { status: 400 }
      )
    }

    // Check if folder has subfolders
    const { data: subfolders } = await supabase
      .from('sms_database_folders')
      .select('id')
      .eq('parent_folder_id', params.folderId)

    if (subfolders && subfolders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete folder with ${subfolders.length} subfolder(s). Delete subfolders first.`
        },
        { status: 400 }
      )
    }

    // Delete folder
    const { error } = await supabase
      .from('sms_database_folders')
      .delete()
      .eq('id', params.folderId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error deleting SMS folder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
