import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { autoAssignTicket, AssignmentStrategy } from '@/lib/tickets/auto-assignment'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyTicketAssignment } from '@/lib/notifications/ticket-notifications'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/partner-support/tickets/[id]/auto-assign
 * Auto-assign ticket to best available employee
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id: ticketId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user has permission (employee or super admin)
    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'EMPLOYEE' && userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get strategy from request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr.catch(() => ({}))
    const strategy: AssignmentStrategy = body.strategy || 'workload_based'

    // Validate strategy
    const validStrategies = ['round_robin', 'workload_based', 'skill_based', 'priority_based']
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` },
        { status: 400 }
      )
    }

    // Perform auto-assignment
    const result = await autoAssignTicket(ticketId, strategy)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          reason: result.reason
        },
        { status: 400 }
      )
    }

    // Get updated ticket details for notification
    const { data: ticket } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    // Send assignment notification
    if (ticket && result.assignedTo) {
      notifyTicketAssignment(
        {
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          partnerName: ticket.partner_name,
          partnerEmail: ticket.partner_email,
          slaDeadline: ticket.sla_deadline
        },
        result.assignedTo
      ).catch(err => apiLogger.error('Notification error', err))
    }

    return NextResponse.json({
      success: true,
      assignedTo: result.assignedTo,
      assignedToName: result.assignedToName,
      strategy: result.strategy,
      reason: result.reason
    })
  } catch (error) {
    apiLogger.error('Auto-assign error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
