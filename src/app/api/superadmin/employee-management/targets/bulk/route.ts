import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, hrCanManageEmployee } from '@/lib/auth/employee-mgmt-auth'
import { bulkLogActivities } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * POST /api/superadmin/employee-management/targets/bulk
 * Bulk assign targets to multiple employees
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
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

    const bodySchema = z.object({


      employee_ids: z.array(z.unknown()).optional(),


      target_data: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { employee_ids, target_data } = body

    // Validate
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'employee_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!target_data || !target_data.target_name || !target_data.target_period) {
      return NextResponse.json(
        { success: false, error: 'Invalid target_data. Required: target_name, target_period, start_date, end_date, target_metrics' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Verify all employees exist
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, sub_role')
      .in('id', employee_ids)
      .is('deleted_at', null)

    if (empError || !employees || employees.length !== employee_ids.length) {
      return NextResponse.json(
        { success: false, error: 'One or more employees not found' },
        { status: 404 }
      )
    }

    // HR check - verify can manage all employees
    if (auth.role === 'HR') {
      for (const empId of employee_ids) {
        const canManage = await hrCanManageEmployee(auth.userId!, empId)
        if (!canManage.canManage) {
          return NextResponse.json(
            { success: false, error: `Cannot assign targets to employee ${empId}: ${canManage.reason}` },
            { status: 403 }
          )
        }
      }
    }

    // Prepare bulk insert data
    const targetsToInsert = employee_ids.map(empId => ({
      employee_id: empId,
      target_name: target_data.target_name,
      target_period: target_data.target_period,
      start_date: target_data.start_date,
      end_date: target_data.end_date,
      target_metrics: target_data.target_metrics,
      achieved_metrics: {},
      achievement_percentage: 0,
      is_active: true,
      created_by: auth.userId,
      notes: target_data.notes || null
    }))

    // Bulk insert
    const { data: createdTargets, error: insertError } = await supabase
      .from('employee_targets')
      .insert(targetsToInsert)
      .select()

    if (insertError) {
      logger.error('Error bulk creating targets:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create targets' },
        { status: 500 }
      )
    }

    // Bulk log activities
    const activities = employee_ids.map(empId => ({
      employeeId: empId,
      action: 'TARGET_ASSIGNED',
      actionDetails: {
        target_name: target_data.target_name,
        target_period: target_data.target_period,
        bulk_assignment: true
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    }))

    await bulkLogActivities(activities)

    logger.info(`Bulk targets assigned to ${employee_ids.length} employees by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      data: {
        targets_created: createdTargets?.length || 0,
        targets: createdTargets
      },
      message: `Targets assigned to ${employee_ids.length} employees successfully`
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/targets/bulk:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
