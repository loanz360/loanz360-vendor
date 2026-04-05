/**
 * SLA Engine - Enterprise-grade Service Level Agreement Management
 *
 * Features:
 * - Business hours calculation (excludes weekends & holidays)
 * - Priority-based SLA targets
 * - First response & resolution time tracking
 * - Automatic breach detection
 * - At-risk ticket identification
 * - SLA reporting & analytics
 */

import { createClient } from '@/lib/supabase/server'

// SLA Configuration Types
export interface SLAPolicy {
  id: string
  name: string
  description?: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  ticket_source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
  first_response_hours: number
  resolution_hours: number
  business_hours_only: boolean
  business_start_hour: number  // 0-23
  business_end_hour: number    // 0-23
  business_days: number[]      // 0=Sunday, 1=Monday, etc.
  exclude_holidays: boolean
  escalation_enabled: boolean
  escalation_thresholds: {
    warning_percent: number    // e.g., 75% of SLA time
    critical_percent: number   // e.g., 90% of SLA time
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SLAStatus {
  ticket_id: string
  policy_id: string
  policy_name: string
  first_response: {
    target_hours: number
    actual_hours: number | null
    deadline: string
    status: 'pending' | 'met' | 'breached'
    remaining_hours: number | null
    percent_used: number
  }
  resolution: {
    target_hours: number
    actual_hours: number | null
    deadline: string
    status: 'pending' | 'met' | 'breached'
    remaining_hours: number | null
    percent_used: number
  }
  overall_status: 'on_track' | 'at_risk' | 'breached'
  is_paused: boolean
  paused_reason?: string
}

export interface Holiday {
  id: string
  date: string
  name: string
  is_recurring: boolean
}

// Default SLA Policies
export const DEFAULT_SLA_POLICIES: Omit<SLAPolicy, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Urgent Priority SLA',
    description: 'For urgent/critical tickets requiring immediate attention',
    priority: 'urgent',
    ticket_source: null,
    first_response_hours: 1,
    resolution_hours: 4,
    business_hours_only: false, // 24/7 for urgent
    business_start_hour: 0,
    business_end_hour: 24,
    business_days: [0, 1, 2, 3, 4, 5, 6],
    exclude_holidays: false,
    escalation_enabled: true,
    escalation_thresholds: { warning_percent: 50, critical_percent: 75 },
    is_active: true
  },
  {
    name: 'High Priority SLA',
    description: 'For high priority tickets',
    priority: 'high',
    ticket_source: null,
    first_response_hours: 2,
    resolution_hours: 8,
    business_hours_only: true,
    business_start_hour: 9,
    business_end_hour: 18,
    business_days: [1, 2, 3, 4, 5], // Mon-Fri
    exclude_holidays: true,
    escalation_enabled: true,
    escalation_thresholds: { warning_percent: 60, critical_percent: 80 },
    is_active: true
  },
  {
    name: 'Medium Priority SLA',
    description: 'For medium priority tickets',
    priority: 'medium',
    ticket_source: null,
    first_response_hours: 4,
    resolution_hours: 24,
    business_hours_only: true,
    business_start_hour: 9,
    business_end_hour: 18,
    business_days: [1, 2, 3, 4, 5],
    exclude_holidays: true,
    escalation_enabled: true,
    escalation_thresholds: { warning_percent: 70, critical_percent: 85 },
    is_active: true
  },
  {
    name: 'Low Priority SLA',
    description: 'For low priority tickets',
    priority: 'low',
    ticket_source: null,
    first_response_hours: 8,
    resolution_hours: 72,
    business_hours_only: true,
    business_start_hour: 9,
    business_end_hour: 18,
    business_days: [1, 2, 3, 4, 5],
    exclude_holidays: true,
    escalation_enabled: false,
    escalation_thresholds: { warning_percent: 75, critical_percent: 90 },
    is_active: true
  }
]

