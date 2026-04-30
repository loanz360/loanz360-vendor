import { parseBody } from '@/lib/utils/parse-body'

/**
 * Customer Category Management API
 * SuperAdmin endpoint for managing customer categories (3-level hierarchy)
 *
 * GET  - Fetch all categories with optional filters
 * POST - Create new category
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

// Rate limiting
const RATE_LIMIT = {
  GET: 60,
  POST: 30
}

// Validation schemas
const createCategorySchema = z.object({
  level: z.number().min(1).max(3),
  category_key: z.string().min(1).max(100).regex(/^[A-Z_]+$/, 'Category key must be uppercase with underscores'),
  category_name: z.string().min(1).max(255),
  category_description: z.string().optional(),
  parent_id: z.string().uuid().optional().nullable(),
  display_order: z.number().optional().default(0),
  icon_name: z.string().max(50).optional(),
  color_code: z.string().max(20).optional(),
  is_active: z.boolean().optional().default(true),
  required_documents: z.array(z.string()).optional().default([]),
  additional_fields: z.array(z.object({
    field_key: z.string(),
    field_name: z.string(),
    field_type: z.string(),
    is_required: z.boolean().optional()
  })).optional().default([])
})

const querySchema = z.object({
  level: z.string().optional(),
  parent_id: z.string().optional(),
  is_active: z.string().optional(),
  search: z.string().optional()
})

/**
 * GET /api/superadmin/customer-management/categories
 * Fetch categories with optional filters
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      level: searchParams.get('level') || undefined,
      parent_id: searchParams.get('parent_id') || undefined,
      is_active: searchParams.get('is_active') || undefined,
      search: searchParams.get('search') || undefined
    }

    const validatedQuery = querySchema.parse(queryParams)

    // Build query
    let query = supabase
      .from('customer_category_definitions')
      .select('*')
      .order('level', { ascending: true })
      .order('display_order', { ascending: true })

    // Apply filters
    if (validatedQuery.level) {
      query = query.eq('level', parseInt(validatedQuery.level))
    }

    if (validatedQuery.parent_id) {
      query = query.eq('parent_id', validatedQuery.parent_id)
    }

    if (validatedQuery.is_active !== undefined) {
      query = query.eq('is_active', validatedQuery.is_active === 'true')
    }

    if (validatedQuery.search) {
      query = query.or(`category_name.ilike.%${validatedQuery.search}%,category_key.ilike.%${validatedQuery.search}%`)
    }

    const { data: categories, error } = await query

    if (error) {
      apiLogger.error('Error fetching categories', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    // Get counts per level
    const { data: levelCounts } = await supabase
      .from('customer_category_definitions')
      .select('level')

    const counts = {
      level1: levelCounts?.filter(c => c.level === 1).length || 0,
      level2: levelCounts?.filter(c => c.level === 2).length || 0,
      level3: levelCounts?.filter(c => c.level === 3).length || 0,
      total: levelCounts?.length || 0
    }

    return NextResponse.json({
      success: true,
      data: categories,
      counts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Categories GET error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
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
 * POST /api/superadmin/customer-management/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = createCategorySchema.parse(body)

    // Validate parent relationship
    if (validatedData.level > 1 && !validatedData.parent_id) {
      return NextResponse.json(
        { success: false, error: 'Parent ID is required for level 2 and 3 categories' },
        { status: 400 }
      )
    }

    if (validatedData.level === 1 && validatedData.parent_id) {
      return NextResponse.json(
        { success: false, error: 'Level 1 categories cannot have a parent' },
        { status: 400 }
      )
    }

    // Check for duplicate category key at the same level
    const { data: existing } = await supabase
      .from('customer_category_definitions')
      .select('id')
      .eq('category_key', validatedData.category_key)
      .eq('level', validatedData.level)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Category key already exists at this level' },
        { status: 409 }
      )
    }

    // Get parent category details for denormalization
    let primaryCategoryKey = null
    let subCategoryKey = null

    if (validatedData.parent_id) {
      const { data: parent } = await supabase
        .from('customer_category_definitions')
        .select('category_key, primary_category_key, level')
        .eq('id', validatedData.parent_id)
        .maybeSingle()

      if (!parent) {
        return NextResponse.json(
          { success: false, error: 'Parent category not found' },
          { status: 404 }
        )
      }

      // Validate parent level
      if (parent.level !== validatedData.level - 1) {
        return NextResponse.json(
          { success: false, error: 'Invalid parent level. Parent must be one level above.' },
          { status: 400 }
        )
      }

      if (validatedData.level === 2) {
        primaryCategoryKey = parent.category_key
      } else if (validatedData.level === 3) {
        primaryCategoryKey = parent.primary_category_key
        subCategoryKey = parent.category_key
      }
    }

    // Insert new category
    const { data: newCategory, error: insertError } = await supabase
      .from('customer_category_definitions')
      .insert({
        level: validatedData.level,
        category_key: validatedData.category_key,
        category_name: validatedData.category_name,
        category_description: validatedData.category_description || null,
        parent_id: validatedData.parent_id || null,
        primary_category_key: primaryCategoryKey,
        sub_category_key: subCategoryKey,
        display_order: validatedData.display_order,
        icon_name: validatedData.icon_name || null,
        color_code: validatedData.color_code || null,
        is_active: validatedData.is_active,
        required_documents: validatedData.required_documents,
        additional_fields: validatedData.additional_fields
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating category', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newCategory,
      message: 'Category created successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Categories POST error', error)

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
