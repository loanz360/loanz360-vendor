
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/database-management/email/contacts/assign-folder
 * Assign contacts to folder(s)
 */
export async function POST(request: NextRequest) {
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

    // Validate required fields
    if (!body.contact_ids || !Array.isArray(body.contact_ids) || body.contact_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    if (!body.folder_ids || !Array.isArray(body.folder_ids) || body.folder_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Folder IDs are required' },
        { status: 400 }
      )
    }

    // Create mappings
    const mappings = []
    for (const contactId of body.contact_ids) {
      for (const folderId of body.folder_ids) {
        mappings.push({
          contact_id: contactId,
          folder_id: folderId,
          added_by: authResult.user?.id
        })
      }
    }

    // Insert mappings (upsert to avoid duplicates)
    const { error } = await supabase
      .from('email_database_contact_folders')
      .upsert(mappings, {
        onConflict: 'contact_id,folder_id',
        ignoreDuplicates: true
      })

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Assigned ${body.contact_ids.length} contact(s) to ${body.folder_ids.length} folder(s)`
    })
  } catch (error: unknown) {
    apiLogger.error('Error assigning contacts to folders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/database-management/email/contacts/assign-folder
 * Remove contacts from folder(s)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await checkAuth(['SUPER_ADMIN'])
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const contactIds = searchParams.get('contact_ids')?.split(',')
    const folderIds = searchParams.get('folder_ids')?.split(',')

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    let query = supabase
      .from('email_database_contact_folders')
      .delete()
      .in('contact_id', contactIds)

    if (folderIds && folderIds.length > 0) {
      query = query.in('folder_id', folderIds)
    }

    const { error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Contacts removed from folder(s) successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error removing contacts from folders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
