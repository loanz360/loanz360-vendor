import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS, addRateLimitHeaders } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { notifyNewTicket } from '@/lib/notifications/ticket-notifications'
import { autoAssignTicket } from '@/lib/tickets/auto-assignment'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partner-support/tickets
 * List partner tickets (for partners: their own, for employees: department-assigned)
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
    const queue = searchParams.get('queue') // my_queue, urgent, sla_breach, unassigned, all

    // Get user role from profiles table
    const { data: userData } = await supabase
      .from('profiles')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    let query = supabase
      .from('partner_support_tickets')
      .select(`
        *,
        message_count:partner_ticket_messages(count),
        unread_count:partner_ticket_messages(count).eq(is_read_by_partner, false),
        attachments_count:partner_ticket_attachments(count)
      `)
      .order('created_at', { ascending: false })

    // Apply role-based filtering
    if (userData?.role === 'PARTNER') {
      query = query.eq('partner_id', user.id)
    } else if (userData?.role === 'EMPLOYEE') {
      // Get employee's department
      const { data: deptData } = await supabase
        .from('department_employees')
        .select('department')
        .eq('employee_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (deptData) {
        // Apply queue filtering for employees
        if (queue === 'my_queue') {
          // Only tickets assigned to this employee
          query = query.or(
            `assigned_to_partner_support_id.eq.${user.id},` +
            `routed_to_employee_id.eq.${user.id}`
          )
        } else if (queue === 'urgent') {
          // Urgent tickets in employee's department (not yet resolved)
          query = query
            .eq('priority', 'urgent')
            .eq('routed_to_department', deptData.department)
            .not('status', 'in', '(resolved,closed)')
        } else if (queue === 'sla_breach') {
          // SLA breached tickets in department
          query = query
            .eq('sla_breached', true)
            .eq('routed_to_department', deptData.department)
            .not('status', 'in', '(resolved,closed)')
        } else if (queue === 'unassigned') {
          // Tickets in department queue but not assigned to anyone
          query = query
            .eq('routed_to_department', deptData.department)
            .is('assigned_to_partner_support_id', null)
            .is('routed_to_employee_id', null)
            .not('status', 'in', '(resolved,closed)')
        } else {
          // Default: all tickets in department or assigned to employee
          query = query.or(
            `assigned_to_partner_support_id.eq.${user.id},` +
            `routed_to_employee_id.eq.${user.id},` +
            `routed_to_department.eq.${deptData.department}`
          )
        }
      }
    } else if (userData?.role === 'SUPER_ADMIN') {
      // Super admin sees all tickets with queue filtering
      if (queue === 'urgent') {
        query = query.eq('priority', 'urgent').not('status', 'in', '(resolved,closed)')
      } else if (queue === 'sla_breach') {
        query = query.eq('sla_breached', true).not('status', 'in', '(resolved,closed)')
      } else if (queue === 'unassigned') {
        query = query
          .is('assigned_to_partner_support_id', null)
          .is('routed_to_employee_id', null)
          .not('status', 'in', '(resolved,closed)')
      }
      // For 'my_queue' or 'all', super admin sees everything
    } else {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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
      const sanitizedSearch = search.replace(/[%_\\'"();]/g, '')
      if (sanitizedSearch.length > 0) {
        query = query.or(
          `ticket_number.ilike.%${sanitizedSearch}%,subject.ilike.%${sanitizedSearch}%,payout_app_id.ilike.%${sanitizedSearch}%`
        )
      }
    }

    const { data: tickets, error } = await query

    if (error) {
      apiLogger.error('Error fetching tickets', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Calculate counts based on role
    let counts: any = {}

    if (userData?.role === 'EMPLOYEE') {
      // For employees, reuse deptData from above (avoid redundant query)
      const deptForCounts = await supabase
        .from('department_employees')
        .select('department')
        .eq('employee_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      // Fetch only needed columns for counts
      const { data: allDeptTickets } = await supabase
        .from('partner_support_tickets')
        .select('id, status, priority, sla_breached, assigned_to_partner_support_id, routed_to_employee_id')
        .eq('routed_to_department', deptForCounts.data?.department || '')

      counts = {
        my_queue: allDeptTickets?.filter(t =>
          (t.assigned_to_partner_support_id === user.id || t.routed_to_employee_id === user.id)
        ).length || 0,
        urgent: allDeptTickets?.filter(t =>
          t.priority === 'urgent' && !['resolved', 'closed'].includes(t.status)
        ).length || 0,
        sla_breach: allDeptTickets?.filter(t =>
          t.sla_breached && !['resolved', 'closed'].includes(t.status)
        ).length || 0,
        unassigned: allDeptTickets?.filter(t =>
          !t.assigned_to_partner_support_id && !t.routed_to_employee_id && !['resolved', 'closed'].includes(t.status)
        ).length || 0,
        total: allDeptTickets?.length || 0
      }
    } else {
      // For partners and super admins, use status-based counts
      counts = {
        open: tickets?.filter(t => t.status === 'new' || t.status === 'open').length || 0,
        in_progress: tickets?.filter(t => t.status === 'in_progress').length || 0,
        pending_partner: tickets?.filter(t => t.status === 'pending_partner').length || 0,
        resolved: tickets?.filter(t => t.status === 'resolved').length || 0,
        closed: tickets?.filter(t => t.status === 'closed').length || 0,
        total: tickets?.length || 0
      }
    }

    return NextResponse.json({
      tickets: tickets || [],
      counts
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'listTickets' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partner-support/tickets
 * Create new partner ticket
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

    // Verify user is a partner from profiles table
    const { data: userData } = await supabase
      .from('profiles')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'PARTNER') {
      return NextResponse.json(
        { error: 'Only partners can create tickets' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      subject,
      description,
      category,
      priority,
      is_confidential,
      requires_urgent_attention,
      attachments,
      payout_application_id,
      payout_application_type,
      payout_app_id,
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

    // Get partner details from partner_profiles table
    const { data: partnerData } = await supabase
      .from('partner_profiles')
      .select('id, company_name, partner_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!partnerData) {
      return NextResponse.json(
        { error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Get profile info for name and email
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    // Get SLA deadline
    const { data: slaRule } = await supabase
      .from('partner_ticket_sla_rules')
      .select('resolution_hours')
      .eq('priority', priority)
      .eq('is_active', true)
      .maybeSingle()

    const slaDeadline = new Date()
    slaDeadline.setHours(slaDeadline.getHours() + (slaRule?.resolution_hours || 48))

    // Create ticket
    const ticketInsert: Record<string, unknown> = {
      partner_id: user.id,
      partner_sub_role: profileData?.sub_role || userData?.sub_role,
      partner_name: profileData?.full_name || 'Partner',
      partner_email: profileData?.email || user.email,
      subject,
      description,
      category,
      priority,
      is_confidential: is_confidential || false,
      requires_urgent_attention: requires_urgent_attention || false,
      status: 'new',
      partner_support_status: 'pending',
      sla_deadline: slaDeadline.toISOString(),
    }

    // Link to payout application if provided
    if (payout_application_id && payout_application_type) {
      ticketInsert.payout_application_id = payout_application_id
      ticketInsert.payout_application_type = payout_application_type
      if (payout_app_id) {
        ticketInsert.payout_app_id = payout_app_id
      }
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('partner_support_tickets')
      .insert(ticketInsert)
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
    await supabase.from('partner_ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_type: 'partner',
      sender_name: profileData?.full_name || 'Partner',
      sender_role: profileData?.sub_role || userData?.sub_role,
      message: description,
      message_type: 'text',
      is_internal: false
    })

    // Add to department queue based on routing rules
    const { data: routingRule } = await supabase
      .from('partner_ticket_routing_rules')
      .select('auto_assign_department')
      .eq('category', category)
      .eq('is_active', true)
      .order('priority_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Payout-linked tickets are auto-routed to accounts department
    const assignedDept = payout_application_id
      ? 'accounts'
      : (routingRule?.auto_assign_department || 'partner_support')

    await supabase.from('partner_ticket_department_queue').insert({
      ticket_id: ticket.id,
      department: assignedDept,
      sla_deadline: slaDeadline.toISOString()
    })

    // Update ticket with routed department
    await supabase
      .from('partner_support_tickets')
      .update({ routed_to_department: assignedDept })
      .eq('id', ticket.id)

    // Create activity log
    await supabase.from('partner_ticket_activity_log').insert({
      ticket_id: ticket.id,
      action_type: 'created',
      action_by: user.id,
      action_by_type: 'partner',
      action_by_name: profileData?.full_name || 'Partner',
      description: `Ticket created with category: ${category}, priority: ${priority}`
    })

    // Send notifications asynchronously (don't block response)
    notifyNewTicket({
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      subject,
      status: ticket.status,
      priority,
      category,
      partnerName: profileData?.full_name || 'Partner',
      partnerEmail: profileData?.email || user.email || '',
      slaDeadline: slaDeadline.toISOString()
    }).catch(err => apiLogger.error('Notification error', err))

    // Auto-assign if urgent priority
    if (priority === 'urgent' || requires_urgent_attention) {
      autoAssignTicket(ticket.id, 'priority_based')
        .catch(err => apiLogger.error('Auto-assignment error', err))
    }

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
