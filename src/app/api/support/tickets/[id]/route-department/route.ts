import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// POST /api/support/tickets/[id]/route-department - Route ticket to another department
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const ticketId = params.id

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user details
    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin

    if (!isHR && !isSuperAdmin && !employee) {
      return NextResponse.json(
        { error: 'Only HR, Super Admin, or assigned employees can route tickets' },
        { status: 403 }
      )
    }

    // Parse request
    const bodySchema = z.object({

      to_department_code: z.string(),

      route_type: z.string().optional().default('escalation'),

      reason: z.string(),

      requires_approval: z.boolean().optional().default(true),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      to_department_code,
      route_type = 'escalation',
      reason,
      requires_approval = true
    } = body

    // Validation
    if (!to_department_code) {
      return NextResponse.json(
        { error: 'to_department_code is required' },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'reason is required' },
        { status: 400 }
      )
    }

    const validRouteTypes = ['escalation', 'handoff', 'collaboration', 'consultation']
    if (!validRouteTypes.includes(route_type)) {
      return NextResponse.json(
        { error: `route_type must be one of: ${validRouteTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Call database function to route ticket
    const { data: routingId, error: routeError } = await supabase
      .rpc('route_ticket_to_department', {
        p_ticket_id: ticketId,
        p_to_department_code: to_department_code,
        p_route_type: route_type,
        p_reason: reason,
        p_routed_by: user.id,
        p_routed_by_name: employee?.full_name || superAdmin?.full_name || 'User',
        p_requires_approval: requires_approval
      })

    if (routeError) {
      apiLogger.error('Error routing ticket', routeError)
      return NextResponse.json(
        { error: `Failed to route ticket: ${routeError.message}` },
        { status: 500 }
      )
    }

    // Get routing details
    const { data: routing } = await supabase
      .from('ticket_department_routing')
      .select(`
        *,
        from_department:departments!ticket_department_routing_from_department_id_fkey(id, name, code),
        to_department:departments!ticket_department_routing_to_department_id_fkey(id, name, code)
      `)
      .eq('id', routingId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      routing,
      message: requires_approval
        ? `Ticket routing to ${to_department_code} department pending approval`
        : `Ticket successfully routed to ${to_department_code} department`
    })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/tickets/[id]/route-department', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/support/tickets/[id]/route-department - Get routing history for ticket
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const ticketId = params.id

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get routing history
    const { data: routings, error } = await supabase
      .from('ticket_department_routing')
      .select(`
        *,
        from_department:departments!ticket_department_routing_from_department_id_fkey(id, name, code),
        to_department:departments!ticket_department_routing_to_department_id_fkey(id, name, code)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching routing history', error)
      return NextResponse.json(
        { error: 'Failed to fetch routing history' },
        { status: 500 }
      )
    }

    return NextResponse.json({ routings })
  } catch (error) {
    apiLogger.error('Error in GET /api/support/tickets/[id]/route-department', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
