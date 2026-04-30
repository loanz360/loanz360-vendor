
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { notifyNewMessage } from '@/lib/notifications/ticket-notifications'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/partner-support/tickets/[id]/messages
 * Add message/reply to ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id: ticketId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, parent_message_id, is_internal } = body

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('partner_support_tickets')
      .select('*, partner_id, status')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Get user details and role
    const { data: userData } = await supabase
      .from('profiles')
      .select('role, sub_role, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    let senderType: 'partner' | 'employee' | 'super_admin' = 'partner'
    let senderName = ''
    let senderRole = ''

    if (userData?.role === 'PARTNER') {
      senderName = userData?.full_name || 'Partner'
      senderRole = userData?.sub_role || ''
      senderType = 'partner'

      // Partners cannot send internal notes
      if (is_internal) {
        return NextResponse.json(
          { error: 'Partners cannot send internal notes' },
          { status: 403 }
        )
      }

      // Check if ticket is closed
      if (ticket.status === 'closed') {
        return NextResponse.json(
          { error: 'Cannot reply to closed ticket' },
          { status: 400 }
        )
      }
    } else if (userData?.role === 'EMPLOYEE') {
      senderName = userData?.full_name || 'Employee'
      senderRole = userData?.sub_role || ''
      senderType = 'employee'
    } else if (userData?.role === 'SUPER_ADMIN') {
      senderName = 'Super Admin'
      senderRole = 'Super Admin'
      senderType = 'super_admin'
    }

    // Insert message
    const { data: newMessage, error: messageError } = await supabase
      .from('partner_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: senderType,
        sender_name: senderName,
        sender_role: senderRole,
        message: message.trim(),
        message_type: 'text',
        parent_message_id: parent_message_id || null,
        is_internal: is_internal || false,
        is_read_by_partner: senderType === 'partner',
        is_read_by_internal: senderType !== 'partner'
      })
      .select()
      .maybeSingle()

    if (messageError) {
      return NextResponse.json(
        { error: messageError.message },
        { status: 500 }
      )
    }

    // Update ticket status based on who replied
    let statusUpdate: any = {}

    if (senderType === 'partner' && ticket.status === 'resolved') {
      // Partner replies to resolved ticket -> reopen
      statusUpdate = {
        status: 'reopened',
        reopened_count: ticket.reopened_count + 1
      }

      // Log activity
      await supabase.from('partner_ticket_activity_log').insert({
        ticket_id: ticketId,
        action_type: 'reopened',
        action_by: user.id,
        action_by_type: senderType,
        action_by_name: senderName,
        description: 'Ticket reopened by partner response'
      })
    } else if (senderType !== 'partner' && ticket.status === 'new') {
      // Employee/Admin replies to new ticket -> in_progress
      statusUpdate = {
        status: 'in_progress',
        first_response_at: new Date().toISOString(),
        first_response_by: user.id
      }

      // Calculate response time
      const createdAt = new Date(ticket.created_at)
      const now = new Date()
      const hours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      statusUpdate.response_time_hours = hours.toFixed(2)
    }

    if (Object.keys(statusUpdate).length > 0) {
      await supabase
        .from('partner_support_tickets')
        .update(statusUpdate)
        .eq('id', ticketId)
    }

    // Log activity
    await supabase.from('partner_ticket_activity_log').insert({
      ticket_id: ticketId,
      action_type: is_internal ? 'internal_note_added' : 'replied',
      action_by: user.id,
      action_by_type: senderType,
      action_by_name: senderName,
      description: is_internal
        ? 'Added internal note'
        : `${senderType === 'partner' ? 'Partner' : 'Support team'} replied to ticket`
    })

    // Send notification asynchronously (only for non-internal messages)
    if (!is_internal) {
      notifyNewMessage(
        {
          ticketId: ticketId,
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          partnerName: ticket.partner_name,
          partnerEmail: ticket.partner_email,
          slaDeadline: ticket.sla_deadline
        },
        senderType === 'partner' ? 'partner' : 'employee',
        user.id,
        message.substring(0, 200)
      ).catch(err => apiLogger.error('Message notification error', err))
    }

    return NextResponse.json({
      success: true,
      message: newMessage
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
