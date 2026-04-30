
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

/**
 * GET /api/customer-support/tickets
 * List customer tickets (for customers: their own, for employees: department-assigned)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    // Determine user role by checking tables directly
    const { data: customerData } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const isCustomer = !!customerData

    let query = supabase
      .from('customer_support_tickets')
      .select(`
        *,
        message_count:customer_ticket_messages(count),
        attachments_count:customer_ticket_attachments(count)
      `)
      .order('created_at', { ascending: false })

    // Apply role-based filtering
    if (isCustomer) {
      query = query.eq('customer_id', customerData.id)
    } else {
      // Check if employee
      const { data: employeeData } = await supabase
        .from('employees')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (employeeData) {
        // Get employee's department
        const { data: deptData } = await supabase
          .from('department_employees')
          .select('department')
          .eq('employee_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (deptData) {
          query = query.or(
            `assigned_to_customer_support_id.eq.${user.id},` +
            `routed_to_employee_id.eq.${user.id},` +
            `routed_to_department.eq.${deptData.department}`
          )
        }
      } else {
        // Check if super admin
        const { data: superAdminData } = await supabase
          .from('super_admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        if (!superAdminData) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }
        // Super admin sees all tickets
      }
    }

    // Apply filters
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
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(
          `ticket_number.ilike.%${safeSearch}%,subject.ilike.%${safeSearch}%`
        )
      }
    }

    const { data: tickets, error } = await query

    if (error) {
      apiLogger.error('Error fetching tickets', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Fetch unread counts for each ticket
    const ticketsWithUnread = tickets || []
    if (ticketsWithUnread.length > 0) {
      const ticketIds = ticketsWithUnread.map(t => t.id)
      const { data: unreadData } = await supabase
        .from('customer_ticket_messages')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
        .eq('is_read_by_customer', false)

      // Build a count map
      const unreadMap: Record<string, number> = {}
      if (unreadData) {
        for (const msg of unreadData) {
          unreadMap[msg.ticket_id] = (unreadMap[msg.ticket_id] || 0) + 1
        }
      }

      // Attach unread_count to each ticket
      for (const ticket of ticketsWithUnread) {
        ticket.unread_count = [{ count: unreadMap[ticket.id] || 0 }]
      }
    }

    // Calculate counts
    const counts = {
      new: ticketsWithUnread.filter(t => t.status === 'new').length,
      in_progress: ticketsWithUnread.filter(t => t.status === 'in_progress').length,
      pending_customer: ticketsWithUnread.filter(t => t.status === 'pending_customer').length,
      resolved: ticketsWithUnread.filter(t => t.status === 'resolved').length,
      closed: ticketsWithUnread.filter(t => t.status === 'closed').length,
      total: ticketsWithUnread.length
    }

    return NextResponse.json({
      tickets: ticketsWithUnread,
      counts
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'listCustomerTickets' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customer-support/tickets
 * Create new customer ticket
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting for create operations
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a customer by checking the customers table directly
    const { data: customerCheck } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customerCheck) {
      return NextResponse.json(
        { error: 'Only customers can create tickets' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      subject,
      description,
      category,
      priority,
      is_confidential,
      requires_urgent_attention,
      loan_application_id
    } = body

    // Validation
    if (!subject || subject.length < 5 || subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject must be between 5 and 200 characters' },
        { status: 400 }
      )
    }

    if (!description || description.length < 20) {
      return NextResponse.json(
        { error: 'Description must be at least 20 characters' },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 })
    }

    if (!priority) {
      return NextResponse.json({ success: false, error: 'Priority is required' }, { status: 400 })
    }

    // Get customer details
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, sub_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customerData) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      )
    }

    // Get SLA deadline
    const { data: slaRule } = await supabase
      .from('customer_ticket_sla_rules')
      .select('resolution_hours')
      .eq('priority', priority)
      .eq('is_active', true)
      .maybeSingle()

    const slaDeadline = new Date()
    slaDeadline.setHours(slaDeadline.getHours() + (slaRule?.resolution_hours || 48))

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('customer_support_tickets')
      .insert({
        customer_id: customerData.id,
        customer_sub_role: customerData.sub_role,
        customer_name: customerData.full_name,
        customer_email: customerData.email,
        customer_phone: customerData.phone,
        subject,
        description,
        category,
        priority,
        is_confidential: is_confidential || false,
        requires_urgent_attention: requires_urgent_attention || false,
        has_loan_reference: !!loan_application_id,
        loan_application_id: loan_application_id || null,
        status: 'new',
        customer_support_status: 'pending',
        sla_deadline: slaDeadline.toISOString()
      })
      .select()
      .maybeSingle()

    if (ticketError) {
      apiLogger.error('Error creating ticket', ticketError)
      return NextResponse.json(
        { error: ticketError.message },
        { status: 500 }
      )
    }

    // Create initial message
    await supabase.from('customer_ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_type: 'customer',
      sender_name: customerData.full_name,
      message: description,
      message_type: 'text',
      is_internal: false
    })

    // Add to department queue based on routing rules
    const { data: routingRule } = await supabase
      .from('customer_ticket_routing_rules')
      .select('auto_assign_department')
      .eq('category', category)
      .eq('is_active', true)
      .order('priority_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const assignedDept = routingRule?.auto_assign_department || 'customer_support'

    await supabase.from('customer_ticket_department_queue').insert({
      ticket_id: ticket.id,
      department: assignedDept,
      sla_deadline: slaDeadline.toISOString()
    })

    // Update ticket with routed department
    await supabase
      .from('customer_support_tickets')
      .update({ routed_to_department: assignedDept })
      .eq('id', ticket.id)

    // Create activity log
    await supabase.from('customer_ticket_activity_log').insert({
      ticket_id: ticket.id,
      action_type: 'created',
      action_by: user.id,
      action_by_type: 'customer',
      action_by_name: customerData.full_name,
      description: `Ticket created with category: ${category}, priority: ${priority}`
    })

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        status: ticket.status,
        routed_to_department: assignedDept
      }
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'createCustomerTicket' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
