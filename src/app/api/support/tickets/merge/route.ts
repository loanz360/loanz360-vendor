import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { apiLogger } from '@/lib/utils/logger'

// ============================================================================
// EMPLOYEE TICKET MERGE API
// Merges multiple tickets into a primary ticket
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Check if user is Super Admin or has merge permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, permissions')
      .eq('id', user.id)
      .maybeSingle()

    const canMerge = profile?.role === 'super_admin' ||
                     profile?.role === 'admin' ||
                     profile?.permissions?.includes('ticket:merge')

    if (!canMerge) {
      return NextResponse.json(
        { error: 'Insufficient permissions to merge tickets' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      primaryTicketId: z.string().uuid().optional(),


      ticketIdsToMerge: z.string().optional(),


      reason: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { primaryTicketId, ticketIdsToMerge, reason } = body

    if (!primaryTicketId || !ticketIdsToMerge?.length || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: primaryTicketId, ticketIdsToMerge, reason' },
        { status: 400 }
      )
    }

    // Verify primary ticket exists and is not closed/merged
    const { data: primaryTicket, error: primaryError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', primaryTicketId)
      .maybeSingle()

    if (primaryError || !primaryTicket) {
      return NextResponse.json({ success: false, error: 'Primary ticket not found' }, { status: 404 })
    }

    if (primaryTicket.status === 'merged') {
      return NextResponse.json(
        { error: 'Cannot merge into a ticket that has already been merged' },
        { status: 400 }
      )
    }

    // Verify all tickets to merge exist and are mergeable
    const { data: ticketsToMerge, error: mergeError } = await supabase
      .from('support_tickets')
      .select('*')
      .in('id', ticketIdsToMerge)

    if (mergeError || !ticketsToMerge?.length) {
      return NextResponse.json({ success: false, error: 'Tickets to merge not found' }, { status: 404 })
    }

    const invalidTickets = ticketsToMerge.filter(t => t.status === 'merged')
    if (invalidTickets.length > 0) {
      return NextResponse.json(
        { error: `Some tickets have already been merged: ${invalidTickets.map(t => t.ticket_number).join(', ')}` },
        { status: 400 }
      )
    }

    // Start merge process
    const mergedResults = []

    for (const ticket of ticketsToMerge) {
      // 1. Move messages to primary ticket
      const { data: messages } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)

      if (messages?.length) {
        const messagesToInsert = messages.map(msg => ({
          ...msg,
          id: undefined, // Let database generate new ID
          ticket_id: primaryTicketId,
          content: `[Merged from ${ticket.ticket_number}]\n\n${msg.content}`,
          created_at: msg.created_at
        }))

        await supabase
          .from('support_ticket_messages')
          .insert(messagesToInsert)
      }

      // 2. Move attachments to primary ticket
      const { data: attachments } = await supabase
        .from('support_ticket_attachments')
        .select('*')
        .eq('ticket_id', ticket.id)

      if (attachments?.length) {
        const attachmentsToInsert = attachments.map(att => ({
          ...att,
          id: undefined,
          ticket_id: primaryTicketId
        }))

        await supabase
          .from('support_ticket_attachments')
          .insert(attachmentsToInsert)
      }

      // 3. Add activity log entry to merged ticket
      await supabase
        .from('support_ticket_activity_log')
        .insert({
          ticket_id: ticket.id,
          action: 'merged',
          description: `Ticket merged into ${primaryTicket.ticket_number}. Reason: ${reason}`,
          performed_by: user.id,
          metadata: {
            primary_ticket_id: primaryTicketId,
            primary_ticket_number: primaryTicket.ticket_number,
            reason
          }
        })

      // 4. Update merged ticket status
      await supabase
        .from('support_tickets')
        .update({
          status: 'merged',
          merged_into: primaryTicketId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id)

      mergedResults.push({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        messages_moved: messages?.length || 0,
        attachments_moved: attachments?.length || 0
      })
    }

    // 5. Add activity log to primary ticket
    await supabase
      .from('support_ticket_activity_log')
      .insert({
        ticket_id: primaryTicketId,
        action: 'tickets_merged',
        description: `${ticketsToMerge.length} ticket(s) merged into this ticket. Reason: ${reason}`,
        performed_by: user.id,
        metadata: {
          merged_tickets: mergedResults,
          reason
        }
      })

    // 6. Update primary ticket with merge info
    const totalMessagesMoved = mergedResults.reduce((sum, r) => sum + r.messages_moved, 0)

    await supabase
      .from('support_tickets')
      .update({
        merged_count: (primaryTicket.merged_count || 0) + ticketIdsToMerge.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', primaryTicketId)

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${ticketIdsToMerge.length} ticket(s) into ${primaryTicket.ticket_number}`,
      primaryTicketId,
      mergedTickets: mergedResults,
      totalMessagesMoved,
      totalAttachmentsMoved: mergedResults.reduce((sum, r) => sum + r.attachments_moved, 0)
    })

  } catch (error) {
    apiLogger.error('Merge error', error)
    return NextResponse.json(
      { error: 'Failed to merge tickets' },
      { status: 500 }
    )
  }
}
