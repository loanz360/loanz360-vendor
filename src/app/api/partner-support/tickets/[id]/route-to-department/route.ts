
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/partner-support/tickets/[id]/route-to-department
 * Route ticket to specialized department
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

    // Only employees and super admin can route tickets
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'EMPLOYEE' && userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      routed_to_department,
      routed_to_employee_id,
      routing_note
    } = body

    if (!routed_to_department) {
      return NextResponse.json(
        { error: 'Department is required' },
        { status: 400 }
      )
    }

    // Get employee name for activity log
    const { data: empData } = await supabase
      .from('employee_profile')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const employeeName = empData
      ? `${empData.first_name} ${empData.last_name}`
      : 'Employee'

    // Update ticket
    const { error: updateError } = await supabase
      .from('partner_support_tickets')
      .update({
        routed_to_department,
        routed_to_employee_id: routed_to_employee_id || null,
        routed_at: new Date().toISOString(),
        routing_note: routing_note || null,
        partner_support_status: 'routed_to_dept',
        status: 'assigned'
      })
      .eq('id', ticketId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Update department queue
    await supabase
      .from('partner_ticket_department_queue')
      .update({
        department: routed_to_department,
        entered_queue_at: new Date().toISOString()
      })
      .eq('ticket_id', ticketId)

    // Log activity
    await supabase.from('partner_ticket_activity_log').insert({
      ticket_id: ticketId,
      action_type: 'department_routed',
      action_by: user.id,
      action_by_type: 'employee',
      action_by_name: employeeName,
      field_changed: 'routed_to_department',
      new_value: routed_to_department,
      description: `Ticket routed to ${routed_to_department} department${routing_note ? ': ' + routing_note : ''}`
    })

    // Add internal note with routing details
    if (routing_note) {
      await supabase.from('partner_ticket_internal_notes').insert({
        ticket_id: ticketId,
        note: routing_note,
        note_type: 'general',
        created_by: user.id,
        created_by_type: 'employee',
        created_by_name: employeeName,
        created_by_department: 'partner_support'
      })
    }

    return NextResponse.json({
      success: true,
      message: `Ticket routed to ${routed_to_department} department`
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
