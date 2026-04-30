
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partner-support/analytics
 * Super Admin analytics for partner support tickets
 * Query params: timeframe (7d, 30d, 90d, all)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Check for super admin session cookie (primary auth method)
    const superAdminSession = request.cookies.get('super_admin_session')?.value

    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Super Admin access required' }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'
    const partnerSubRole = searchParams.get('partner_sub_role') // BA, BP, or CP filter

    // Calculate date range
    let dateFilter = ''
    const now = new Date()
    if (timeframe === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilter = sevenDaysAgo.toISOString()
    } else if (timeframe === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      dateFilter = thirtyDaysAgo.toISOString()
    } else if (timeframe === '90d') {
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      dateFilter = ninetyDaysAgo.toISOString()
    }

    // Fetch all tickets (with optional date filter and partner sub-role filter)
    let ticketsQuery = supabase
      .from('partner_support_tickets')
      .select('*')

    if (dateFilter) {
      ticketsQuery = ticketsQuery.gte('created_at', dateFilter)
    }

    // Filter by partner sub-role if specified
    if (partnerSubRole) {
      ticketsQuery = ticketsQuery.eq('partner_sub_role', partnerSubRole)
    }

    const { data: ticketsData, error: ticketsError } = await ticketsQuery

    // Handle missing table gracefully - return empty analytics
    let tickets = ticketsData || []
    let messages: any[] = []

    if (ticketsError) {
      apiLogger.error('Error fetching tickets (table may not exist yet)', ticketsError)
      // Continue with empty data instead of erroring
    } else {
      // Fetch all messages for response time calculations
      const { data: messagesData } = await supabase
        .from('partner_support_ticket_messages')
        .select('ticket_id, created_at, sender_type')
        .order('created_at', { ascending: true })

      messages = messagesData || []
    }

    // Calculate metrics
    const analytics = {
      overview: {
        total_tickets: tickets?.length || 0,
        open_tickets: tickets?.filter(t => ['new', 'assigned', 'in_progress'].includes(t.status)).length || 0,
        resolved_tickets: tickets?.filter(t => t.status === 'resolved').length || 0,
        closed_tickets: tickets?.filter(t => t.status === 'closed').length || 0,
        sla_breached: tickets?.filter(t => t.sla_breached).length || 0,
      },

      by_status: {
        new: tickets?.filter(t => t.status === 'new').length || 0,
        assigned: tickets?.filter(t => t.status === 'assigned').length || 0,
        in_progress: tickets?.filter(t => t.status === 'in_progress').length || 0,
        pending_partner: tickets?.filter(t => t.status === 'pending_partner').length || 0,
        pending_internal: tickets?.filter(t => t.status === 'pending_internal').length || 0,
        resolved: tickets?.filter(t => t.status === 'resolved').length || 0,
        closed: tickets?.filter(t => t.status === 'closed').length || 0,
        on_hold: tickets?.filter(t => t.status === 'on_hold').length || 0,
        escalated: tickets?.filter(t => t.status === 'escalated').length || 0,
        reopened: tickets?.filter(t => t.status === 'reopened').length || 0,
      },

      by_priority: {
        urgent: tickets?.filter(t => t.priority === 'urgent').length || 0,
        high: tickets?.filter(t => t.priority === 'high').length || 0,
        medium: tickets?.filter(t => t.priority === 'medium').length || 0,
        low: tickets?.filter(t => t.priority === 'low').length || 0,
      },

      by_category: {
        payout_commission: tickets?.filter(t => t.category === 'payout_commission').length || 0,
        sales_support: tickets?.filter(t => t.category === 'sales_support').length || 0,
        technical_issue: tickets?.filter(t => t.category === 'technical_issue').length || 0,
        account_management: tickets?.filter(t => t.category === 'account_management').length || 0,
        training_resources: tickets?.filter(t => t.category === 'training_resources').length || 0,
        compliance_legal: tickets?.filter(t => t.category === 'compliance_legal').length || 0,
        customer_issues: tickets?.filter(t => t.category === 'customer_issues').length || 0,
        partnership_management: tickets?.filter(t => t.category === 'partnership_management').length || 0,
        general_inquiry: tickets?.filter(t => t.category === 'general_inquiry').length || 0,
      },

      by_department: {
        partner_support: tickets?.filter(t => t.assigned_department === 'partner_support').length || 0,
        payout_team: tickets?.filter(t => t.assigned_department === 'payout_team').length || 0,
        technical_team: tickets?.filter(t => t.assigned_department === 'technical_team').length || 0,
        compliance_team: tickets?.filter(t => t.assigned_department === 'compliance_team').length || 0,
        sales_team: tickets?.filter(t => t.assigned_department === 'sales_team').length || 0,
      },

      response_times: calculateResponseTimes(tickets || [], messages || []),

      sla_compliance: {
        total_tickets: tickets?.length || 0,
        sla_met: tickets?.filter(t => !t.sla_breached).length || 0,
        sla_breached: tickets?.filter(t => t.sla_breached).length || 0,
        compliance_rate: tickets?.length ?
          ((tickets.filter(t => !t.sla_breached).length / tickets.length) * 100).toFixed(1) : '0',
      },

      trends: calculateTrends(tickets || []),
    }

    return NextResponse.json({ analytics }, { status: 200 })

  } catch (error) {
    apiLogger.error('Analytics error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error',
    }, { status: 500 })
  }
}

// Helper function to calculate response times
function calculateResponseTimes(tickets: any[], messages: any[]) {
  const messagesByTicket = messages.reduce((acc, msg) => {
    if (!acc[msg.ticket_id]) acc[msg.ticket_id] = []
    acc[msg.ticket_id].push(msg)
    return acc
  }, {} as Record<string, any[]>)

  let totalFirstResponseTime = 0
  let firstResponseCount = 0
  let totalResolutionTime = 0
  let resolutionCount = 0

  tickets.forEach(ticket => {
    // First response time
    if (ticket.first_response_at) {
      const responseTime = new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()
      totalFirstResponseTime += responseTime / (1000 * 60 * 60) // Convert to hours
      firstResponseCount++
    }

    // Resolution time
    if (ticket.resolved_at) {
      const resolutionTime = new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
      totalResolutionTime += resolutionTime / (1000 * 60 * 60) // Convert to hours
      resolutionCount++
    }
  })

  return {
    avg_first_response_hours: firstResponseCount > 0 ?
      (totalFirstResponseTime / firstResponseCount).toFixed(2) : '0',
    avg_resolution_hours: resolutionCount > 0 ?
      (totalResolutionTime / resolutionCount).toFixed(2) : '0',
    tickets_with_response: firstResponseCount,
    tickets_resolved: resolutionCount,
  }
}

// Helper function to calculate trends
function calculateTrends(tickets: any[]) {
  const today = new Date()
  const last7Days = []
  const last30Days = []

  // Group tickets by date
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const count = tickets.filter(t => {
      const ticketDate = new Date(t.created_at).toISOString().split('T')[0]
      return ticketDate === dateStr
    }).length

    last7Days.unshift({ date: dateStr, count })
  }

  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const count = tickets.filter(t => {
      const ticketDate = new Date(t.created_at).toISOString().split('T')[0]
      return ticketDate === dateStr
    }).length

    last30Days.unshift({ date: dateStr, count })
  }

  return {
    last_7_days: last7Days,
    last_30_days: last30Days,
  }
}
