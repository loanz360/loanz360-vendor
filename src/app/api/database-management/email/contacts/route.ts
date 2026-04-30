import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/database-management/email/contacts
 * Fetch email contacts with pagination, search, and filters
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

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Search
    const search = searchParams.get('search') || ''

    // Filters
    const folderId = searchParams.get('folder_id')
    const status = searchParams.get('status')
    const tag = searchParams.get('tag')

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    // Build query
    let query = supabase
      .from('email_database_contacts')
      .select('*, folders:email_database_contact_folders(folder:email_database_folders(*))', { count: 'exact' })

    // Apply search
    if (search) {
      const sanitizedSearch = search.substring(0, 100)
      query = query.or(`email.ilike.%${sanitizedSearch}%,name.ilike.%${sanitizedSearch}%,company.ilike.%${sanitizedSearch}%`)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (tag) {
      query = query.contains('tags', [tag])
    }

    if (folderId) {
      // Filter by folder - need to join through contact_folders
      const { data: contactsInFolder } = await supabase
        .from('email_database_contact_folders')
        .select('contact_id')
        .eq('folder_id', folderId)

      if (contactsInFolder) {
        const contactIds = contactsInFolder.map(c => c.contact_id)
        if (contactIds.length > 0) {
          query = query.in('id', contactIds)
        } else {
          // No contacts in this folder
          return NextResponse.json({
            success: true,
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0
            }
          })
        }
      }
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching email contacts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/database-management/email/contacts
 * Create new email contact
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('email_database_contacts')
      .select('id')
      .eq('email', body.email.toLowerCase().trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      )
    }

    // Insert contact
    const { data, error } = await supabase
      .from('email_database_contacts')
      .insert({
        email: body.email.toLowerCase().trim(),
        name: body.name,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        company: body.company,
        designation: body.designation,
        location_city: body.location_city,
        location_state: body.location_state,
        website: body.website,
        linkedin_url: body.linkedin_url,
        notes: body.notes,
        tags: body.tags || [],
        custom_fields: body.custom_fields || {},
        source: body.source || 'manual_entry',
        source_reference_id: authResult.user?.id,
        source_reference_type: 'super_admin'
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // If folder_ids provided, add to folders
    if (body.folder_ids && Array.isArray(body.folder_ids)) {
      const folderMappings = body.folder_ids.map((folderId: string) => ({
        contact_id: data.id,
        folder_id: folderId,
        added_by: authResult.user?.id
      }))

      await supabase
        .from('email_database_contact_folders')
        .insert(folderMappings)
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error creating email contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/database-management/email/contacts
 * Bulk delete email contacts
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
    const ids = searchParams.get('ids')

    if (!ids) {
      return NextResponse.json(
        { success: false, error: 'Contact IDs are required' },
        { status: 400 }
      )
    }

    const contactIds = ids.split(',')

    const supabase = await createClient()

    // Delete folder mappings first
    await supabase
      .from('email_database_contact_folders')
      .delete()
      .in('contact_id', contactIds)

    // Delete contacts
    const { error } = await supabase
      .from('email_database_contacts')
      .delete()
      .in('id', contactIds)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Deleted ${contactIds.length} contact(s)`
    })
  } catch (error: unknown) {
    apiLogger.error('Error deleting email contacts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
