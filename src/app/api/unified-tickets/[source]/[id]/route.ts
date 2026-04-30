import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

type TicketSource = 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'

interface RouteParams {
  params: Promise<{
    source: string
    id: string
  }>
}

/**
 * GET /api/unified-tickets/[source]/[id]
 * Get detailed ticket information from any source
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { source, id } = await params
    const ticketSource = source.toUpperCase() as TicketSource

    if (!['EMPLOYEE', 'CUSTOMER', 'PARTNER'].includes(ticketSource)) {
      return NextResponse.json(
        { error: 'Invalid ticket source. Must be EMPLOYEE, CUSTOMER, or PARTNER' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check authorization based on user role
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const { data: employee } = await supabase
      .from('employees')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    let ticket: unknown = null
    let messages: unknown[] = []
    let attachments: unknown[] = []
    let activityLog: unknown[] = []
    let internalNotes: unknown[] = []
    let relatedTickets: unknown[] = []

    // Fetch based on source
    if (ticketSource === 'EMPLOYEE') {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          employee:employees!support_tickets_employee_id_fkey(
            id, full_name, email, sub_role
          )
        `)
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
      }

      // Check access for non-super-admin
      if (!superAdmin) {
        const isOwner = data.employee_id === user.id
        const isAssigned = data.assigned_user_id === user.id
        const isHR = employee?.role === 'hr' || employee?.role === 'HR'

        if (!isOwner && !isAssigned && !isHR) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }
      }

      ticket = {
        ...data,
        ticket_source: 'EMPLOYEE',
        unified_ticket_id: `EMP-${data.ticket_number}`,
        requester_name: data.is_anonymous ? 'Anonymous' : data.employee?.full_name,
        requester_email: data.is_anonymous ? '' : data.employee?.email
      }

      // Fetch messages
      const { data: msgs } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })
      messages = msgs || []

      // Fetch attachments
      const { data: atts } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false })
      attachments = atts || []

      // Fetch activity log
      const { data: logs } = await supabase
        .from('ticket_activity_log')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false })
      activityLog = logs || []

    } else if (ticketSource === 'CUSTOMER') {
      const { data, error } = await supabase
        .from('customer_support_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
      }

      // Check access
      if (!superAdmin && !employee) {
        const isCustomer = data.customer_id === user.id
        if (!isCustomer) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }
      }

      ticket = {
        ...data,
        ticket_source: 'CUSTOMER',
        unified_ticket_id: `CST-${data.ticket_number}`,
        requester_name: data.customer_name,
        requester_email: data.customer_email
      }

      // Fetch messages (only external for customers)
      let msgQuery = supabase
        .from('customer_ticket_messages')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })

      if (!superAdmin && !employee) {
        msgQuery = msgQuery.eq('is_internal', false)
      }
      const { data: msgs } = await msgQuery
      messages = msgs || []

      // Fetch attachments
      const { data: atts } = await supabase
        .from('customer_ticket_attachments')
        .select('*')
        .eq('ticket_id', id)
      attachments = atts || []

      // Fetch activity log (employees/admins only)
      if (superAdmin || employee) {
        const { data: logs } = await supabase
          .from('customer_ticket_activity_log')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: false })
        activityLog = logs || []
      }

    } else if (ticketSource === 'PARTNER') {
      const { data, error } = await supabase
        .from('partner_support_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
      }

      // Check access
      if (!superAdmin && !employee) {
        const isPartner = data.partner_id === user.id
        if (!isPartner) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }
      }

      ticket = {
        ...data,
        ticket_source: 'PARTNER',
        unified_ticket_id: `PTR-${data.ticket_number}`,
        requester_name: data.partner_name,
        requester_email: data.partner_email
      }

      // Fetch messages
      let msgQuery = supabase
        .from('partner_ticket_messages')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true })

      if (!superAdmin && !employee) {
        msgQuery = msgQuery.eq('is_internal', false)
      }
      const { data: msgs } = await msgQuery
      messages = msgs || []

      // Fetch attachments
      const { data: atts } = await supabase
        .from('partner_ticket_attachments')
        .select('*')
        .eq('ticket_id', id)
      attachments = atts || []

      // Fetch activity log
      if (superAdmin || employee) {
        const { data: logs } = await supabase
          .from('partner_ticket_activity_log')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: false })
        activityLog = logs || []

        // Fetch internal notes
        const { data: notes } = await supabase
          .from('partner_ticket_internal_notes')
          .select('*')
          .eq('ticket_id', id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
        internalNotes = notes || []
      }
    }

    // Fetch related tickets
    const { data: relationships } = await supabase
      .from('ticket_relationships')
      .select('*')
      .or(`source_ticket_id.eq.${id},related_ticket_id.eq.${id}`)

    if (relationships) {
      relatedTickets = relationships
    }

    // Fetch tags
    const { data: tags } = await supabase
      .from('ticket_tag_assignments')
      .select(`
        *,
        tag:ticket_tags(*)
      `)
      .eq('ticket_id', id)
      .eq('ticket_type', ticketSource)

    // Fetch watchers
    const { data: watchers } = await supabase
      .from('ticket_watchers')
      .select('*')
      .eq('ticket_id', id)
      .eq('ticket_type', ticketSource)

    return NextResponse.json({
      ticket,
      messages,
      attachments,
      activityLog,
      internalNotes,
      relatedTickets,
      tags: tags || [],
      watchers: watchers || []
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'getUnifiedTicketDetail' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/unified-tickets/[source]/[id]
 * Update ticket from any source
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { source, id } = await params
    const ticketSource = source.toUpperCase() as TicketSource

    if (!['EMPLOYEE', 'CUSTOMER', 'PARTNER'].includes(ticketSource)) {
      return NextResponse.json(
        { error: 'Invalid ticket source' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Only employees and super admins can update
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!superAdmin && !employee) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const bodySchema = z.object({


      status: z.string().optional(),


      priority: z.string().optional(),


      category: z.string().optional(),


      assigned_to_id: z.string().uuid().optional(),


      routed_to_department: z.string().optional(),


      escalation_level: z.string().optional(),


      is_confidential: z.boolean().optional(),


      resolution_notes: z.string().optional(),


      add_message: z.string().optional(),


      escalate: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      status,
      priority,
      category,
      assigned_to_id,
      routed_to_department,
      escalation_level,
      is_confidential,
      resolution_notes,
      add_message,
      escalate
    } = body

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const activityLogs: unknown[] = []
    const updaterName = superAdmin?.full_name || employee?.full_name || 'Unknown'
    const updaterType = superAdmin ? 'super_admin' : 'employee'

    // Get current ticket for comparison
    let currentTicket: unknown = null
    let tableName = ''
    let activityTableName = ''

    if (ticketSource === 'EMPLOYEE') {
      tableName = 'support_tickets'
      activityTableName = 'ticket_activity_log'
      const { data } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle()
      currentTicket = data
    } else if (ticketSource === 'CUSTOMER') {
      tableName = 'customer_support_tickets'
      activityTableName = 'customer_ticket_activity_log'
      const { data } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle()
      currentTicket = data
    } else if (ticketSource === 'PARTNER') {
      tableName = 'partner_support_tickets'
      activityTableName = 'partner_ticket_activity_log'
      const { data } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle()
      currentTicket = data
    }

    if (!currentTicket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Track changes
    if (status && status !== currentTicket.status) {
      updates.status = status
      activityLogs.push({
        ticket_id: id,
        action_type: 'status_changed',
        action_by: user.id,
        action_by_type: updaterType,
        action_by_name: updaterName,
        field_changed: 'status',
        old_value: currentTicket.status,
        new_value: status,
        description: `Status changed from ${currentTicket.status} to ${status}`
      })

      // Handle special status changes
      if (status === 'resolved' && !currentTicket.resolved_at) {
        updates.resolved_at = new Date().toISOString()
        updates.resolved_by = user.id
        if (currentTicket.created_at) {
          const created = new Date(currentTicket.created_at)
          const resolved = new Date()
          updates.resolution_time_hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
        }
      }

      if (status === 'closed') {
        updates.closed_at = new Date().toISOString()
        updates.closed_by = user.id
      }

      if (status === 'reopened') {
        updates.reopened_count = (currentTicket.reopened_count || 0) + 1
        updates.resolved_at = null
        updates.closed_at = null
      }
    }

    if (priority && priority !== currentTicket.priority) {
      updates.priority = priority
      activityLogs.push({
        ticket_id: id,
        action_type: 'priority_changed',
        action_by: user.id,
        action_by_type: updaterType,
        action_by_name: updaterName,
        field_changed: 'priority',
        old_value: currentTicket.priority,
        new_value: priority,
        description: `Priority changed from ${currentTicket.priority} to ${priority}`
      })
    }

    if (escalation_level !== undefined && escalation_level !== currentTicket.escalation_level) {
      updates.escalation_level = escalation_level
      updates.is_escalated = escalation_level > 0
      if (escalation_level > (currentTicket.escalation_level || 0)) {
        updates.escalated_at = new Date().toISOString()
        updates.escalated_to_id = user.id
      }
      activityLogs.push({
        ticket_id: id,
        action_type: 'escalated',
        action_by: user.id,
        action_by_type: updaterType,
        action_by_name: updaterName,
        field_changed: 'escalation_level',
        old_value: String(currentTicket.escalation_level || 0),
        new_value: String(escalation_level),
        description: `Escalation level changed to ${escalation_level}`
      })
    }

    // Source-specific updates
    if (ticketSource === 'EMPLOYEE') {
      if (assigned_to_id) {
        updates.assigned_user_id = assigned_to_id
        activityLogs.push({
          ticket_id: id,
          action_type: 'assigned',
          action_by: user.id,
          action_by_type: updaterType,
          action_by_name: updaterName,
          new_value: assigned_to_id,
          description: `Ticket assigned to user ${assigned_to_id}`
        })
      }
    } else if (ticketSource === 'CUSTOMER') {
      if (assigned_to_id) {
        updates.assigned_to_customer_support_id = assigned_to_id
        activityLogs.push({
          ticket_id: id,
          action_type: 'assigned',
          action_by: user.id,
          action_by_type: updaterType,
          action_by_name: updaterName,
          new_value: assigned_to_id,
          description: `Ticket assigned`
        })
      }
      if (routed_to_department) {
        updates.routed_to_department = routed_to_department
        updates.routed_at = new Date().toISOString()
        activityLogs.push({
          ticket_id: id,
          action_type: 'department_routed',
          action_by: user.id,
          action_by_type: updaterType,
          action_by_name: updaterName,
          new_value: routed_to_department,
          description: `Routed to ${routed_to_department} department`
        })
      }
    } else if (ticketSource === 'PARTNER') {
      if (assigned_to_id) {
        updates.assigned_to_partner_support_id = assigned_to_id
        updates.partner_support_status = 'assigned'
        activityLogs.push({
          ticket_id: id,
          action_type: 'assigned',
          action_by: user.id,
          action_by_type: updaterType,
          action_by_name: updaterName,
          new_value: assigned_to_id,
          description: `Ticket assigned`
        })
      }
      if (routed_to_department) {
        updates.routed_to_department = routed_to_department
        updates.routed_at = new Date().toISOString()
        updates.partner_support_status = 'routed_to_dept'
        activityLogs.push({
          ticket_id: id,
          action_type: 'department_routed',
          action_by: user.id,
          action_by_type: updaterType,
          action_by_name: updaterName,
          new_value: routed_to_department,
          description: `Routed to ${routed_to_department} department`
        })
      }
    }

    if (is_confidential !== undefined) {
      updates.is_confidential = is_confidential
    }

    // Handle escalate boolean shorthand (from UI escalate button)
    if (escalate === true && escalation_level === undefined) {
      const newLevel = (currentTicket.escalation_level || 0) + 1
      updates.escalation_level = newLevel
      updates.is_escalated = true
      updates.escalated_at = new Date().toISOString()
      updates.escalated_to_id = user.id
      if (currentTicket.status !== 'escalated') {
        updates.status = 'escalated'
      }
      activityLogs.push({
        ticket_id: id,
        action_type: 'escalated',
        action_by: user.id,
        action_by_type: updaterType,
        action_by_name: updaterName,
        field_changed: 'escalation_level',
        old_value: String(currentTicket.escalation_level || 0),
        new_value: String(newLevel),
        description: `Ticket escalated to level ${newLevel}`
      })
    }

    // Perform update
    const { data: updatedTicket, error: updateError } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Update error', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update ticket' }, { status: 500 })
    }

    // Insert activity logs
    if (activityLogs.length > 0) {
      await supabase.from(activityTableName).insert(activityLogs)
    }

    // Handle add_message
    if (add_message && add_message.content?.trim()) {
      let messageTableName = ''
      const messagePayload: Record<string, unknown> = {
        ticket_id: id,
        content: add_message.content.trim(),
        is_internal: add_message.is_internal || false,
        created_at: new Date().toISOString()
      }

      if (ticketSource === 'EMPLOYEE') {
        messageTableName = 'ticket_messages'
        messagePayload.sender_id = user.id
        messagePayload.sender_type = superAdmin ? 'support' : 'employee'
        messagePayload.sender_name = updaterName
      } else if (ticketSource === 'CUSTOMER') {
        messageTableName = 'customer_ticket_messages'
        messagePayload.sender_id = user.id
        messagePayload.sender_type = 'support'
        messagePayload.sender_name = updaterName
      } else if (ticketSource === 'PARTNER') {
        messageTableName = 'partner_ticket_messages'
        messagePayload.sender_id = user.id
        messagePayload.sender_type = 'support'
        messagePayload.sender_name = updaterName
      }

      if (messageTableName) {
        const { error: msgError } = await supabase
          .from(messageTableName)
          .insert(messagePayload)

        if (msgError) {
          apiLogger.error('Message insert error', msgError)
        }

        // Track first response time
        if (!currentTicket.first_response_at) {
          const firstResponseUpdate: Record<string, unknown> = {
            first_response_at: new Date().toISOString()
          }
          const created = new Date(currentTicket.created_at)
          firstResponseUpdate.response_time_hours =
            (new Date().getTime() - created.getTime()) / (1000 * 60 * 60)

          await supabase.from(tableName).update(firstResponseUpdate).eq('id', id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      ticket: {
        ...updatedTicket || currentTicket,
        ticket_source: ticketSource,
        unified_ticket_id: `${ticketSource.substring(0, 3)}-${(updatedTicket || currentTicket).ticket_number}`
      }
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'updateUnifiedTicket' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
