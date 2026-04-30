import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/database-management/email/folders
 * Fetch all email folders with hierarchy
 */
export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams
    const parentId = searchParams.get('parent_id')

    let query = supabase
      .from('email_database_folders')
      .select('*')
      .order('name', { ascending: true })

    if (parentId) {
      query = query.eq('parent_folder_id', parentId)
    } else {
      query = query.is('parent_folder_id', null)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching email folders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/database-management/email/folders
 * Create new email folder
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
    const bodySchema = z.object({

      name: z.string(),

      parent_folder_id: z.string().uuid().optional(),

      description: z.string().optional(),

      color: z.string().optional(),

      icon: z.string().optional(),

      is_starred: z.boolean().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate name in same parent
    const { data: existing } = await supabase
      .from('email_database_folders')
      .select('id')
      .eq('name', body.name)
      .eq('parent_folder_id', body.parent_folder_id || null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Folder with this name already exists' },
        { status: 409 }
      )
    }

    // Insert folder
    const { data, error } = await supabase
      .from('email_database_folders')
      .insert({
        name: body.name,
        description: body.description,
        parent_folder_id: body.parent_folder_id || null,
        color: body.color || '#6B7280',
        icon: body.icon || 'folder',
        is_starred: body.is_starred || false,
        created_by: authResult.user?.id
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error creating email folder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
