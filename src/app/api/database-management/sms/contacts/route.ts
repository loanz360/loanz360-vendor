import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth/check-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/database-management/sms/contacts
 * Fetch SMS/mobile contacts with pagination, search, and filters
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
    const isDnd = searchParams.get('is_dnd')

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    // Build query
    let query = supabase
      .from('sms_database_contacts')
      .select('*, folders:sms_database_contact_folders(folder:sms_database_folders(*))', { count: 'exact' })

    // Apply search
    if (search) {
      const sanitizedSearch = search.substring(0, 100)
      query = query.or(`mobile_number.ilike.%${sanitizedSearch}%,name.ilike.%${sanitizedSearch}%,company.ilike.%${sanitizedSearch}%`)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (tag) {
      query = query.contains('tags', [tag])
    }

    if (isDnd) {
      query = query.eq('is_dnd', isDnd === 'true')
    }

    if (folderId) {
      // Filter by folder
      const { data: contactsInFolder } = await supabase
        .from('sms_database_contact_folders')
        .select('contact_id')
        .eq('folder_id', folderId)

      if (contactsInFolder) {
        const contactIds = contactsInFolder.map(c => c.contact_id)
        if (contactIds.length > 0) {
          query = query.in('id', contactIds)
        } else {
          return NextResponse.json({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
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
    apiLogger.error('Error fetching SMS contacts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/database-management/sms/contacts
 * Create new SMS contact
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

      mobile_number: z.string().min(10),

      country_code: z.string().optional(),

      name: z.string().optional(),

      alternate_number: z.string().optional(),

      company: z.string().optional(),

      designation: z.string().optional(),

      location_city: z.string().optional(),

      location_state: z.string().optional(),

      notes: z.string().optional(),

      tags: z.array(z.unknown()).optional(),

      custom_fields: z.string().optional(),

      source: z.string().optional(),

      folder_ids: z.array(z.unknown()).optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.mobile_number) {
      return NextResponse.json(
        { success: false, error: 'Mobile number is required' },
        { status: 400 }
      )
    }

    // Clean mobile number
    const cleanedNumber = body.mobile_number.replace(/[^0-9]/g, '')

    if (cleanedNumber.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number (minimum 10 digits)' },
        { status: 400 }
      )
    }

    // Check if mobile number already exists
    const { data: existing } = await supabase
      .from('sms_database_contacts')
      .select('id')
      .eq('mobile_number', cleanedNumber)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Mobile number already exists' },
        { status: 409 }
      )
    }

    // Insert contact
    const { data, error } = await supabase
      .from('sms_database_contacts')
      .insert({
        mobile_number: cleanedNumber,
        country_code: body.country_code || '+91',
        name: body.name,
        alternate_number: body.alternate_number,
        company: body.company,
        designation: body.designation,
        location_city: body.location_city,
        location_state: body.location_state,
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
        .from('sms_database_contact_folders')
        .insert(folderMappings)
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error creating SMS contact', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/database-management/sms/contacts
 * Bulk delete SMS contacts
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
      .from('sms_database_contact_folders')
      .delete()
      .in('contact_id', contactIds)

    // Delete contacts
    const { error } = await supabase
      .from('sms_database_contacts')
      .delete()
      .in('id', contactIds)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `Deleted ${contactIds.length} contact(s)`
    })
  } catch (error: unknown) {
    apiLogger.error('Error deleting SMS contacts', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
