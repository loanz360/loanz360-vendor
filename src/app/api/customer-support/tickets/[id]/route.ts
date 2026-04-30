import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customer-support/tickets/[id]
 * Get ticket details with messages and attachments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('customer_support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Check permissions by querying tables directly
    const { data: customerData } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const isCustomer = !!customerData
    let isEmployee = false
    let isSuperAdmin = false

    if (!isCustomer) {
      const { data: empData } = await supabase
        .from('employees')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      isEmployee = !!empData

      if (!isEmployee) {
        const { data: saData } = await supabase
          .from('super_admins')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        isSuperAdmin = !!saData
      }
    }

    if (isCustomer && ticket.customer_id !== customerData.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Fetch messages (exclude internal notes for customers)
    let messagesQuery = supabase
      .from('customer_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (isCustomer) {
      messagesQuery = messagesQuery.eq('is_internal', false)
    }

    const { data: messages } = await messagesQuery

    // Fetch attachments
    const { data: attachments } = await supabase
      .from('customer_ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })

    // Fetch activity log (only for employees and admins)
    let activityLog = []
    if (isEmployee || isSuperAdmin) {
      const { data: activities } = await supabase
        .from('customer_ticket_activity_log')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .limit(50)

      activityLog = activities || []
    }

    // Mark messages as read
    if (isCustomer) {
      await supabase
        .from('customer_ticket_messages')
        .update({ is_read_by_customer: true })
        .eq('ticket_id', ticketId)
        .eq('is_read_by_customer', false)
    } else if (isEmployee) {
      await supabase
        .from('customer_ticket_messages')
        .update({ is_read_by_support: true })
        .eq('ticket_id', ticketId)
        .eq('is_read_by_support', false)
    }

    // Get assigned employee name if assigned
    let assignedToName = null
    if (ticket.assigned_to_customer_support_id) {
      const { data: assignee } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', ticket.assigned_to_customer_support_id)
        .maybeSingle()
      assignedToName = assignee?.full_name
    }

    // Format messages with attachments
    const formattedMessages = (messages || []).map((msg: unknown) => ({
      id: msg.id,
      sender_type: msg.sender_type === 'employee' ? 'support' : msg.sender_type,
      sender_name: msg.sender_name,
      content: msg.message,
      created_at: msg.created_at,
      attachments: (attachments || [])
        .filter((att: unknown) => att.message_id === msg.id)
        .map((att: unknown) => ({
          id: att.id,
          file_name: att.file_name,
          file_type: att.file_type,
          file_size: att.file_size,
          file_url: att.signed_url || `/api/customer-support/tickets/${ticketId}/attachments/${att.id}`
        }))
    }))

    // Format ticket response for frontend
    const formattedTicket = {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      subcategory: ticket.subcategory,
      status: ticket.status,
      priority: ticket.priority,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      resolved_at: ticket.resolved_at,
      closed_at: ticket.closed_at,
      sla_deadline: ticket.sla_deadline,
      sla_status: ticket.sla_status,
      assigned_to_name: assignedToName,
      satisfaction_rating: ticket.satisfaction_rating,
      satisfaction_feedback: ticket.satisfaction_feedback,
      messages: formattedMessages
    }

    return NextResponse.json({
      ticket: formattedTicket,
      attachments: attachments || [],
      activityLog
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'getCustomerTicketDetails', ticketId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/customer-support/tickets/[id]
 * Update ticket (status, priority, assignment, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const bodySchema = z.object({

      status: z.string().optional(),

      priority: z.string().optional(),

      assigned_to_customer_support_id: z.string().uuid().optional(),

      routed_to_department: z.string().optional(),

      routing_note: z.string().optional(),

      internal_notes: z.string().optional(),

      resolution_summary: z.string().optional(),

      satisfaction_rating: z.string().optional(),

      satisfaction_feedback: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Get current ticket
    const { data: ticket } = await supabase
      .from('customer_support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Check permissions by querying tables directly
    const { data: patchCustomerData } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const isCustomer = !!patchCustomerData
    let isEmployee = false
    let isSuperAdmin = false
    let actorName = patchCustomerData?.full_name || 'Unknown'

    if (!isCustomer) {
      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('id', user.id)
        .maybeSingle()
      isEmployee = !!empData
      if (empData) actorName = empData.full_name

      if (!isEmployee) {
        const { data: saData } = await supabase
          .from('super_admins')
          .select('id, full_name')
          .eq('id', user.id)
          .maybeSingle()
        isSuperAdmin = !!saData
        if (saData) actorName = saData.full_name
      }
    }

    // Customers can only update their own tickets and only for specific fields
    if (isCustomer) {
      if (ticket.customer_id !== patchCustomerData.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      // Customers can only update: status (to reopen), satisfaction_rating, satisfaction_feedback
      const allowedCustomerFields = ['status', 'satisfaction_rating', 'satisfaction_feedback']
      const requestedFields = Object.keys(body)
      const hasDisallowedFields = requestedFields.some(f => !allowedCustomerFields.includes(f))
      if (hasDisallowedFields) {
        return NextResponse.json({ success: false, error: 'Forbidden: You can only update status or rating' }, { status: 403 })
      }
      // If updating status, only allow reopening (to 'open')
      if (body.status && body.status !== 'open') {
        return NextResponse.json({ success: false, error: 'Forbidden: You can only reopen tickets' }, { status: 403 })
      }
    } else if (!isEmployee && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by_id: user.id
    }

    // Track changes for activity log
    const changes: { field: string; oldValue: unknown; newValue: unknown}[] = []

    // Handle status change
    if (body.status && body.status !== ticket.status) {
      updateData.status = body.status
      changes.push({ field: 'status', oldValue: ticket.status, newValue: body.status })

      if (body.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = user.id
        if (ticket.first_response_at) {
          const resolutionTime =
            (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
          updateData.resolution_time_hours = resolutionTime
        }
      } else if (body.status === 'closed') {
        updateData.closed_at = new Date().toISOString()
        updateData.closed_by = user.id
      }
    }

    // Handle priority change
    if (body.priority && body.priority !== ticket.priority) {
      updateData.priority = body.priority
      changes.push({ field: 'priority', oldValue: ticket.priority, newValue: body.priority })
    }

    // Handle assignment
    if (body.assigned_to_customer_support_id) {
      updateData.assigned_to_customer_support_id = body.assigned_to_customer_support_id
      changes.push({
        field: 'assigned_to',
        oldValue: ticket.assigned_to_customer_support_id,
        newValue: body.assigned_to_customer_support_id
      })
    }

    // Handle routing
    if (body.routed_to_department) {
      updateData.routed_to_department = body.routed_to_department
      updateData.routed_at = new Date().toISOString()
      if (body.routing_note) {
        updateData.routing_note = body.routing_note
      }
      changes.push({
        field: 'routed_to_department',
        oldValue: ticket.routed_to_department,
        newValue: body.routed_to_department
      })
    }

    // Handle internal notes
    if (body.internal_notes !== undefined) {
      updateData.internal_notes = body.internal_notes
    }

    // Handle resolution summary
    if (body.resolution_summary) {
      updateData.resolution_summary = body.resolution_summary
    }

    // Handle satisfaction rating (typically from customer)
    if (body.satisfaction_rating !== undefined) {
      updateData.satisfaction_rating = body.satisfaction_rating
      updateData.satisfaction_rated_at = new Date().toISOString()
      if (body.satisfaction_feedback) {
        updateData.satisfaction_feedback = body.satisfaction_feedback
      }
      changes.push({
        field: 'satisfaction_rating',
        oldValue: ticket.satisfaction_rating || 'none',
        newValue: body.satisfaction_rating
      })
    }

    // Update ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('customer_support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating ticket', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Log changes in activity log
    const actorType = isCustomer ? 'customer' : 'employee'
    for (const change of changes) {
      await supabase.from('customer_ticket_activity_log').insert({
        ticket_id: ticketId,
        action_type: `${change.field}_changed`,
        action_by: user.id,
        action_by_type: actorType,
        action_by_name: actorName,
        description: `Changed ${change.field} from "${change.oldValue}" to "${change.newValue}"`,
        old_value: String(change.oldValue),
        new_value: String(change.newValue)
      })
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'updateCustomerTicket', ticketId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