/**
 * Get applicable SLA policy for a ticket
 */
export async function getSLAPolicy(
  priority: string,
  source?: string
): Promise<SLAPolicy | null> {
  const supabase = await createClient()

  // First try to find source-specific policy
  if (source) {
    const { data: sourcePolicy } = await supabase
      .from('unified_sla_policies')
      .select('*')
      .eq('priority', priority)
      .eq('ticket_source', source)
      .eq('is_active', true)
      .maybeSingle()

    if (sourcePolicy) return sourcePolicy as SLAPolicy
  }

  // Fall back to general policy
  const { data: generalPolicy } = await supabase
    .from('unified_sla_policies')
    .select('*')
    .eq('priority', priority)
    .is('ticket_source', null)
    .eq('is_active', true)
    .maybeSingle()

  return generalPolicy as SLAPolicy | null
}

/**
 * Get holidays for a date range
 */
async function getHolidays(startDate: Date, endDate: Date): Promise<Date[]> {
  const supabase = await createClient()

  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', startStr)
    .lte('date', endStr)

  return (holidays || []).map(h => new Date(h.date))
}

/**
 * Check if a given date is a holiday
 */
function isHoliday(date: Date, holidays: Date[]): boolean {
  const dateStr = date.toISOString().split('T')[0]
  return holidays.some(h => h.toISOString().split('T')[0] === dateStr)
}

/**
 * Check if a given date/time is within business hours
 */
function isBusinessHour(
  date: Date,
  policy: SLAPolicy,
  holidays: Date[]
): boolean {
  // Check if it's a business day
  const dayOfWeek = date.getDay()
  if (!policy.business_days.includes(dayOfWeek)) {
    return false
  }

  // Check holidays
  if (policy.exclude_holidays && isHoliday(date, holidays)) {
    return false
  }

  // Check business hours
  const hour = date.getHours()
  return hour >= policy.business_start_hour && hour < policy.business_end_hour
}

/**
 * Calculate business hours between two dates
 */
export async function calculateBusinessHours(
  startDate: Date,
  endDate: Date,
  policy: SLAPolicy
): Promise<number> {
  if (!policy.business_hours_only) {
    // Simple calculation for 24/7 support
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
  }

  const holidays = await getHolidays(startDate, endDate)
  let businessHours = 0
  const current = new Date(startDate)

  while (current < endDate) {
    if (isBusinessHour(current, policy, holidays)) {
      // Add up to one hour or until end date
      const nextHour = new Date(current)
      nextHour.setHours(nextHour.getHours() + 1)

      if (nextHour <= endDate) {
        businessHours += 1
      } else {
        // Partial hour
        businessHours += (endDate.getTime() - current.getTime()) / (1000 * 60 * 60)
      }
    }
    current.setHours(current.getHours() + 1)
  }

  return businessHours
}

/**
 * Calculate SLA deadline based on policy
 */
export async function calculateSLADeadline(
  startDate: Date,
  targetHours: number,
  policy: SLAPolicy
): Promise<Date> {
  if (!policy.business_hours_only) {
    // Simple calculation for 24/7 support
    const deadline = new Date(startDate)
    deadline.setHours(deadline.getHours() + targetHours)
    return deadline
  }

  const maxDays = Math.ceil(targetHours / 8) + 30 // Buffer for holidays
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + maxDays)

  const holidays = await getHolidays(startDate, endDate)

  let hoursRemaining = targetHours
  const current = new Date(startDate)

  while (hoursRemaining > 0) {
    if (isBusinessHour(current, policy, holidays)) {
      hoursRemaining -= 1
    }
    if (hoursRemaining > 0) {
      current.setHours(current.getHours() + 1)
    }
  }

  return current
}

/**
 * Calculate SLA status for a ticket
 */
