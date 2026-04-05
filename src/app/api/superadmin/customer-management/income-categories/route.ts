export const dynamic = 'force-dynamic'

/**
 * Income Categories Management API
 * SuperAdmin endpoint for managing the 7 primary income categories
 *
 * GET  - Fetch all income categories with statistics
 * POST - Create new income category
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const createCategorySchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  route: z.string().max(50).regex(/^[a-z0-9-]*$/, 'Route must be lowercase alphanumeric with hyphens').optional(),
  display_order: z.number().optional().default(0),
  is_active: z.boolean().optional().default(true),
  show_entity_profile: z.boolean().optional().default(false),
})

/**
 * GET /api/superadmin/customer-management/income-categories
 * Fetch all income categories with profile counts and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('is_active')

    // Build query for categories
    let query = supabaseAdmin
      .from('income_categories')
      .select(`
        *,
        income_profiles(count)
      `)
      .order('display_order', { ascending: true })

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: categories, error } = await query

    if (error) {
      apiLogger.error('Error fetching income categories', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch income categories' },
        { status: 500 }
      )
    }

    // Get individual counts per category
    const { data: individualCounts } = await supabaseAdmin
      .from('individuals')
      .select('income_category_id')

    const categoryCounts = categories?.map(cat => ({
      ...cat,
      profile_count: cat.income_profiles?.[0]?.count || 0,
      individual_count: individualCounts?.filter(i => i.income_category_id === cat.id).length || 0
    })) || []

    // Get statistics
    const totalCategories = categoryCounts.length
    const activeCategories = categoryCounts.filter(c => c.is_active).length
    const totalProfiles = categoryCounts.reduce((sum, c) => sum + c.profile_count, 0)
    const totalIndividuals = categoryCounts.reduce((sum, c) => sum + c.individual_count, 0)

    return NextResponse.json({
      success: true,
      data: categoryCounts,
      statistics: {
        totalCategories,
        activeCategories,
        totalProfiles,
        totalIndividuals
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Income Categories GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/customer-management/income-categories
 * Create a new income category
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createCategorySchema.parse(body)

    // Check for duplicate code
    const { data: existing } = await supabaseAdmin
      .from('income_categories')
      .select('id')
      .eq('code', validatedData.code)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Income category code already exists' },
        { status: 409 }
      )
    }

    // Insert new category (key is synced to match code)
    const { data: newCategory, error: insertError } = await supabaseAdmin
      .from('income_categories')
      .insert({
        code: validatedData.code,
        key: validatedData.code,  // Key matches code for API access
        name: validatedData.name,
        description: validatedData.description || null,
        icon: validatedData.icon || null,
        color: validatedData.color || null,
        route: validatedData.route || validatedData.code.toLowerCase().replace(/_/g, '-'),  // Auto-generate route from code if not provided
        display_order: validatedData.display_order,
        is_active: validatedData.is_active,
        show_entity_profile: validatedData.show_entity_profile,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating income category', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create income category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newCategory,
      message: 'Income category created successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Income Categories POST error', error)

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
