import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

const assignmentSchema = z.object({
  user_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_rotating: z.boolean().default(false)
})

// GET - Fetch shift assignments
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = adminClient
      .from('employee_shift_assignments')
      .select(`
        *,
        shift_definitions (
          id,
          name,
          start_time,
          end_time,
          grace_period_minutes,
          required_hours
        ),
        users!employee_shift_assignments_user_id_fkey (
          id,
          full_name,
          email
        )
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .range(from, to)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: assignments, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: assignments || [],
      meta: { page, page_size: pageSize, total: count ?? 0 }
    })

  } catch (error: unknown) {
    apiLogger.error('Fetch shift assignments error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

// POST - Create shift assignment
export async function POST(request: NextRequest) {
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or Super Admin
    const { data: userData } = await adminClient
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = userData?.sub_role === 'hr_executive' || userData?.sub_role === 'hr_manager'
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN'

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = assignmentSchema.parse(body)

    // Validate employee exists
    const { data: employee } = await adminClient
      .from('users')
      .select('id')
      .eq('id', validatedData.user_id)
      .maybeSingle()

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Check for overlapping active shift assignments for this user
    let overlapQuery = adminClient
      .from('employee_shift_assignments')
      .select('id, effective_from, effective_to')
      .eq('user_id', validatedData.user_id)
      .eq('is_active', true)
      .lte('effective_from', validatedData.effective_to || '9999-12-31')

    if (validatedData.effective_to) {
      overlapQuery = overlapQuery.or(`effective_to.is.null,effective_to.gte.${validatedData.effective_from}`)
    } else {
      overlapQuery = overlapQuery.or(`effective_to.is.null,effective_to.gte.${validatedData.effective_from}`)
    }

    const { data: overlapping } = await overlapQuery

    if (overlapping && overlapping.length > 0) {
      // Deactivate overlapping assignments instead of rejecting
      apiLogger.info('Deactivating overlapping shift assignments', {
        user_id: validatedData.user_id,
        count: overlapping.length,
      })
    }

    // Deactivate previous assignments for this user
    await adminClient
      .from('employee_shift_assignments')
      .update({ is_active: false })
      .eq('user_id', validatedData.user_id)
      .eq('is_active', true)

    // Create new assignment
    const { data: assignment, error } = await adminClient
      .from('employee_shift_assignments')
      .insert({
        ...validatedData,
        assigned_by: user.id,
        assigned_at: new Date().toISOString()
      })
      .select(`
        *,
        shift_definitions (
          name,
          start_time,
          end_time
        )
      `)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: assignment,
      message: 'Shift assigned successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    apiLogger.error('Create shift assignment error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to assign shift' },
      { status: 500 }
    )
  }
}
