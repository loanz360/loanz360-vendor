import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, hrCanManageEmployee } from '@/lib/auth/employee-mgmt-auth'
import { logEmployeeActivity, logStatusChange } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/employee-management/[id]
 * Fetch single employee details with complete profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_EMPLOYEES')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const employeeId = params.id
    const supabase = createSupabaseAdmin()

    // Fetch employee with related data
    const { data: employee, error } = await supabase
      .from('employees')
      .select(`
        *,
        departments:department_id (
          id,
          name,
          code,
          department_type
        ),
        reporting_manager:reporting_manager_id (
          id,
          employee_id,
          full_name,
          sub_role,
          work_email
        )
      `)
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // HR check - can only view employees in their department
    if (auth.role === 'HR') {
      const { data: hrProfile } = await supabase
        .from('employees')
        .select('department_id')
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (hrProfile?.department_id !== employee.department_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied to this employee' },
          { status: 403 }
        )
      }
    }

    // Get additional information
    const [
      { data: directReports },
      { data: targets },
      { data: performanceLogs },
      { data: notes }
    ] = await Promise.all([
      // Direct reports
      supabase
        .from('employees')
        .select('id, employee_id, full_name, sub_role')
        .eq('reporting_manager_id', employeeId)
        .is('deleted_at', null),

      // Active targets
      supabase
        .from('employee_targets')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .order('end_date', { ascending: false })
        .limit(5),

      // Recent performance logs
      supabase
        .from('employee_performance_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .order('period_end', { ascending: false })
        .limit(6),

      // Recent notes (visible to requester)
      supabase
        .from('employee_notes')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...employee,
        direct_reports: directReports || [],
        active_targets: targets || [],
        recent_performance: performanceLogs || [],
        notes: notes || []
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/employee-management/[id]
 * Update employee details
 * Permissions: Super Admin (all fields), HR (limited fields)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'EDIT_EMPLOYEE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const employeeId = params.id
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

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

    // Get current employee data
    const { data: currentEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !currentEmployee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updated_by: auth.userId,
      updated_at: new Date().toISOString()
    }

    // Allowed fields for update
    const allowedFields = [
      'full_name',
      'mobile_number',
      'work_email',
      'personal_email',
      'address',
      'city',
      'state',
      'pincode',
      'department_id',
      'sub_role',
      'reporting_manager_id',
      'emergency_contact_name',
      'emergency_contact_number',
      'emergency_contact_relation',
      'qualification',
      'experience_years',
      'previous_company',
      'probation_end_date'
    ]

    // HR restrictions - cannot modify certain fields
    const hrRestrictedFields = ['department_id', 'sub_role']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // HR cannot change department or sub_role
        if (auth.role === 'HR' && hrRestrictedFields.includes(field)) {
          continue
        }
        updateData[field] = body[field]
      }
    }

    // Check for duplicate email/mobile if being updated
    if (body.work_email && body.work_email !== currentEmployee.work_email) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('work_email', body.work_email)
        .neq('id', employeeId)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Work email already exists' },
          { status: 409 }
        )
      }
    }

    if (body.mobile_number && body.mobile_number !== currentEmployee.mobile_number) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('mobile_number', body.mobile_number)
        .neq('id', employeeId)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Mobile number already exists' },
          { status: 409 }
        )
      }
    }

    // Update employee
    const { data: updatedEmployee, error: updateError } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', employeeId)
      .select(`
        *,
        departments:department_id (
          id,
          name,
          code
        )
      `)
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating employee:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update employee' },
        { status: 500 }
      )
    }

    // Log activity
    await logEmployeeActivity({
      employeeId,
      action: 'EMPLOYEE_UPDATED',
      actionDetails: {
        updated_fields: Object.keys(updateData).filter(k => !['updated_by', 'updated_at'].includes(k)),
        employee_id: currentEmployee.employee_id
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    return NextResponse.json({
      success: true,
      data: updatedEmployee,
      message: 'Employee updated successfully'
    })
  } catch (error) {
    logger.error('Error in PUT /api/superadmin/employee-management/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/employee-management/[id]
 * Soft delete employee (only Super Admin)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'DELETE_EMPLOYEE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Only Super Admin can delete employees' },
        { status: 403 }
      )
    }

    const employeeId = params.id
    const supabase = createSupabaseAdmin()

    // Get employee data before deletion
    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('employee_id, full_name, sub_role')
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('employees')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.userId,
        is_active: false,
        updated_by: auth.userId
      })
      .eq('id', employeeId)

    if (deleteError) {
      logger.error('Error deleting employee:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete employee' },
        { status: 500 }
      )
    }

    // Log activity
    await logEmployeeActivity({
      employeeId,
      action: 'EMPLOYEE_DELETED',
      actionDetails: {
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        sub_role: employee.sub_role
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    logger.info(`Employee ${employee.employee_id} deleted by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.employee_id} deleted successfully`
    })
  } catch (error) {
    logger.error('Error in DELETE /api/superadmin/employee-management/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
