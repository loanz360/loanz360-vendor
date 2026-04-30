
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import EmployeeSupportEmailService from '@/lib/services/employee-support-email-service'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/support/tickets - Get all tickets for current user
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const assignedTo = searchParams.get('assigned_to')
    const search = searchParams.get('search')

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        employee:employees!support_tickets_employee_id_fkey(
          id,
          full_name,
          email,
          sub_role
        ),
        messages:ticket_messages(count),
        attachments:ticket_attachments(count),
        feedback:ticket_feedback(rating, was_helpful)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Check if user is employee, HR, Super Admin, or department staff
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

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    // Department staff role mapping - determines which departments a sub_role can access
    const departmentRoleMap: Record<string, string[]> = {
      'finance': ['FINANCE_MANAGER', 'FINANCE_EXECUTIVE', 'FINANCE_ANALYST'],
      'accounts': ['ACCOUNTS_MANAGER', 'ACCOUNTS_EXECUTIVE', 'ACCOUNTANT'],
      'payout_specialist': ['PAYOUT_SPECIALIST'],
      'technical_support': ['TECHNICAL_SUPPORT_EXECUTIVE', 'TECHNICAL_SUPPORT_MANAGER'],
      'compliance': ['COMPLIANCE_OFFICER']
    }

    // Find which department(s) this employee's sub_role belongs to
    const employeeDepartment = employee?.sub_role
      ? Object.keys(departmentRoleMap).find(dept =>
          departmentRoleMap[dept].includes(employee.sub_role)
        )
      : null

    const isDepartmentStaff = !!employeeDepartment
    const isRegularEmployee = !!employee && !isHR && !isDepartmentStaff

    // Apply filters based on user type
    if (isDepartmentStaff) {
      // Department staff see tickets assigned to their department or 'all'
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo)
      } else {
        query = query.in('assigned_to', [employeeDepartment!, 'all'])
      }
    } else if (isHR) {
      // HR can see tickets assigned to them, 'both', or 'all'
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo)
      } else {
        query = query.in('assigned_to', ['hr', 'both', 'all'])
      }
    } else if (isSuperAdmin) {
      // Super Admin can see tickets assigned to them, 'both', or 'all'
      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo)
      } else {
        query = query.in('assigned_to', ['super_admin', 'both', 'all'])
      }
    } else if (isRegularEmployee) {
      // Regular employees can only see their own tickets
      query = query.eq('employee_id', user.id)
    } else {
      return NextResponse.json(
        { error: 'Invalid user type' },
        { status: 403 }
      )
    }

    // Apply additional filters
    if (status) {
      query = query.eq('status', status)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (search) {
      query = query.or(`subject.ilike.%${search}%,ticket_number.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: tickets, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching tickets', error)
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    // Calculate pagination metadata
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)
    const hasMore = page < totalPages

    // Fetch accurate status counts from the full dataset (not just current page)
    // Build the same base filter for counts query
    let countsQuery = supabase
      .from('support_tickets')
      .select('status', { count: 'exact', head: false })

    // Apply same access filters as the main query
    if (isDepartmentStaff) {
      countsQuery = countsQuery.in('assigned_to', [employeeDepartment!, 'all'])
    } else if (isHR) {
      countsQuery = countsQuery.in('assigned_to', ['hr', 'both', 'all'])
    } else if (isSuperAdmin) {
      countsQuery = countsQuery.in('assigned_to', ['super_admin', 'both', 'all'])
    } else if (isRegularEmployee) {
      countsQuery = countsQuery.eq('employee_id', user.id)
    }

    // Apply same filters
    if (category) countsQuery = countsQuery.eq('category', category)
    if (priority) countsQuery = countsQuery.eq('priority', priority)

    const { data: allStatusTickets } = await countsQuery

    const openCount = allStatusTickets?.filter(t => t.status === 'open').length || 0
    const inProgressCount = allStatusTickets?.filter(t => t.status === 'in_progress').length || 0
    const resolvedCount = allStatusTickets?.filter(t => t.status === 'resolved').length || 0
    const closedCount = allStatusTickets?.filter(t => t.status === 'closed').length || 0
    const onHoldCount = allStatusTickets?.filter(t => t.status === 'on_hold').length || 0
    const reopenedCount = allStatusTickets?.filter(t => t.status === 'reopened').length || 0

    return NextResponse.json({
      tickets,
      counts: {
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount,
        onHold: onHoldCount,
        reopened: reopenedCount,
        total: totalCount
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/support/tickets', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/support/tickets - Create new ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is an employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Only employees can create tickets' },
        { status: 403 }
      )
    }

    // Check if user is HR
    const isHR = employee.role === 'hr' || employee.role === 'HR'
    if (isHR) {
      return NextResponse.json(
        { error: 'HR staff cannot create support tickets' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      subject,
      description,
      category = 'general',
      priority = 'medium',
      assigned_to,
      is_anonymous = false,
      is_confidential = false
    } = body

    // Validate required fields
    if (!subject || !description || !assigned_to) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, description, assigned_to' },
        { status: 400 }
      )
    }

    // Validate subject length
    if (subject.trim().length < 5) {
      return NextResponse.json(
        { error: 'Subject must be at least 5 characters long' },
        { status: 400 }
      )
    }

    if (subject.trim().length > 200) {
      return NextResponse.json(
        { error: 'Subject must not exceed 200 characters' },
        { status: 400 }
      )
    }

    // Validate description length (minimum 20 characters for quality)
    if (description.trim().length < 20) {
      return NextResponse.json(
        { error: 'Description must be at least 20 characters long. Please provide more details about your issue.' },
        { status: 400 }
      )
    }

    if (description.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Description must not exceed 5000 characters' },
        { status: 400 }
      )
    }

    // Validate assigned_to
    const validDepartments = [
      'hr',
      'super_admin',
      'finance',
      'accounts',
      'payout_specialist',
      'technical_support',
      'compliance',
      'both',
      'all'
    ]

    if (!validDepartments.includes(assigned_to)) {
      return NextResponse.json(
        { error: 'Invalid assigned_to value. Must be one of: ' + validDepartments.join(', ') },
        { status: 400 }
      )
    }

    // Create ticket (ticket_number will be auto-generated by trigger)
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        employee_id: user.id,
        subject,
        description,
        category,
        priority,
        assigned_to,
        is_anonymous,
        is_confidential,
        status: 'open'
      })
      .select()
      .maybeSingle()

    if (ticketError) {
      apiLogger.error('Error creating ticket', ticketError)
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      )
    }

    // Create activity log entry (will be auto-created by trigger, but we can add details)
    await supabase
      .from('ticket_activity_log')
      .insert({
        ticket_id: ticket.id,
        action_type: 'created',
        action_by: user.id,
        action_by_type: 'employee',
        action_by_name: employee.full_name,
        description: `Ticket created by ${employee.full_name}`
      })

    // Add initial system message
    await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'employee',
        sender_name: is_anonymous ? 'Anonymous' : employee.full_name,
        message: description,
        message_type: 'text'
      })

    // Send email notifications
    try {
      // Notify employee (confirmation)
      await EmployeeSupportEmailService.notifyEmployeeTicketCreated({
        ticketNumber: ticket.ticket_number,
        ticketId: ticket.id,
        subject: ticket.subject,
        employeeName: employee.full_name,
        employeeEmail: employee.email || user.email!,
        employeeRole: employee.sub_role,
        assignedTo: ticket.assigned_to,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        isAnonymous: ticket.is_anonymous,
        isConfidential: ticket.is_confidential
      })

      // Notify relevant department users
      // Get users to notify based on assigned department
      let notifyUsers: any[] = []

      // HR Department
      if (['hr', 'both', 'all'].includes(assigned_to)) {
        const { data: hrUsers } = await supabase
          .from('employees')
          .select('id, full_name, email, sub_role')
          .or('role.eq.hr,role.eq.HR')
          .limit(5) // Notify max 5 HR users

        if (hrUsers) notifyUsers = [...notifyUsers, ...hrUsers.map(u => ({ ...u, role: 'hr' }))]
      }

      // Super Admin
      if (['super_admin', 'both', 'all'].includes(assigned_to)) {
        const { data: adminUsers } = await supabase
          .from('super_admins')
          .select('id, full_name, email')
          .limit(3) // Notify max 3 admins

        if (adminUsers) notifyUsers = [...notifyUsers, ...adminUsers.map(u => ({ ...u, role: 'super_admin' }))]
      }

      // Finance Department
      if (['finance', 'all'].includes(assigned_to)) {
        const { data: financeUsers } = await supabase
          .from('employees')
          .select('id, full_name, email, sub_role')
          .or('sub_role.ilike.%finance%,sub_role.ilike.%accounts%')
          .limit(3)

        if (financeUsers) notifyUsers = [...notifyUsers, ...financeUsers.map(u => ({ ...u, role: 'finance' }))]
      }

      // Accounts Department
      if (['accounts', 'all'].includes(assigned_to)) {
        const { data: accountsUsers } = await supabase
          .from('employees')
          .select('id, full_name, email, sub_role')
          .ilike('sub_role', '%accounts%')
          .limit(3)

        if (accountsUsers) notifyUsers = [...notifyUsers, ...accountsUsers.map(u => ({ ...u, role: 'accounts' }))]
      }

      // Payout Specialist
      if (['payout_specialist', 'all'].includes(assigned_to)) {
        const { data: payoutUsers } = await supabase
          .from('employees')
          .select('id, full_name, email, sub_role')
          .eq('sub_role', 'PAYOUT_SPECIALIST')
          .limit(3)

        if (payoutUsers) notifyUsers = [...notifyUsers, ...payoutUsers.map(u => ({ ...u, role: 'payout_specialist' }))]
      }

      // Technical Support
      if (['technical_support', 'all'].includes(assigned_to)) {
        const { data: techUsers } = await supabase
          .from('employees')
          .select('id, full_name, email, sub_role')
          .or('sub_role.eq.TECHNICAL_SUPPORT_EXECUTIVE,sub_role.eq.TECHNICAL_SUPPORT_MANAGER')
          .limit(3)

        if (techUsers) notifyUsers = [...notifyUsers, ...techUsers.map(u => ({ ...u, role: 'technical_support' }))]
      }

      // Compliance Department
      if (['compliance', 'all'].includes(assigned_to)) {
        const { data: complianceUsers } = await supabase
          .from('employees')
          .select('id, full_name, email, sub_role')
          .eq('sub_role', 'COMPLIANCE_OFFICER')
          .limit(3)

        if (complianceUsers) notifyUsers = [...notifyUsers, ...complianceUsers.map(u => ({ ...u, role: 'compliance' }))]
      }

      // Send notification to each HR/Admin user
      for (const hrAdmin of notifyUsers) {
        if (hrAdmin.email) {
          await EmployeeSupportEmailService.notifyHRAdminNewTicket({
            ticketNumber: ticket.ticket_number,
            ticketId: ticket.id,
            subject: ticket.subject,
            employeeName: employee.full_name,
            employeeEmail: employee.email || user.email!,
            employeeRole: employee.sub_role,
            hrAdminName: hrAdmin.full_name,
            hrAdminEmail: hrAdmin.email,
            assignedTo: ticket.assigned_to,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            isAnonymous: ticket.is_anonymous,
            isConfidential: ticket.is_confidential
          })
        }
      }

    } catch (emailError) {
      // Don't fail the request if email fails
      apiLogger.error('Error sending email notifications', emailError)
    }

    return NextResponse.json({
      success: true,
      ticket,
      message: 'Support ticket created successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/tickets', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
