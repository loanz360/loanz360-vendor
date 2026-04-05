import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { searchParams } = new URL(request.url)

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Filter parameters
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const supabase = await createClient()

    // SECURITY FIX CRITICAL-02: Check authentication and authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is SUPER_ADMIN
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized database access attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/contacts'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('contacts')
      .select(`
        *,
        category:categories(id, name),
        source_file:files(id, file_name)
      `, { count: 'exact' })

    // Apply search filter
    // SECURITY FIX CRITICAL-06: Sanitize search input to prevent SQL injection
    if (search) {
      // Escape special ILIKE characters (%, _) and limit length
      const sanitizedSearch = search
        .slice(0, 100) // Limit to 100 characters
        .replace(/[%_]/g, '\\$&') // Escape % and _ characters

      query = query.or(`full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%,company.ilike.%${sanitizedSearch}%`)
    }

    // Apply category filter
    if (category) {
      query = query.eq('category_id', category)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: contacts, error, count } = await query

    if (error) {
      logger.error('Contacts fetch error', error instanceof Error ? error : undefined, {
        context: 'contacts-GET',
        page,
        limit
      })
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: contacts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    logger.error('Contacts API error', error instanceof Error ? error : undefined, {
      context: 'contacts-GET'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',') || []

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No contact IDs provided' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // SECURITY FIX CRITICAL-02: Check authentication and authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is SUPER_ADMIN
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized database delete attempt', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/database/contacts DELETE'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', ids)

    if (error) {
      logger.error('Delete contacts error', error instanceof Error ? error : undefined, {
        context: 'contacts-DELETE',
        idsCount: ids.length
      })
      return NextResponse.json(
        { error: 'Failed to delete contacts' },
        { status: 500 }
      )
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      action: 'DELETE_CONTACTS',
      entity_type: 'CONTACT',
      details: { deleted_count: ids.length }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${ids.length} contact(s)`
    })

  } catch (error) {
    logger.error('Delete contacts error', error instanceof Error ? error : undefined, {
      context: 'contacts-DELETE'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
