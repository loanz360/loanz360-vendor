export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { apiLogger } from '@/lib/utils/logger'

// ============================================================================
// SUPPORT TICKET ANALYTICS API
// Comprehensive analytics for support ticket system
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('sb-access-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has analytics access
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'all'
    const range = searchParams.get('range') || '30d'
    const customFrom = searchParams.get('from')
    const customTo = searchParams.get('to')

    // Calculate date range
    let dateFrom: Date
    let dateTo: Date = new Date()

    if (range === 'custom' && customFrom && customTo) {
      dateFrom = new Date(customFrom)
      dateTo = new Date(customTo)
    } else {
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
      dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    // Get analytics data
    const [
      overview,
      volumeByDay,
      byCategory,
      byPriority,
      byStatus,
      agentPerformance,
      peakHours,
      slaMetrics
    ] = await Promise.all([
      getOverviewMetrics(source, dateFrom, dateTo),
      getVolumeByDay(source, dateFrom, dateTo),
      getCategoryDistribution(source, dateFrom, dateTo),
      getPriorityDistribution(source, dateFrom, dateTo),
      getStatusDistribution(source, dateFrom, dateTo),
      getAgentPerformance(source, dateFrom, dateTo),
      getPeakHours(source, dateFrom, dateTo),
      getSLAMetrics(source, dateFrom, dateTo)
    ])

    // Calculate previous period for trend
    const previousFrom = new Date(dateFrom.getTime() - (dateTo.getTime() - dateFrom.getTime()))
    const previousOverview = await getOverviewMetrics(source, previousFrom, dateFrom)
    const ticketsTrend = previousOverview.totalTickets > 0
      ? ((overview.totalTickets - previousOverview.totalTickets) / previousOverview.totalTickets) * 100
      : 0

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          ...overview,
          ticketsTrend
        },
        volumeByDay,
        byCategory,
        byPriority,
        byStatus,
        agentPerformance,
        peakHours,
        slaMetrics
      },
      dateRange: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString()
      }
    })

  } catch (error) {
    apiLogger.error('Analytics error', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getOverviewMetrics(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  let totalTickets = 0
  let openTickets = 0
  let resolvedTickets = 0
  let totalResolutionTime = 0
  let resolvedCount = 0
  let totalFirstResponseTime = 0
  let respondedCount = 0
  let slaCompliant = 0
  let slaTotal = 0

  for (const table of tables) {
    // Total tickets
    const { count: total } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    totalTickets += total || 0

    // Open tickets
    const { count: open } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress', 'pending', 'reopened'])
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    openTickets += open || 0

    // Resolved tickets
    const { count: resolved } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved', 'closed'])
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    resolvedTickets += resolved || 0

    // Resolution time for resolved tickets
    const { data: resolvedData } = await supabase
      .from(table)
      .select('created_at, resolved_at')
      .in('status', ['resolved', 'closed'])
      .not('resolved_at', 'is', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (resolvedData) {
      for (const ticket of resolvedData) {
        const resolutionTime = (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
        totalResolutionTime += resolutionTime
        resolvedCount++
      }
    }

    // First response time
    const { data: responseData } = await supabase
      .from(table)
      .select('created_at, first_response_at')
      .not('first_response_at', 'is', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (responseData) {
      for (const ticket of responseData) {
        const responseTime = (new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
        totalFirstResponseTime += responseTime
        respondedCount++
      }
    }

    // SLA compliance
    const { count: compliant } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('sla_status', 'met')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    slaCompliant += compliant || 0

    const { count: slaTracked } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .not('sla_status', 'is', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    slaTotal += slaTracked || 0
  }

  return {
    totalTickets,
    openTickets,
    resolvedTickets,
    avgResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    avgFirstResponseTime: respondedCount > 0 ? totalFirstResponseTime / respondedCount : 0,
    slaComplianceRate: slaTotal > 0 ? (slaCompliant / slaTotal) * 100 : 100,
    customerSatisfaction: 0 // TODO: Compute from feedback data
  }
}

async function getVolumeByDay(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const dayMap = new Map<string, { created: number; resolved: number }>()

  // Initialize all days
  const currentDate = new Date(from)
  while (currentDate <= to) {
    const dateKey = currentDate.toISOString().split('T')[0]
    dayMap.set(dateKey, { created: 0, resolved: 0 })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  for (const table of tables) {
    // Created tickets by day
    const { data: createdData } = await supabase
      .from(table)
      .select('created_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (createdData) {
      for (const ticket of createdData) {
        const dateKey = ticket.created_at.split('T')[0]
        const day = dayMap.get(dateKey)
        if (day) day.created++
      }
    }

    // Resolved tickets by day
    const { data: resolvedData } = await supabase
      .from(table)
      .select('resolved_at')
      .not('resolved_at', 'is', null)
      .gte('resolved_at', from.toISOString())
      .lte('resolved_at', to.toISOString())

    if (resolvedData) {
      for (const ticket of resolvedData) {
        const dateKey = ticket.resolved_at.split('T')[0]
        const day = dayMap.get(dateKey)
        if (day) day.resolved++
      }
    }
  }

  return Array.from(dayMap.entries()).map(([date, counts]) => ({
    date,
    ...counts
  }))
}

async function getCategoryDistribution(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const categoryMap = new Map<string, number>()
  let total = 0

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('category')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (data) {
      for (const ticket of data) {
        const category = ticket.category || 'general'
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
        total++
      }
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
}

async function getPriorityDistribution(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const priorityMap = new Map<string, { count: number; totalResolutionHours: number; resolvedCount: number }>()

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('priority, created_at, resolved_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (data) {
      for (const ticket of data) {
        const priority = ticket.priority || 'medium'
        const current = priorityMap.get(priority) || { count: 0, totalResolutionHours: 0, resolvedCount: 0 }

        current.count++

        if (ticket.resolved_at) {
          const hours = (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
          current.totalResolutionHours += hours
          current.resolvedCount++
        }

        priorityMap.set(priority, current)
      }
    }
  }

  const priorityOrder = ['critical', 'urgent', 'high', 'medium', 'low']

  return priorityOrder
    .filter(p => priorityMap.has(p))
    .map(priority => {
      const data = priorityMap.get(priority)!
      return {
        priority,
        count: data.count,
        avgResolutionHours: data.resolvedCount > 0 ? data.totalResolutionHours / data.resolvedCount : 0
      }
    })
}

async function getStatusDistribution(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const statusMap = new Map<string, number>()

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('status')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (data) {
      for (const ticket of data) {
        const status = ticket.status || 'open'
        statusMap.set(status, (statusMap.get(status) || 0) + 1)
      }
    }
  }

  const statusColors: Record<string, string> = {
    open: 'bg-yellow-400',
    in_progress: 'bg-blue-400',
    pending: 'bg-orange-400',
    on_hold: 'bg-gray-400',
    resolved: 'bg-green-400',
    closed: 'bg-gray-500',
    reopened: 'bg-purple-400',
    escalated: 'bg-red-400'
  }

  return Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
    color: statusColors[status] || 'bg-gray-400'
  }))
}

async function getAgentPerformance(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const agentMap = new Map<string, {
    name: string
    tickets: number
    totalResolutionTime: number
    resolvedCount: number
    slaCompliant: number
    slaTotal: number
  }>()

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select(`
        assigned_agent_id,
        created_at,
        resolved_at,
        sla_status,
        agent:profiles!${table}_assigned_agent_id_fkey(full_name)
      `)
      .not('assigned_agent_id', 'is', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (data) {
      for (const ticket of data) {
        const agentId = ticket.assigned_agent_id
        const agentName = ticket.agent?.full_name || 'Unknown Agent'

        const current = agentMap.get(agentId) || {
          name: agentName,
          tickets: 0,
          totalResolutionTime: 0,
          resolvedCount: 0,
          slaCompliant: 0,
          slaTotal: 0
        }

        current.tickets++

        if (ticket.resolved_at) {
          const hours = (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
          current.totalResolutionTime += hours
          current.resolvedCount++
        }

        if (ticket.sla_status) {
          current.slaTotal++
          if (ticket.sla_status === 'met') current.slaCompliant++
        }

        agentMap.set(agentId, current)
      }
    }
  }

  return Array.from(agentMap.entries())
    .map(([agentId, data]) => ({
      agentId,
      agentName: data.name,
      ticketsHandled: data.tickets,
      avgResolutionTime: data.resolvedCount > 0 ? data.totalResolutionTime / data.resolvedCount : 0,
      slaCompliance: data.slaTotal > 0 ? (data.slaCompliant / data.slaTotal) * 100 : 100,
      satisfactionScore: 0 // TODO: Compute from feedback data
    }))
    .sort((a, b) => b.ticketsHandled - a.ticketsHandled)
}

async function getPeakHours(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const hourMap = new Map<number, number>()

  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, 0)
  }

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('created_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (data) {
      for (const ticket of data) {
        const hour = new Date(ticket.created_at).getHours()
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
      }
    }
  }

  return Array.from(hourMap.entries())
    .map(([hour, ticketCount]) => ({ hour, ticketCount }))
    .sort((a, b) => a.hour - b.hour)
}

async function getSLAMetrics(source: string, from: Date, to: Date) {
  const tables = getTicketTables(source)
  const metrics = {
    onTrack: 0,
    atRisk: 0,
    breached: 0,
    met: 0
  }

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('sla_status')
      .not('sla_status', 'is', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())

    if (data) {
      for (const ticket of data) {
        switch (ticket.sla_status) {
          case 'on_track':
            metrics.onTrack++
            break
          case 'at_risk':
            metrics.atRisk++
            break
          case 'breached':
            metrics.breached++
            break
          case 'met':
            metrics.met++
            break
        }
      }
    }
  }

  return metrics
}

function getTicketTables(source: string): string[] {
  switch (source) {
    case 'employee':
      return ['support_tickets']
    case 'customer':
      return ['customer_support_tickets']
    case 'partner':
      return ['partner_support_tickets']
    default:
      return ['support_tickets', 'customer_support_tickets', 'partner_support_tickets']
  }
}
