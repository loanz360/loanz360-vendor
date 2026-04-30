import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Income Category Detail API
 * SuperAdmin endpoint for managing individual income categories
 *
 * GET    - Fetch single income category with profiles
 * PUT    - Update income category
 * DELETE - Delete income category (soft delete)
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

// Validation schema for updates
const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  route: z.string().max(50).regex(/^[a-z0-9-]*$/, 'Route must be lowercase alphanumeric with hyphens').optional(),
  display_order: z.number().optional(),
  is_active: z.boolean().optional(),
  show_entity_profile: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/superadmin/customer-management/income-categories/[id]
 * Fetch single income category with its profiles
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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

    // Fetch category with profiles
    const { data: category, error } = await supabaseAdmin
      .from('income_categories')
      .select(`
        *,
        income_profiles(*)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !category) {
      return NextResponse.json(
        { success: false, error: 'Income category not found' },
        { status: 404 }
      )
    }

    // Get individual count for this category
    const { count: individualCount } = await supabaseAdmin
      .from('individuals')
      .select('*', { count: 'exact', head: true })
      .eq('income_category_id', id)

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        individual_count: individualCount || 0
      }
    })

  } catch (error) {
    apiLogger.error('Income Category GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/income-categories/[id]
 * Update an income category
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateCategorySchema.parse(body)

    // Check if category exists
    const { data: existing } = await supabaseAdmin
      .from('income_categories')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Income category not found' },
        { status: 404 }
      )
    }

    // Update category
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('income_categories')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating income category', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update income category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Income category updated successfully'
    })

  } catch (error) {
    apiLogger.error('Income Category PUT error', error)

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
 * DELETE /api/superadmin/customer-management/income-categories/[id]
 * Soft delete an income category (set is_active = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

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

    // Check if category has individuals
    const { count: individualCount } = await supabaseAdmin
      .from('individuals')
      .select('*', { count: 'exact', head: true })
      .eq('income_category_id', id)

    if (individualCount && individualCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete category with ${individualCount} individuals. Deactivate instead.` },
        { status: 400 }
      )
    }

    // Soft delete - set is_active to false
    const { error: deleteError } = await supabaseAdmin
      .from('income_categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting income category', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete income category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Income category deactivated successfully'
    })

  } catch (error) {
    apiLogger.error('Income Category DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
