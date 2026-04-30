
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  escalateTicket,
  acknowledgeEscalation,
  resolveEscalation,
  deEscalateTicket,
  getEscalationHistory,
  getPendingEscalations,
  getEscalationStats,
  processAutoEscalations,
  EscalationTrigger,
  EscalationLevel
} from '@/lib/tickets/escalation-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/escalation
 * Get escalation data (history, pending, stats)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'pending' // 'history', 'pending', 'stats', 'process'
    const ticketId = searchParams.get('ticket_id')
    const source = searchParams.get('source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
    const period = searchParams.get('period') || '30d'

    // Mode: Get escalation history for a ticket
    if (mode === 'history' && ticketId && source) {
      const history = await getEscalationHistory(ticketId, source)
      return NextResponse.json({ history })
    }

    // Mode: Get pending escalations for current user
    if (mode === 'pending') {
      const userId = searchParams.get('user_id') || user.id
      const escalations = await getPendingEscalations(userId)

      // Enrich with ticket details
      const enrichedEscalations = await Promise.all(
        escalations.map(async (esc) => {
          const tableName = getTableName(esc.ticket_source)
          const { data: ticket } = await supabase
            .from(tableName)
            .select('ticket_number, subject, priority, status, created_at')
            .eq('id', esc.ticket_id)
            .maybeSingle()

          return {
            ...esc,
            ticket
          }
        })
      )

      return NextResponse.json({ escalations: enrichedEscalations })
    }

    // Mode: Get escalation statistics
    if (mode === 'stats') {
      const endDate = new Date()
      const startDate = new Date()

      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(startDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(startDate.getDate() - 90)
          break
        case '365d':
          startDate.setDate(startDate.getDate() - 365)
          break
      }

      const stats = await getEscalationStats(startDate, endDate, source || undefined)
      return NextResponse.json({ stats })
    }

    // Mode: Process auto-escalations (admin only)
    if (mode === 'process') {
      const escalatedCount = await processAutoEscalations()
      return NextResponse.json({ escalated_count: escalatedCount })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/escalation
 * Create a new escalation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      ticket_id,
      ticket_source,
      trigger,
      trigger_details,
      target_user_id,
      target_level
    } = body

    if (!ticket_id || !ticket_source || !trigger) {
      return NextResponse.json(
        { error: 'Missing required fields: ticket_id, ticket_source, trigger' },
        { status: 400 }
      )
    }

    // Get user details
    const { data: employee } = await supabase
      .from('employees')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    const escalation = await escalateTicket(
      ticket_id,
      ticket_source as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
      trigger as EscalationTrigger,
      trigger_details,
      user.id,
      employee?.name || user.email || 'Unknown',
      target_user_id,
      target_level as EscalationLevel | undefined
    )

    if (!escalation) {
      return NextResponse.json({ success: false, error: 'Failed to escalate ticket' }, { status: 500 })
    }

    return NextResponse.json({ escalation })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/escalation
 * Update escalation status (acknowledge, resolve, de-escalate)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { escalation_id, action, notes, ticket_id, ticket_source, to_level, reason } = body

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 })
    }

    let success = false

    switch (action) {
      case 'acknowledge':
        if (!escalation_id) {
          return NextResponse.json({ success: false, error: 'Missing escalation_id' }, { status: 400 })
        }
        success = await acknowledgeEscalation(escalation_id, user.id)
        break

      case 'resolve':
        if (!escalation_id) {
          return NextResponse.json({ success: false, error: 'Missing escalation_id' }, { status: 400 })
        }
        success = await resolveEscalation(escalation_id, user.id, notes)
        break

      case 'de_escalate':
        if (!ticket_id || !ticket_source || !to_level || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields for de-escalation' },
            { status: 400 }
          )
        }

        const { data: employee } = await supabase
          .from('employees')
          .select('name')
          .eq('id', user.id)
          .maybeSingle()

        const deEscalation = await deEscalateTicket(
          ticket_id,
          ticket_source as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
          to_level as EscalationLevel,
          reason,
          user.id,
          employee?.name || user.email || 'Unknown'
        )

        if (deEscalation) {
          return NextResponse.json({ escalation: deEscalation })
        }
        break

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    if (success) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Operation failed' }, { status: 500 })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function
function getTableName(source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'): string {
  switch (source) {
    case 'EMPLOYEE':
      return 'employee_support_tickets'
    case 'CUSTOMER':
      return 'customer_support_tickets'
    case 'PARTNER':
      return 'partner_support_tickets'
  }
}
