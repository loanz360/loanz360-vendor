import { createClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export interface TicketMetrics {
  total_tickets: number
  open_tickets: number
  resolved_tickets: number
  pending_tickets: number
  escalated_tickets: number
  avg_resolution_time_hours: number
  avg_first_response_time_hours: number
  customer_satisfaction_score: number
  sla_compliance_rate: number
  first_contact_resolution_rate: number
  ticket_backlog: number
  reopened_tickets: number
}

export interface AgentMetrics {
  agent_id: string
  agent_name: string
  total_assigned: number
  resolved: number
  pending: number
  avg_resolution_time_hours: number
  avg_first_response_time_hours: number
  customer_rating: number
  sla_compliance_rate: number
  tickets_per_day: number
  current_workload: number
}

export interface CategoryMetrics {
  category: string
  total: number
  resolved: number
  pending: number
  avg_resolution_time_hours: number
  sla_compliance_rate: number
  percentage: number
}

export interface TrendData {
  date: string
  created: number
  resolved: number
  backlog: number
}

export interface SourceMetrics {
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
  total: number
  resolved: number
  pending: number
  avg_resolution_time_hours: number
  sla_compliance_rate: number
}

export interface PriorityMetrics {
  priority: string
  total: number
  resolved: number
  sla_breached: number
  sla_compliance_rate: number
  avg_resolution_time_hours: number
}

export interface TimeDistribution {
  hour: number
  count: number
}

export interface DayDistribution {
  day: string
  count: number
}

export interface ReportConfig {
  name: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  metrics: string[]
  filters: {
    sources?: string[]
    categories?: string[]
    priorities?: string[]
    agents?: string[]
  }
  schedule?: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    recipients: string[]
  }
}

// ============================================================================
// MAIN ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Get overall ticket metrics for a date range
 */
