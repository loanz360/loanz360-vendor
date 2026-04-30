import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/schedule/dsm-team/transfer
 * Transfers a schedule from one Direct Sales Executive to another
 * Only accessible to Direct Sales Managers
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
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
    const bodySchema = z.object({

      schedule_id: z.string().uuid().optional(),

      from_executive_id: z.string().uuid().optional(),

      to_executive_id: z.string().uuid().optional(),

      transfer_reason: z.string().optional(),

      notify_executives: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      schedule_id,
      from_executive_id,
      to_executive_id,
      transfer_reason,
      notify_executives
    } = body

    // Validate required fields
    if (!schedule_id || !to_executive_id) {
      return NextResponse.json(
        { error: 'Missing required fields: schedule_id, to_executive_id' },
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

    // Verify the schedule exists and belongs to a team member
    const { data: schedule, error: scheduleError } = await supabase
      .from('meetings')
      .select('id, sales_executive_id, title, scheduled_date, status, participant_name')
      .eq('id', schedule_id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found.' },
        { status: 404 }
      )
    }

    // Verify both executives report to this DSM
    const { data: executives, error: executivesError } = await supabase
      .from('employees')
      .select('user_id, full_name, employee_id')
      .eq('reporting_manager_id', dsmEmployee.id)
      .eq('is_active', true)
      .in('user_id', [schedule.sales_executive_id, to_executive_id])

    if (executivesError || !executives || executives.length < 2) {
      return NextResponse.json(
        { error: 'One or both executives do not report to you or are not active.' },
        { status: 403 }
      )
    }

    const fromExecutive = executives.find(e => e.user_id === schedule.sales_executive_id)
    const toExecutive = executives.find(e => e.user_id === to_executive_id)

    if (!fromExecutive || !toExecutive) {
      return NextResponse.json(
        { error: 'Could not find executive records.' },
        { status: 404 }
      )
    }

    // Check if schedule can be transferred (must be scheduled or confirmed)
    if (!['SCHEDULED', 'CONFIRMED'].includes(schedule.status)) {
      return NextResponse.json(
        { error: 'Can only transfer schedules with SCHEDULED or CONFIRMED status.' },
        { status: 400 }
      )
    }

    // Create audit trail entry in schedule notes
    const auditNote = `Schedule transferred from ${fromExecutive.full_name} (${fromExecutive.employee_id}) to ${toExecutive.full_name} (${toExecutive.employee_id}) by ${dsmEmployee.full_name} (Direct Sales Manager).${transfer_reason ? ` Reason: ${transfer_reason}` : ''}`

    // Update the schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('meetings')
      .update({
        sales_executive_id: to_executive_id,
        updated_at: new Date().toISOString(),
        description: schedule_id ? `${auditNote}\n\n---\n\n${schedule.description || ''}` : auditNote
      })
      .eq('id', schedule_id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error transferring schedule', updateError)
      return NextResponse.json(
        { error: 'Failed to transfer schedule.' },
        { status: 500 }
      )
    }

    // Create activity log entry
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'SCHEDULE_TRANSFER',
        entity_type: 'meeting',
        entity_id: schedule_id,
        metadata: {
          from_executive_id: fromExecutive.user_id,
          from_executive_name: fromExecutive.full_name,
          to_executive_id: toExecutive.user_id,
          to_executive_name: toExecutive.full_name,
          transfer_reason: transfer_reason || null,
          schedule_title: schedule.title,
          scheduled_date: schedule.scheduled_date
        },
        created_at: new Date().toISOString()
      })

    if (logError) {
      apiLogger.error('Error creating activity log', logError)
      // Don't fail the request if logging fails
    }

    // Send notifications if requested
    if (notify_executives) {
      // Notify the original executive
      await supabase
        .from('notifications')
        .insert({
          title: 'Schedule Transferred',
          message: `Your schedule "${schedule.title}" on ${new Date(schedule.scheduled_date).toLocaleDateString()} has been transferred to ${toExecutive.full_name} by your manager.`,
          type: 'SCHEDULE_UPDATE',
          user_id: fromExecutive.user_id,
          created_at: new Date().toISOString()
        })

      // Notify the new executive
      await supabase
        .from('notifications')
        .insert({
          title: 'New Schedule Assigned',
          message: `You have been assigned a new schedule "${schedule.title}" on ${new Date(schedule.scheduled_date).toLocaleDateString()}. Previously assigned to ${fromExecutive.full_name}.`,
          type: 'SCHEDULE_ASSIGNED',
          user_id: toExecutive.user_id,
          created_at: new Date().toISOString()
        })
    }

    return NextResponse.json({
      success: true,
      schedule: updatedSchedule,
      transfer_details: {
        from: {
          user_id: fromExecutive.user_id,
          name: fromExecutive.full_name,
          employee_id: fromExecutive.employee_id
        },
        to: {
          user_id: toExecutive.user_id,
          name: toExecutive.full_name,
          employee_id: toExecutive.employee_id
        },
        transferred_by: dsmEmployee.full_name,
        transferred_at: new Date().toISOString()
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/schedule/dsm-team/transfer', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
