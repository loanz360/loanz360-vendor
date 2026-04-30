
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import EmployeeSupportEmailService from '@/lib/services/employee-support-email-service'
import { apiLogger } from '@/lib/utils/logger'

// POST /api/support/tickets/[id]/messages - Add message to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

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
      .select('*, employee:employees!support_tickets_employee_id_fkey(full_name)')
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

    // HR can only reply to tickets assigned to them
    if (isHR && !['hr', 'both', 'all'].includes(ticket.assigned_to)) {
      return NextResponse.json(
        { error: 'This ticket is not assigned to HR' },
        { status: 403 }
      )
    }

    // Super Admin can only reply to tickets assigned to them
    if (isSuperAdmin && !['super_admin', 'both', 'all'].includes(ticket.assigned_to)) {
      return NextResponse.json(
        { error: 'This ticket is not assigned to Super Admin' },
        { status: 403 }
      )
    }

    // Department staff can only reply to tickets assigned to their department
    if (isDepartmentStaff && !['all'].includes(ticket.assigned_to) && ticket.assigned_to !== Object.keys(departmentRoleMap).find(dept => departmentRoleMap[dept].includes(employee.sub_role))) {
      return NextResponse.json(
        { error: `This ticket is not assigned to your department` },
        { status: 403 }
      )
    }

    // Parse message data
    const body = await request.json()
    const { message, parent_message_id } = body

    if (!message || message.trim() === '') {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    // Determine sender type and name
    let senderType: string
    let senderName: string

    if (isSuperAdmin) {
      senderType = 'super_admin'
      senderName = superAdmin.full_name || 'Super Admin'
    } else if (isHR) {
      senderType = 'hr'
      senderName = employee.full_name || 'HR'
    } else if (isDepartmentStaff) {
      // Use the department as sender type for department staff
      senderType = ticket.assigned_to
      senderName = employee.full_name || `${ticket.assigned_to.replace(/_/g, ' ')} Team`
    } else {
      senderType = 'employee'
      senderName = ticket.is_anonymous ? 'Anonymous' : (employee?.full_name || 'Employee')
    }

    // Create message
    const { data: newMessage, error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: senderType,
        sender_name: senderName,
        message: message.trim(),
        message_type: 'text',
        parent_message_id: parent_message_id || null
      })
      .select()
      .maybeSingle()

    if (messageError) {
      apiLogger.error('Error creating message', messageError)
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    // Update ticket status if employee replies to resolved ticket
    if (isOwner && ticket.status === 'resolved') {
      await supabase
        .from('support_tickets')
        .update({
          status: 'reopened',
          reopened_count: (ticket.reopened_count || 0) + 1
        })
        .eq('id', ticketId)

      await supabase.from('ticket_activity_log').insert({
        ticket_id: ticketId,
        action_type: 'reopened',
        action_by: user.id,
        action_by_type: senderType,
        action_by_name: senderName,
        description: 'Ticket reopened by employee reply'
      })
    }

    // Update ticket status to in_progress if it was open (for any staff member replying)
    if (ticket.status === 'open' && (isHR || isSuperAdmin || isDepartmentStaff)) {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticketId)

      // Log the auto-status change
      await supabase.from('ticket_activity_log').insert({
        ticket_id: ticketId,
        action_type: 'status_changed',
        action_by: user.id,
        action_by_type: senderType,
        action_by_name: senderName,
        old_value: 'open',
        new_value: 'in_progress',
        description: `Status auto-changed to in_progress on first staff reply`
      })

      // Set first response time
      if (!ticket.first_response_at) {
        const createdAt = new Date(ticket.created_at).getTime()
        const responseAt = new Date().getTime()
        await supabase
          .from('support_tickets')
          .update({
            first_response_at: new Date().toISOString(),
            response_time_hours: (responseAt - createdAt) / (1000 * 60 * 60)
          })
          .eq('id', ticketId)
      }
    }

    // Log reply activity
    await supabase.from('ticket_activity_log').insert({
      ticket_id: ticketId,
      action_type: 'replied',
      action_by: user.id,
      action_by_type: senderType,
      action_by_name: senderName,
      description: `${senderName} replied to the ticket`
    })

    // Send email notifications for new messages
    try {
      // Get ticket owner details
      const { data: ticketOwner } = await supabase
        .from('employees')
        .select('full_name, email, sub_role')
        .eq('id', ticket.employee_id)
        .maybeSingle()

      // If HR/Admin replied, notify the employee
      if ((isHR || isSuperAdmin) && ticketOwner && ticketOwner.email) {
        await EmployeeSupportEmailService.notifyEmployeeNewReply({
          ticketNumber: ticket.ticket_number,
          ticketId: ticket.id,
          subject: ticket.subject,
          employeeName: ticketOwner.full_name,
          employeeEmail: ticketOwner.email,
          employeeRole: ticketOwner.sub_role,
          hrAdminName: senderName,
          assignedTo: ticket.assigned_to,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          message: message.trim()
        })
      }

      // If employee replied, notify assigned staff/department
      if (isOwner && ticketOwner && ticketOwner.email) {
        let notifyUsers: any[] = []

        // If there's a specific assigned user, notify only them
        if (ticket.assigned_user_id) {
          const { data: assignedUser } = await supabase
            .from(ticket.assigned_to === 'super_admin' ? 'super_admins' : 'employees')
            .select('id, full_name, email')
            .eq('id', ticket.assigned_user_id)
            .maybeSingle()

          if (assignedUser) {
            notifyUsers = [assignedUser]
          }
        } else {
          // Notify based on department assignment
          if (ticket.assigned_to === 'hr' || ticket.assigned_to === 'both') {
            const { data: hrUsers } = await supabase
              .from('employees')
              .select('id, full_name, email')
              .or('role.eq.hr,role.eq.HR')
              .limit(5)
            if (hrUsers) notifyUsers = [...notifyUsers, ...hrUsers]
          }

          if (ticket.assigned_to === 'super_admin' || ticket.assigned_to === 'both') {
            const { data: adminUsers } = await supabase
              .from('super_admins')
              .select('id, full_name, email')
              .limit(3)
            if (adminUsers) notifyUsers = [...notifyUsers, ...adminUsers]
          }

          // Department-specific notifications (accounts, finance, technical_support, etc.)
          const deptRoleMap: Record<string, string[]> = {
            'finance': ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'FINANCE_ANALYST'],
            'accounts': ['ACCOUNTS_MANAGER', 'ACCOUNTS_EXECUTIVE', 'ACCOUNTANT'],
            'payout_specialist': ['PAYOUT_SPECIALIST'],
            'technical_support': ['TECHNICAL_SUPPORT_EXECUTIVE', 'TECHNICAL_SUPPORT_MANAGER'],
            'compliance': ['COMPLIANCE_OFFICER']
          }

          const deptRoles = deptRoleMap[ticket.assigned_to]
          if (deptRoles) {
            const { data: deptUsers } = await supabase
              .from('employees')
              .select('id, full_name, email')
              .in('sub_role', deptRoles)
              .limit(5)
            if (deptUsers) notifyUsers = [...notifyUsers, ...deptUsers]
          }

          // If assigned_to is 'all', notify all department heads
          if (ticket.assigned_to === 'all') {
            const allRoles = Object.values(deptRoleMap).flat()
            const { data: allDeptUsers } = await supabase
              .from('employees')
              .select('id, full_name, email')
              .in('sub_role', allRoles)
              .limit(10)
            if (allDeptUsers) notifyUsers = [...notifyUsers, ...allDeptUsers]
          }
        }

        // Send notification to each staff member
        for (const staffMember of notifyUsers) {
          if (staffMember.email) {
            await EmployeeSupportEmailService.notifyHRAdminEmployeeReply({
              ticketNumber: ticket.ticket_number,
              ticketId: ticket.id,
              subject: ticket.subject,
              employeeName: ticketOwner.full_name,
              employeeEmail: ticketOwner.email,
              employeeRole: ticketOwner.sub_role,
              hrAdminName: staffMember.full_name,
              hrAdminEmail: staffMember.email,
              assignedTo: ticket.assigned_to,
              status: ticket.status,
              priority: ticket.priority,
              category: ticket.category,
              message: message.trim(),
              isAnonymous: ticket.is_anonymous
            })
          }
        }
      }

    } catch (emailError) {
      apiLogger.error('Error sending message email notifications', emailError)
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      notification: 'Message sent successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/tickets/[id]/messages', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