export async function calculateSLAStatus(
  ticketId: string,
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  createdAt: string,
  firstResponseAt: string | null,
  resolvedAt: string | null,
  status: string,
  isPaused: boolean = false,
  pausedReason?: string
): Promise<SLAStatus | null> {
  const policy = await getSLAPolicy(priority, source)

  if (!policy) {
    return null
  }

  const now = new Date()
  const created = new Date(createdAt)
  const firstResponse = firstResponseAt ? new Date(firstResponseAt) : null
  const resolved = resolvedAt ? new Date(resolvedAt) : null

  // Calculate first response metrics
  const firstResponseDeadline = await calculateSLADeadline(
    created,
    policy.first_response_hours,
    policy
  )

  let firstResponseActualHours: number | null = null
  let firstResponseStatus: 'pending' | 'met' | 'breached' = 'pending'
  let firstResponseRemainingHours: number | null = null
  let firstResponsePercentUsed = 0

  if (firstResponse) {
    firstResponseActualHours = await calculateBusinessHours(created, firstResponse, policy)
    firstResponseStatus = firstResponseActualHours <= policy.first_response_hours ? 'met' : 'breached'
    firstResponsePercentUsed = (firstResponseActualHours / policy.first_response_hours) * 100
  } else if (!isPaused && !['resolved', 'closed'].includes(status)) {
    const elapsedHours = await calculateBusinessHours(created, now, policy)
    firstResponseRemainingHours = Math.max(0, policy.first_response_hours - elapsedHours)
    firstResponsePercentUsed = (elapsedHours / policy.first_response_hours) * 100

    if (now > firstResponseDeadline) {
      firstResponseStatus = 'breached'
    }
  }

  // Calculate resolution metrics
  const resolutionDeadline = await calculateSLADeadline(
    created,
    policy.resolution_hours,
    policy
  )

  let resolutionActualHours: number | null = null
  let resolutionStatus: 'pending' | 'met' | 'breached' = 'pending'
  let resolutionRemainingHours: number | null = null
  let resolutionPercentUsed = 0

  if (resolved) {
    resolutionActualHours = await calculateBusinessHours(created, resolved, policy)
    resolutionStatus = resolutionActualHours <= policy.resolution_hours ? 'met' : 'breached'
    resolutionPercentUsed = (resolutionActualHours / policy.resolution_hours) * 100
  } else if (!isPaused && !['resolved', 'closed'].includes(status)) {
    const elapsedHours = await calculateBusinessHours(created, now, policy)
    resolutionRemainingHours = Math.max(0, policy.resolution_hours - elapsedHours)
    resolutionPercentUsed = (elapsedHours / policy.resolution_hours) * 100

    if (now > resolutionDeadline) {
      resolutionStatus = 'breached'
    }
  }

  // Determine overall status
  let overallStatus: 'on_track' | 'at_risk' | 'breached' = 'on_track'

  if (firstResponseStatus === 'breached' || resolutionStatus === 'breached') {
    overallStatus = 'breached'
  } else if (
    firstResponsePercentUsed >= policy.escalation_thresholds.warning_percent ||
    resolutionPercentUsed >= policy.escalation_thresholds.warning_percent
  ) {
    overallStatus = 'at_risk'
  }

  return {
    ticket_id: ticketId,
    policy_id: policy.id,
    policy_name: policy.name,
    first_response: {
      target_hours: policy.first_response_hours,
      actual_hours: firstResponseActualHours,
      deadline: firstResponseDeadline.toISOString(),
      status: firstResponseStatus,
      remaining_hours: firstResponseRemainingHours,
      percent_used: Math.min(100, firstResponsePercentUsed)
    },
    resolution: {
      target_hours: policy.resolution_hours,
      actual_hours: resolutionActualHours,
      deadline: resolutionDeadline.toISOString(),
      status: resolutionStatus,
      remaining_hours: resolutionRemainingHours,
      percent_used: Math.min(100, resolutionPercentUsed)
    },
    overall_status: overallStatus,
    is_paused: isPaused,
    paused_reason: pausedReason
  }
}

