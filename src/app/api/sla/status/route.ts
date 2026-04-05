export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  calculateSLAStatus,
  getAtRiskTickets,
  generateSLAComplianceReport
} from '@/lib/tickets/sla-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/sla/status
 * Get SLA status for tickets or at-risk tickets
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticket_id')
    const source = searchParams.get('source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
    const mode = searchParams.get('mode') || 'single' // 'single', 'at_risk', 'report'

    // Mode: Get SLA status for a single ticket
    if (mode === 'single' && ticketId && source) {
      // Get ticket details
      let tableName: string
      switch (source) {
        case 'EMPLOYEE':
          tableName = 'employee_support_tickets'
          break
        case 'CUSTOMER':
          tableName = 'customer_support_tickets'
          break
        case 'PARTNER':
          tableName = 'partner_support_tickets'
          break
        default:
          return NextResponse.json({ success: false, error: 'Invalid source' }, { status: 400 })
      }

      const { data: ticket, error: ticketError } = await supabase
        .from(tableName)
        .select('id, priority, created_at, first_response_at, resolved_at, status')
        .eq('id', ticketId)
        .maybeSingle()

      if (ticketError || !ticket) {
        return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
      }

      const slaStatus = await calculateSLAStatus(
        ticket.id,
        source,
        ticket.priority,
        ticket.created_at,
        ticket.first_response_at,
        ticket.resolved_at,
        ticket.status
      )

      return NextResponse.json({ sla_status: slaStatus })
    }

    // Mode: Get all at-risk tickets
    if (mode === 'at_risk') {
      const atRiskTickets = await getAtRiskTickets(source || undefined)

      // Sort by urgency (breached first, then by remaining time)
      atRiskTickets.sort((a, b) => {
        if (a.sla_status.overall_status === 'breached' && b.sla_status.overall_status !== 'breached') {
          return -1
        }
        if (b.sla_status.overall_status === 'breached' && a.sla_status.overall_status !== 'breached') {
          return 1
        }
        // Sort by remaining resolution time
        const aRemaining = a.sla_status.resolution.remaining_hours ?? 999
        const bRemaining = b.sla_status.resolution.remaining_hours ?? 999
        return aRemaining - bRemaining
      })

      return NextResponse.json({
        at_risk_tickets: atRiskTickets,
        summary: {
          total: atRiskTickets.length,
          breached: atRiskTickets.filter(t => t.sla_status.overall_status === 'breached').length,
          at_risk: atRiskTickets.filter(t => t.sla_status.overall_status === 'at_risk').length
        }
      })
    }

    // Mode: Generate compliance report
    if (mode === 'report') {
      const period = searchParams.get('period') || '30d'
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
        default:
          startDate.setDate(startDate.getDate() - 30)
      }

      const report = await generateSLAComplianceReport(
        startDate,
        endDate,
        source || undefined
      )

      return NextResponse.json({ report })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode or missing parameters' }, { status: 400 })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
