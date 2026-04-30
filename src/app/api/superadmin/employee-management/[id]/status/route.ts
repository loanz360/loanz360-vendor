import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, hrCanManageEmployee } from '@/lib/auth/employee-mgmt-auth'
import { logStatusChange } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const runtime = 'nodejs'

/**
 * PATCH /api/superadmin/employee-management/[id]/status
 * Enable or disable employee
 * Permissions: Super Admin, HR
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ENABLE_DISABLE_EMPLOYEE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const employeeId = params.id
    const bodySchema = z.object({

      is_active: z.boolean().optional(),

      reason: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { is_active, reason } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'is_active must be a boolean value' },
        { status: 400 }
      )
    }

    // HR-specific check
    if (auth.role === 'HR') {
      const canManage = await hrCanManageEmployee(auth.userId!, employeeId)
      if (!canManage.canManage) {
        return NextResponse.json(
          { success: false, error: canManage.reason || 'Cannot manage this employee' },
          { status: 403 }
        )
      }
    }

    const supabase = createSupabaseAdmin()

    // Get current employee status
    const { data: currentEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('employee_id, full_name, is_active, employee_status')
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !currentEmployee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    if (currentEmployee.is_active === is_active) {
      return NextResponse.json(
        { success: false, error: `Employee is already ${is_active ? 'active' : 'inactive'}` },
        { status: 400 }
      )
    }

    // Determine new employee_status based on is_active
    let newStatus = currentEmployee.employee_status
    if (!is_active && currentEmployee.employee_status === 'ACTIVE') {
      newStatus = 'INACTIVE'
    } else if (is_active && currentEmployee.employee_status === 'INACTIVE') {
      newStatus = 'ACTIVE'
    }

    // Update employee status
    const { data: updatedEmployee, error: updateError } = await supabase
      .from('employees')
      .update({
        is_active,
        employee_status: newStatus,
        updated_by: auth.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select('*')
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating employee status:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update employee status' },
        { status: 500 }
      )
    }

    // Log status change
    await logStatusChange(
      employeeId,
      currentEmployee.employee_status,
      newStatus,
      auth.userId!,
      auth.role!,
      reason || `Employee ${is_active ? 'enabled' : 'disabled'}`
    )

    logger.info(`Employee ${currentEmployee.employee_id} ${is_active ? 'enabled' : 'disabled'} by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      data: updatedEmployee,
      message: `Employee ${currentEmployee.employee_id} ${is_active ? 'enabled' : 'disabled'} successfully`
    })
  } catch (error) {
    logger.error('Error in PATCH /api/superadmin/employee-management/[id]/status:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
