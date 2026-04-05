export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import EmployeeSupportEmailService from '@/lib/services/employee-support-email-service'
import AccountsNotificationService from '@/lib/services/accounts-notification-service'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/support/tickets/[id] - Get single ticket with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { id: ticketId } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get ticket with all related data
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        employee:employees!support_tickets_employee_id_fkey(
          id,
          full_name,
          email,
          sub_role
        ),
        messages:ticket_messages(
          *,
          attachments:ticket_attachments(*)
        ),
        attachments:ticket_attachments(*),
        activity_log:ticket_activity_log(
          *
        ),
        feedback:ticket_feedback(*),
        watchers:ticket_watchers(*)
      `)
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError) {
      apiLogger.error('Error fetching ticket', ticketError)
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isOwner = ticket.employee_id === user.id
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    // Department staff role mapping
    const departmentRoleMap: Record<string, string[]> = {
      'finance': ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'FINANCE_ANALYST'],
      'accounts': ['ACCOUNTS_MANAGER', 'ACCOUNTS_EXECUTIVE', 'ACCOUNTANT'],
      'payout_specialist': ['PAYOUT_SPECIALIST'],
      'technical_support': ['TECHNICAL_SUPPORT_EXECUTIVE', 'TECHNICAL_SUPPORT_MANAGER'],
      'compliance': ['COMPLIANCE_OFFICER']
    }

    // Check if employee belongs to a department that matches the ticket's assignment
    const employeeDepartment = employee?.sub_role
      ? Object.keys(departmentRoleMap).find(dept =>
          departmentRoleMap[dept].includes(employee.sub_role)
        )
      : null
    const isDepartmentStaff = !!employeeDepartment

    // Verify access - must be owner, HR, super admin, or department staff
    if (!isOwner && !isHR && !isSuperAdmin && !isDepartmentStaff) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // If HR, check if ticket is assigned to them
    if (isHR && !isOwner && !['hr', 'both', 'all'].includes(ticket.assigned_to)) {
      return NextResponse.json(
        { error: 'This ticket is not assigned to HR' },
        { status: 403 }
      )
    }

    // If Super Admin, check if ticket is assigned to them
    if (isSuperAdmin && !['super_admin', 'both', 'all'].includes(ticket.assigned_to)) {
      return NextResponse.json(
        { error: 'This ticket is not assigned to Super Admin' },
        { status: 403 }
      )
    }

    // If department staff, check if ticket is assigned to their department
    if (isDepartmentStaff && !isOwner && !isHR && !isSuperAdmin) {
      if (!['all'].includes(ticket.assigned_to) && ticket.assigned_to !== employeeDepartment) {
        return NextResponse.json(
          { error: `This ticket is not assigned to your department (${employeeDepartment})` },
          { status: 403 }
        )
      }
    }

    // Sort messages by creation time
    if (ticket.messages) {
      ticket.messages.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }

    // Sort activity log by creation time (newest first)
    if (ticket.activity_log) {
      ticket.activity_log.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    // Mark messages as read for the current user
    if (ticket.messages && ticket.messages.length > 0) {
      const unreadMessageIds = ticket.messages
        .filter(m => !m.is_read && m.sender_id !== user.id)
        .map(m => m.id)

      if (unreadMessageIds.length > 0) {
        await supabase
          .from('ticket_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', unreadMessageIds)
      }
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    apiLogger.error('Error in GET /api/support/tickets/[id]', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/support/tickets/[id] - Update ticket
export async function PATCH(
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

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Check permissions
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const isOwner = ticket.employee_id === user.id
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    // Check department-specific access
    const departmentRoleMap: Record<string, string[]> = {
      'finance': ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'FINANCE_ANALYST'],
      'accounts': ['ACCOUNTS_MANAGER', 'ACCOUNTS_EXECUTIVE', 'ACCOUNTANT'],
      'payout_specialist': ['PAYOUT_SPECIALIST'],
      'technical_support': ['TECHNICAL_SUPPORT_EXECUTIVE', 'TECHNICAL_SUPPORT_MANAGER'],
      'compliance': ['COMPLIANCE_OFFICER']
    }

    const isDepartmentStaff = employee && departmentRoleMap[ticket.assigned_to]?.includes(employee.sub_role)

    if (!isOwner && !isHR && !isSuperAdmin && !isDepartmentStaff) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Parse update data
    const body = await request.json()
    const updates: any = {}

    // Employees can only update certain fields
    if (isOwner && !isHR && !isSuperAdmin) {
      if (body.status && ['reopened'].includes(body.status)) {
        updates.status = body.status
        updates.reopened_count = (ticket.reopened_count || 0) + 1
      }
    }

    // HR, Admin, and Department Staff can update more fields
    if (isHR || isSuperAdmin || isDepartmentStaff) {
      if (body.status) updates.status = body.status
      if (body.priority) updates.priority = body.priority
      if (body.assigned_to) updates.assigned_to = body.assigned_to
      if (body.assigned_user_id) updates.assigned_user_id = body.assigned_user_id

      // Handle status changes
      if (body.status === 'resolved' && !ticket.resolved_at) {
        updates.resolved_at = new Date().toISOString()

        // Calculate resolution time
        const createdAt = new Date(ticket.created_at).getTime()
        const resolvedAt = new Date().getTime()
        updates.resolution_time_hours = (resolvedAt - createdAt) / (1000 * 60 * 60)
      }

      if (body.status === 'closed' && !ticket.closed_at) {
        updates.closed_at = new Date().toISOString()
      }

      // Set first response time if this is the first HR/Admin response
      if (!ticket.first_response_at) {
        updates.first_response_at = new Date().toISOString()

        const createdAt = new Date(ticket.created_at).getTime()
        const responseAt = new Date().getTime()
        updates.response_time_hours = (responseAt - createdAt) / (1000 * 60 * 60)
      }
    }

    // Update ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating ticket', updateError)
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      )
    }

    // Log activity
    const actorName = employee?.full_name || superAdmin?.full_name || 'User'
    const actorType = isSuperAdmin ? 'super_admin' :
                      isHR ? 'hr' :
                      isDepartmentStaff ? ticket.assigned_to : // Use the department type for staff
                      'employee'

    if (updates.status) {
      await supabase.from('ticket_activity_log').insert({
        ticket_id: ticketId,
        action_type: 'status_changed',
        action_by: user.id,
        action_by_type: actorType,
        action_by_name: actorName,
        old_value: ticket.status,
        new_value: updates.status,
        description: `Status changed from ${ticket.status} to ${updates.status}`
      })

      // Push in-app notification to ticket owner
      if (ticket.employee_id !== user.id) {
        await AccountsNotificationService.notifyTicketStatusChange({
          ticketId,
          ticketNumber: updatedTicket.ticket_number,
          userId: ticket.employee_id,
          oldStatus: ticket.status,
          newStatus: updates.status
        })
      }
    }

    // If ticket was escalated/reassigned, notify the new department
    if (updates.assigned_to && updates.assigned_to !== ticket.assigned_to) {
      await supabase.from('ticket_activity_log').insert({
        ticket_id: ticketId,
        action_type: 'escalated',
        action_by: user.id,
        action_by_type: actorType,
        action_by_name: actorName,
        old_value: ticket.assigned_to,
        new_value: updates.assigned_to,
        description: `Ticket routed from ${ticket.assigned_to} to ${updates.assigned_to}`
      })

      // Find users in the new department and notify them
      const deptRoleMap: Record<string, string[]> = {
        'finance': ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE'],
        'accounts': ['ACCOUNTS_MANAGER', 'ACCOUNTS_EXECUTIVE'],
        'payout_specialist': ['PAYOUT_SPECIALIST'],
        'technical_support': ['TECHNICAL_SUPPORT_EXECUTIVE', 'TECHNICAL_SUPPORT_MANAGER'],
        'compliance': ['COMPLIANCE_OFFICER']
      }
      const newDeptRoles = deptRoleMap[updates.assigned_to]
      if (newDeptRoles) {
        const { data: deptUsers } = await supabase
          .from('employees')
          .select('id')
          .in('sub_role', newDeptRoles)
          .limit(5)

        if (deptUsers && deptUsers.length > 0) {
          await AccountsNotificationService.notifyTicketEscalated({
            ticketId,
            ticketNumber: updatedTicket.ticket_number,
            fromDepartment: ticket.assigned_to,
            toDepartment: updates.assigned_to,
            toUserIds: deptUsers.map(u => u.id)
          })
        }
      }
    }

    // Send email notifications for status changes
    try {
      // Get ticket owner details
      const { data: ticketOwner } = await supabase
        .from('employees')
        .select('full_name, email, sub_role')
        .eq('id', ticket.employee_id)
        .maybeSingle()

      if (ticketOwner && ticketOwner.email) {
        // Notify on status change
        if (updates.status && updates.status !== ticket.status) {
          if (updates.status === 'resolved') {
            await EmployeeSupportEmailService.notifyEmployeeTicketResolved({
              ticketNumber: updatedTicket.ticket_number,
              ticketId: updatedTicket.id,
              subject: updatedTicket.subject,
              employeeName: ticketOwner.full_name,
              employeeEmail: ticketOwner.email,
              employeeRole: ticketOwner.sub_role,
              assignedTo: updatedTicket.assigned_to,
              status: updatedTicket.status,
              priority: updatedTicket.priority,
              category: updatedTicket.category,
              resolutionSummary: body.resolutionSummary
            })
          } else if (updates.status === 'closed') {
            await EmployeeSupportEmailService.notifyEmployeeTicketClosed({
              ticketNumber: updatedTicket.ticket_number,
              ticketId: updatedTicket.id,
              subject: updatedTicket.subject,
              employeeName: ticketOwner.full_name,
              employeeEmail: ticketOwner.email,
              employeeRole: ticketOwner.sub_role,
              assignedTo: updatedTicket.assigned_to,
              status: updatedTicket.status,
              priority: updatedTicket.priority,
              category: updatedTicket.category
            })
          } else if (updates.status === 'reopened') {
            await EmployeeSupportEmailService.notifyEmployeeTicketReopened({
              ticketNumber: updatedTicket.ticket_number,
              ticketId: updatedTicket.id,
              subject: updatedTicket.subject,
              employeeName: ticketOwner.full_name,
              employeeEmail: ticketOwner.email,
              employeeRole: ticketOwner.sub_role,
              assignedTo: updatedTicket.assigned_to,
              status: updatedTicket.status,
              priority: updatedTicket.priority,
              category: updatedTicket.category
            })
          } else {
            await EmployeeSupportEmailService.notifyEmployeeStatusChange(
              {
                ticketNumber: updatedTicket.ticket_number,
                ticketId: updatedTicket.id,
                subject: updatedTicket.subject,
                employeeName: ticketOwner.full_name,
                employeeEmail: ticketOwner.email,
                employeeRole: ticketOwner.sub_role,
                assignedTo: updatedTicket.assigned_to,
                status: updatedTicket.status,
                priority: updatedTicket.priority,
                category: updatedTicket.category
              },
              ticket.status
            )
          }
        }

        // Notify on specific assignment
        if (updates.assigned_user_id && (isHR || isSuperAdmin)) {
          const { data: assignedUser } = await supabase
            .from(updatedTicket.assigned_to === 'super_admin' ? 'super_admins' : 'employees')
            .select('full_name, email')
            .eq('id', updates.assigned_user_id)
            .maybeSingle()

          if (assignedUser && assignedUser.email) {
            await EmployeeSupportEmailService.notifySpecificAssignment({
              ticketNumber: updatedTicket.ticket_number,
              ticketId: updatedTicket.id,
              subject: updatedTicket.subject,
              employeeName: ticketOwner.full_name,
              employeeEmail: ticketOwner.email,
              employeeRole: ticketOwner.sub_role,
              hrAdminName: assignedUser.full_name,
              hrAdminEmail: assignedUser.email,
              assignedTo: updatedTicket.assigned_to,
              status: updatedTicket.status,
              priority: updatedTicket.priority,
              category: updatedTicket.category,
              isAnonymous: updatedTicket.is_anonymous,
              isConfidential: updatedTicket.is_confidential
            })
          }
        }
      }

    } catch (emailError) {
      apiLogger.error('Error sending status change email notifications', emailError)
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket updated successfully'
    })
  } catch (error) {
    apiLogger.error('Error in PATCH /api/support/tickets/[id]', error)
    logApiError(error as Error, request, { action: 'patch' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
