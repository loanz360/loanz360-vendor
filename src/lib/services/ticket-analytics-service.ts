/**
 * Enterprise Ticket Analytics Service
 * Version: 1.0 - Fortune 500 Standard
 *
 * Comprehensive analytics for support ticket system.
 * Provides insights for performance monitoring, SLA tracking,
 * agent performance, and trend analysis.
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { TicketSource, SLAStatus } from '@/types/support-tickets'

// ============================================================
// TYPES
// ============================================================

export interface DateRange {
  from: string
  to: string
}

export interface OverviewMetrics {
  total_tickets: number
  open_tickets: number
  resolved_tickets: number
  closed_tickets: number
  avg_resolution_time_hours: number
  avg_first_response_time_hours: number
  sla_compliance_rate: number
  customer_satisfaction_avg: number
  tickets_per_day_avg: number
  trend: {
    tickets_change_percent: number
    resolution_time_change_percent: number
    sla_change_percent: number
  }
}

export interface TicketVolumeData {
  date: string
  total: number
  created: number
  resolved: number
  closed: number
  by_source: {
    employee: number
    customer: number
    partner: number
  }
}

export interface CategoryDistribution {
  category: string
  count: number
  percentage: number
  avg_resolution_hours: number
  sla_compliance_rate: number
}

export interface PriorityDistribution {
  priority: string
  count: number
  percentage: number
  avg_resolution_hours: number
  sla_compliance_rate: number
}

export interface StatusDistribution {
  status: string
  count: number
  percentage: number
}

export interface AgentPerformanceMetrics {
  agent_id: string
  agent_name: string
  department: string
  tickets_assigned: number
  tickets_resolved: number
  tickets_closed: number
  avg_resolution_time_hours: number
  avg_first_response_time_hours: number
  sla_compliance_rate: number
  customer_satisfaction_avg: number
  first_contact_resolution_rate: number
  reopen_rate: number
  performance_score: number
  rank: number
}

export interface DepartmentMetrics {
  department: string
  total_tickets: number
  open_tickets: number
  resolved_tickets: number
  avg_resolution_time_hours: number
  sla_compliance_rate: number
  agents_count: number
  tickets_per_agent: number
}

export interface SLAMetrics {
  total_tickets: number
  on_track: number
  at_risk: number
  breached: number
  compliance_rate: number
  avg_time_to_breach_hours: number
  breach_by_priority: {
    urgent: number
    high: number
    medium: number
    low: number
  }
  breach_by_category: Record<string, number>
}

export interface TrendData {
  period: string
  value: number
  change_percent: number
}

export interface PeakHoursData {
  hour: number
  ticket_count: number
  avg_response_time_minutes: number
}

// ============================================================
// ANALYTICS SERVICE CLASS
// ============================================================

export class TicketAnalyticsService {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Get overview metrics
   */
  async getOverviewMetrics(
    dateRange: DateRange,
    ticketSource?: TicketSource | string
  ): Promise<OverviewMetrics> {
    const tables = ticketSource
      ? [this.getTableName(ticketSource)]
      : ['support_tickets', 'customer_support_tickets', 'partner_support_tickets']

    let totalTickets = 0
    let openTickets = 0
    let resolvedTickets = 0
    let closedTickets = 0
    let totalResolutionTime = 0
    let totalFirstResponseTime = 0
    let resolutionCount = 0
    let responseCount = 0
    let slaCompliant = 0
    let satisfactionTotal = 0
    let satisfactionCount = 0

    for (const table of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select('status, resolution_time_hours, response_time_hours, sla_breached, satisfaction_rating')
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)

      if (tickets) {
        totalTickets += tickets.length
        openTickets += tickets.filter(t =>
          ['new', 'open', 'assigned', 'in_progress'].includes(t.status)
        ).length
        resolvedTickets += tickets.filter(t => t.status === 'resolved').length
        closedTickets += tickets.filter(t => t.status === 'closed').length

        for (const ticket of tickets) {
          if (ticket.resolution_time_hours) {
            totalResolutionTime += ticket.resolution_time_hours
            resolutionCount++
          }
          if (ticket.response_time_hours) {
            totalFirstResponseTime += ticket.response_time_hours
            responseCount++
          }
          if (!ticket.sla_breached) {
            slaCompliant++
          }
          if (ticket.satisfaction_rating) {
            satisfactionTotal += ticket.satisfaction_rating
            satisfactionCount++
          }
        }
      }
    }

    // Calculate previous period for trend comparison
    const periodDays = Math.ceil(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
    )
    const previousFrom = new Date(new Date(dateRange.from).getTime() - periodDays * 24 * 60 * 60 * 1000)
    const previousTo = new Date(dateRange.from)

    const previousMetrics = await this.getPreviousPeriodMetrics(
      { from: previousFrom.toISOString(), to: previousTo.toISOString() },
      tables
    )

    const ticketsChangePercent = previousMetrics.totalTickets > 0
      ? ((totalTickets - previousMetrics.totalTickets) / previousMetrics.totalTickets) * 100
      : 0

    const currentAvgResolution = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0
    const resolutionChangePercent = previousMetrics.avgResolutionTime > 0
      ? ((currentAvgResolution - previousMetrics.avgResolutionTime) / previousMetrics.avgResolutionTime) * 100
      : 0

    const currentSlaRate = totalTickets > 0 ? (slaCompliant / totalTickets) * 100 : 100
    const slaChangePercent = previousMetrics.slaRate > 0
      ? currentSlaRate - previousMetrics.slaRate
      : 0

    return {
      total_tickets: totalTickets,
      open_tickets: openTickets,
      resolved_tickets: resolvedTickets,
      closed_tickets: closedTickets,
      avg_resolution_time_hours: resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0,
      avg_first_response_time_hours: responseCount > 0 ? totalFirstResponseTime / responseCount : 0,
      sla_compliance_rate: currentSlaRate,
      customer_satisfaction_avg: satisfactionCount > 0 ? satisfactionTotal / satisfactionCount : 0,
      tickets_per_day_avg: periodDays > 0 ? totalTickets / periodDays : 0,
      trend: {
        tickets_change_percent: ticketsChangePercent,
        resolution_time_change_percent: resolutionChangePercent,
        sla_change_percent: slaChangePercent
      }
    }
  }

  /**
   * Get ticket volume over time
   */
  async getTicketVolume(
    dateRange: DateRange,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TicketVolumeData[]> {
    const volumeMap = new Map<string, TicketVolumeData>()

    const tables: { table: string; source: keyof TicketVolumeData['by_source'] }[] = [
      { table: 'support_tickets', source: 'employee' },
      { table: 'customer_support_tickets', source: 'customer' },
      { table: 'partner_support_tickets', source: 'partner' }
    ]

    for (const { table, source } of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select('created_at, status, resolved_at, closed_at')
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)

      if (tickets) {
        for (const ticket of tickets) {
          const date = this.getDateKey(ticket.created_at, granularity)

          if (!volumeMap.has(date)) {
            volumeMap.set(date, {
              date,
              total: 0,
              created: 0,
              resolved: 0,
              closed: 0,
              by_source: { employee: 0, customer: 0, partner: 0 }
            })
          }

          const data = volumeMap.get(date)!
          data.total++
          data.created++
          data.by_source[source]++

          if (ticket.resolved_at) {
            const resolvedDate = this.getDateKey(ticket.resolved_at, granularity)
            if (!volumeMap.has(resolvedDate)) {
              volumeMap.set(resolvedDate, {
                date: resolvedDate,
                total: 0,
                created: 0,
                resolved: 0,
                closed: 0,
                by_source: { employee: 0, customer: 0, partner: 0 }
              })
            }
            volumeMap.get(resolvedDate)!.resolved++
          }

          if (ticket.closed_at) {
            const closedDate = this.getDateKey(ticket.closed_at, granularity)
            if (!volumeMap.has(closedDate)) {
              volumeMap.set(closedDate, {
                date: closedDate,
                total: 0,
                created: 0,
                resolved: 0,
                closed: 0,
                by_source: { employee: 0, customer: 0, partner: 0 }
              })
            }
            volumeMap.get(closedDate)!.closed++
          }
        }
      }
    }

    return Array.from(volumeMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Get category distribution
   */
  async getCategoryDistribution(
    dateRange: DateRange,
    ticketSource?: TicketSource | string
  ): Promise<CategoryDistribution[]> {
    const tables = ticketSource
      ? [this.getTableName(ticketSource)]
      : ['support_tickets', 'customer_support_tickets', 'partner_support_tickets']

    const categoryMap = new Map<string, {
      count: number
      totalResolution: number
      resolutionCount: number
      slaCompliant: number
    }>()

    for (const table of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select('category, resolution_time_hours, sla_breached')
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)

      if (tickets) {
        for (const ticket of tickets) {
          const category = ticket.category || 'uncategorized'

          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              count: 0,
              totalResolution: 0,
              resolutionCount: 0,
              slaCompliant: 0
            })
          }

          const data = categoryMap.get(category)!
          data.count++

          if (ticket.resolution_time_hours) {
            data.totalResolution += ticket.resolution_time_hours
            data.resolutionCount++
          }

          if (!ticket.sla_breached) {
            data.slaCompliant++
          }
        }
      }
    }

    const totalCount = Array.from(categoryMap.values()).reduce((sum, d) => sum + d.count, 0)

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
        avg_resolution_hours: data.resolutionCount > 0 ? data.totalResolution / data.resolutionCount : 0,
        sla_compliance_rate: data.count > 0 ? (data.slaCompliant / data.count) * 100 : 100
      }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(
    dateRange: DateRange,
    department?: string
  ): Promise<AgentPerformanceMetrics[]> {
    const agentMap = new Map<string, {
      name: string
      department: string
      assigned: number
      resolved: number
      closed: number
      totalResolution: number
      totalResponse: number
      resolutionCount: number
      responseCount: number
      slaCompliant: number
      satisfactionTotal: number
      satisfactionCount: number
      firstContactResolved: number
      reopened: number
    }>()

    // Get employees
    let employeeQuery = this.supabase
      .from('employees')
      .select('id, full_name, department')
      .eq('is_active', true)

    if (department) {
      employeeQuery = employeeQuery.eq('department', department)
    }

    const { data: employees } = await employeeQuery

    if (!employees) return []

    // Initialize agent data
    for (const emp of employees) {
      agentMap.set(emp.id, {
        name: emp.full_name,
        department: emp.department,
        assigned: 0,
        resolved: 0,
        closed: 0,
        totalResolution: 0,
        totalResponse: 0,
        resolutionCount: 0,
        responseCount: 0,
        slaCompliant: 0,
        satisfactionTotal: 0,
        satisfactionCount: 0,
        firstContactResolved: 0,
        reopened: 0
      })
    }

    // Fetch tickets from all sources
    const tables = [
      { table: 'support_tickets', assignedField: 'assigned_user_id' },
      { table: 'customer_support_tickets', assignedField: 'assigned_to_customer_support_id' },
      { table: 'partner_support_tickets', assignedField: 'assigned_to_partner_support_id' }
    ]

    for (const { table, assignedField } of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select(`
          ${assignedField},
          status,
          resolution_time_hours,
          response_time_hours,
          sla_breached,
          satisfaction_rating,
          reopened_count
        `)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .not(assignedField, 'is', null)

      if (tickets) {
        for (const ticket of tickets) {
          const agentId = ticket[assignedField]
          if (!agentMap.has(agentId)) continue

          const data = agentMap.get(agentId)!
          data.assigned++

          if (ticket.status === 'resolved') data.resolved++
          if (ticket.status === 'closed') data.closed++

          if (ticket.resolution_time_hours) {
            data.totalResolution += ticket.resolution_time_hours
            data.resolutionCount++
          }

          if (ticket.response_time_hours) {
            data.totalResponse += ticket.response_time_hours
            data.responseCount++
          }

          if (!ticket.sla_breached) data.slaCompliant++

          if (ticket.satisfaction_rating) {
            data.satisfactionTotal += ticket.satisfaction_rating
            data.satisfactionCount++
          }

          if (ticket.reopened_count > 0) data.reopened++
        }
      }
    }

    // Calculate metrics and rank
    const metrics: AgentPerformanceMetrics[] = Array.from(agentMap.entries())
      .map(([agentId, data]) => {
        const slaRate = data.assigned > 0 ? (data.slaCompliant / data.assigned) * 100 : 100
        const avgResolution = data.resolutionCount > 0 ? data.totalResolution / data.resolutionCount : 0
        const avgResponse = data.responseCount > 0 ? data.totalResponse / data.responseCount : 0
        const satisfactionAvg = data.satisfactionCount > 0 ? data.satisfactionTotal / data.satisfactionCount : 0
        const reopenRate = data.resolved > 0 ? (data.reopened / data.resolved) * 100 : 0

        // Calculate performance score (weighted average)
        const performanceScore =
          (slaRate * 0.25) +
          (satisfactionAvg * 20 * 0.25) + // Scale to 100
          (Math.max(0, 100 - avgResolution * 2) * 0.25) + // Lower is better
          (Math.max(0, 100 - reopenRate * 5) * 0.25) // Lower is better

        return {
          agent_id: agentId,
          agent_name: data.name,
          department: data.department,
          tickets_assigned: data.assigned,
          tickets_resolved: data.resolved,
          tickets_closed: data.closed,
          avg_resolution_time_hours: avgResolution,
          avg_first_response_time_hours: avgResponse,
          sla_compliance_rate: slaRate,
          customer_satisfaction_avg: satisfactionAvg,
          first_contact_resolution_rate: data.assigned > 0 ? (data.firstContactResolved / data.assigned) * 100 : 0,
          reopen_rate: reopenRate,
          performance_score: performanceScore,
          rank: 0
        }
      })
      .filter(m => m.tickets_assigned > 0)
      .sort((a, b) => b.performance_score - a.performance_score)

    // Assign ranks
    metrics.forEach((m, i) => { m.rank = i + 1 })

    return metrics
  }

  /**
   * Get SLA metrics
   */
  async getSLAMetrics(
    dateRange: DateRange,
    ticketSource?: TicketSource | string
  ): Promise<SLAMetrics> {
    const tables = ticketSource
      ? [this.getTableName(ticketSource)]
      : ['support_tickets', 'customer_support_tickets', 'partner_support_tickets']

    let totalTickets = 0
    let onTrack = 0
    let atRisk = 0
    let breached = 0
    let totalTimeToBreachHours = 0
    let breachCount = 0

    const breachByPriority = { urgent: 0, high: 0, medium: 0, low: 0 }
    const breachByCategory: Record<string, number> = {}

    for (const table of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select('sla_status, sla_breached, priority, category, created_at, sla_deadline')
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)

      if (tickets) {
        totalTickets += tickets.length

        for (const ticket of tickets) {
          if (ticket.sla_status === 'on_track' || (!ticket.sla_breached && ticket.sla_status !== 'at_risk')) {
            onTrack++
          } else if (ticket.sla_status === 'at_risk') {
            atRisk++
          }

          if (ticket.sla_breached) {
            breached++

            // Track by priority
            if (ticket.priority in breachByPriority) {
              breachByPriority[ticket.priority as keyof typeof breachByPriority]++
            }

            // Track by category
            const category = ticket.category || 'uncategorized'
            breachByCategory[category] = (breachByCategory[category] || 0) + 1

            // Calculate time to breach
            if (ticket.created_at && ticket.sla_deadline) {
              const created = new Date(ticket.created_at)
              const deadline = new Date(ticket.sla_deadline)
              const timeToBreachHours = (deadline.getTime() - created.getTime()) / (1000 * 60 * 60)
              totalTimeToBreachHours += timeToBreachHours
              breachCount++
            }
          }
        }
      }
    }

    return {
      total_tickets: totalTickets,
      on_track: onTrack,
      at_risk: atRisk,
      breached: breached,
      compliance_rate: totalTickets > 0 ? ((totalTickets - breached) / totalTickets) * 100 : 100,
      avg_time_to_breach_hours: breachCount > 0 ? totalTimeToBreachHours / breachCount : 0,
      breach_by_priority: breachByPriority,
      breach_by_category: breachByCategory
    }
  }

  /**
   * Get peak hours analysis
   */
  async getPeakHours(dateRange: DateRange): Promise<PeakHoursData[]> {
    const hourlyData = new Map<number, { count: number; totalResponse: number; responseCount: number }>()

    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyData.set(i, { count: 0, totalResponse: 0, responseCount: 0 })
    }

    const tables = ['support_tickets', 'customer_support_tickets', 'partner_support_tickets']

    for (const table of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select('created_at, response_time_hours')
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)

      if (tickets) {
        for (const ticket of tickets) {
          const hour = new Date(ticket.created_at).getHours()
          const data = hourlyData.get(hour)!
          data.count++

          if (ticket.response_time_hours) {
            data.totalResponse += ticket.response_time_hours * 60 // Convert to minutes
            data.responseCount++
          }
        }
      }
    }

    return Array.from(hourlyData.entries()).map(([hour, data]) => ({
      hour,
      ticket_count: data.count,
      avg_response_time_minutes: data.responseCount > 0 ? data.totalResponse / data.responseCount : 0
    }))
  }

  /**
   * Get department metrics
   */
  async getDepartmentMetrics(dateRange: DateRange): Promise<DepartmentMetrics[]> {
    const deptMap = new Map<string, {
      total: number
      open: number
      resolved: number
      totalResolution: number
      resolutionCount: number
      slaCompliant: number
    }>()

    const tables = [
      { table: 'support_tickets', deptField: 'assigned_to' },
      { table: 'customer_support_tickets', deptField: 'routed_to_department' },
      { table: 'partner_support_tickets', deptField: 'routed_to_department' }
    ]

    for (const { table, deptField } of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select(`${deptField}, status, resolution_time_hours, sla_breached`)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .not(deptField, 'is', null)

      if (tickets) {
        for (const ticket of tickets) {
          const dept = ticket[deptField]
          if (!dept) continue

          if (!deptMap.has(dept)) {
            deptMap.set(dept, {
              total: 0,
              open: 0,
              resolved: 0,
              totalResolution: 0,
              resolutionCount: 0,
              slaCompliant: 0
            })
          }

          const data = deptMap.get(dept)!
          data.total++

          if (['new', 'open', 'assigned', 'in_progress'].includes(ticket.status)) {
            data.open++
          }
          if (ticket.status === 'resolved' || ticket.status === 'closed') {
            data.resolved++
          }
          if (ticket.resolution_time_hours) {
            data.totalResolution += ticket.resolution_time_hours
            data.resolutionCount++
          }
          if (!ticket.sla_breached) {
            data.slaCompliant++
          }
        }
      }
    }

    // Get agent counts per department
    const { data: employees } = await this.supabase
      .from('employees')
      .select('department')
      .eq('is_active', true)

    const agentCounts: Record<string, number> = {}
    if (employees) {
      for (const emp of employees) {
        if (emp.department) {
          agentCounts[emp.department] = (agentCounts[emp.department] || 0) + 1
        }
      }
    }

    return Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      total_tickets: data.total,
      open_tickets: data.open,
      resolved_tickets: data.resolved,
      avg_resolution_time_hours: data.resolutionCount > 0 ? data.totalResolution / data.resolutionCount : 0,
      sla_compliance_rate: data.total > 0 ? (data.slaCompliant / data.total) * 100 : 100,
      agents_count: agentCounts[department] || 0,
      tickets_per_agent: agentCounts[department] ? data.total / agentCounts[department] : data.total
    }))
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private getTableName(source: TicketSource | string): string {
    switch (source) {
      case TicketSource.EMPLOYEE:
      case 'EMPLOYEE':
        return 'support_tickets'
      case TicketSource.CUSTOMER:
      case 'CUSTOMER':
        return 'customer_support_tickets'
      case TicketSource.PARTNER:
      case 'PARTNER':
        return 'partner_support_tickets'
      default:
        return 'support_tickets'
    }
  }

  private getDateKey(dateStr: string, granularity: 'day' | 'week' | 'month'): string {
    const date = new Date(dateStr)
    switch (granularity) {
      case 'day':
        return date.toISOString().split('T')[0]
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return weekStart.toISOString().split('T')[0]
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    }
  }

  private async getPreviousPeriodMetrics(
    dateRange: DateRange,
    tables: string[]
  ): Promise<{ totalTickets: number; avgResolutionTime: number; slaRate: number }> {
    let totalTickets = 0
    let totalResolutionTime = 0
    let resolutionCount = 0
    let slaCompliant = 0

    for (const table of tables) {
      const { data: tickets } = await this.supabase
        .from(table)
        .select('resolution_time_hours, sla_breached')
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)

      if (tickets) {
        totalTickets += tickets.length
        for (const ticket of tickets) {
          if (ticket.resolution_time_hours) {
            totalResolutionTime += ticket.resolution_time_hours
            resolutionCount++
          }
          if (!ticket.sla_breached) slaCompliant++
        }
      }
    }

    return {
      totalTickets,
      avgResolutionTime: resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0,
      slaRate: totalTickets > 0 ? (slaCompliant / totalTickets) * 100 : 100
    }
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export async function getAnalyticsService(): Promise<TicketAnalyticsService> {
  const supabase = await createClient()
  return new TicketAnalyticsService(supabase)
}

export async function getTicketAnalytics(
  dateRange: DateRange,
  ticketSource?: TicketSource | string
): Promise<OverviewMetrics> {
  const service = await getAnalyticsService()
  return service.getOverviewMetrics(dateRange, ticketSource)
}
