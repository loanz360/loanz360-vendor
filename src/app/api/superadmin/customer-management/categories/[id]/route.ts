
/**
 * Customer Category Management API - Single Category Operations
 * SuperAdmin endpoint for managing individual categories
 *
 * GET    - Fetch single category by ID
 * PUT    - Update category
 * DELETE - Delete category (soft delete or cascade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for update
const updateCategorySchema = z.object({
  category_name: z.string().min(1).max(255).optional(),
  category_description: z.string().optional().nullable(),
  display_order: z.number().optional(),
  icon_name: z.string().max(50).optional().nullable(),
  color_code: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
  required_documents: z.array(z.string()).optional(),
  additional_fields: z.array(z.object({
    field_key: z.string(),
    field_name: z.string(),
    field_type: z.string(),
    is_required: z.boolean().optional()
  })).optional()
})

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/superadmin/customer-management/categories/[id]
 * Fetch single category with its children
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Fetch category
    const { data: category, error } = await supabase
      .from('customer_category_definitions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    // Fetch children if this is not a level 3 category
    let children: any[] = []
    if (category.level < 3) {
      const { data: childCategories } = await supabase
        .from('customer_category_definitions')
        .select('*')
        .eq('parent_id', id)
        .order('display_order', { ascending: true })

      children = childCategories || []
    }

    // Fetch parent if exists
    let parent = null
    if (category.parent_id) {
      const { data: parentCategory } = await supabase
        .from('customer_category_definitions')
        .select('id, category_key, category_name, level')
        .eq('id', category.parent_id)
        .maybeSingle()

      parent = parentCategory
    }

    // Count customers using this category
    let customerCount = 0
    if (category.level === 1) {
      const { count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('primary_category', category.category_key)
      customerCount = count || 0
    } else if (category.level === 2) {
      const { count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('sub_category', category.category_key)
      customerCount = count || 0
    } else if (category.level === 3) {
      const { count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('specific_profile', category.category_key)
      customerCount = count || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        parent,
        children,
        customerCount
      }
    })

  } catch (error) {
    apiLogger.error('Category GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/categories/[id]
 * Update a category
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateCategorySchema.parse(body)

    // Check if category exists
    const { data: existing, error: fetchError } = await supabase
      .from('customer_category_definitions')
      .select('id, category_key, level')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: Record<string, any> = {}

    if (validatedData.category_name !== undefined) {
      updateData.category_name = validatedData.category_name
    }
    if (validatedData.category_description !== undefined) {
      updateData.category_description = validatedData.category_description
    }
    if (validatedData.display_order !== undefined) {
      updateData.display_order = validatedData.display_order
    }
    if (validatedData.icon_name !== undefined) {
      updateData.icon_name = validatedData.icon_name
    }
    if (validatedData.color_code !== undefined) {
      updateData.color_code = validatedData.color_code
    }
    if (validatedData.is_active !== undefined) {
      updateData.is_active = validatedData.is_active
    }
    if (validatedData.required_documents !== undefined) {
      updateData.required_documents = validatedData.required_documents
    }
    if (validatedData.additional_fields !== undefined) {
      updateData.additional_fields = validatedData.additional_fields
    }

    // Update category
    const { data: updated, error: updateError } = await supabase
      .from('customer_category_definitions')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating category', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Category updated successfully'
    })

  } catch (error) {
    apiLogger.error('Category PUT error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/customer-management/categories/[id]
 * Delete a category
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const cascade = searchParams.get('cascade') === 'true'

    // Check if category exists
    const { data: existing, error: fetchError } = await supabase
      .from('customer_category_definitions')
      .select('id, category_key, level')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if category has children
    const { data: children, error: childError } = await supabase
      .from('customer_category_definitions')
      .select('id')
      .eq('parent_id', id)

    if (children && children.length > 0 && !cascade) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category has child categories. Use cascade=true to delete all.',
          childCount: children.length
        },
        { status: 400 }
      )
    }

    // Check if any customers are using this category
    let customerCount = 0
    if (existing.level === 1) {
      const { count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('primary_category', existing.category_key)
      customerCount = count || 0
    } else if (existing.level === 2) {
      const { count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('sub_category', existing.category_key)
      customerCount = count || 0
    } else if (existing.level === 3) {
      const { count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('specific_profile', existing.category_key)
      customerCount = count || 0
    }

    if (customerCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete category. ${customerCount} customer(s) are using this category.`,
          customerCount
        },
        { status: 400 }
      )
    }

    // Delete category (cascade is handled by DB foreign key ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('customer_category_definitions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting category', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Category DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
