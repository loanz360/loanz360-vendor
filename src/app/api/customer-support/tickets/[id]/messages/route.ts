
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customer-support/tickets/[id]/messages
 * Add a message/reply to a ticket
 */
export async function POST(
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
    const body = await request.json()
    // Support both 'message' and 'content' field names for compatibility
    const message = body.message || body.content
    const is_internal = body.is_internal || false
    const message_type = body.message_type || 'text'
    const attachment_ids = body.attachment_ids || []

    // Validation
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message cannot be empty' }, { status: 400 })
    }

    // Get ticket
    const { data: ticket } = await supabase
      .from('customer_support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Determine user role by checking tables directly
    const { data: msgCustomerData } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const isCustomer = !!msgCustomerData
    let isEmployee = false

    // Check permissions
    if (isCustomer && ticket.customer_id !== msgCustomerData.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Customers cannot send internal messages
    if (isCustomer && is_internal) {
      return NextResponse.json(
        { error: 'Customers cannot send internal messages' },
        { status: 403 }
      )
    }

    // Determine sender details
    let senderName = 'Unknown'
    let senderType = 'customer'
    let senderRole = null

    if (isCustomer) {
      senderName = msgCustomerData.full_name
      senderType = 'customer'
    } else {
      const { data: employeeData } = await supabase
        .from('employees')
        .select('full_name, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (employeeData) {
        isEmployee = true
        senderName = employeeData.full_name
        senderType = 'employee'
        senderRole = employeeData.sub_role
      }
    }

    // Create message
    const { data: newMessage, error: messageError } = await supabase
      .from('customer_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: senderType,
        sender_name: senderName,
        sender_role: senderRole,
        message: message.trim(),
        message_type,
        is_internal,
        is_read_by_customer: isCustomer, // Mark as read by sender
        is_read_by_support: isEmployee
      })
      .select()
      .maybeSingle()

    if (messageError) {
      apiLogger.error('Error creating message', messageError)
      return NextResponse.json({ success: false, error: messageError.message }, { status: 500 })
    }

    // Update ticket status if needed
    const updates: any = {}

    // Set first response time if this is the first employee response
    if (isEmployee && !ticket.first_response_at) {
      const responseTime =
        (new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
      updates.first_response_at = new Date().toISOString()
      updates.first_response_by = user.id
      updates.response_time_hours = responseTime
    }

    // Update status to in_progress if it's new
    if (ticket.status === 'new' && isEmployee) {
      updates.status = 'in_progress'
    }

    // If customer replied to a pending_customer ticket, change status
    if (ticket.status === 'pending_customer' && isCustomer) {
      updates.status = 'in_progress'
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('customer_support_tickets')
        .update(updates)
        .eq('id', ticketId)
    }

    // Create activity log
    await supabase.from('customer_ticket_activity_log').insert({
      ticket_id: ticketId,
      action_type: 'message_added',
      action_by: user.id,
      action_by_type: senderType,
      action_by_name: senderName,
      description: is_internal
        ? `Added internal note`
        : `Added ${senderType === 'customer' ? 'customer' : 'support'} reply`
    })

    return NextResponse.json({
      success: true,
      message: newMessage
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'addCustomerTicketMessage', ticketId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
