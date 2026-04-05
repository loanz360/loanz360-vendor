/**
 * Escalation Engine - Enterprise-grade Ticket Escalation Management
 *
 * Features:
 * - Multi-level escalation paths (L1 -> L2 -> L3 -> L4)
 * - Automatic escalation based on SLA breach risk
 * - Role-based escalation targets
 * - Escalation notifications
 * - Escalation history tracking
 * - Manual escalation support
 */

import { createClient } from '@/lib/supabase/server'

// Escalation Types
export type EscalationLevel = 'L1' | 'L2' | 'L3' | 'L4'
export type EscalationTrigger = 'sla_warning' | 'sla_critical' | 'sla_breach' | 'customer_request' | 'priority_escalation' | 'manual' | 'reopen'
export type EscalationStatus = 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'de_escalated'

export interface EscalationRule {
  id: string
  name: string
  description?: string
  ticket_source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
  priority?: 'urgent' | 'high' | 'medium' | 'low' | null
  category?: string | null
  trigger: EscalationTrigger
  trigger_threshold?: number // e.g., 75% SLA used triggers warning
  from_level: EscalationLevel
  to_level: EscalationLevel
  target_role?: string  // Role to escalate to
  target_user_id?: string  // Specific user to escalate to
  auto_escalate: boolean
  time_to_escalate_hours?: number  // Time before auto-escalation
  notification_channels: ('email' | 'in_app' | 'sms')[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EscalationPath {
  id: string
  name: string
  description?: string
  ticket_source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
  levels: {
    level: EscalationLevel
    target_roles: string[]
    target_user_ids?: string[]
    response_time_hours: number
    notification_channels: ('email' | 'in_app' | 'sms')[]
  }[]
  is_default: boolean
  is_active: boolean
}

export interface EscalationRecord {
  id: string
  ticket_id: string
  ticket_source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
  from_level: EscalationLevel | null
  to_level: EscalationLevel
  trigger: EscalationTrigger
  trigger_details?: string
  escalated_by_id?: string
  escalated_by_name?: string
  escalated_to_id?: string
  escalated_to_name?: string
  escalated_to_role?: string
  status: EscalationStatus
  acknowledged_at?: string
  acknowledged_by_id?: string
  resolved_at?: string
  resolved_by_id?: string
  resolution_notes?: string
  created_at: string
  updated_at: string
}

export interface EscalationTarget {
  user_id: string
  user_name: string
  user_email: string
  role: string
  level: EscalationLevel
}

// Default Escalation Paths
export const DEFAULT_ESCALATION_PATHS: Omit<EscalationPath, 'id'>[] = [
  {
    name: 'Standard Support Escalation',
    description: 'Default escalation path for all ticket types',
    ticket_source: null,
    levels: [
      {
        level: 'L1',
        target_roles: ['support_agent', 'customer_support_agent', 'partner_support_agent'],
        response_time_hours: 4,
        notification_channels: ['in_app']
      },
      {
        level: 'L2',
        target_roles: ['support_supervisor', 'customer_support_manager', 'partner_support_manager'],
        response_time_hours: 2,
        notification_channels: ['in_app', 'email']
      },
      {
        level: 'L3',
        target_roles: ['support_manager', 'department_head'],
        response_time_hours: 1,
        notification_channels: ['in_app', 'email', 'sms']
      },
      {
        level: 'L4',
        target_roles: ['admin', 'super_admin', 'cto'],
        response_time_hours: 0.5,
        notification_channels: ['in_app', 'email', 'sms']
      }
    ],
    is_default: true,
    is_active: true
  },
  {
    name: 'Urgent Priority Fast Track',
    description: 'Fast-track escalation for urgent tickets',
    ticket_source: null,
    levels: [
      {
        level: 'L1',
        target_roles: ['senior_support_agent'],
        response_time_hours: 1,
        notification_channels: ['in_app', 'email']
      },
      {
        level: 'L2',
        target_roles: ['support_manager'],
        response_time_hours: 0.5,
        notification_channels: ['in_app', 'email', 'sms']
      },
      {
        level: 'L3',
        target_roles: ['department_head', 'admin'],
        response_time_hours: 0.25,
        notification_channels: ['in_app', 'email', 'sms']
      },
      {
        level: 'L4',
        target_roles: ['super_admin', 'ceo'],
        response_time_hours: 0.25,
        notification_channels: ['in_app', 'email', 'sms']
      }
    ],
    is_default: false,
    is_active: true
  }
]

// Default Escalation Rules
export const DEFAULT_ESCALATION_RULES: Omit<EscalationRule, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'SLA Warning - Escalate to L2',
    description: 'Escalate when SLA is 75% consumed',
    ticket_source: null,
    priority: null,
    category: null,
    trigger: 'sla_warning',
    trigger_threshold: 75,
    from_level: 'L1',
    to_level: 'L2',
    target_role: 'support_supervisor',
    auto_escalate: true,
    time_to_escalate_hours: 0.5,
    notification_channels: ['in_app', 'email'],
    is_active: true
  },
  {
    name: 'SLA Critical - Escalate to L3',
    description: 'Escalate when SLA is 90% consumed',
    ticket_source: null,
    priority: null,
    category: null,
    trigger: 'sla_critical',
    trigger_threshold: 90,
    from_level: 'L2',
    to_level: 'L3',
    target_role: 'support_manager',
    auto_escalate: true,
    time_to_escalate_hours: 0.25,
    notification_channels: ['in_app', 'email', 'sms'],
    is_active: true
  },
  {
    name: 'SLA Breach - Escalate to L4',
    description: 'Immediate escalation when SLA is breached',
    ticket_source: null,
    priority: null,
    category: null,
    trigger: 'sla_breach',
    trigger_threshold: 100,
    from_level: 'L3',
    to_level: 'L4',
    target_role: 'admin',
    auto_escalate: true,
    time_to_escalate_hours: 0,
    notification_channels: ['in_app', 'email', 'sms'],
    is_active: true
  },
  {
    name: 'Urgent Priority Auto-Escalate',
    description: 'Auto-escalate urgent tickets after 1 hour',
    ticket_source: null,
    priority: 'urgent',
    category: null,
    trigger: 'priority_escalation',
    trigger_threshold: null,
    from_level: 'L1',
    to_level: 'L2',
    target_role: 'support_manager',
    auto_escalate: true,
    time_to_escalate_hours: 1,
    notification_channels: ['in_app', 'email', 'sms'],
    is_active: true
  },
  {
    name: 'Customer Request Escalation',
    description: 'When customer explicitly requests escalation',
    ticket_source: 'CUSTOMER',
    priority: null,
    category: null,
    trigger: 'customer_request',
    trigger_threshold: null,
    from_level: 'L1',
    to_level: 'L2',
    target_role: 'customer_support_manager',
    auto_escalate: false,
    time_to_escalate_hours: null,
    notification_channels: ['in_app', 'email'],
    is_active: true
  },
  {
    name: 'Ticket Reopen Escalation',
    description: 'Auto-escalate reopened tickets',
    ticket_source: null,
    priority: null,
    category: null,
    trigger: 'reopen',
    trigger_threshold: null,
    from_level: 'L1',
    to_level: 'L2',
    target_role: 'support_supervisor',
    auto_escalate: true,
    time_to_escalate_hours: 0,
    notification_channels: ['in_app', 'email'],
    is_active: true
  }
]

