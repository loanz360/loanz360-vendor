/**
 * Enterprise SLA Service
 * Version: 1.0 - Fortune 500 Standard
 *
 * Comprehensive SLA management for all ticket types.
 * Fixes Bug #2: Missing SLA in Employee Tickets
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  TicketPriority,
  TicketSource,
  SLAStatus,
  EscalationLevel,
  DEFAULT_SLA_HOURS
} from '@/types/support-tickets'

// ============================================================
// TYPES
// ============================================================

export interface SLARule {
  id: string
  name: string
  ticket_source: TicketSource | string | null
  category: string | null
  priority: string
  first_response_hours: number
  resolution_hours: number
  use_business_hours: boolean
  business_hours_start: string // HH:MM
  business_hours_end: string // HH:MM
  business_days: number[] // 0-6 (Sunday-Saturday)
  escalate_on_breach: boolean
  escalation_level: number
  notify_at_risk_percentage: number
  is_active: boolean
}

export interface SLACalculationResult {
  first_response_deadline: Date
  resolution_deadline: Date
  sla_status: SLAStatus
  time_remaining_minutes: number
  time_elapsed_minutes: number
  percentage_used: number
  is_first_response_breached: boolean
  is_resolution_breached: boolean
  next_business_hours_start: Date | null
  applied_rule: SLARule | null
}

export interface SLAUpdateResult {
  success: boolean
  sla_deadline: string
  sla_breached: boolean
  sla_status: SLAStatus
  first_response_deadline: string
  error?: string
}

export interface BusinessHoursConfig {
  start: string // HH:MM
  end: string // HH:MM
  days: number[] // 0-6 (Sunday-Saturday)
  timezone: string
}

// ============================================================
// DEFAULT CONFIGURATIONS
// ============================================================

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  start: '09:00',
  end: '18:00',
  days: [1, 2, 3, 4, 5], // Monday to Friday
  timezone: 'Asia/Kolkata'
}

const DEFAULT_SLA_RULES: Record<string, { first_response: number; resolution: number }> = {
  urgent: { first_response: 1, resolution: 4 },
  high: { first_response: 2, resolution: 8 },
  medium: { first_response: 4, resolution: 24 },
  low: { first_response: 8, resolution: 48 }
}

// ============================================================
// SLA SERVICE CLASS
// ============================================================

export class SLAService {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Calculate SLA deadlines for a new ticket
   */
  async calculateSLA(
    ticketSource: TicketSource | string,
    priority: string,
    category?: string,
    createdAt?: Date
  ): Promise<SLACalculationResult> {
    const startTime = createdAt || new Date()

    // Get applicable SLA rule
    const rule = await this.getApplicableSLARule(ticketSource, priority, category)

    // Calculate deadlines
    const firstResponseHours = rule?.first_response_hours || DEFAULT_SLA_RULES[priority]?.first_response || 4
    const resolutionHours = rule?.resolution_hours || DEFAULT_SLA_RULES[priority]?.resolution || 24

    let firstResponseDeadline: Date
    let resolutionDeadline: Date

    if (rule?.use_business_hours) {
      firstResponseDeadline = this.addBusinessHours(startTime, firstResponseHours, {
        start: rule.business_hours_start,
        end: rule.business_hours_end,
        days: rule.business_days,
        timezone: DEFAULT_BUSINESS_HOURS.timezone
      })
      resolutionDeadline = this.addBusinessHours(startTime, resolutionHours, {
        start: rule.business_hours_start,
        end: rule.business_hours_end,
        days: rule.business_days,
        timezone: DEFAULT_BUSINESS_HOURS.timezone
      })
    } else {
      firstResponseDeadline = new Date(startTime.getTime() + firstResponseHours * 60 * 60 * 1000)
      resolutionDeadline = new Date(startTime.getTime() + resolutionHours * 60 * 60 * 1000)
    }

    const now = new Date()
    const timeElapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (60 * 1000))
    const totalMinutes = resolutionHours * 60
    const timeRemainingMinutes = Math.floor((resolutionDeadline.getTime() - now.getTime()) / (60 * 1000))
    const percentageUsed = Math.min(100, (timeElapsedMinutes / totalMinutes) * 100)

    // Determine SLA status
    let slaStatus: SLAStatus = SLAStatus.ON_TRACK
    if (now > resolutionDeadline) {
      slaStatus = SLAStatus.BREACHED
    } else if (percentageUsed >= (rule?.notify_at_risk_percentage || 80)) {
      slaStatus = SLAStatus.AT_RISK
    }

    return {
      first_response_deadline: firstResponseDeadline,
      resolution_deadline: resolutionDeadline,
      sla_status: slaStatus,
      time_remaining_minutes: Math.max(0, timeRemainingMinutes),
      time_elapsed_minutes: timeElapsedMinutes,
      percentage_used: percentageUsed,
      is_first_response_breached: now > firstResponseDeadline,
      is_resolution_breached: now > resolutionDeadline,
      next_business_hours_start: this.getNextBusinessHoursStart(now, rule),
      applied_rule: rule
    }
  }

  /**
   * Get applicable SLA rule from database
   */
  private async getApplicableSLARule(
    ticketSource: TicketSource | string,
    priority: string,
    category?: string
  ): Promise<SLARule | null> {
    // Determine which SLA table to query based on ticket source
    let tableName: string
    switch (ticketSource) {
      case TicketSource.EMPLOYEE:
      case 'EMPLOYEE':
        tableName = 'employee_ticket_sla_rules'
        break
      case TicketSource.CUSTOMER:
      case 'CUSTOMER':
        tableName = 'customer_ticket_sla_rules'
        break
      case TicketSource.PARTNER:
      case 'PARTNER':
        tableName = 'partner_ticket_sla_rules'
        break
      default:
        // Try unified SLA rules table
        tableName = 'ticket_sla_rules'
    }

    // Try to get specific rule for category + priority
    if (category) {
      const { data: specificRule } = await this.supabase
        .from(tableName)
        .select('*')
        .eq('priority', priority)
        .eq('category', category)
        .eq('is_active', true)
        .maybeSingle()

      if (specificRule) return specificRule as SLARule
    }

    // Fall back to priority-only rule
    const { data: priorityRule } = await this.supabase
      .from(tableName)
      .select('*')
      .eq('priority', priority)
      .is('category', null)
      .eq('is_active', true)
      .maybeSingle()

    if (priorityRule) return priorityRule as SLARule

    // Try generic SLA rules table as final fallback
    if (tableName !== 'ticket_sla_rules') {
      const { data: genericRule } = await this.supabase
        .from('ticket_sla_rules')
        .select('*')
        .eq('priority', priority)
        .eq('is_active', true)
        .order('priority_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (genericRule) return genericRule as SLARule
    }

    return null
  }

  /**
   * Update ticket SLA status
   */
  async updateTicketSLA(
    ticketId: string,
    ticketSource: TicketSource | string,
    priority: string,
    category?: string,
    createdAt?: string
  ): Promise<SLAUpdateResult> {
    try {
      const startTime = createdAt ? new Date(createdAt) : new Date()
      const calculation = await this.calculateSLA(ticketSource, priority, category, startTime)

      // Determine table name
      let tableName: string
      switch (ticketSource) {
        case TicketSource.EMPLOYEE:
        case 'EMPLOYEE':
          tableName = 'support_tickets'
          break
        case TicketSource.CUSTOMER:
        case 'CUSTOMER':
          tableName = 'customer_support_tickets'
          break
        case TicketSource.PARTNER:
        case 'PARTNER':
          tableName = 'partner_support_tickets'
          break
        default:
          throw new Error('Invalid ticket source')
      }

      // Update ticket with SLA information
      const { error } = await this.supabase
        .from(tableName)
        .update({
          sla_deadline: calculation.resolution_deadline.toISOString(),
          sla_breached: calculation.is_resolution_breached,
          sla_status: calculation.sla_status,
          first_response_deadline: calculation.first_response_deadline.toISOString()
        })
        .eq('id', ticketId)

      if (error) {
        console.error('Error updating ticket SLA:', error)
        return {
          success: false,
          sla_deadline: calculation.resolution_deadline.toISOString(),
          sla_breached: calculation.is_resolution_breached,
          sla_status: calculation.sla_status,
          first_response_deadline: calculation.first_response_deadline.toISOString(),
          error: error.message
        }
      }

      return {
        success: true,
        sla_deadline: calculation.resolution_deadline.toISOString(),
        sla_breached: calculation.is_resolution_breached,
        sla_status: calculation.sla_status,
        first_response_deadline: calculation.first_response_deadline.toISOString()
      }
    } catch (error) {
      console.error('SLA update error:', error)
      return {
        success: false,
        sla_deadline: new Date().toISOString(),
        sla_breached: false,
        sla_status: SLAStatus.ON_TRACK,
        first_response_deadline: new Date().toISOString(),
        error: (error as Error).message
      }
    }
  }

  /**
   * Check and update SLA breach status for all active tickets
   * This should be called by a scheduled job
   */
  async checkAndUpdateBreaches(): Promise<{ updated: number; breached: number }> {
    let updated = 0
    let breached = 0

    const tables = [
      'support_tickets',
      'customer_support_tickets',
      'partner_support_tickets'
    ]

    const now = new Date()

    for (const tableName of tables) {
      // Get tickets that are not closed/resolved and have SLA deadline
      const { data: tickets } = await this.supabase
        .from(tableName)
        .select('id, sla_deadline, sla_breached, sla_status, created_at, priority')
        .not('status', 'in', '(resolved,closed,cancelled)')
        .not('sla_deadline', 'is', null)

      if (!tickets) continue

      for (const ticket of tickets) {
        const deadline = new Date(ticket.sla_deadline)
        const createdAt = new Date(ticket.created_at)

        // Calculate current SLA status
        const totalTime = deadline.getTime() - createdAt.getTime()
        const elapsedTime = now.getTime() - createdAt.getTime()
        const percentageUsed = (elapsedTime / totalTime) * 100

        let newStatus: SLAStatus
        let isBreached = false

        if (now > deadline) {
          newStatus = SLAStatus.BREACHED
          isBreached = true
          breached++
        } else if (percentageUsed >= 80) {
          newStatus = SLAStatus.AT_RISK
        } else {
          newStatus = SLAStatus.ON_TRACK
        }

        // Update if status changed
        if (ticket.sla_status !== newStatus || ticket.sla_breached !== isBreached) {
          await this.supabase
            .from(tableName)
            .update({
              sla_status: newStatus,
              sla_breached: isBreached
            })
            .eq('id', ticket.id)
          updated++

          // Log SLA breach if newly breached
          if (isBreached && !ticket.sla_breached) {
            await this.logSLABreach(ticket.id, tableName)
          }
        }
      }
    }

    return { updated, breached }
  }

  /**
   * Log SLA breach to activity log
   */
  private async logSLABreach(ticketId: string, tableName: string): Promise<void> {
    let activityTable: string
    switch (tableName) {
      case 'support_tickets':
        activityTable = 'ticket_activity_log'
        break
      case 'customer_support_tickets':
        activityTable = 'customer_ticket_activity_log'
        break
      case 'partner_support_tickets':
        activityTable = 'partner_ticket_activity_log'
        break
      default:
        return
    }

    await this.supabase.from(activityTable).insert({
      ticket_id: ticketId,
      action_type: 'sla_breached',
      action_by: 'system',
      action_by_type: 'system',
      action_by_name: 'System',
      description: 'SLA deadline has been breached'
    })
  }

  /**
   * Pause SLA (when ticket is on hold)
   */
  async pauseSLA(ticketId: string, ticketSource: TicketSource | string): Promise<boolean> {
    let tableName: string
    switch (ticketSource) {
      case TicketSource.EMPLOYEE:
      case 'EMPLOYEE':
        tableName = 'support_tickets'
        break
      case TicketSource.CUSTOMER:
      case 'CUSTOMER':
        tableName = 'customer_support_tickets'
        break
      case TicketSource.PARTNER:
      case 'PARTNER':
        tableName = 'partner_support_tickets'
        break
      default:
        return false
    }

    const { error } = await this.supabase
      .from(tableName)
      .update({
        sla_status: SLAStatus.PAUSED,
        sla_paused_at: new Date().toISOString()
      })
      .eq('id', ticketId)

    return !error
  }

  /**
   * Resume SLA (when ticket is taken off hold)
   */
  async resumeSLA(ticketId: string, ticketSource: TicketSource | string): Promise<boolean> {
    let tableName: string
    switch (ticketSource) {
      case TicketSource.EMPLOYEE:
      case 'EMPLOYEE':
        tableName = 'support_tickets'
        break
      case TicketSource.CUSTOMER:
      case 'CUSTOMER':
        tableName = 'customer_support_tickets'
        break
      case TicketSource.PARTNER:
      case 'PARTNER':
        tableName = 'partner_support_tickets'
        break
      default:
        return false
    }

    // Get current ticket data
    const { data: ticket } = await this.supabase
      .from(tableName)
      .select('sla_deadline, sla_paused_at')
      .eq('id', ticketId)
      .maybeSingle()

    if (!ticket || !ticket.sla_paused_at || !ticket.sla_deadline) {
      return false
    }

    // Calculate time paused and extend deadline
    const pausedAt = new Date(ticket.sla_paused_at)
    const now = new Date()
    const pausedDuration = now.getTime() - pausedAt.getTime()

    const oldDeadline = new Date(ticket.sla_deadline)
    const newDeadline = new Date(oldDeadline.getTime() + pausedDuration)

    const { error } = await this.supabase
      .from(tableName)
      .update({
        sla_deadline: newDeadline.toISOString(),
        sla_status: SLAStatus.ON_TRACK,
        sla_paused_at: null
      })
      .eq('id', ticketId)

    return !error
  }

  /**
   * Add business hours to a date
   */
  private addBusinessHours(startDate: Date, hours: number, config: BusinessHoursConfig): Date {
    let remainingMinutes = hours * 60
    let currentDate = new Date(startDate)

    const [startHour, startMinute] = config.start.split(':').map(Number)
    const [endHour, endMinute] = config.end.split(':').map(Number)
    const businessMinutesPerDay = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)

    while (remainingMinutes > 0) {
      const dayOfWeek = currentDate.getDay()

      // If not a business day, move to next day
      if (!config.days.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(startHour, startMinute, 0, 0)
        continue
      }

      const currentHour = currentDate.getHours()
      const currentMinute = currentDate.getMinutes()
      const currentDayMinutes = currentHour * 60 + currentMinute
      const businessStart = startHour * 60 + startMinute
      const businessEnd = endHour * 60 + endMinute

      // If before business hours, move to start
      if (currentDayMinutes < businessStart) {
        currentDate.setHours(startHour, startMinute, 0, 0)
        continue
      }

      // If after business hours, move to next day
      if (currentDayMinutes >= businessEnd) {
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(startHour, startMinute, 0, 0)
        continue
      }

      // Within business hours - calculate remaining time today
      const remainingTodayMinutes = businessEnd - currentDayMinutes

      if (remainingMinutes <= remainingTodayMinutes) {
        currentDate.setMinutes(currentDate.getMinutes() + remainingMinutes)
        remainingMinutes = 0
      } else {
        remainingMinutes -= remainingTodayMinutes
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(startHour, startMinute, 0, 0)
      }
    }

    return currentDate
  }

  /**
   * Get next business hours start time
   */
  private getNextBusinessHoursStart(now: Date, rule: SLARule | null): Date | null {
    if (!rule?.use_business_hours) return null

    const [startHour, startMinute] = rule.business_hours_start.split(':').map(Number)
    const [endHour, endMinute] = rule.business_hours_end.split(':').map(Number)

    let checkDate = new Date(now)

    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = checkDate.getDay()

      if (rule.business_days.includes(dayOfWeek)) {
        const currentMinutes = checkDate.getHours() * 60 + checkDate.getMinutes()
        const businessStart = startHour * 60 + startMinute
        const businessEnd = endHour * 60 + endMinute

        // If we're before business hours today, return today's start
        if (i === 0 && currentMinutes < businessStart) {
          return new Date(checkDate.setHours(startHour, startMinute, 0, 0))
        }

        // If we're past end of business hours, check tomorrow
        if (i === 0 && currentMinutes >= businessEnd) {
          checkDate.setDate(checkDate.getDate() + 1)
          continue
        }

        // If it's a future day, return that day's start
        if (i > 0) {
          return new Date(checkDate.setHours(startHour, startMinute, 0, 0))
        }
      }

      checkDate.setDate(checkDate.getDate() + 1)
    }

    return null
  }

  /**
   * Get SLA metrics for reporting
   */
  async getSLAMetrics(
    ticketSource?: TicketSource | string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    total_tickets: number
    on_track: number
    at_risk: number
    breached: number
    compliance_rate: number
    avg_response_time_hours: number
    avg_resolution_time_hours: number
  }> {
    const tables = ticketSource
      ? [this.getTableName(ticketSource)]
      : ['support_tickets', 'customer_support_tickets', 'partner_support_tickets']

    let totalTickets = 0
    let onTrack = 0
    let atRisk = 0
    let breached = 0
    let totalResponseTime = 0
    let totalResolutionTime = 0
    let responseTimeCount = 0
    let resolutionTimeCount = 0

    for (const tableName of tables) {
      let query = this.supabase
        .from(tableName)
        .select('sla_status, sla_breached, response_time_hours, resolution_time_hours')

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const { data } = await query

      if (data) {
        totalTickets += data.length
        onTrack += data.filter(t => t.sla_status === 'on_track').length
        atRisk += data.filter(t => t.sla_status === 'at_risk').length
        breached += data.filter(t => t.sla_breached).length

        for (const ticket of data) {
          if (ticket.response_time_hours) {
            totalResponseTime += ticket.response_time_hours
            responseTimeCount++
          }
          if (ticket.resolution_time_hours) {
            totalResolutionTime += ticket.resolution_time_hours
            resolutionTimeCount++
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
      avg_response_time_hours: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      avg_resolution_time_hours: resolutionTimeCount > 0 ? totalResolutionTime / resolutionTimeCount : 0
    }
  }

  private getTableName(ticketSource: TicketSource | string): string {
    switch (ticketSource) {
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
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create an instance of SLAService
 */
export async function getSLAService(): Promise<SLAService> {
  const supabase = await createClient()
  return new SLAService(supabase)
}

/**
 * Quick SLA calculation
 */
export async function calculateTicketSLA(
  ticketSource: TicketSource | string,
  priority: string,
  category?: string
): Promise<SLACalculationResult> {
  const service = await getSLAService()
  return service.calculateSLA(ticketSource, priority, category)
}

/**
 * Update SLA for a ticket
 */
export async function updateTicketSLA(
  ticketId: string,
  ticketSource: TicketSource | string,
  priority: string,
  category?: string,
  createdAt?: string
): Promise<SLAUpdateResult> {
  const service = await getSLAService()
  return service.updateTicketSLA(ticketId, ticketSource, priority, category, createdAt)
}
