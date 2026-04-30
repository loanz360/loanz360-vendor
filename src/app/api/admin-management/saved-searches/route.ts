
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { savedSearchSchema } from '@/lib/search/admin-search'

/**
 * GET /api/admin-management/saved-searches
 * Get all saved search templates
 */

export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Fetch all saved searches
    const { data: savedSearches, error } = await supabase
      .from('admin_saved_searches')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return NextResponse.json(
          {
            success: true,
            savedSearches: [],
            message: 'Saved searches table not yet created',
          },
          { status: 200 }
        )
      }
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        savedSearches: savedSearches || [],
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch saved searches')
  }
}

/**
 * POST /api/admin-management/saved-searches
 * Create a new saved search template
 */

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Parse and validate request body
    const body = await request.json()
    const validation = savedSearchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid saved search data',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const savedSearch = validation.data

    // If marking as default, unset other defaults first
    if (savedSearch.isDefault) {
      await supabase
        .from('admin_saved_searches')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    // Insert saved search
    const { data, error } = await supabase
      .from('admin_saved_searches')
      .insert({
        name: savedSearch.name,
        description: savedSearch.description,
        filters: savedSearch.filters,
        is_default: savedSearch.isDefault || false,
        created_by: savedSearch.createdBy,
      })
      .select()
      .maybeSingle()

    if (error) {
      // If table doesn't exist, provide helpful error
      if (error.code === '42P01') {
        return NextResponse.json(
          {
            success: false,
            error: 'Saved searches table not yet created. Please run database migrations.',
          },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        savedSearch: data,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error, 'create saved search')
  }
}