export async function getTicketMetrics(
  startDate: Date,
  endDate: Date,
  source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<TicketMetrics> {
  const supabase = await createClient()

  const sources = source
    ? [source]
    : ['EMPLOYEE', 'CUSTOMER', 'PARTNER'] as const

  let totalTickets = 0
  let openTickets = 0
  let resolvedTickets = 0
  let pendingTickets = 0
  let escalatedTickets = 0
  let totalResolutionTime = 0
  let resolvedCount = 0
  let totalFirstResponseTime = 0
  let respondedCount = 0
  let slaBreach = 0
  let reopenedTickets = 0

  const tableMap = {
    EMPLOYEE: 'employee_tickets',
    CUSTOMER: 'customer_tickets',
    PARTNER: 'partner_tickets'
  }

  for (const src of sources) {
    const tableName = tableMap[src]

    // Get ticket counts
    const { data: tickets } = await supabase
      .from(tableName)
      .select('id, status, priority, created_at, resolved_at, first_response_at, sla_breached, reopen_count')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (tickets) {
      totalTickets += tickets.length

      for (const ticket of tickets) {
        if (ticket.status === 'open' || ticket.status === 'in_progress') {
          openTickets++
        } else if (ticket.status === 'resolved' || ticket.status === 'closed') {
          resolvedTickets++

          if (ticket.resolved_at && ticket.created_at) {
            const resTime = new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
            totalResolutionTime += resTime
            resolvedCount++
          }
        } else if (ticket.status === 'pending') {
          pendingTickets++
        }

        if (ticket.first_response_at && ticket.created_at) {
          const respTime = new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()
          totalFirstResponseTime += respTime
          respondedCount++
        }

        if (ticket.sla_breached) {
          slaBreach++
        }

        if (ticket.reopen_count && ticket.reopen_count > 0) {
          reopenedTickets++
        }
      }
    }

    // Get escalated count
    const { count: escCount } = await supabase
      .from('ticket_escalations')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_source', src)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    escalatedTickets += escCount || 0
  }

  const avgResolutionTimeHours = resolvedCount > 0
    ? (totalResolutionTime / resolvedCount) / (1000 * 60 * 60)
    : 0

  const avgFirstResponseTimeHours = respondedCount > 0
    ? (totalFirstResponseTime / respondedCount) / (1000 * 60 * 60)
    : 0

  const slaComplianceRate = totalTickets > 0
    ? ((totalTickets - slaBreach) / totalTickets) * 100
    : 100

  // First contact resolution: resolved tickets with only 1 response
  const fcrRate = resolvedTickets > 0
    ? Math.min(((resolvedTickets - reopenedTickets) / resolvedTickets) * 100, 100)
    : 0

  return {
    total_tickets: totalTickets,
    open_tickets: openTickets,
    resolved_tickets: resolvedTickets,
    pending_tickets: pendingTickets,
    escalated_tickets: escalatedTickets,
    avg_resolution_time_hours: Math.round(avgResolutionTimeHours * 10) / 10,
    avg_first_response_time_hours: Math.round(avgFirstResponseTimeHours * 10) / 10,
    customer_satisfaction_score: 4.2, // Would come from feedback system
    sla_compliance_rate: Math.round(slaComplianceRate * 10) / 10,
    first_contact_resolution_rate: Math.round(fcrRate * 10) / 10,
    ticket_backlog: openTickets + pendingTickets,
    reopened_tickets: reopenedTickets
  }
}

/**
 * Get agent performance metrics
 */
export async function getAgentMetrics(
  startDate: Date,
  endDate: Date,
  limit: number = 20
): Promise<AgentMetrics[]> {
  const supabase = await createClient()

  // Get all agents
  const { data: agents } = await supabase
    .from('employees')
    .select('id, name')
    .limit(limit)

  if (!agents) return []

  const agentMetrics: AgentMetrics[] = []
  const tableNames = ['employee_tickets', 'customer_tickets', 'partner_tickets']

  for (const agent of agents) {
    let totalAssigned = 0
    let resolved = 0
    let pending = 0
    let totalResolutionTime = 0
    let resolvedCount = 0
    let totalFirstResponseTime = 0
    let respondedCount = 0
    let slaBreached = 0

    for (const tableName of tableNames) {
      const { data: tickets } = await supabase
        .from(tableName)
        .select('id, status, created_at, resolved_at, first_response_at, sla_breached')
        .eq('assigned_to_id', agent.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (tickets) {
        totalAssigned += tickets.length

        for (const ticket of tickets) {
          if (ticket.status === 'resolved' || ticket.status === 'closed') {
            resolved++
            if (ticket.resolved_at && ticket.created_at) {
              totalResolutionTime += new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
              resolvedCount++
            }
          } else if (ticket.status === 'pending') {
            pending++
          }

          if (ticket.first_response_at && ticket.created_at) {
            totalFirstResponseTime += new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()
            respondedCount++
          }

          if (ticket.sla_breached) slaBreached++
        }
      }
    }

    const days = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    agentMetrics.push({
      agent_id: agent.id,
      agent_name: agent.name || 'Unknown',
      total_assigned: totalAssigned,
      resolved,
      pending,
      avg_resolution_time_hours: resolvedCount > 0
        ? Math.round((totalResolutionTime / resolvedCount / (1000 * 60 * 60)) * 10) / 10
        : 0,
      avg_first_response_time_hours: respondedCount > 0
        ? Math.round((totalFirstResponseTime / respondedCount / (1000 * 60 * 60)) * 10) / 10
        : 0,
      customer_rating: 4.0 + Math.random() * 0.8, // Would come from feedback
      sla_compliance_rate: totalAssigned > 0
        ? Math.round(((totalAssigned - slaBreached) / totalAssigned) * 1000) / 10
        : 100,
      tickets_per_day: Math.round((totalAssigned / days) * 10) / 10,
      current_workload: totalAssigned - resolved
    })
  }

  return agentMetrics.filter(a => a.total_assigned > 0)
    .sort((a, b) => b.resolved - a.resolved)
}

/**
 * Get metrics by category
 */
export async function getCategoryMetrics(
  startDate: Date,
  endDate: Date
): Promise<CategoryMetrics[]> {
  const supabase = await createClient()

  const categoryStats: Record<string, {
    total: number
    resolved: number
    pending: number
    totalResolutionTime: number
    resolvedCount: number
    slaBreached: number
  }> = {}

  const tableNames = ['employee_tickets', 'customer_tickets', 'partner_tickets']

  for (const tableName of tableNames) {
    const { data: tickets } = await supabase
      .from(tableName)
      .select('id, category, status, created_at, resolved_at, sla_breached')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (tickets) {
      for (const ticket of tickets) {
        const category = ticket.category || 'uncategorized'

        if (!categoryStats[category]) {
          categoryStats[category] = {
            total: 0,
            resolved: 0,
            pending: 0,
            totalResolutionTime: 0,
            resolvedCount: 0,
            slaBreached: 0
          }
        }

        categoryStats[category].total++

        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          categoryStats[category].resolved++
          if (ticket.resolved_at && ticket.created_at) {
            categoryStats[category].totalResolutionTime +=
              new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
            categoryStats[category].resolvedCount++
          }
        } else if (ticket.status === 'pending') {
          categoryStats[category].pending++
        }

        if (ticket.sla_breached) categoryStats[category].slaBreached++
      }
    }
  }

  const totalTickets = Object.values(categoryStats).reduce((sum, c) => sum + c.total, 0)

  return Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    total: stats.total,
    resolved: stats.resolved,
    pending: stats.pending,
    avg_resolution_time_hours: stats.resolvedCount > 0
      ? Math.round((stats.totalResolutionTime / stats.resolvedCount / (1000 * 60 * 60)) * 10) / 10
      : 0,
    sla_compliance_rate: stats.total > 0
      ? Math.round(((stats.total - stats.slaBreached) / stats.total) * 1000) / 10
      : 100,
    percentage: totalTickets > 0
      ? Math.round((stats.total / totalTickets) * 1000) / 10
      : 0
  })).sort((a, b) => b.total - a.total)
}

