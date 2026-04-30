import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Income Profile Detail API
 * SuperAdmin endpoint for managing individual income profiles
 *
 * GET    - Fetch single income profile
 * PUT    - Update income profile
 * DELETE - Delete income profile (soft delete)
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
const updateProfileSchema = z.object({
  income_category_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  required_documents: z.array(z.string()).optional(),
  additional_fields: z.record(z.any()).optional(),
  display_order: z.number().optional(),
  is_active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/superadmin/customer-management/income-profiles/[id]
 * Fetch single income profile
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

    // Fetch profile with category
    const { data: profile, error } = await supabaseAdmin
      .from('income_profiles')
      .select(`
        *,
        income_categories(*)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !profile) {
      return NextResponse.json(
        { success: false, error: 'Income profile not found' },
        { status: 404 }
      )
    }

    // Get individual count for this profile
    const { count: individualCount } = await supabaseAdmin
      .from('individuals')
      .select('*', { count: 'exact', head: true })
      .eq('income_profile_id', id)

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        individual_count: individualCount || 0
      }
    })

  } catch (error) {
    apiLogger.error('Income Profile GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/income-profiles/[id]
 * Update an income profile
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
    const validatedData = updateProfileSchema.parse(body)

    // Check if profile exists
    const { data: existing } = await supabaseAdmin
      .from('income_profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Income profile not found' },
        { status: 404 }
      )
    }

    // If changing category, verify new category exists
    if (validatedData.income_category_id) {
      const { data: category } = await supabaseAdmin
        .from('income_categories')
        .select('id')
        .eq('id', validatedData.income_category_id)
        .maybeSingle()

      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Target income category not found' },
          { status: 404 }
        )
      }
    }

    // Update profile
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('income_profiles')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        income_categories(id, code, name, color)
      `)
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating income profile', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update income profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Income profile updated successfully'
    })

  } catch (error) {
    apiLogger.error('Income Profile PUT error', error)

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
 * DELETE /api/superadmin/customer-management/income-profiles/[id]
 * Soft delete an income profile (set is_active = false)
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

    // Check if profile has individuals
    const { count: individualCount } = await supabaseAdmin
      .from('individuals')
      .select('*', { count: 'exact', head: true })
      .eq('income_profile_id', id)

    if (individualCount && individualCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete profile with ${individualCount} individuals. Deactivate instead.` },
        { status: 400 }
      )
    }

    // Soft delete - set is_active to false
    const { error: deleteError } = await supabaseAdmin
      .from('income_profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting income profile', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete income profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Income profile deactivated successfully'
    })

  } catch (error) {
    apiLogger.error('Income Profile DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