/**
 * Update SLA status for a ticket in the database
 */
export async function updateTicketSLAStatus(
  ticketId: string,
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  slaStatus: SLAStatus
): Promise<void> {
  const supabase = await createClient()

  // Determine which table to update
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
  }

  await supabase
    .from(tableName)
    .update({
      sla_policy_id: slaStatus.policy_id,
      sla_deadline: slaStatus.resolution.deadline,
      sla_status: slaStatus.overall_status,
      sla_first_response_deadline: slaStatus.first_response.deadline,
      sla_first_response_met: slaStatus.first_response.status === 'met',
      sla_resolution_met: slaStatus.resolution.status === 'met',
      sla_breached: slaStatus.overall_status === 'breached'
    })
    .eq('id', ticketId)
}

/**
 * Get tickets at risk of SLA breach
 */
export async function getAtRiskTickets(
  source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<{ source: string; ticket_id: string; sla_status: SLAStatus }[]> {
  const supabase = await createClient()
  const atRiskTickets: { source: string; ticket_id: string; sla_status: SLAStatus }[] = []

  const sources = source ? [source] : ['EMPLOYEE', 'CUSTOMER', 'PARTNER']

  for (const src of sources) {
    let tableName: string
    switch (src) {
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
        continue
    }

    const { data: tickets } = await supabase
      .from(tableName)
      .select('id, priority, created_at, first_response_at, resolved_at, status')
      .not('status', 'in', '(resolved,closed)')
      .or('sla_status.eq.at_risk,sla_status.eq.breached')

    for (const ticket of tickets || []) {
      const slaStatus = await calculateSLAStatus(
        ticket.id,
        src as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
        ticket.priority,
        ticket.created_at,
        ticket.first_response_at,
        ticket.resolved_at,
        ticket.status
      )

      if (slaStatus && (slaStatus.overall_status === 'at_risk' || slaStatus.overall_status === 'breached')) {
        atRiskTickets.push({
          source: src,
          ticket_id: ticket.id,
          sla_status: slaStatus
        })
      }
    }
  }

  return atRiskTickets
}

/**
 * Generate SLA compliance report
 */
export interface SLAComplianceReport {
  period: { start: string; end: string }
  total_tickets: number
  first_response: {
    met: number
    breached: number
    compliance_rate: number
    avg_response_hours: number
  }
  resolution: {
    met: number
    breached: number
    compliance_rate: number
    avg_resolution_hours: number
  }
  by_priority: {
    priority: string
    total: number
    first_response_compliance: number
    resolution_compliance: number
  }[]
  by_source: {
    source: string
    total: number
    first_response_compliance: number
    resolution_compliance: number
  }[]
}

export async function generateSLAComplianceReport(
  startDate: Date,
  endDate: Date,
  source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<SLAComplianceReport> {
  const supabase = await createClient()

  const sources = source ? [source] : ['EMPLOYEE', 'CUSTOMER', 'PARTNER']

  let totalTickets = 0
  let firstResponseMet = 0
  let firstResponseBreached = 0
  let resolutionMet = 0
  let resolutionBreached = 0
  let totalResponseHours = 0
  let totalResolutionHours = 0
  let responseCount = 0
  let resolutionCount = 0

  const byPriority: Record<string, { total: number; frMet: number; resMet: number }> = {}
  const bySource: Record<string, { total: number; frMet: number; resMet: number }> = {}

  for (const src of sources) {
    let tableName: string
    switch (src) {
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
        continue
    }

    const { data: tickets } = await supabase
      .from(tableName)
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    for (const ticket of tickets || []) {
      totalTickets++

      // Initialize tracking objects
      if (!byPriority[ticket.priority]) {
        byPriority[ticket.priority] = { total: 0, frMet: 0, resMet: 0 }
      }
      if (!bySource[src]) {
        bySource[src] = { total: 0, frMet: 0, resMet: 0 }
      }

      byPriority[ticket.priority].total++
      bySource[src].total++

      // Check first response
      if (ticket.sla_first_response_met !== null) {
        if (ticket.sla_first_response_met) {
          firstResponseMet++
          byPriority[ticket.priority].frMet++
          bySource[src].frMet++
        } else {
          firstResponseBreached++
        }
      }

      // Check resolution
      if (ticket.sla_resolution_met !== null) {
        if (ticket.sla_resolution_met) {
          resolutionMet++
          byPriority[ticket.priority].resMet++
          bySource[src].resMet++
        } else {
          resolutionBreached++
        }
      }

      // Calculate averages
      if (ticket.response_time_hours) {
        totalResponseHours += ticket.response_time_hours
        responseCount++
      }
      if (ticket.resolution_time_hours) {
        totalResolutionHours += ticket.resolution_time_hours
        resolutionCount++
      }
    }
  }

  const firstResponseTotal = firstResponseMet + firstResponseBreached
  const resolutionTotal = resolutionMet + resolutionBreached

  return {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    total_tickets: totalTickets,
    first_response: {
      met: firstResponseMet,
      breached: firstResponseBreached,
      compliance_rate: firstResponseTotal > 0 ? (firstResponseMet / firstResponseTotal) * 100 : 0,
      avg_response_hours: responseCount > 0 ? totalResponseHours / responseCount : 0
    },
    resolution: {
      met: resolutionMet,
      breached: resolutionBreached,
      compliance_rate: resolutionTotal > 0 ? (resolutionMet / resolutionTotal) * 100 : 0,
      avg_resolution_hours: resolutionCount > 0 ? totalResolutionHours / resolutionCount : 0
    },
    by_priority: Object.entries(byPriority).map(([priority, data]) => ({
      priority,
      total: data.total,
      first_response_compliance: data.total > 0 ? (data.frMet / data.total) * 100 : 0,
      resolution_compliance: data.total > 0 ? (data.resMet / data.total) * 100 : 0
    })),
    by_source: Object.entries(bySource).map(([source, data]) => ({
      source,
      total: data.total,
      first_response_compliance: data.total > 0 ? (data.frMet / data.total) * 100 : 0,
      resolution_compliance: data.total > 0 ? (data.resMet / data.total) * 100 : 0
    }))
  }
}

/**
 * Process SLA for a newly created ticket
 */
export async function initializeTicketSLA(
  ticketId: string,
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  createdAt: string
): Promise<SLAStatus | null> {
  const slaStatus = await calculateSLAStatus(
    ticketId,
    source,
    priority,
    createdAt,
    null,
    null,
    'new'
  )

  if (slaStatus) {
    await updateTicketSLAStatus(ticketId, source, slaStatus)
  }

  return slaStatus
}

/**
 * Record first response for SLA tracking
 */
export async function recordFirstResponse(
  ticketId: string,
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  createdAt: string,
  responseAt: string
): Promise<SLAStatus | null> {
  const slaStatus = await calculateSLAStatus(
    ticketId,
    source,
    priority,
    createdAt,
    responseAt,
    null,
    'in_progress'
  )

  if (slaStatus) {
    await updateTicketSLAStatus(ticketId, source, slaStatus)
  }

  return slaStatus
}

/**
 * Record resolution for SLA tracking
 */
export async function recordResolution(
  ticketId: string,
  source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  createdAt: string,
  firstResponseAt: string | null,
  resolvedAt: string
): Promise<SLAStatus | null> {
  const slaStatus = await calculateSLAStatus(
    ticketId,
    source,
    priority,
    createdAt,
    firstResponseAt,
    resolvedAt,
    'resolved'
  )

  if (slaStatus) {
    await updateTicketSLAStatus(ticketId, source, slaStatus)
  }

  return slaStatus
}
