/**
 * Ticket Counts Service - Enterprise Grade
 * Version: 1.0
 *
 * Efficient ticket count calculation with caching support.
 * Fixes Bug #3: Race Condition in Counts
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { TicketSource, TicketStatus, TicketPriority, SLAStatus } from '@/types/support-tickets'

// ============================================================
// TYPES
// ============================================================

export interface TicketCountsResult {
  // Status counts
  total: number
  new: number
  assigned: number
  in_progress: number
  pending_requester: number
  pending_internal: number
  on_hold: number
  escalated: number
  resolved: number
  closed: number
  reopened: number

  // Priority counts
  urgent: number
  high: number
  medium: number
  low: number

  // SLA counts
  sla_on_track: number
  sla_at_risk: number
  sla_breached: number

  // Assignment counts
  unassigned: number
  requires_urgent_attention: number

  // Queue counts (for employees)
  my_queue?: number

  // Source counts (for unified view)
  by_source?: {
    employee: number
    customer: number
    partner: number
  }
}

export interface CountsQuery {
  userId?: string
  userRole?: string
  department?: string
  ticketSource?: TicketSource | string
  dateFrom?: string
  dateTo?: string
  useCache?: boolean
}

// ============================================================
// CACHE CONFIGURATION
// ============================================================

// In-memory cache for counts (should be replaced with Redis in production)
const countsCache = new Map<string, { data: TicketCountsResult; timestamp: number }>()
const CACHE_TTL_MS = 30000 // 30 seconds

function getCacheKey(query: CountsQuery): string {
  return `counts:${query.ticketSource || 'all'}:${query.userId || 'any'}:${query.department || 'any'}`
}

function getFromCache(key: string): TicketCountsResult | null {
  const cached = countsCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  countsCache.delete(key)
  return null
}

function setCache(key: string, data: TicketCountsResult): void {
  countsCache.set(key, { data, timestamp: Date.now() })
}

export function invalidateCountsCache(ticketSource?: string, userId?: string): void {
  if (!ticketSource && !userId) {
    countsCache.clear()
    return
  }

  for (const key of countsCache.keys()) {
    if (ticketSource && key.includes(ticketSource)) {
      countsCache.delete(key)
    }
    if (userId && key.includes(userId)) {
      countsCache.delete(key)
    }
  }
}

// ============================================================
// TICKET COUNTS SERVICE
// ============================================================

export class TicketCountsService {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Get counts for employee tickets
   */
  async getEmployeeTicketCounts(query: CountsQuery = {}): Promise<TicketCountsResult> {
    const cacheKey = getCacheKey({ ...query, ticketSource: 'EMPLOYEE' })

    if (query.useCache !== false) {
      const cached = getFromCache(cacheKey)
      if (cached) return cached
    }

    // Build optimized count query using aggregate functions
    let baseQuery = this.supabase
      .from('support_tickets')
      .select('status, priority, sla_status, sla_breached, assigned_user_id, assigned_to, requires_urgent_attention, employee_id', { count: 'exact' })

    // Apply filters
    if (query.userId && query.userRole === 'EMPLOYEE') {
      baseQuery = baseQuery.eq('employee_id', query.userId)
    }

    if (query.department) {
      baseQuery = baseQuery.eq('assigned_to', query.department)
    }

    if (query.dateFrom) {
      baseQuery = baseQuery.gte('created_at', query.dateFrom)
    }

    if (query.dateTo) {
      baseQuery = baseQuery.lte('created_at', query.dateTo)
    }

    const { data: tickets, count } = await baseQuery

    const counts = this.calculateCounts(tickets || [], query.userId)
    counts.total = count || tickets?.length || 0

    // Calculate my_queue for employee context
    if (query.userId) {
      counts.my_queue = tickets?.filter(t =>
        t.assigned_user_id === query.userId ||
        (t.employee_id === query.userId)
      ).length || 0
    }

    setCache(cacheKey, counts)
    return counts
  }

  /**
   * Get counts for customer tickets
   */
  async getCustomerTicketCounts(query: CountsQuery = {}): Promise<TicketCountsResult> {
    const cacheKey = getCacheKey({ ...query, ticketSource: 'CUSTOMER' })

    if (query.useCache !== false) {
      const cached = getFromCache(cacheKey)
      if (cached) return cached
    }

    let baseQuery = this.supabase
      .from('customer_support_tickets')
      .select('status, priority, sla_status, sla_breached, assigned_to_customer_support_id, routed_to_department, requires_urgent_attention, customer_id', { count: 'exact' })

    if (query.userId && query.userRole === 'CUSTOMER') {
      baseQuery = baseQuery.eq('customer_id', query.userId)
    }

    if (query.department) {
      baseQuery = baseQuery.eq('routed_to_department', query.department)
    }

    if (query.dateFrom) {
      baseQuery = baseQuery.gte('created_at', query.dateFrom)
    }

    if (query.dateTo) {
      baseQuery = baseQuery.lte('created_at', query.dateTo)
    }

    const { data: tickets, count } = await baseQuery

    const counts = this.calculateCounts(tickets || [], query.userId, 'assigned_to_customer_support_id')
    counts.total = count || tickets?.length || 0

    if (query.userId && query.userRole === 'EMPLOYEE') {
      counts.my_queue = tickets?.filter(t =>
        t.assigned_to_customer_support_id === query.userId
      ).length || 0
    }

    setCache(cacheKey, counts)
    return counts
  }

  /**
   * Get counts for partner tickets
   */
  async getPartnerTicketCounts(query: CountsQuery = {}): Promise<TicketCountsResult> {
    const cacheKey = getCacheKey({ ...query, ticketSource: 'PARTNER' })

    if (query.useCache !== false) {
      const cached = getFromCache(cacheKey)
      if (cached) return cached
    }

    let baseQuery = this.supabase
      .from('partner_support_tickets')
      .select('status, priority, sla_status, sla_breached, assigned_to_partner_support_id, routed_to_employee_id, routed_to_department, requires_urgent_attention, partner_id', { count: 'exact' })

    if (query.userId && query.userRole === 'PARTNER') {
      baseQuery = baseQuery.eq('partner_id', query.userId)
    }

    if (query.department) {
      baseQuery = baseQuery.eq('routed_to_department', query.department)
    }

    if (query.dateFrom) {
      baseQuery = baseQuery.gte('created_at', query.dateFrom)
    }

    if (query.dateTo) {
      baseQuery = baseQuery.lte('created_at', query.dateTo)
    }

    const { data: tickets, count } = await baseQuery

    const counts = this.calculateCountsPartner(tickets || [], query.userId)
    counts.total = count || tickets?.length || 0

    if (query.userId && query.userRole === 'EMPLOYEE') {
      counts.my_queue = tickets?.filter(t =>
        t.assigned_to_partner_support_id === query.userId ||
        t.routed_to_employee_id === query.userId
      ).length || 0
    }

    setCache(cacheKey, counts)
    return counts
  }

  /**
   * Get unified counts across all ticket sources (for Super Admin)
   */
  async getUnifiedCounts(query: CountsQuery = {}): Promise<TicketCountsResult> {
    const cacheKey = getCacheKey({ ...query, ticketSource: 'unified' })

    if (query.useCache !== false) {
      const cached = getFromCache(cacheKey)
      if (cached) return cached
    }

    // Fetch counts from all three sources in parallel
    const [employeeCounts, customerCounts, partnerCounts] = await Promise.all([
      this.getEmployeeTicketCounts({ ...query, useCache: false }),
      this.getCustomerTicketCounts({ ...query, useCache: false }),
      this.getPartnerTicketCounts({ ...query, useCache: false })
    ])

    // Merge counts
    const unified: TicketCountsResult = {
      total: employeeCounts.total + customerCounts.total + partnerCounts.total,
      new: employeeCounts.new + customerCounts.new + partnerCounts.new,
      assigned: employeeCounts.assigned + customerCounts.assigned + partnerCounts.assigned,
      in_progress: employeeCounts.in_progress + customerCounts.in_progress + partnerCounts.in_progress,
      pending_requester: employeeCounts.pending_requester + customerCounts.pending_requester + partnerCounts.pending_requester,
      pending_internal: employeeCounts.pending_internal + customerCounts.pending_internal + partnerCounts.pending_internal,
      on_hold: employeeCounts.on_hold + customerCounts.on_hold + partnerCounts.on_hold,
      escalated: employeeCounts.escalated + customerCounts.escalated + partnerCounts.escalated,
      resolved: employeeCounts.resolved + customerCounts.resolved + partnerCounts.resolved,
      closed: employeeCounts.closed + customerCounts.closed + partnerCounts.closed,
      reopened: employeeCounts.reopened + customerCounts.reopened + partnerCounts.reopened,
      urgent: employeeCounts.urgent + customerCounts.urgent + partnerCounts.urgent,
      high: employeeCounts.high + customerCounts.high + partnerCounts.high,
      medium: employeeCounts.medium + customerCounts.medium + partnerCounts.medium,
      low: employeeCounts.low + customerCounts.low + partnerCounts.low,
      sla_on_track: employeeCounts.sla_on_track + customerCounts.sla_on_track + partnerCounts.sla_on_track,
      sla_at_risk: employeeCounts.sla_at_risk + customerCounts.sla_at_risk + partnerCounts.sla_at_risk,
      sla_breached: employeeCounts.sla_breached + customerCounts.sla_breached + partnerCounts.sla_breached,
      unassigned: employeeCounts.unassigned + customerCounts.unassigned + partnerCounts.unassigned,
      requires_urgent_attention: employeeCounts.requires_urgent_attention + customerCounts.requires_urgent_attention + partnerCounts.requires_urgent_attention,
      by_source: {
        employee: employeeCounts.total,
        customer: customerCounts.total,
        partner: partnerCounts.total
      }
    }

    setCache(cacheKey, unified)
    return unified
  }

  /**
   * Get counts by specific queue type (optimized for sidebar badges)
   */
  async getQueueCounts(
    userId: string,
    department: string,
    ticketSource: TicketSource | string
  ): Promise<{
    my_queue: number
    urgent: number
    sla_breach: number
    unassigned: number
  }> {
    const cacheKey = `queue:${ticketSource}:${userId}:${department}`

    const cached = getFromCache(cacheKey) as any
    if (cached?.my_queue !== undefined) {
      return {
        my_queue: cached.my_queue,
        urgent: cached.urgent,
        sla_breach: cached.sla_breached,
        unassigned: cached.unassigned
      }
    }

    let tableName: string
    let assignedField: string
    let assignedField2: string | null = null

    switch (ticketSource) {
      case TicketSource.EMPLOYEE:
      case 'EMPLOYEE':
        tableName = 'support_tickets'
        assignedField = 'assigned_user_id'
        break
      case TicketSource.CUSTOMER:
      case 'CUSTOMER':
        tableName = 'customer_support_tickets'
        assignedField = 'assigned_to_customer_support_id'
        break
      case TicketSource.PARTNER:
      case 'PARTNER':
        tableName = 'partner_support_tickets'
        assignedField = 'assigned_to_partner_support_id'
        assignedField2 = 'routed_to_employee_id'
        break
      default:
        return { my_queue: 0, urgent: 0, sla_breach: 0, unassigned: 0 }
    }

    // Single query with all conditions
    const { data: tickets } = await this.supabase
      .from(tableName)
      .select(`status, priority, sla_breached, ${assignedField}${assignedField2 ? `, ${assignedField2}` : ''}, routed_to_department`)
      .not('status', 'in', '(resolved,closed)')

    if (!tickets) {
      return { my_queue: 0, urgent: 0, sla_breach: 0, unassigned: 0 }
    }

    // Filter in memory (faster than multiple DB queries)
    const departmentTickets = tickets.filter(t => t.routed_to_department === department)

    const result = {
      my_queue: tickets.filter(t =>
        t[assignedField] === userId || (assignedField2 && t[assignedField2] === userId)
      ).length,
      urgent: departmentTickets.filter(t => t.priority === 'urgent').length,
      sla_breach: departmentTickets.filter(t => t.sla_breached).length,
      unassigned: departmentTickets.filter(t =>
        !t[assignedField] && (!assignedField2 || !t[assignedField2])
      ).length
    }

    return result
  }

  /**
   * Calculate counts from ticket array
   */
  private calculateCounts(
    tickets: any[],
    userId?: string,
    assignedField: string = 'assigned_user_id'
  ): TicketCountsResult {
    return {
      total: tickets.length,
      new: tickets.filter(t => t.status === 'new' || t.status === 'open').length,
      assigned: tickets.filter(t => t.status === 'assigned').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      pending_requester: tickets.filter(t => t.status === 'pending_requester' || t.status === 'pending_customer' || t.status === 'pending_partner').length,
      pending_internal: tickets.filter(t => t.status === 'pending_internal').length,
      on_hold: tickets.filter(t => t.status === 'on_hold').length,
      escalated: tickets.filter(t => t.status === 'escalated').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      reopened: tickets.filter(t => t.status === 'reopened').length,
      urgent: tickets.filter(t => t.priority === 'urgent').length,
      high: tickets.filter(t => t.priority === 'high').length,
      medium: tickets.filter(t => t.priority === 'medium').length,
      low: tickets.filter(t => t.priority === 'low').length,
      sla_on_track: tickets.filter(t => t.sla_status === 'on_track' || (!t.sla_breached && t.sla_status !== 'at_risk')).length,
      sla_at_risk: tickets.filter(t => t.sla_status === 'at_risk').length,
      sla_breached: tickets.filter(t => t.sla_breached).length,
      unassigned: tickets.filter(t => !t[assignedField]).length,
      requires_urgent_attention: tickets.filter(t => t.requires_urgent_attention).length
    }
  }

  /**
   * Calculate counts for partner tickets (has two assignment fields)
   */
  private calculateCountsPartner(tickets: any[], userId?: string): TicketCountsResult {
    const counts = this.calculateCounts(tickets, userId, 'assigned_to_partner_support_id')

    // Override unassigned to check both fields
    counts.unassigned = tickets.filter(t =>
      !t.assigned_to_partner_support_id && !t.routed_to_employee_id
    ).length

    return counts
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create an instance of TicketCountsService
 */
export async function getTicketCountsService(): Promise<TicketCountsService> {
  const supabase = await createClient()
  return new TicketCountsService(supabase)
}

/**
 * Quick unified counts
 */
export async function getUnifiedTicketCounts(query: CountsQuery = {}): Promise<TicketCountsResult> {
  const service = await getTicketCountsService()
  return service.getUnifiedCounts(query)
}

/**
 * Quick source-specific counts
 */
export async function getTicketCounts(
  ticketSource: TicketSource | string,
  query: CountsQuery = {}
): Promise<TicketCountsResult> {
  const service = await getTicketCountsService()

  switch (ticketSource) {
    case TicketSource.EMPLOYEE:
    case 'EMPLOYEE':
      return service.getEmployeeTicketCounts(query)
    case TicketSource.CUSTOMER:
    case 'CUSTOMER':
      return service.getCustomerTicketCounts(query)
    case TicketSource.PARTNER:
    case 'PARTNER':
      return service.getPartnerTicketCounts(query)
    default:
      return service.getUnifiedCounts(query)
  }
}
