
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { notifyTicketAssignment, notifyStatusChange } from '@/lib/notifications/ticket-notifications'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partner-support/tickets/[id]
 * Get single ticket with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Verify access
    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const hasAccess =
      userData?.role === 'SUPER_ADMIN' ||
      (userData?.role === 'PARTNER' && ticket.partner_id === user.id) ||
      (userData?.role === 'EMPLOYEE' &&
        (ticket.assigned_to_partner_support_id === user.id ||
          ticket.routed_to_employee_id === user.id))

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get messages (exclude internal notes for partners)
    const messagesQuery = supabase
      .from('partner_ticket_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (userData?.role === 'PARTNER') {
      messagesQuery.eq('is_internal', false)
    }

    const { data: messages } = await messagesQuery

    // Get attachments
    const { data: attachments } = await supabase
      .from('partner_ticket_attachments')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })

    // Get activity log
    const { data: activityLog } = await supabase
      .from('partner_ticket_activity_log')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })

    // Get internal notes (employees only)
    let internalNotes = null
    if (userData?.role === 'EMPLOYEE' || userData?.role === 'SUPER_ADMIN') {
      const { data } = await supabase
        .from('partner_ticket_internal_notes')
        .select('*')
        .eq('ticket_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      internalNotes = data
    }

    // Mark messages as read
    if (userData?.role === 'PARTNER') {
      await supabase
        .from('partner_ticket_messages')
        .update({ is_read_by_partner: true, read_by_partner_at: new Date().toISOString() })
        .eq('ticket_id', id)
        .eq('is_read_by_partner', false)
    } else if (userData?.role === 'EMPLOYEE' || userData?.role === 'SUPER_ADMIN') {
      await supabase
        .from('partner_ticket_messages')
        .update({ is_read_by_internal: true, read_by_internal_at: new Date().toISOString() })
        .eq('ticket_id', id)
        .eq('is_read_by_internal', false)
    }

    return NextResponse.json({
      ticket,
      messages: messages || [],
      attachments: attachments || [],
      activity_log: activityLog || [],
      internal_notes: internalNotes || []
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/partner-support/tickets/[id]
 * Update ticket (status, priority, assignment)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      status,
      priority,
      assigned_to_partner_support_id,
      routed_to_department,
      routed_to_employee_id,
      routing_note,
      escalation_level,
      escalated_to_id,
      escalation_reason
    } = body

    // Get user role
    const { data: userData } = await supabase
      .from('profiles')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    // Only employees and super admin can update
    if (userData?.role !== 'EMPLOYEE' && userData?.role !== 'SUPER_ADMIN') {
      // Partners can only reopen resolved tickets
      if (status === 'reopened') {
        // Get current ticket to check status and reopened_count
        const { data: currentTicket } = await supabase
          .from('partner_support_tickets')
          .select('reopened_count, status')
          .eq('id', id)
          .eq('partner_id', user.id)
          .maybeSingle()

        if (!currentTicket || currentTicket.status !== 'resolved') {
          return NextResponse.json({ success: false, error: 'Only resolved tickets can be reopened' }, { status: 400 })
        }

        const { error: updateError } = await supabase
          .from('partner_support_tickets')
          .update({
            status: 'reopened',
            reopened_count: (currentTicket.reopened_count || 0) + 1
          })
          .eq('id', id)
          .eq('partner_id', user.id)

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        // Log activity
        await supabase.from('partner_ticket_activity_log').insert({
          ticket_id: id,
          action_type: 'reopened',
          action_by: user.id,
          action_by_type: 'partner',
          action_by_name: 'Partner',
          description: 'Ticket reopened by partner'
        })

        return NextResponse.json({ success: true })
      }

      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() }

    if (status) {
      updates.status = status
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString()
        updates.resolved_by = user.id

        // Calculate resolution time
        const { data: ticket } = await supabase
          .from('partner_support_tickets')
          .select('created_at')
          .eq('id', id)
          .maybeSingle()

        if (ticket) {
          const createdAt = new Date(ticket.created_at)
          const now = new Date()
          const hours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
          updates.resolution_time_hours = hours.toFixed(2)
        }
      } else if (status === 'closed') {
        updates.closed_at = new Date().toISOString()
        updates.closed_by = user.id
      } else if (status === 'reopened') {
        // Fetch current count and increment in JS (no RPC needed)
        const { data: reopenTicket } = await supabase
          .from('partner_support_tickets')
          .select('reopened_count')
          .eq('id', id)
          .maybeSingle()
        updates.reopened_count = (reopenTicket?.reopened_count || 0) + 1
      }
    }

    if (priority) updates.priority = priority
    if (assigned_to_partner_support_id) updates.assigned_to_partner_support_id = assigned_to_partner_support_id
    if (routed_to_department) {
      updates.routed_to_department = routed_to_department
      updates.routed_at = new Date().toISOString()
      updates.partner_support_status = 'routed_to_dept'
    }
    if (routed_to_employee_id) updates.routed_to_employee_id = routed_to_employee_id
    if (routing_note) updates.routing_note = routing_note

    if (escalation_level !== undefined) {
      updates.is_escalated = escalation_level > 0
      updates.escalation_level = escalation_level
      updates.escalated_at = new Date().toISOString()
    }
    if (escalated_to_id) updates.escalated_to_id = escalated_to_id
    if (escalation_reason) updates.escalation_reason = escalation_reason

    // Check if this is first response
    const { data: existingTicket } = await supabase
      .from('partner_support_tickets')
      .select('first_response_at, created_at')
      .eq('id', id)
      .maybeSingle()

    if (existingTicket && !existingTicket.first_response_at && (status === 'in_progress' || status === 'resolved')) {
      updates.first_response_at = new Date().toISOString()
      updates.first_response_by = user.id

      // Calculate response time
      const createdAt = new Date(existingTicket.created_at)
      const now = new Date()
      const hours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      updates.response_time_hours = hours.toFixed(2)
    }

    // Get old ticket data for comparison
    const { data: oldTicket } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    // Update ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('partner_support_tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Send notifications asynchronously
    if (assigned_to_partner_support_id && assigned_to_partner_support_id !== oldTicket?.assigned_to_partner_support_id) {
      // Assignment notification
      notifyTicketAssignment(
        {
          ticketId: id,
          ticketNumber: updatedTicket.ticket_number,
          subject: updatedTicket.subject,
          status: updatedTicket.status,
          priority: updatedTicket.priority,
          category: updatedTicket.category,
          partnerName: updatedTicket.partner_name,
          partnerEmail: updatedTicket.partner_email,
          slaDeadline: updatedTicket.sla_deadline
        },
        assigned_to_partner_support_id
      ).catch(err => apiLogger.error('Assignment notification error', err))
    }

    if (status && status !== oldTicket?.status) {
      // Status change notification
      notifyStatusChange(
        {
          ticketId: id,
          ticketNumber: updatedTicket.ticket_number,
          subject: updatedTicket.subject,
          status: updatedTicket.status,
          priority: updatedTicket.priority,
          category: updatedTicket.category,
          partnerName: updatedTicket.partner_name,
          partnerEmail: updatedTicket.partner_email,
          slaDeadline: updatedTicket.sla_deadline
        },
        oldTicket?.status,
        status
      ).catch(err => apiLogger.error('Status change notification error', err))
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
