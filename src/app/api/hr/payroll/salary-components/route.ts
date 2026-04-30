import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

// GET /api/hr/payroll/salary-components
// Fetch all salary components (earnings and deductions)
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'earning' or 'deduction'
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active_only') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = (page - 1) * limit

    // Build count query first for pagination metadata
    let countQuery = adminClient
      .from('salary_components')
      .select('*', { count: 'exact', head: true })

    if (type) countQuery = countQuery.eq('type', type)
    if (category) countQuery = countQuery.eq('category', category)
    if (activeOnly) countQuery = countQuery.eq('is_active', true)

    const { count: totalCount } = await countQuery

    // Build data query
    let query = adminClient
      .from('salary_components')
      .select('*')
      .order('display_order', { ascending: true })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (type) {
      query = query.eq('type', type)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: components, error } = await query

    if (error) {
      throw error
    }

    // Group by type for easier frontend consumption
    const earnings = components?.filter(c => c.type === 'earning') || []
    const deductions = components?.filter(c => c.type === 'deduction') || []

    return NextResponse.json({
      success: true,
      data: {
        all: components || [],
        earnings,
        deductions
      },
      meta: {
        page,
        limit,
        total: totalCount ?? 0,
        totalPages: Math.ceil((totalCount ?? 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Fetch salary components error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch salary components' },
      { status: 500 }
    )
  }
}

// POST /api/hr/payroll/salary-components
// Create a new salary component (HR/Superadmin only)
export async function POST(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can create salary components' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      code: z.string().optional(),


      name: z.string().optional(),


      type: z.string().optional(),


      category: z.string().optional(),


      is_statutory: z.boolean().optional(),


      is_taxable: z.boolean().optional(),


      calculation_type: z.string().optional(),


      percentage_of: z.string().optional(),


      percentage_value: z.string().optional(),


      description: z.string().optional(),


      display_order: z.string().optional(),


      id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      code,
      name,
      type,
      category,
      is_statutory,
      is_taxable,
      calculation_type,
      percentage_of,
      percentage_value,
      description,
      display_order
    } = body

    // Validate required fields
    if (!code || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'Code, name, and type are required' },
        { status: 400 }
      )
    }

    // Check name uniqueness
    const { data: existingByName } = await adminClient
      .from('salary_components')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle()

    if (existingByName) {
      return NextResponse.json(
        { success: false, error: 'A salary component with this name already exists' },
        { status: 409 }
      )
    }

    // Insert new component
    const { data: component, error } = await adminClient
      .from('salary_components')
      .insert({
        code,
        name,
        type,
        category,
        is_statutory: is_statutory || false,
        is_taxable: is_taxable !== false,
        calculation_type: calculation_type || 'fixed',
        percentage_of,
        percentage_value,
        description,
        display_order: display_order || 0,
        is_active: true
      })
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: 'Component code already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: component,
      message: 'Salary component created successfully'
    })

  } catch (error) {
    apiLogger.error('Create salary component error', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { success: false, error: 'Failed to create salary component' },
      { status: 500 }
    )
  }
}

// PUT /api/hr/payroll/salary-components
// Update a salary component (HR/Superadmin only)
export async function PUT(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can update salary components' },
        { status: 403 }
      )
    }

    const bodySchema2 = z.object({


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Component ID is required' },
        { status: 400 }
      )
    }

    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ['code', 'name', 'type', 'category', 'is_statutory', 'is_taxable', 'calculation_type', 'percentage_of', 'percentage_value', 'description', 'display_order', 'is_active']
    const updatePayload: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in body) updatePayload[key] = body[key]
    }

    // Update component
    const { data: component, error } = await adminClient
      .from('salary_components')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: component,
      message: 'Salary component updated successfully'
    })

  } catch (error) {
    apiLogger.error('Update salary component error', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json(
      { success: false, error: 'Failed to update salary component' },
      { status: 500 }
    )
  }
}
