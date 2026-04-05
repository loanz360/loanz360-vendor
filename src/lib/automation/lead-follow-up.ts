/**
 * Lead Follow-up Automation
 *
 * Automated system for managing lead follow-ups
 * - Creates follow-up reminders based on lead status and age
 * - Sends notifications to BDEs when follow-up is due
 * - Escalates neglected leads automatically
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { notifyFollowUpReminder, sendLeadNotification } from '@/lib/notifications/ulap-lead-notifications'

// ============================================================================
// TYPES
// ============================================================================

export interface FollowUpRule {
  id: string
  name: string
  description: string
  status_trigger: string[] // Lead statuses that trigger this rule
  days_since_last_activity: number // Days of inactivity before triggering
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  action: 'REMINDER' | 'ESCALATE' | 'AUTO_STATUS_CHANGE'
  target_status?: string // For AUTO_STATUS_CHANGE
  escalate_to?: 'BDM' | 'MANAGER' | 'SUPER_ADMIN'
  notification_channels: ('sms' | 'email' | 'in_app')[]
  is_active: boolean
}

export interface FollowUpSchedule {
  id: string
  lead_id: string
  lead_number: string
  customer_name: string
  customer_mobile: string
  bde_id: string
  bde_name: string
  scheduled_date: Date
  follow_up_type: 'INITIAL_CONTACT' | 'DOCUMENT_FOLLOWUP' | 'STATUS_UPDATE' | 'GENERAL'
  notes?: string
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'RESCHEDULED'
  created_at: Date
}

export interface FollowUpResult {
  success: boolean
  processed: number
  reminders_sent: number
  escalations: number
  errors: string[]
}

// ============================================================================
// DEFAULT FOLLOW-UP RULES
// ============================================================================

export const DEFAULT_FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    id: 'new-lead-contact',
    name: 'New Lead Contact Reminder',
    description: 'Remind BDE to contact new leads within 2 hours',
    status_trigger: ['NEW'],
    days_since_last_activity: 0, // Same day
    priority: 'HIGH',
    action: 'REMINDER',
    notification_channels: ['sms', 'in_app'],
    is_active: true
  },
  {
    id: 'document-pending-followup',
    name: 'Document Collection Follow-up',
    description: 'Follow up on pending documents after 3 days',
    status_trigger: ['DOCUMENT_PENDING'],
    days_since_last_activity: 3,
    priority: 'MEDIUM',
    action: 'REMINDER',
    notification_channels: ['email', 'in_app'],
    is_active: true
  },
  {
    id: 'stale-lead-escalation',
    name: 'Stale Lead Escalation',
    description: 'Escalate leads with no activity for 7 days',
    status_trigger: ['NEW', 'CONTACTED', 'DOCUMENT_PENDING'],
    days_since_last_activity: 7,
    priority: 'URGENT',
    action: 'ESCALATE',
    escalate_to: 'BDM',
    notification_channels: ['sms', 'email', 'in_app'],
    is_active: true
  },
  {
    id: 'under-review-reminder',
    name: 'Under Review Reminder',
    description: 'Remind about leads under review for more than 5 days',
    status_trigger: ['UNDER_REVIEW'],
    days_since_last_activity: 5,
    priority: 'MEDIUM',
    action: 'REMINDER',
    notification_channels: ['in_app'],
    is_active: true
  },
  {
    id: 'approved-disbursement-followup',
    name: 'Approved Lead Disbursement Follow-up',
    description: 'Follow up on approved leads pending disbursement after 3 days',
    status_trigger: ['APPROVED'],
    days_since_last_activity: 3,
    priority: 'HIGH',
    action: 'REMINDER',
    notification_channels: ['sms', 'in_app'],
    is_active: true
  },
  {
    id: 'critical-escalation',
    name: 'Critical Lead Escalation',
    description: 'Escalate high-priority leads with no activity for 3 days to Super Admin',
    status_trigger: ['NEW', 'CONTACTED'],
    days_since_last_activity: 3,
    priority: 'URGENT',
    action: 'ESCALATE',
    escalate_to: 'SUPER_ADMIN',
    notification_channels: ['sms', 'email', 'in_app'],
    is_active: false // Disabled by default
  }
]

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Process all follow-up rules and send reminders/escalations
 * This should be called by a cron job (e.g., every hour)
 */
