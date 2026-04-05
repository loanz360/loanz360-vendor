import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, hrCanManageEmployee } from '@/lib/auth/employee-mgmt-auth'
import { logEmployeeActivity } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/superadmin/employee-management/targets
 * Fetch all targets with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_PERFORMANCE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const targetPeriod = searchParams.get('period')
    const isActive = searchParams.get('is_active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('employee_targets')
      .select(`
        *,
        employees:employee_id (
          id,
          employee_id,
          full_name,
          sub_role,
          department_id,
          departments:department_id (
            id,
            name,
            code
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    }

    if (targetPeriod) {
      query = query.eq('target_period', targetPeriod)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: targets, error, count } = await query

    if (error) {
      logger.error('Error fetching targets:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch targets' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: targets,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/targets:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/employee-management/targets
 * Create new target for employee(s)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ASSIGN_TARGETS')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to assign targets' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate required fields
    const requiredFields = ['employee_id', 'target_name', 'target_period', 'start_date', 'end_date', 'target_metrics']
    const missingFields = requiredFields.filter(field => !body[field])

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(body.start_date)
    const endDate = new Date(body.end_date)

    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // HR check - can only assign targets to employees they can manage
    if (auth.role === 'HR') {
      const canManage = await hrCanManageEmployee(auth.userId!, body.employee_id)
      if (!canManage.canManage) {
        return NextResponse.json(
          { success: false, error: canManage.reason || 'Cannot assign targets to this employee' },
          { status: 403 }
        )
      }
    }

    const supabase = createSupabaseAdmin()

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, sub_role')
      .eq('id', body.employee_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Prepare target data
    const targetData = {
      employee_id: body.employee_id,
      target_name: body.target_name,
      target_period: body.target_period,
      start_date: body.start_date,
      end_date: body.end_date,
      target_metrics: body.target_metrics,
      achieved_metrics: {},
      achievement_percentage: 0,
      is_active: true,
      created_by: auth.userId,
      notes: body.notes || null
    }

    // Insert target
    const { data: newTarget, error: insertError } = await supabase
      .from('employee_targets')
      .insert(targetData)
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating target:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create target' },
        { status: 500 }
      )
    }

    // Log activity
    await logEmployeeActivity({
      employeeId: body.employee_id,
      action: 'TARGET_ASSIGNED',
      actionDetails: {
        target_id: newTarget.id,
        target_name: newTarget.target_name,
        target_period: newTarget.target_period,
        target_metrics: newTarget.target_metrics
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    logger.info(`Target assigned to employee ${employee.employee_id}`)

    return NextResponse.json({
      success: true,
      data: newTarget,
      message: `Target assigned to ${employee.full_name} successfully`
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/targets:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