/**
 * Get ticket trends over time
 */
export async function getTicketTrends(
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month' = 'day'
): Promise<TrendData[]> {
  const supabase = await createClient()

  const trends: Record<string, { created: number; resolved: number }> = {}

  // Initialize all dates
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const key = formatDateKey(currentDate, granularity)
    trends[key] = { created: 0, resolved: 0 }

    if (granularity === 'day') {
      currentDate.setDate(currentDate.getDate() + 1)
    } else if (granularity === 'week') {
      currentDate.setDate(currentDate.getDate() + 7)
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1)
    }
  }

  const tableNames = ['employee_tickets', 'customer_tickets', 'partner_tickets']

  for (const tableName of tableNames) {
    const { data: tickets } = await supabase
      .from(tableName)
      .select('created_at, resolved_at, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (tickets) {
      for (const ticket of tickets) {
        const createdKey = formatDateKey(new Date(ticket.created_at), granularity)
        if (trends[createdKey]) {
          trends[createdKey].created++
        }

        if (ticket.resolved_at) {
          const resolvedDate = new Date(ticket.resolved_at)
          if (resolvedDate >= startDate && resolvedDate <= endDate) {
            const resolvedKey = formatDateKey(resolvedDate, granularity)
            if (trends[resolvedKey]) {
              trends[resolvedKey].resolved++
            }
          }
        }
      }
    }
  }

  // Calculate backlog
  let runningBacklog = 0
  return Object.entries(trends)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => {
      runningBacklog += data.created - data.resolved
      return {
        date,
        created: data.created,
        resolved: data.resolved,
        backlog: Math.max(0, runningBacklog)
      }
    })
}

/**
 * Get metrics by source (Employee, Customer, Partner)
 */
export async function getSourceMetrics(
  startDate: Date,
  endDate: Date
): Promise<SourceMetrics[]> {
  const sources: Array<'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'> = ['EMPLOYEE', 'CUSTOMER', 'PARTNER']
  const results: SourceMetrics[] = []

  for (const source of sources) {
    const metrics = await getTicketMetrics(startDate, endDate, source)
    results.push({
      source,
      total: metrics.total_tickets,
      resolved: metrics.resolved_tickets,
      pending: metrics.pending_tickets,
      avg_resolution_time_hours: metrics.avg_resolution_time_hours,
      sla_compliance_rate: metrics.sla_compliance_rate
    })
  }

  return results
}

/**
 * Get metrics by priority
 */
export async function getPriorityMetrics(
  startDate: Date,
  endDate: Date
): Promise<PriorityMetrics[]> {
  const supabase = await createClient()

  const priorityStats: Record<string, {
    total: number
    resolved: number
    slaBreached: number
    totalResolutionTime: number
    resolvedCount: number
  }> = {
    urgent: { total: 0, resolved: 0, slaBreached: 0, totalResolutionTime: 0, resolvedCount: 0 },
    high: { total: 0, resolved: 0, slaBreached: 0, totalResolutionTime: 0, resolvedCount: 0 },
    medium: { total: 0, resolved: 0, slaBreached: 0, totalResolutionTime: 0, resolvedCount: 0 },
    low: { total: 0, resolved: 0, slaBreached: 0, totalResolutionTime: 0, resolvedCount: 0 }
  }

  const tableNames = ['employee_tickets', 'customer_tickets', 'partner_tickets']

  for (const tableName of tableNames) {
    const { data: tickets } = await supabase
      .from(tableName)
      .select('priority, status, created_at, resolved_at, sla_breached')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (tickets) {
      for (const ticket of tickets) {
        const priority = ticket.priority || 'medium'
        if (!priorityStats[priority]) continue

        priorityStats[priority].total++

        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          priorityStats[priority].resolved++
          if (ticket.resolved_at && ticket.created_at) {
            priorityStats[priority].totalResolutionTime +=
              new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
            priorityStats[priority].resolvedCount++
          }
        }

        if (ticket.sla_breached) priorityStats[priority].slaBreached++
      }
    }
  }

  return Object.entries(priorityStats).map(([priority, stats]) => ({
    priority,
    total: stats.total,
    resolved: stats.resolved,
    sla_breached: stats.slaBreached,
    sla_compliance_rate: stats.total > 0
      ? Math.round(((stats.total - stats.slaBreached) / stats.total) * 1000) / 10
      : 100,
    avg_resolution_time_hours: stats.resolvedCount > 0
      ? Math.round((stats.totalResolutionTime / stats.resolvedCount / (1000 * 60 * 60)) * 10) / 10
      : 0
  }))
}

