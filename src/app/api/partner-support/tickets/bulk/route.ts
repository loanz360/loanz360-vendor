import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyTicketAssignment, notifyStatusChange } from '@/lib/notifications/ticket-notifications'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/partner-support/tickets/bulk
 * Bulk operations on multiple tickets
 *
 * Supported operations:
 * - assign: Assign multiple tickets to an employee
 * - status_change: Change status of multiple tickets
 * - close: Close multiple tickets
 * - priority_change: Change priority of multiple tickets
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user has permission (employee or super admin)
    const { data: userData } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'EMPLOYEE' && userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const bodySchema = z.object({


      operation: z.string().optional(),


      ticket_ids: z.array(z.unknown()).optional(),


      data: z.record(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { operation, ticket_ids, data } = body

    // Validation
    if (!operation || !ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Required: operation, ticket_ids (array)' },
        { status: 400 }
      )
    }

    if (ticket_ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 tickets per bulk operation' },
        { status: 400 }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Get all tickets for validation
    const { data: tickets, error: fetchError } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .in('id', ticket_ids)

    if (fetchError || !tickets) {
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    if (tickets.length !== ticket_ids.length) {
      return NextResponse.json(
        { error: `Some tickets not found. Expected ${ticket_ids.length}, found ${tickets.length}` },
        { status: 404 }
      )
    }

    switch (operation) {
      case 'assign':
        // Bulk assign to employee
        if (!data?.assigned_to_id) {
          return NextResponse.json(
            { error: 'assigned_to_id is required for assign operation' },
            { status: 400 }
          )
        }

        for (const ticket of tickets) {
          try {
            const { error: updateError } = await supabase
              .from('partner_support_tickets')
              .update({
                assigned_to_partner_support_id: data.assigned_to_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
              })
              .eq('id', ticket.id)

            if (updateError) throw updateError

            // Log activity
            await supabase.from('partner_ticket_activity_log').insert({
              ticket_id: ticket.id,
              action_type: 'assigned',
              action_by: user.id,
              action_by_type: 'employee',
              action_by_name: userData.full_name,
              description: `Bulk assigned to employee via bulk operation`
            })

            // Send notification
            notifyTicketAssignment(
              {
                ticketId: ticket.id,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                status: 'assigned',
                priority: ticket.priority,
                category: ticket.category,
                partnerName: ticket.partner_name,
                partnerEmail: ticket.partner_email,
                slaDeadline: ticket.sla_deadline
              },
              data.assigned_to_id
            ).catch(err => apiLogger.error('Notification error', err))

            results.success++
          } catch (error) {
            results.failed++
            results.errors.push(`Ticket ${ticket.ticket_number}: ${(error as Error).message}`)
          }
        }
        break

      case 'status_change':
        // Bulk status change
        if (!data?.status) {
          return NextResponse.json(
            { error: 'status is required for status_change operation' },
            { status: 400 }
          )
        }

        const validStatuses = ['new', 'assigned', 'in_progress', 'pending_partner', 'pending_internal', 'on_hold', 'resolved', 'closed', 'reopened']
        if (!validStatuses.includes(data.status)) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
            { status: 400 }
          )
        }

        for (const ticket of tickets) {
          try {
            const updates: Record<string, unknown> = { status: data.status }

            if (data.status === 'resolved') {
              updates.resolved_at = new Date().toISOString()
              updates.resolved_by = user.id
            } else if (data.status === 'closed') {
              updates.closed_at = new Date().toISOString()
              updates.closed_by = user.id
            }

            const { error: updateError } = await supabase
              .from('partner_support_tickets')
              .update(updates)
              .eq('id', ticket.id)

            if (updateError) throw updateError

            // Log activity
            await supabase.from('partner_ticket_activity_log').insert({
              ticket_id: ticket.id,
              action_type: 'status_changed',
              action_by: user.id,
              action_by_type: 'employee',
              action_by_name: userData.full_name,
              description: `Bulk status changed from ${ticket.status} to ${data.status}`
            })

            // Send notification
            notifyStatusChange(
              {
                ticketId: ticket.id,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                status: data.status,
                priority: ticket.priority,
                category: ticket.category,
                partnerName: ticket.partner_name,
                partnerEmail: ticket.partner_email,
                slaDeadline: ticket.sla_deadline
              },
              ticket.status,
              data.status
            ).catch(err => apiLogger.error('Notification error', err))

            results.success++
          } catch (error) {
            results.failed++
            results.errors.push(`Ticket ${ticket.ticket_number}: ${(error as Error).message}`)
          }
        }
        break

      case 'close':
        // Bulk close tickets
        for (const ticket of tickets) {
          try {
            const { error: updateError } = await supabase
              .from('partner_support_tickets')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: user.id
              })
              .eq('id', ticket.id)

            if (updateError) throw updateError

            // Log activity
            await supabase.from('partner_ticket_activity_log').insert({
              ticket_id: ticket.id,
              action_type: 'closed',
              action_by: user.id,
              action_by_type: 'employee',
              action_by_name: userData.full_name,
              description: `Bulk closed via bulk operation${data?.reason ? `: ${data.reason}` : ''}`
            })

            // Send notification
            notifyStatusChange(
              {
                ticketId: ticket.id,
                ticketNumber: ticket.ticket_number,
                subject: ticket.subject,
                status: 'closed',
                priority: ticket.priority,
                category: ticket.category,
                partnerName: ticket.partner_name,
                partnerEmail: ticket.partner_email,
                slaDeadline: ticket.sla_deadline
              },
              ticket.status,
              'closed'
            ).catch(err => apiLogger.error('Notification error', err))

            results.success++
          } catch (error) {
            results.failed++
            results.errors.push(`Ticket ${ticket.ticket_number}: ${(error as Error).message}`)
          }
        }
        break

      case 'priority_change':
        // Bulk priority change
        if (!data?.priority) {
          return NextResponse.json(
            { error: 'priority is required for priority_change operation' },
            { status: 400 }
          )
        }

        const validPriorities = ['urgent', 'high', 'medium', 'low']
        if (!validPriorities.includes(data.priority)) {
          return NextResponse.json(
            { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
            { status: 400 }
          )
        }

        for (const ticket of tickets) {
          try {
            const { error: updateError } = await supabase
              .from('partner_support_tickets')
              .update({ priority: data.priority })
              .eq('id', ticket.id)

            if (updateError) throw updateError

            // Log activity
            await supabase.from('partner_ticket_activity_log').insert({
              ticket_id: ticket.id,
              action_type: 'priority_changed',
              action_by: user.id,
              action_by_type: 'employee',
              action_by_name: userData.full_name,
              description: `Bulk priority changed from ${ticket.priority} to ${data.priority}`
            })

            results.success++
          } catch (error) {
            results.failed++
            results.errors.push(`Ticket ${ticket.ticket_number}: ${(error as Error).message}`)
          }
        }
        break

      default:
        return NextResponse.json(
          { error: `Invalid operation. Supported: assign, status_change, close, priority_change` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      operation,
      results: {
        total: ticket_ids.length,
        success: results.success,
        failed: results.failed,
        errors: results.errors
      }
    })
  } catch (error) {
    apiLogger.error('Bulk operation error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
