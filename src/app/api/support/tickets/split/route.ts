
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { apiLogger } from '@/lib/utils/logger'

// ============================================================================
// EMPLOYEE TICKET SPLIT API
// Splits a ticket by creating a new ticket from selected messages
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate unique ticket number
function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `EMP-${timestamp}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('sb-access-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has split permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, permissions')
      .eq('id', user.id)
      .maybeSingle()

    const canSplit = profile?.role === 'super_admin' ||
                     profile?.role === 'admin' ||
                     profile?.permissions?.includes('ticket:split')

    if (!canSplit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to split tickets' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { originalTicketId, messageIds, newTicket, reason } = body

    if (!originalTicketId || !messageIds?.length || !newTicket?.subject || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: originalTicketId, messageIds, newTicket.subject, reason' },
        { status: 400 }
      )
    }

    // Verify original ticket exists
    const { data: originalTicketData, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', originalTicketId)
      .maybeSingle()

    if (ticketError || !originalTicketData) {
      return NextResponse.json({ success: false, error: 'Original ticket not found' }, { status: 404 })
    }

    // Verify messages exist and belong to original ticket
    const { data: messages, error: messagesError } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .in('id', messageIds)
      .eq('ticket_id', originalTicketId)

    if (messagesError || messages?.length !== messageIds.length) {
      return NextResponse.json(
        { error: 'Some messages not found or do not belong to this ticket' },
        { status: 400 }
      )
    }

    // Generate new ticket number
    const newTicketNumber = generateTicketNumber()

    // Create new ticket
    const { data: createdTicket, error: createError } = await supabase
      .from('support_tickets')
      .insert({
        ticket_number: newTicketNumber,
        employee_id: originalTicketData.employee_id,
        subject: newTicket.subject,
        description: `Split from ticket ${originalTicketData.ticket_number}.\n\nReason: ${reason}`,
        category: originalTicketData.category,
        priority: newTicket.priority || originalTicketData.priority,
        status: 'open',
        assigned_to: originalTicketData.assigned_to,
        split_from: originalTicketId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (createError || !createdTicket) {
      apiLogger.error('Create ticket error', createError)
      return NextResponse.json({ success: false, error: 'Failed to create new ticket' }, { status: 500 })
    }

    // Copy selected messages to new ticket
    const messagesToInsert = messages.map(msg => ({
      ticket_id: createdTicket.id,
      sender_type: msg.sender_type,
      sender_id: msg.sender_id,
      content: msg.content,
      is_internal: msg.is_internal,
      created_at: msg.created_at
    }))

    const { error: insertMessagesError } = await supabase
      .from('support_ticket_messages')
      .insert(messagesToInsert)

    if (insertMessagesError) {
      apiLogger.error('Insert messages error', insertMessagesError)
      // Rollback - delete the created ticket
      await supabase.from('support_tickets').delete().eq('id', createdTicket.id)
      return NextResponse.json({ success: false, error: 'Failed to copy messages' }, { status: 500 })
    }

    // Copy any attachments from the selected messages
    const { data: attachments } = await supabase
      .from('support_ticket_attachments')
      .select('*')
      .eq('ticket_id', originalTicketId)
      .in('message_id', messageIds)

    if (attachments?.length) {
      // Get the mapping of old message IDs to new message IDs
      const { data: newMessages } = await supabase
        .from('support_ticket_messages')
        .select('id, created_at')
        .eq('ticket_id', createdTicket.id)
        .order('created_at')

      // Map attachments to new ticket (simplified - attach to ticket without specific message)
      const attachmentsToInsert = attachments.map(att => ({
        ticket_id: createdTicket.id,
        file_name: att.file_name,
        file_type: att.file_type,
        file_size: att.file_size,
        file_url: att.file_url,
        uploaded_by: att.uploaded_by,
        created_at: att.created_at
      }))

      await supabase
        .from('support_ticket_attachments')
        .insert(attachmentsToInsert)
    }

    // Add note to original messages indicating split
    for (const messageId of messageIds) {
      await supabase
        .from('support_ticket_messages')
        .update({
          content: supabase.rpc('concat_split_note', {
            original_content: messages.find(m => m.id === messageId)?.content || '',
            new_ticket_number: newTicketNumber
          })
        })
        .eq('id', messageId)
    }

    // Fallback: Update messages with split note directly
    await supabase
      .from('support_ticket_messages')
      .update({
        metadata: {
          split_to: createdTicket.id,
          split_to_ticket_number: newTicketNumber
        }
      })
      .in('id', messageIds)

    // Add activity log to original ticket
    await supabase
      .from('support_ticket_activity_log')
      .insert({
        ticket_id: originalTicketId,
        action: 'split',
        description: `${messageIds.length} message(s) split to new ticket ${newTicketNumber}. Reason: ${reason}`,
        performed_by: user.id,
        metadata: {
          new_ticket_id: createdTicket.id,
          new_ticket_number: newTicketNumber,
          message_ids: messageIds,
          reason
        }
      })

    // Add activity log to new ticket
    await supabase
      .from('support_ticket_activity_log')
      .insert({
        ticket_id: createdTicket.id,
        action: 'created_from_split',
        description: `Ticket created from split of ${originalTicketData.ticket_number}`,
        performed_by: user.id,
        metadata: {
          original_ticket_id: originalTicketId,
          original_ticket_number: originalTicketData.ticket_number,
          message_count: messageIds.length,
          reason
        }
      })

    // Update original ticket
    await supabase
      .from('support_tickets')
      .update({
        split_count: (originalTicketData.split_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', originalTicketId)

    return NextResponse.json({
      success: true,
      message: `Successfully split ${messageIds.length} message(s) to new ticket ${newTicketNumber}`,
      newTicketId: createdTicket.id,
      newTicketNumber: newTicketNumber,
      messageCount: messageIds.length,
      attachmentCount: attachments?.length || 0
    })

  } catch (error) {
    apiLogger.error('Split error', error)
    return NextResponse.json(
      { error: 'Failed to split ticket' },
      { status: 500 }
    )
  }
}