/**
 * Get escalation path for a ticket
 */
export async function getEscalationPath(
  ticketSource?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<EscalationPath | null> {
  const supabase = await createClient()

  // Try to find source-specific path first
  if (ticketSource) {
    const { data: sourcePath } = await supabase
      .from('escalation_paths')
      .select('*')
      .eq('ticket_source', ticketSource)
      .eq('is_active', true)
      .maybeSingle()

    if (sourcePath) return sourcePath as EscalationPath
  }

  // Fall back to default path
  const { data: defaultPath } = await supabase
    .from('escalation_paths')
    .select('*')
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()

  return defaultPath as EscalationPath | null
}

/**
 * Get applicable escalation rules
 */
export async function getApplicableRules(
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  priority: string,
  category?: string,
  trigger?: EscalationTrigger
): Promise<EscalationRule[]> {
  const supabase = await createClient()

  let query = supabase
    .from('escalation_rules')
    .select('*')
    .eq('is_active', true)

  if (trigger) {
    query = query.eq('trigger', trigger)
  }

  const { data: rules } = await query

  if (!rules) return []

  // Filter rules based on specificity
  return (rules as EscalationRule[]).filter(rule => {
    // Check source match
    if (rule.ticket_source && rule.ticket_source !== ticketSource) {
      return false
    }

    // Check priority match
    if (rule.priority && rule.priority !== priority) {
      return false
    }

    // Check category match
    if (rule.category && rule.category !== category) {
      return false
    }

    return true
  })
}

/**
 * Get current escalation level for a ticket
 */
export async function getCurrentEscalationLevel(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<EscalationLevel> {
  const supabase = await createClient()

  // Get the latest escalation record
  const { data: escalation } = await supabase
    .from('escalation_history')
    .select('to_level')
    .eq('ticket_id', ticketId)
    .eq('ticket_source', ticketSource)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (escalation?.to_level as EscalationLevel) || 'L1'
}

/**
 * Get escalation targets for a level
 */
export async function getEscalationTargets(
  level: EscalationLevel,
  ticketSource?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<EscalationTarget[]> {
  const supabase = await createClient()
  const path = await getEscalationPath(ticketSource)

  if (!path) return []

  const levelConfig = path.levels.find(l => l.level === level)
  if (!levelConfig) return []

  // Get users with matching roles
  const { data: users } = await supabase
    .from('employees')
    .select('id, name, email, role')
    .in('role', levelConfig.target_roles)
    .eq('status', 'active')

  return (users || []).map(user => ({
    user_id: user.id,
    user_name: user.name,
    user_email: user.email,
    role: user.role,
    level
  }))
}

/**
 * Escalate a ticket
 */
export async function escalateTicket(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  trigger: EscalationTrigger,
  triggerDetails?: string,
  escalatedById?: string,
  escalatedByName?: string,
  targetUserId?: string,
  targetLevel?: EscalationLevel
): Promise<EscalationRecord | null> {
  const supabase = await createClient()

  // Get current level
  const currentLevel = await getCurrentEscalationLevel(ticketId, ticketSource)

  // Determine target level
  let toLevel = targetLevel
  if (!toLevel) {
    const levelOrder: EscalationLevel[] = ['L1', 'L2', 'L3', 'L4']
    const currentIndex = levelOrder.indexOf(currentLevel)
    toLevel = currentIndex < 3 ? levelOrder[currentIndex + 1] : 'L4'
  }

  // Get escalation target
  let targetUser: EscalationTarget | null = null
  if (targetUserId) {
    const { data: user } = await supabase
      .from('employees')
      .select('id, name, email, role')
      .eq('id', targetUserId)
      .maybeSingle()

    if (user) {
      targetUser = {
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        role: user.role,
        level: toLevel
      }
    }
  } else {
    const targets = await getEscalationTargets(toLevel, ticketSource)
    if (targets.length > 0) {
      targetUser = targets[0] // In production, use round-robin or workload-based assignment
    }
  }

  // Create escalation record
  const { data: escalation, error } = await supabase
    .from('escalation_history')
    .insert({
      ticket_id: ticketId,
      ticket_source: ticketSource,
      from_level: currentLevel,
      to_level: toLevel,
      trigger,
      trigger_details: triggerDetails,
      escalated_by_id: escalatedById,
      escalated_by_name: escalatedByName,
      escalated_to_id: targetUser?.user_id,
      escalated_to_name: targetUser?.user_name,
      escalated_to_role: targetUser?.role,
      status: 'pending'
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating escalation:', error)
    return null
  }

  // Update ticket with escalation info
  const tableName = getTableName(ticketSource)
  await supabase
    .from(tableName)
    .update({
      escalation_level: toLevel,
      escalated_at: new Date().toISOString(),
      escalated_to_id: targetUser?.user_id
    })
    .eq('id', ticketId)

  // Create notification for target user
  if (targetUser) {
    await createEscalationNotification(
      ticketId,
      ticketSource,
      targetUser,
      trigger,
      currentLevel,
      toLevel
    )
  }

  return escalation as EscalationRecord
}

/**
 * Acknowledge escalation
 */
export async function acknowledgeEscalation(
  escalationId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('escalation_history')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_id: userId
    })
    .eq('id', escalationId)

  return !error
}

/**
 * Resolve escalation
 */
export async function resolveEscalation(
  escalationId: string,
  userId: string,
  notes?: string
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('escalation_history')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by_id: userId,
      resolution_notes: notes
    })
    .eq('id', escalationId)

  return !error
}

