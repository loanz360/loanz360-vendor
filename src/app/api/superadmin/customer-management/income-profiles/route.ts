export const dynamic = 'force-dynamic'

/**
 * Income Profiles Management API
 * SuperAdmin endpoint for managing income profiles under categories
 *
 * GET  - Fetch all income profiles with filters
 * POST - Create new income profile
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

// Validation schema - matches actual income_profiles table columns
const createProfileSchema = z.object({
  category_id: z.string().uuid(),
  key: z.string().min(1).max(100).regex(/^[A-Z_]+$/, 'Key must be uppercase with underscores'),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  typical_income_range: z.string().max(100).optional(),
  typical_loan_types: z.array(z.string()).optional(),
  display_order: z.number().optional().default(0),
  is_active: z.boolean().optional().default(true),
})

/**
 * GET /api/superadmin/customer-management/income-profiles
 * Fetch all income profiles with optional filters
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

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('category_id')
    const isActive = searchParams.get('is_active')
    const requireEntity = searchParams.get('require_entity')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Build query - use inner join if filtering by require_entity
    let query = supabaseAdmin
      .from('income_profiles')
      .select(`
        *,
        income_categories${requireEntity === 'true' ? '!inner' : ''}(id, key, name, color, show_entity_profile)
      `, { count: 'exact' })
      .order('category_id', { ascending: true })
      .order('display_order', { ascending: true })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,key.ilike.%${search}%`)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true')
    }

    // Filter to only profiles under categories that require entity selection
    if (requireEntity === 'true') {
      query = query.eq('income_categories.show_entity_profile', true)
    }

    const { data: profiles, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching income profiles', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch income profiles' },
        { status: 500 }
      )
    }

    // Get individual counts per profile
    const { data: individualCounts } = await supabaseAdmin
      .from('individuals')
      .select('income_profile_id')

    const profilesWithCounts = profiles?.map(profile => ({
      ...profile,
      individual_count: individualCounts?.filter(i => i.income_profile_id === profile.id).length || 0
    })) || []

    // Get statistics
    const { count: totalProfiles } = await supabaseAdmin
      .from('income_profiles')
      .select('*', { count: 'exact', head: true })

    const { count: activeProfiles } = await supabaseAdmin
      .from('income_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      data: profilesWithCounts,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      },
      statistics: {
        totalProfiles: totalProfiles || 0,
        activeProfiles: activeProfiles || 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Income Profiles GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/customer-management/income-profiles
 * Create a new income profile
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
    const validatedData = createProfileSchema.parse(body)

    // Verify category exists
    const { data: category } = await supabaseAdmin
      .from('income_categories')
      .select('id, key')
      .eq('id', validatedData.category_id)
      .maybeSingle()

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Income category not found' },
        { status: 404 }
      )
    }

    // Check for duplicate key within same category
    const { data: existing } = await supabaseAdmin
      .from('income_profiles')
      .select('id')
      .eq('key', validatedData.key)
      .eq('category_id', validatedData.category_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Profile key already exists in this category' },
        { status: 409 }
      )
    }

    // Insert new profile - only columns that exist in the table
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('income_profiles')
      .insert({
        category_id: validatedData.category_id,
        key: validatedData.key,
        name: validatedData.name,
        description: validatedData.description || null,
        icon: validatedData.icon || null,
        typical_income_range: validatedData.typical_income_range || null,
        typical_loan_types: validatedData.typical_loan_types || null,
        display_order: validatedData.display_order,
        is_active: validatedData.is_active,
      })
      .select(`
        *,
        income_categories(id, key, name, color)
      `)
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating income profile', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create income profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newProfile,
      message: 'Income profile created successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Income Profiles POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
