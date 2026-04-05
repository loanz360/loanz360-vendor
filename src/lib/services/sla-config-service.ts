import { createClient } from '@supabase/supabase-js'

// ============================================================================
// SLA CONFIGURATION SERVICE
// Centralized SLA rules management with database-backed configuration
// Fixes Bug #7: Hardcoded SLA Fallback
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// TYPES
// ============================================================================

export type TicketSource = 'employee' | 'customer' | 'partner'
export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'critical'

export interface SLARule {
  id: string
  ticket_source: TicketSource
  priority: Priority
  category?: string
  first_response_hours: number
  resolution_hours: number
  escalation_hours: number
  business_hours_only: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SLAConfig {
  firstResponseHours: number
  resolutionHours: number
  escalationHours: number
  businessHoursOnly: boolean
  warningThresholdPercent: number
}

export interface BusinessHours {
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  startHour: number
  endHour: number
  timezone: string
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// These are used only if database rules don't exist
// ============================================================================

const DEFAULT_SLA_RULES: Record<TicketSource, Record<Priority, SLAConfig>> = {
  employee: {
    critical: {
      firstResponseHours: 0.5,  // 30 minutes
      resolutionHours: 4,
      escalationHours: 2,
      businessHoursOnly: false,
      warningThresholdPercent: 75
    },
    urgent: {
      firstResponseHours: 1,
      resolutionHours: 8,
      escalationHours: 4,
      businessHoursOnly: false,
      warningThresholdPercent: 75
    },
    high: {
      firstResponseHours: 4,
      resolutionHours: 24,
      escalationHours: 12,
      businessHoursOnly: true,
      warningThresholdPercent: 80
    },
    medium: {
      firstResponseHours: 8,
      resolutionHours: 48,
      escalationHours: 24,
      businessHoursOnly: true,
      warningThresholdPercent: 80
    },
    low: {
      firstResponseHours: 24,
      resolutionHours: 120,
      escalationHours: 72,
      businessHoursOnly: true,
      warningThresholdPercent: 85
    }
  },
  customer: {
    critical: {
      firstResponseHours: 0.25, // 15 minutes
      resolutionHours: 2,
      escalationHours: 1,
      businessHoursOnly: false,
      warningThresholdPercent: 70
    },
    urgent: {
      firstResponseHours: 0.5,
      resolutionHours: 4,
      escalationHours: 2,
      businessHoursOnly: false,
      warningThresholdPercent: 75
    },
    high: {
      firstResponseHours: 2,
      resolutionHours: 12,
      escalationHours: 6,
      businessHoursOnly: false,
      warningThresholdPercent: 80
    },
    medium: {
      firstResponseHours: 4,
      resolutionHours: 24,
      escalationHours: 12,
      businessHoursOnly: true,
      warningThresholdPercent: 80
    },
    low: {
      firstResponseHours: 12,
      resolutionHours: 72,
      escalationHours: 48,
      businessHoursOnly: true,
      warningThresholdPercent: 85
    }
  },
  partner: {
    critical: {
      firstResponseHours: 0.5,
      resolutionHours: 4,
      escalationHours: 2,
      businessHoursOnly: false,
      warningThresholdPercent: 70
    },
    urgent: {
      firstResponseHours: 1,
      resolutionHours: 8,
      escalationHours: 4,
      businessHoursOnly: false,
      warningThresholdPercent: 75
    },
    high: {
      firstResponseHours: 4,
      resolutionHours: 24,
      escalationHours: 12,
      businessHoursOnly: true,
      warningThresholdPercent: 80
    },
    medium: {
      firstResponseHours: 8,
      resolutionHours: 48,
      escalationHours: 24,
      businessHoursOnly: true,
      warningThresholdPercent: 80
    },
    low: {
      firstResponseHours: 24,
      resolutionHours: 120,
      escalationHours: 72,
      businessHoursOnly: true,
      warningThresholdPercent: 85
    }
  }
}

// Default business hours (IST)
const DEFAULT_BUSINESS_HOURS: BusinessHours[] = [
  { dayOfWeek: 1, startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }, // Monday
  { dayOfWeek: 2, startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }, // Tuesday
  { dayOfWeek: 3, startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }, // Wednesday
  { dayOfWeek: 4, startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }, // Thursday
  { dayOfWeek: 5, startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' }, // Friday
  { dayOfWeek: 6, startHour: 10, endHour: 14, timezone: 'Asia/Kolkata' }, // Saturday (half day)
]

// Category-specific SLA adjustments (multipliers)
const CATEGORY_SLA_MULTIPLIERS: Record<string, number> = {
  // Employee categories
  payroll: 0.5,       // Payroll issues need faster resolution
  hr: 0.75,           // HR issues are time-sensitive
  leave: 0.8,         // Leave requests need timely response
  it_support: 1.0,    // Standard SLA
  benefits: 1.0,      // Standard SLA
  general: 1.25,      // General queries can take longer

  // Customer categories
  loan: 0.5,          // Loan issues are critical
  billing: 0.6,       // Billing needs quick attention
  account: 0.75,      // Account issues are important
  complaint: 0.5,     // Complaints need fast resolution
  technical: 0.8,     // Technical issues
  documentation: 1.25, // Documentation can wait

  // Partner categories
  commission: 0.5,    // Commission issues are priority
  onboarding: 0.6,    // Onboarding needs quick support
  compliance: 0.5,    // Compliance is critical
  training: 1.0,      // Standard for training
  support: 0.8        // General support
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class SLAConfigurationService {
  private rulesCache: Map<string, { rule: SLAConfig; expiry: number }> = new Map()
  private businessHoursCache: { hours: BusinessHours[]; expiry: number } | null = null
  private cacheTTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get SLA configuration for a ticket
   */
  async getSLAConfig(
    ticketSource: TicketSource,
    priority: Priority,
    category?: string
  ): Promise<SLAConfig> {
    const cacheKey = `${ticketSource}:${priority}:${category || 'default'}`

    // Check cache
    const cached = this.rulesCache.get(cacheKey)
    if (cached && cached.expiry > Date.now()) {
      return cached.rule
    }

    // Try to get from database
    const dbRule = await this.getRuleFromDatabase(ticketSource, priority, category)

    if (dbRule) {
      const config: SLAConfig = {
        firstResponseHours: dbRule.first_response_hours,
        resolutionHours: dbRule.resolution_hours,
        escalationHours: dbRule.escalation_hours,
        businessHoursOnly: dbRule.business_hours_only,
        warningThresholdPercent: 80
      }

      // Apply category multiplier
      const adjustedConfig = this.applyCategorgMultiplier(config, category)

      // Cache the result
      this.rulesCache.set(cacheKey, {
        rule: adjustedConfig,
        expiry: Date.now() + this.cacheTTL
      })

      return adjustedConfig
    }

    // Fallback to defaults
    const defaultConfig = DEFAULT_SLA_RULES[ticketSource]?.[priority] ||
                         DEFAULT_SLA_RULES.employee.medium

    const adjustedDefault = this.applyCategorgMultiplier(defaultConfig, category)

    // Cache the default
    this.rulesCache.set(cacheKey, {
      rule: adjustedDefault,
      expiry: Date.now() + this.cacheTTL
    })

    return adjustedDefault
  }

  /**
   * Get SLA rule from database
   */
  private async getRuleFromDatabase(
    ticketSource: TicketSource,
    priority: Priority,
    category?: string
  ): Promise<SLARule | null> {
    try {
      // First try to get category-specific rule
      if (category) {
        const { data: categoryRule } = await supabase
          .from('ticket_sla_rules')
          .select('*')
          .eq('ticket_source', ticketSource)
          .eq('priority', priority)
          .eq('category', category)
          .eq('is_active', true)
          .maybeSingle()

        if (categoryRule) return categoryRule
      }

      // Fall back to general rule for priority
      const { data: priorityRule } = await supabase
        .from('ticket_sla_rules')
        .select('*')
        .eq('ticket_source', ticketSource)
        .eq('priority', priority)
        .is('category', null)
        .eq('is_active', true)
        .maybeSingle()

      return priorityRule
    } catch {
      return null
    }
  }

  /**
   * Apply category-specific multiplier to SLA times
   */
  private applyCategorgMultiplier(config: SLAConfig, category?: string): SLAConfig {
    if (!category) return config

    const multiplier = CATEGORY_SLA_MULTIPLIERS[category] || 1.0

    return {
      ...config,
      firstResponseHours: Math.round(config.firstResponseHours * multiplier * 100) / 100,
      resolutionHours: Math.round(config.resolutionHours * multiplier * 100) / 100,
      escalationHours: Math.round(config.escalationHours * multiplier * 100) / 100
    }
  }

  /**
   * Get business hours configuration
   */
  async getBusinessHours(): Promise<BusinessHours[]> {
    // Check cache
    if (this.businessHoursCache && this.businessHoursCache.expiry > Date.now()) {
      return this.businessHoursCache.hours
    }

    try {
      const { data } = await supabase
        .from('business_hours_config')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week')

      if (data?.length) {
        const hours = data.map(d => ({
          dayOfWeek: d.day_of_week,
          startHour: d.start_hour,
          endHour: d.end_hour,
          timezone: d.timezone
        }))

        this.businessHoursCache = {
          hours,
          expiry: Date.now() + this.cacheTTL
        }

        return hours
      }
    } catch (error) {
      console.error('Error fetching business hours:', error)
    }

    // Return defaults
    this.businessHoursCache = {
      hours: DEFAULT_BUSINESS_HOURS,
      expiry: Date.now() + this.cacheTTL
    }

    return DEFAULT_BUSINESS_HOURS
  }

  /**
   * Calculate deadline considering business hours
   */
  async calculateDeadline(
    startTime: Date,
    hours: number,
    businessHoursOnly: boolean
  ): Promise<Date> {
    if (!businessHoursOnly) {
      return new Date(startTime.getTime() + hours * 60 * 60 * 1000)
    }

    const businessHours = await this.getBusinessHours()
    let remainingHours = hours
    let currentTime = new Date(startTime)

    while (remainingHours > 0) {
      const dayOfWeek = currentTime.getDay()
      const dayConfig = businessHours.find(bh => bh.dayOfWeek === dayOfWeek)

      if (dayConfig) {
        const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60

        if (currentHour < dayConfig.startHour) {
          // Before business hours - move to start
          currentTime.setHours(dayConfig.startHour, 0, 0, 0)
        } else if (currentHour >= dayConfig.endHour) {
          // After business hours - move to next day
          currentTime.setDate(currentTime.getDate() + 1)
          currentTime.setHours(0, 0, 0, 0)
          continue
        }

        // Calculate remaining hours for today
        const hoursLeftToday = dayConfig.endHour - (currentTime.getHours() + currentTime.getMinutes() / 60)

        if (remainingHours <= hoursLeftToday) {
          // Can finish today
          currentTime = new Date(currentTime.getTime() + remainingHours * 60 * 60 * 1000)
          remainingHours = 0
        } else {
          // Use all hours today, continue tomorrow
          remainingHours -= hoursLeftToday
          currentTime.setDate(currentTime.getDate() + 1)
          currentTime.setHours(0, 0, 0, 0)
        }
      } else {
        // Non-working day - skip to next day
        currentTime.setDate(currentTime.getDate() + 1)
        currentTime.setHours(0, 0, 0, 0)
      }
    }

    return currentTime
  }

  /**
   * Create or update SLA rule
   */
  async upsertSLARule(rule: Partial<SLARule> & {
    ticket_source: TicketSource
    priority: Priority
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('ticket_sla_rules')
        .upsert({
          ...rule,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'ticket_source,priority,category'
        })

      if (error) throw error

      // Invalidate cache
      this.invalidateCache()

      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all SLA rules for management
   */
  async getAllRules(): Promise<SLARule[]> {
    const { data, error } = await supabase
      .from('ticket_sla_rules')
      .select('*')
      .order('ticket_source')
      .order('priority')

    if (error) {
      console.error('Error fetching SLA rules:', error)
      return []
    }

    return data || []
  }

  /**
   * Invalidate all cached rules
   */
  invalidateCache(): void {
    this.rulesCache.clear()
    this.businessHoursCache = null
  }

  /**
   * Get SLA status for a ticket
   */
  getSLAStatus(
    deadline: Date,
    config: SLAConfig
  ): 'on_track' | 'at_risk' | 'breached' {
    const now = new Date()
    const deadlineTime = deadline.getTime()
    const nowTime = now.getTime()

    if (nowTime >= deadlineTime) {
      return 'breached'
    }

    const totalTime = deadlineTime - now.getTime()
    const warningThreshold = totalTime * (config.warningThresholdPercent / 100)

    if (deadlineTime - nowTime <= totalTime - warningThreshold) {
      return 'at_risk'
    }

    return 'on_track'
  }

  /**
   * Calculate SLA metrics for reporting
   */
  calculateSLAMetrics(
    createdAt: Date,
    firstResponseAt: Date | null,
    resolvedAt: Date | null,
    config: SLAConfig
  ): {
    firstResponseMet: boolean | null
    resolutionMet: boolean | null
    firstResponseHours: number | null
    resolutionHours: number | null
  } {
    const createdTime = createdAt.getTime()

    let firstResponseMet: boolean | null = null
    let firstResponseHours: number | null = null

    if (firstResponseAt) {
      firstResponseHours = (firstResponseAt.getTime() - createdTime) / (1000 * 60 * 60)
      firstResponseMet = firstResponseHours <= config.firstResponseHours
    }

    let resolutionMet: boolean | null = null
    let resolutionHours: number | null = null

    if (resolvedAt) {
      resolutionHours = (resolvedAt.getTime() - createdTime) / (1000 * 60 * 60)
      resolutionMet = resolutionHours <= config.resolutionHours
    }

    return {
      firstResponseMet,
      resolutionMet,
      firstResponseHours: firstResponseHours ? Math.round(firstResponseHours * 100) / 100 : null,
      resolutionHours: resolutionHours ? Math.round(resolutionHours * 100) / 100 : null
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton instance
let slaConfigService: SLAConfigurationService | null = null

export function getSLAConfigService(): SLAConfigurationService {
  if (!slaConfigService) {
    slaConfigService = new SLAConfigurationService()
  }
  return slaConfigService
}

// Helper functions for quick access
export async function getSLAConfig(
  ticketSource: TicketSource,
  priority: Priority,
  category?: string
): Promise<SLAConfig> {
  return getSLAConfigService().getSLAConfig(ticketSource, priority, category)
}

export async function calculateSLADeadline(
  startTime: Date,
  hours: number,
  businessHoursOnly: boolean
): Promise<Date> {
  return getSLAConfigService().calculateDeadline(startTime, hours, businessHoursOnly)
}

export function getSLAStatus(
  deadline: Date,
  config: SLAConfig
): 'on_track' | 'at_risk' | 'breached' {
  return getSLAConfigService().getSLAStatus(deadline, config)
}

// Export defaults for reference
export { DEFAULT_SLA_RULES, DEFAULT_BUSINESS_HOURS, CATEGORY_SLA_MULTIPLIERS }