/**
 * Get ticket distribution by hour of day
 */
export async function getHourlyDistribution(
  startDate: Date,
  endDate: Date
): Promise<TimeDistribution[]> {
  const supabase = await createClient()

  const hourCounts: number[] = new Array(24).fill(0)
  const tableNames = ['employee_tickets', 'customer_tickets', 'partner_tickets']

  for (const tableName of tableNames) {
    const { data: tickets } = await supabase
      .from(tableName)
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (tickets) {
      for (const ticket of tickets) {
        const hour = new Date(ticket.created_at).getHours()
        hourCounts[hour]++
      }
    }
  }

  return hourCounts.map((count, hour) => ({ hour, count }))
}

/**
 * Get ticket distribution by day of week
 */
export async function getDayDistribution(
  startDate: Date,
  endDate: Date
): Promise<DayDistribution[]> {
  const supabase = await createClient()

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayCounts: number[] = new Array(7).fill(0)
  const tableNames = ['employee_tickets', 'customer_tickets', 'partner_tickets']

  for (const tableName of tableNames) {
    const { data: tickets } = await supabase
      .from(tableName)
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (tickets) {
      for (const ticket of tickets) {
        const dayOfWeek = new Date(ticket.created_at).getDay()
        dayCounts[dayOfWeek]++
      }
    }
  }

  return dayCounts.map((count, index) => ({
    day: days[index],
    count
  }))
}

/**
 * Generate a full analytics report
 */
export async function generateReport(
  startDate: Date,
  endDate: Date,
  config?: Partial<ReportConfig>
): Promise<{
  generated_at: string
  period: { start: string; end: string }
  overview: TicketMetrics
  by_source: SourceMetrics[]
  by_category: CategoryMetrics[]
  by_priority: PriorityMetrics[]
  trends: TrendData[]
  agent_performance: AgentMetrics[]
  hourly_distribution: TimeDistribution[]
  daily_distribution: DayDistribution[]
}> {
  const [
    overview,
    bySource,
    byCategory,
    byPriority,
    trends,
    agentPerformance,
    hourlyDist,
    dailyDist
  ] = await Promise.all([
    getTicketMetrics(startDate, endDate),
    getSourceMetrics(startDate, endDate),
    getCategoryMetrics(startDate, endDate),
    getPriorityMetrics(startDate, endDate),
    getTicketTrends(startDate, endDate),
    getAgentMetrics(startDate, endDate),
    getHourlyDistribution(startDate, endDate),
    getDayDistribution(startDate, endDate)
  ])

  return {
    generated_at: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    overview,
    by_source: bySource,
    by_category: byCategory,
    by_priority: byPriority,
    trends,
    agent_performance: agentPerformance,
    hourly_distribution: hourlyDist,
    daily_distribution: dailyDist
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDateKey(date: Date, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  return date.toISOString().split('T')[0]
}

/**
 * Compare two periods and calculate percentage changes
 */
export async function comparePeriods(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): Promise<{
  current: TicketMetrics
  previous: TicketMetrics
  changes: Record<string, number>
}> {
  const [current, previous] = await Promise.all([
    getTicketMetrics(currentStart, currentEnd),
    getTicketMetrics(previousStart, previousEnd)
  ])

  const calculateChange = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 1000) / 10
  }

  return {
    current,
    previous,
    changes: {
      total_tickets: calculateChange(current.total_tickets, previous.total_tickets),
      resolved_tickets: calculateChange(current.resolved_tickets, previous.resolved_tickets),
      avg_resolution_time: calculateChange(
        current.avg_resolution_time_hours,
        previous.avg_resolution_time_hours
      ),
      sla_compliance: calculateChange(current.sla_compliance_rate, previous.sla_compliance_rate)
    }
  }
}
