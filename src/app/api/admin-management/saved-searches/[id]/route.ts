
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError, parseSupabaseError } from '@/lib/errors/api-errors'
import { uuidParamSchema, formatValidationErrors } from '@/lib/validation/admin-validation'
import { savedSearchSchema } from '@/lib/search/admin-search'

/**
 * DELETE /api/admin-management/saved-searches/[id]
 * Delete a saved search template
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid saved search ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    // Delete saved search
    const { error } = await supabase
      .from('admin_saved_searches')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Saved search deleted successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'delete saved search')
  }
}

/**
 * PUT /api/admin-management/saved-searches/[id]
 * Update a saved search template
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid saved search ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

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
        .neq('id', id)
    }

    // Update saved search
    const { data, error } = await supabase
      .from('admin_saved_searches')
      .update({
        name: savedSearch.name,
        description: savedSearch.description,
        filters: savedSearch.filters,
        is_default: savedSearch.isDefault || false,
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        savedSearch: data,
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'update saved search')
  }
}