export async function processFollowUpRules(): Promise<FollowUpResult> {
  const result: FollowUpResult = {
    success: true,
    processed: 0,
    reminders_sent: 0,
    escalations: 0,
    errors: []
  }

  const supabase = createSupabaseAdmin()

  try {
    // Get active rules
    const rules = DEFAULT_FOLLOW_UP_RULES.filter(r => r.is_active)

    for (const rule of rules) {
      try {
        // Calculate the cutoff date
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - rule.days_since_last_activity)

        // Find leads matching this rule
        const { data: leads, error } = await supabase
          .from('leads')
          .select(`
            id,
            lead_id,
            customer_name,
            customer_mobile,
            customer_email,
            loan_type,
            required_loan_amount,
            lead_status,
            lead_priority,
            assigned_bde_id,
            assigned_bde_name,
            updated_at,
            created_at
          `)
          .in('lead_status', rule.status_trigger)
          .lt('updated_at', cutoffDate.toISOString())
          .not('assigned_bde_id', 'is', null)

        if (error) {
          result.errors.push(`Rule ${rule.id}: ${error.message}`)
          continue
        }

        if (!leads || leads.length === 0) continue

        // Filter by priority if rule is for high-priority leads
        const filteredLeads = rule.priority === 'URGENT' && rule.id === 'critical-escalation'
          ? leads.filter(l => l.lead_priority === 'HIGH')
          : leads

        for (const lead of filteredLeads) {
          result.processed++

          // Check if we've already processed this lead today
          const { data: existing } = await supabase
            .from('follow_up_logs')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('rule_id', rule.id)
            .gte('created_at', new Date().toISOString().split('T')[0])
            .maybeSingle()

          if (existing) continue // Already processed today

          // Process based on action type
          if (rule.action === 'REMINDER' && lead.assigned_bde_id) {
            await notifyFollowUpReminder(
              lead.id,
              lead.lead_id,
              lead.customer_name,
              lead.customer_mobile,
              lead.loan_type,
              lead.required_loan_amount,
              lead.assigned_bde_id
            )
            result.reminders_sent++
          } else if (rule.action === 'ESCALATE') {
            await escalateLead(lead, rule)
            result.escalations++
          }

          // Log the follow-up action
          await supabase.from('follow_up_logs').insert({
            lead_id: lead.id,
            lead_number: lead.lead_id,
            rule_id: rule.id,
            rule_name: rule.name,
            action: rule.action,
            priority: rule.priority,
            processed_at: new Date().toISOString()
          })
        }
      } catch (ruleError) {
        result.errors.push(`Rule ${rule.id}: ${String(ruleError)}`)
      }
    }
  } catch (error) {
    result.success = false
    result.errors.push(`Fatal error: ${String(error)}`)
  }

  return result
}

/**
 * Escalate a lead to the appropriate level
 */