/**
 * De-escalate a ticket
 */
export async function deEscalateTicket(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  toLevel: EscalationLevel,
  reason: string,
  userId: string,
  userName: string
): Promise<EscalationRecord | null> {
  const supabase = await createClient()

  const currentLevel = await getCurrentEscalationLevel(ticketId, ticketSource)

  // Create de-escalation record
  const { data: escalation, error } = await supabase
    .from('escalation_history')
    .insert({
      ticket_id: ticketId,
      ticket_source: ticketSource,
      from_level: currentLevel,
      to_level: toLevel,
      trigger: 'manual',
      trigger_details: `De-escalation: ${reason}`,
      escalated_by_id: userId,
      escalated_by_name: userName,
      status: 'de_escalated'
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error de-escalating:', error)
    return null
  }

  // Update ticket
  const tableName = getTableName(ticketSource)
  await supabase
    .from(tableName)
    .update({
      escalation_level: toLevel
    })
    .eq('id', ticketId)

  return escalation as EscalationRecord
}

/**
 * Get escalation history for a ticket
 */
export async function getEscalationHistory(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<EscalationRecord[]> {
  const supabase = await createClient()

  const { data: history } = await supabase
    .from('escalation_history')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('ticket_source', ticketSource)
    .order('created_at', { ascending: false })

  return (history || []) as EscalationRecord[]
}

/**
 * Get pending escalations for a user
 */
export async function getPendingEscalations(
  userId: string
): Promise<EscalationRecord[]> {
  const supabase = await createClient()

  const { data: escalations } = await supabase
    .from('escalation_history')
    .select('*')
    .eq('escalated_to_id', userId)
    .in('status', ['pending', 'acknowledged'])
    .order('created_at', { ascending: false })

  return (escalations || []) as EscalationRecord[]
}

/**
 * Get escalation statistics
 */
export interface EscalationStats {
  total_escalations: number
  by_level: Record<EscalationLevel, number>
  by_trigger: Record<EscalationTrigger, number>
  avg_resolution_time_hours: number
  pending_count: number
  acknowledged_count: number
  resolved_count: number
}

export async function getEscalationStats(
  startDate?: Date,
  endDate?: Date,
  ticketSource?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
): Promise<EscalationStats> {
  const supabase = await createClient()

  let query = supabase.from('escalation_history').select('*')

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }
  if (ticketSource) {
    query = query.eq('ticket_source', ticketSource)
  }

  const { data: escalations } = await query

  const records = (escalations || []) as EscalationRecord[]

  const stats: EscalationStats = {
    total_escalations: records.length,
    by_level: { L1: 0, L2: 0, L3: 0, L4: 0 },
    by_trigger: {
      sla_warning: 0,
      sla_critical: 0,
      sla_breach: 0,
      customer_request: 0,
      priority_escalation: 0,
      manual: 0,
      reopen: 0
    },
    avg_resolution_time_hours: 0,
    pending_count: 0,
    acknowledged_count: 0,
    resolved_count: 0
  }

  let totalResolutionTime = 0
  let resolvedCount = 0

  for (const record of records) {
    // Count by level
    stats.by_level[record.to_level]++

    // Count by trigger
    stats.by_trigger[record.trigger]++

    // Count by status
    switch (record.status) {
      case 'pending':
        stats.pending_count++
        break
      case 'acknowledged':
        stats.acknowledged_count++
        break
      case 'resolved':
      case 'de_escalated':
        stats.resolved_count++
        break
    }

    // Calculate resolution time
    if (record.resolved_at) {
      const created = new Date(record.created_at)
      const resolved = new Date(record.resolved_at)
      totalResolutionTime += (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
      resolvedCount++
    }
  }

  stats.avg_resolution_time_hours = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0

  return stats
}

/**
 * Check tickets for auto-escalation
 */
export async function processAutoEscalations(): Promise<number> {
  const supabase = await createClient()
  let escalatedCount = 0

  // Get all active tickets that might need escalation
  const sources: ('EMPLOYEE' | 'CUSTOMER' | 'PARTNER')[] = ['EMPLOYEE', 'CUSTOMER', 'PARTNER']

  for (const source of sources) {
    const tableName = getTableName(source)

    const { data: tickets } = await supabase
      .from(tableName)
      .select('id, priority, category, created_at, sla_status, escalation_level')
      .not('status', 'in', '(resolved,closed)')

    for (const ticket of tickets || []) {
      // Get applicable rules
      const rules = await getApplicableRules(
        source,
        ticket.priority,
        ticket.category
      )

      for (const rule of rules) {
        if (!rule.auto_escalate) continue

        // Check if this rule should trigger
        let shouldEscalate = false

        if (rule.trigger === 'sla_warning' && ticket.sla_status === 'at_risk') {
          shouldEscalate = true
        } else if (rule.trigger === 'sla_breach' && ticket.sla_status === 'breached') {
          shouldEscalate = true
        } else if (rule.trigger === 'priority_escalation' && ticket.priority === 'urgent') {
          // Check time elapsed
          const created = new Date(ticket.created_at)
          const elapsed = (Date.now() - created.getTime()) / (1000 * 60 * 60)
          if (rule.time_to_escalate_hours && elapsed >= rule.time_to_escalate_hours) {
            shouldEscalate = true
          }
        }

        // Check current level matches rule
        const currentLevel = ticket.escalation_level || 'L1'
        if (currentLevel !== rule.from_level) {
          shouldEscalate = false
        }

        if (shouldEscalate) {
          await escalateTicket(
            ticket.id,
            source,
            rule.trigger,
            `Auto-escalation triggered by rule: ${rule.name}`,
            undefined,
            'System',
            rule.target_user_id,
            rule.to_level
          )
          escalatedCount++
          break // Only apply one rule per ticket
        }
      }
    }
  }

  return escalatedCount
}

// Helper function to get table name
function getTableName(source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'): string {
  switch (source) {
    case 'EMPLOYEE':
      return 'employee_support_tickets'
    case 'CUSTOMER':
      return 'customer_support_tickets'
    case 'PARTNER':
      return 'partner_support_tickets'
  }
}

// Helper function to create escalation notification
async function createEscalationNotification(
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  target: EscalationTarget,
  trigger: EscalationTrigger,
  fromLevel: EscalationLevel,
  toLevel: EscalationLevel
): Promise<void> {
  const supabase = await createClient()

  const triggerLabels: Record<EscalationTrigger, string> = {
    sla_warning: 'SLA Warning',
    sla_critical: 'SLA Critical',
    sla_breach: 'SLA Breach',
    customer_request: 'Customer Request',
    priority_escalation: 'Priority Escalation',
    manual: 'Manual Escalation',
    reopen: 'Ticket Reopened'
  }

  await supabase.from('notifications').insert({
    user_id: target.user_id,
    type: 'escalation',
    title: `Ticket Escalated to ${toLevel}`,
    message: `A ticket has been escalated from ${fromLevel} to ${toLevel}. Reason: ${triggerLabels[trigger]}`,
    data: {
      ticket_id: ticketId,
      ticket_source: ticketSource,
      from_level: fromLevel,
      to_level: toLevel,
      trigger
    },
    read: false
  })
}
