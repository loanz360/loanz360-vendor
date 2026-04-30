import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, hrCanManageEmployee } from '@/lib/auth/employee-mgmt-auth'
import { logEmployeeActivity } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/employee-management/targets/[id]
 * Fetch single target details
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

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_PERFORMANCE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const targetId = params.id
    const supabase = createSupabaseAdmin()

    const { data: target, error } = await supabase
      .from('employee_targets')
      .select(`
        *,
        employees:employee_id (
          id,
          employee_id,
          full_name,
          sub_role,
          work_email,
          departments:department_id (
            id,
            name,
            code
          )
        )
      `)
      .eq('id', targetId)
      .maybeSingle()

    if (error || !target) {
      return NextResponse.json(
        { success: false, error: 'Target not found' },
        { status: 404 }
      )
    }

    // Get related performance logs
    const { data: performanceLogs } = await supabase
      .from('employee_performance_logs')
      .select('*')
      .eq('target_id', targetId)
      .order('period_end', { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        ...target,
        performance_logs: performanceLogs || []
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/targets/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/employee-management/targets/[id]
 * Update target details and achievement
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

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'MODIFY_TARGETS')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to modify targets' },
        { status: 403 }
      )
    }

    const targetId = params.id
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const supabase = createSupabaseAdmin()

    // Get current target
    const { data: currentTarget, error: fetchError } = await supabase
      .from('employee_targets')
      .select('*, employees:employee_id(id, employee_id, full_name)')
      .eq('id', targetId)
      .maybeSingle()

    if (fetchError || !currentTarget) {
      return NextResponse.json(
        { success: false, error: 'Target not found' },
        { status: 404 }
      )
    }

    // HR check
    if (auth.role === 'HR') {
      const canManage = await hrCanManageEmployee(auth.userId!, currentTarget.employee_id)
      if (!canManage.canManage) {
        return NextResponse.json(
          { success: false, error: 'Cannot modify targets for this employee' },
          { status: 403 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}

    // Allowed fields for update
    const allowedFields = [
      'target_name',
      'target_period',
      'start_date',
      'end_date',
      'target_metrics',
      'achieved_metrics',
      'is_active',
      'notes'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Calculate achievement percentage if achieved_metrics is updated
    if (body.achieved_metrics && body.target_metrics) {
      const targetMetrics = body.target_metrics || currentTarget.target_metrics
      const achievedMetrics = body.achieved_metrics

      // Calculate average achievement percentage across all metrics
      const metricKeys = Object.keys(targetMetrics)
      if (metricKeys.length > 0) {
        const totalAchievement = metricKeys.reduce((sum, key) => {
          const target = targetMetrics[key] || 1
          const achieved = achievedMetrics[key] || 0
          return sum + (achieved / target) * 100
        }, 0)

        updateData.achievement_percentage = Math.round((totalAchievement / metricKeys.length) * 100) / 100

        // Check if target is achieved (>= 100%)
        updateData.is_achieved = updateData.achievement_percentage >= 100
      }
    }

    // Update target
    const { data: updatedTarget, error: updateError } = await supabase
      .from('employee_targets')
      .update(updateData)
      .eq('id', targetId)
      .select(`
        *,
        employees:employee_id (
          id,
          employee_id,
          full_name,
          sub_role
        )
      `)
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating target:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update target' },
        { status: 500 }
      )
    }

    // Log activity
    await logEmployeeActivity({
      employeeId: currentTarget.employee_id,
      action: 'TARGET_UPDATED',
      actionDetails: {
        target_id: targetId,
        target_name: updatedTarget.target_name,
        updated_fields: Object.keys(updateData),
        achievement_percentage: updatedTarget.achievement_percentage
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    return NextResponse.json({
      success: true,
      data: updatedTarget,
      message: 'Target updated successfully'
    })
  } catch (error) {
    logger.error('Error in PUT /api/superadmin/employee-management/targets/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/employee-management/targets/[id]
 * Delete target (Super Admin and HR with permissions)
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

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'MODIFY_TARGETS')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to delete targets' },
        { status: 403 }
      )
    }

    const targetId = params.id
    const supabase = createSupabaseAdmin()

    // Get target before deletion
    const { data: target, error: fetchError } = await supabase
      .from('employee_targets')
      .select('*, employees:employee_id(id, employee_id, full_name)')
      .eq('id', targetId)
      .maybeSingle()

    if (fetchError || !target) {
      return NextResponse.json(
        { success: false, error: 'Target not found' },
        { status: 404 }
      )
    }

    // HR check
    if (auth.role === 'HR') {
      const canManage = await hrCanManageEmployee(auth.userId!, target.employee_id)
      if (!canManage.canManage) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete targets for this employee' },
          { status: 403 }
        )
      }
    }

    // Delete target
    const { error: deleteError } = await supabase
      .from('employee_targets')
      .delete()
      .eq('id', targetId)

    if (deleteError) {
      logger.error('Error deleting target:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete target' },
        { status: 500 }
      )
    }

    // Log activity
    await logEmployeeActivity({
      employeeId: target.employee_id,
      action: 'TARGET_DELETED',
      actionDetails: {
        target_id: targetId,
        target_name: target.target_name,
        target_period: target.target_period
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    logger.info(`Target ${targetId} deleted by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      message: 'Target deleted successfully'
    })
  } catch (error) {
    logger.error('Error in DELETE /api/superadmin/employee-management/targets/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