async function escalateLead(
  lead: {
    id: string
    lead_id: string
    customer_name: string
    customer_mobile: string
    customer_email?: string
    loan_type: string
    required_loan_amount: number
    assigned_bde_id?: string
    assigned_bde_name?: string
  },
  rule: FollowUpRule
): Promise<void> {
  const supabase = createSupabaseAdmin()

  // Create escalation record
  await supabase.from('lead_escalations').insert({
    lead_id: lead.id,
    lead_number: lead.lead_id,
    escalated_from: lead.assigned_bde_id,
    escalated_from_name: lead.assigned_bde_name,
    escalated_to_role: rule.escalate_to || 'BDM',
    escalation_reason: `Auto-escalated: ${rule.description}`,
    priority: rule.priority,
    status: 'PENDING',
    created_at: new Date().toISOString()
  })

  // Send escalation notification
  await sendLeadNotification({
    type: 'LEAD_ESCALATED',
    leadId: lead.id,
    leadNumber: lead.lead_id,
    customerName: lead.customer_name,
    customerMobile: lead.customer_mobile,
    customerEmail: lead.customer_email,
    loanType: lead.loan_type,
    loanAmount: lead.required_loan_amount,
    bdeId: lead.assigned_bde_id,
    reason: `Auto-escalated due to ${rule.days_since_last_activity} days of inactivity`,
    channels: rule.notification_channels
  })

  // Update lead record
  await supabase
    .from('leads')
    .update({
      is_escalated: true,
      escalated_at: new Date().toISOString(),
      escalated_to: rule.escalate_to || 'BDM',
      escalation_reason: rule.description
    })
    .eq('id', lead.id)
}

/**
 * Schedule a follow-up for a specific lead
 */
export async function scheduleFollowUp(
  leadId: string,
  leadNumber: string,
  customerName: string,
  customerMobile: string,
  bdeId: string,
  bdeName: string,
  scheduledDate: Date,
  followUpType: FollowUpSchedule['follow_up_type'],
  notes?: string
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase
      .from('follow_up_schedules')
      .insert({
        lead_id: leadId,
        lead_number: leadNumber,
        customer_name: customerName,
        customer_mobile: customerMobile,
        bde_id: bdeId,
        bde_name: bdeName,
        scheduled_date: scheduledDate.toISOString(),
        follow_up_type: followUpType,
        notes,
        status: 'PENDING',
        created_at: new Date().toISOString()
      })
      .select('id')
      .maybeSingle()

    if (error) throw error

    return { success: true, scheduleId: data.id }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Get pending follow-ups for a BDE
 */
export async function getPendingFollowUps(
  bdeId: string,
  dateRange?: { start: Date; end: Date }
): Promise<FollowUpSchedule[]> {
  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('follow_up_schedules')
    .select('*')
    .eq('bde_id', bdeId)
    .eq('status', 'PENDING')
    .order('scheduled_date', { ascending: true })

  if (dateRange) {
    query = query
      .gte('scheduled_date', dateRange.start.toISOString())
      .lte('scheduled_date', dateRange.end.toISOString())
  }

  const { data } = await query

  return data || []
}

/**
 * Mark a follow-up as completed
 */
export async function completeFollowUp(
  scheduleId: string,
  outcome: string,
  nextFollowUpDate?: Date
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseAdmin()

  try {
    await supabase
      .from('follow_up_schedules')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        outcome
      })
      .eq('id', scheduleId)

    // If next follow-up is scheduled, create new record
    if (nextFollowUpDate) {
      const { data: current } = await supabase
        .from('follow_up_schedules')
        .select('*')
        .eq('id', scheduleId)
        .maybeSingle()

      if (current) {
        await scheduleFollowUp(
          current.lead_id,
          current.lead_number,
          current.customer_name,
          current.customer_mobile,
          current.bde_id,
          current.bde_name,
          nextFollowUpDate,
          'GENERAL',
          `Follow-up from ${scheduleId}`
        )
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Get today's follow-ups due
 */
export async function getTodaysFollowUps(): Promise<FollowUpSchedule[]> {
  const supabase = createSupabaseAdmin()
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  const { data } = await supabase
    .from('follow_up_schedules')
    .select('*')
    .eq('status', 'PENDING')
    .gte('scheduled_date', startOfDay.toISOString())
    .lt('scheduled_date', endOfDay.toISOString())
    .order('scheduled_date', { ascending: true })

  return data || []
}

export default {
  processFollowUpRules,
  scheduleFollowUp,
  getPendingFollowUps,
  completeFollowUp,
  getTodaysFollowUps,
  DEFAULT_FOLLOW_UP_RULES
}
