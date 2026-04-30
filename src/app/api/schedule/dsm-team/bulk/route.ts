import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/schedule/dsm-team/bulk
 * Performs bulk operations on schedules (reassign, cancel, delete)
 * Only accessible to Direct Sales Managers
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Direct Sales Manager
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    let isAuthorized = false

    if (profile) {
      const userSubRole = profile.subrole?.toUpperCase().replace(/[\s-]/g, '_') || ''
      const userStatus = profile.status?.toUpperCase() || ''

      const isDSM = userSubRole === 'DIRECT_SALES_MANAGER' || userSubRole === 'DSM'
      isAuthorized = isDSM && userStatus === 'ACTIVE'
    } else {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (userProfile) {
        const userRole = userProfile.role?.toUpperCase()
        const userSubRole = userProfile.sub_role?.toUpperCase().replace(/[\s-]/g, '_') || ''

        const isDSM = userSubRole === 'DIRECT_SALES_MANAGER' || userSubRole === 'DSM'
        isAuthorized = userRole === 'EMPLOYEE' && isDSM
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Direct Sales Managers.' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      action, // 'reassign', 'cancel', 'delete', 'update_status'
      schedule_ids,
      target_executive_id, // For reassign action
      reason, // For cancel/reassign
      new_status // For update_status action
    } = body

    // Validate required fields
    if (!action || !schedule_ids || !Array.isArray(schedule_ids) || schedule_ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: action, schedule_ids (array)' },
        { status: 400 }
      )
    }

    // Validate action-specific fields
    if (action === 'reassign' && !target_executive_id) {
      return NextResponse.json(
        { error: 'target_executive_id is required for reassign action' },
        { status: 400 }
      )
    }

    if (action === 'update_status' && !new_status) {
      return NextResponse.json(
        { error: 'new_status is required for update_status action' },
        { status: 400 }
      )
    }

    // Get DSM's employee record
    const { data: dsmEmployee } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!dsmEmployee) {
      return NextResponse.json(
        { error: 'Could not find your employee record.' },
        { status: 404 }
      )
    }

    // Get all team members reporting to this DSM
    const { data: teamMembers } = await supabase
      .from('employees')
      .select('user_id, full_name, employee_id')
      .eq('reporting_manager_id', dsmEmployee.id)
      .eq('is_active', true)

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json(
        { error: 'You have no team members.' },
        { status: 403 }
      )
    }

    const teamMemberUserIds = teamMembers.map(tm => tm.user_id)

    // Fetch the schedules to be operated on
    const { data: schedules, error: schedulesError } = await supabase
      .from('meetings')
      .select('*')
      .in('id', schedule_ids)
      .eq('is_deleted', false)

    if (schedulesError || !schedules || schedules.length === 0) {
      return NextResponse.json(
        { error: 'No valid schedules found with the provided IDs.' },
        { status: 404 }
      )
    }

    // Verify all schedules belong to team members
    const invalidSchedules = schedules.filter(s => !teamMemberUserIds.includes(s.sales_executive_id))
    if (invalidSchedules.length > 0) {
      return NextResponse.json(
        { error: `Some schedules do not belong to your team members.` },
        { status: 403 }
      )
    }

    let results: any[] = []
    let successCount = 0
    let failCount = 0

    // Perform the bulk operation
    switch (action) {
      case 'reassign':
        // Verify target executive is in the team
        const targetExecutive = teamMembers.find(tm => tm.user_id === target_executive_id)
        if (!targetExecutive) {
          return NextResponse.json(
            { error: 'Target executive does not report to you or is not active.' },
            { status: 403 }
          )
        }

        for (const schedule of schedules) {
          const fromExecutive = teamMembers.find(tm => tm.user_id === schedule.sales_executive_id)
          const auditNote = `Bulk reassigned from ${fromExecutive?.full_name} to ${targetExecutive.full_name} by ${dsmEmployee.full_name}.${reason ? ` Reason: ${reason}` : ''}`

          const { error: updateError } = await supabase
            .from('meetings')
            .update({
              sales_executive_id: target_executive_id,
              updated_at: new Date().toISOString(),
              description: `${auditNote}\n\n---\n\n${schedule.description || ''}`
            })
            .eq('id', schedule.id)

          if (updateError) {
            failCount++
            results.push({ schedule_id: schedule.id, success: false, error: updateError.message })
          } else {
            successCount++
            results.push({ schedule_id: schedule.id, success: true })
          }
        }
        break

      case 'cancel':
        for (const schedule of schedules) {
          const { error: updateError } = await supabase
            .from('meetings')
            .update({
              status: 'CANCELLED',
              updated_at: new Date().toISOString(),
              outcome_notes: `Cancelled by manager: ${dsmEmployee.full_name}.${reason ? ` Reason: ${reason}` : ''}`
            })
            .eq('id', schedule.id)

          if (updateError) {
            failCount++
            results.push({ schedule_id: schedule.id, success: false, error: updateError.message })
          } else {
            successCount++
            results.push({ schedule_id: schedule.id, success: true })
          }
        }
        break

      case 'delete':
        for (const schedule of schedules) {
          const { error: updateError } = await supabase
            .from('meetings')
            .update({
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              deleted_by: user.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', schedule.id)

          if (updateError) {
            failCount++
            results.push({ schedule_id: schedule.id, success: false, error: updateError.message })
          } else {
            successCount++
            results.push({ schedule_id: schedule.id, success: true })
          }
        }
        break

      case 'update_status':
        const validStatuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW']
        if (!validStatuses.includes(new_status)) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
            { status: 400 }
          )
        }

        for (const schedule of schedules) {
          const { error: updateError } = await supabase
            .from('meetings')
            .update({
              status: new_status,
              updated_at: new Date().toISOString()
            })
            .eq('id', schedule.id)

          if (updateError) {
            failCount++
            results.push({ schedule_id: schedule.id, success: false, error: updateError.message })
          } else {
            successCount++
            results.push({ schedule_id: schedule.id, success: true })
          }
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: reassign, cancel, delete, update_status' },
          { status: 400 }
        )
    }

    // Create audit log entry
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: `BULK_${action.toUpperCase()}`,
        entity_type: 'meeting',
        metadata: {
          schedule_ids,
          action,
          target_executive_id: target_executive_id || null,
          reason: reason || null,
          new_status: new_status || null,
          success_count: successCount,
          fail_count: failCount,
          performed_by: dsmEmployee.full_name
        },
        created_at: new Date().toISOString()
      })

    if (logError) {
      apiLogger.error('Error creating activity log', logError)
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: schedule_ids.length,
        succeeded: successCount,
        failed: failCount
      },
      results
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/schedule/dsm-team/bulk', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
