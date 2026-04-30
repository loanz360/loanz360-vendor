
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// POST /api/support/tickets/[id]/assign - Manually assign or auto-assign ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: ticketId } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR or Super Admin
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Access denied. HR or Super Admin role required.' },
        { status: 403 }
      )
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      assigned_user_id, // Specific HR user ID (manual assignment)
      strategy, // Auto-assignment strategy (workload_based, round_robin, etc.)
      is_auto = false
    } = body

    let newAssignedUserId: string | null = null
    let assignmentType: 'manual' | 'auto' = 'manual'
    let strategyUsed: string | null = null
    let reason: string = ''

    // Manual assignment to specific HR user
    if (assigned_user_id) {
      // Verify assigned user is HR
      const { data: assignedUser, error: assignedUserError } = await supabase
        .from('employees')
        .select('id, role, full_name')
        .eq('id', assigned_user_id)
        .maybeSingle()

      if (assignedUserError || !assignedUser) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        )
      }

      if (assignedUser.role !== 'hr' && assignedUser.role !== 'HR') {
        return NextResponse.json(
          { error: 'Assigned user is not an HR employee' },
          { status: 400 }
        )
      }

      newAssignedUserId = assigned_user_id
      assignmentType = 'manual'
      reason = `Manually assigned by ${employee?.full_name || superAdmin?.full_name || 'admin'}`
    }
    // Auto-assignment using strategy
    else if (is_auto || strategy) {
      // Call auto-assignment function
      const assignmentStrategy = strategy || 'workload_based'

      const { data: autoAssignResult, error: autoAssignError } = await supabase
        .rpc('auto_assign_support_ticket', {
          p_ticket_id: ticketId,
          p_strategy: assignmentStrategy
        })

      if (autoAssignError) {
        apiLogger.error('Auto-assignment error', autoAssignError)
        return NextResponse.json(
          { error: `Auto-assignment failed: ${autoAssignError.message}` },
          { status: 500 }
        )
      }

      newAssignedUserId = autoAssignResult
      assignmentType = 'auto'
      strategyUsed = assignmentStrategy
      reason = `Auto-assigned using ${assignmentStrategy} strategy`
    } else {
      return NextResponse.json(
        { error: 'Either assigned_user_id or is_auto/strategy must be provided' },
        { status: 400 }
      )
    }

    if (!newAssignedUserId) {
      return NextResponse.json(
        { error: 'No available HR staff found for assignment' },
        { status: 400 }
      )
    }

    // Update ticket with new assignment
    const { data: updatedTicket, error: updateError } = await supabase
      .from('support_tickets')
      .update({
        assigned_user_id: newAssignedUserId,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select(`
        *,
        assigned_user:employees!support_tickets_assigned_user_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating ticket assignment', updateError)
      return NextResponse.json(
        { error: 'Failed to update ticket assignment' },
        { status: 500 }
      )
    }

    // Get HR skills for workload snapshot
    const { data: hrSkills } = await supabase
      .from('hr_staff_skills')
      .select('current_pending_tickets, current_open_tickets, current_in_progress_tickets, satisfaction_score, avg_response_time_minutes')
      .eq('hr_user_id', newAssignedUserId)
      .maybeSingle()

    // Log assignment history
    await supabase
      .from('support_ticket_assignment_history')
      .insert({
        ticket_id: ticketId,
        assigned_from_user_id: ticket.assigned_user_id,
        assigned_to_user_id: newAssignedUserId,
        assigned_by: assignmentType,
        strategy_used: strategyUsed,
        reason,
        workload_snapshot: hrSkills || {},
        assigned_by_user_id: user.id
      })

    // Log activity
    await supabase
      .from('ticket_activity_log')
      .insert({
        ticket_id: ticketId,
        action_type: ticket.assigned_user_id ? 'reassigned' : 'assigned',
        action_by: user.id,
        action_by_type: isHR ? 'hr' : 'super_admin',
        action_by_name: employee?.full_name || superAdmin?.full_name || 'Admin',
        description: reason
      })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      assignment: {
        assigned_user_id: newAssignedUserId,
        assigned_user_name: updatedTicket.assigned_user?.full_name,
        assignment_type: assignmentType,
        strategy_used: strategyUsed,
        reason
      },
      message: `Ticket ${assignmentType === 'auto' ? 'auto-assigned' : 'assigned'} successfully`
    })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/tickets/[id]/assign', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
