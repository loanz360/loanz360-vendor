import { createClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_viewed'
  | 'ticket_assigned'
  | 'ticket_escalated'
  | 'ticket_resolved'
  | 'ticket_deleted'
  | 'message_sent'
  | 'message_viewed'
  | 'attachment_uploaded'
  | 'attachment_downloaded'
  | 'user_login'
  | 'user_logout'
  | 'user_permission_changed'
  | 'data_exported'
  | 'data_deleted'
  | 'settings_changed'
  | 'api_access'
  | 'bulk_operation'

export interface AuditLogEntry {
  id: string
  action: AuditAction
  entity_type: 'ticket' | 'message' | 'user' | 'settings' | 'api' | 'system'
  entity_id?: string
  user_id: string
  user_email?: string
  user_name?: string
  user_role?: string
  ip_address?: string
  user_agent?: string
  details: Record<string, any>
  changes?: {
    field: string
    old_value: any
    new_value: any
  }[]
  timestamp: string
  session_id?: string
}

export interface DataRetentionPolicy {
  id: string
  name: string
  entity_type: string
  retention_days: number
  action: 'archive' | 'anonymize' | 'delete'
  is_active: boolean
  last_run_at?: string
  created_at?: string
}

export interface PrivacySettings {
  data_masking_enabled: boolean
  masked_fields: string[]
  anonymization_enabled: boolean
  consent_required: boolean
  gdpr_compliant: boolean
  data_export_enabled: boolean
  right_to_delete_enabled: boolean
}

export interface ComplianceReport {
  generated_at: string
  period: { start: string; end: string }
  total_tickets: number
  data_access_logs: number
  data_exports: number
  data_deletions: number
  sla_compliance_rate: number
  average_response_time_hours: number
  escalation_rate: number
  sensitive_data_incidents: number
  policy_violations: number
}

export interface SecurityAlert {
  id: string
  type: 'suspicious_access' | 'policy_violation' | 'data_breach' | 'failed_login' | 'unusual_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  user_id?: string
  ip_address?: string
  resolved: boolean
  resolved_by_id?: string
  resolved_at?: string
  created_at: string
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      ...entry,
      timestamp: new Date().toISOString()
    })

  if (error) {
    console.error('Error creating audit log:', error)
    return false
  }

  return true
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(options: {
  action?: AuditAction
  entityType?: string
  entityId?: string
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })

  if (options.action) {
    query = query.eq('action', options.action)
  }

  if (options.entityType) {
    query = query.eq('entity_type', options.entityType)
  }

  if (options.entityId) {
    query = query.eq('entity_id', options.entityId)
  }

  if (options.userId) {
    query = query.eq('user_id', options.userId)
  }

  if (options.startDate) {
    query = query.gte('timestamp', options.startDate.toISOString())
  }

  if (options.endDate) {
    query = query.lte('timestamp', options.endDate.toISOString())
  }

  query = query.range(
    options.offset || 0,
    (options.offset || 0) + (options.limit || 50) - 1
  )

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching audit logs:', error)
    return { logs: [], total: 0 }
  }

  return {
    logs: data || [],
    total: count || 0
  }
}

/**
 * Log ticket access
 */
export async function logTicketAccess(
  ticketId: string,
  ticketSource: string,
  userId: string,
  userEmail: string,
  action: 'viewed' | 'updated' | 'deleted',
  details?: Record<string, any>,
  changes?: { field: string; old_value: any; new_value: any }[]
): Promise<void> {
  await createAuditLog({
    action: action === 'viewed' ? 'ticket_viewed' :
            action === 'updated' ? 'ticket_updated' : 'ticket_deleted',
    entity_type: 'ticket',
    entity_id: ticketId,
    user_id: userId,
    user_email: userEmail,
    details: {
      ticket_source: ticketSource,
      ...details
    },
    changes
  })
}

// ============================================================================
// DATA PRIVACY
// ============================================================================

/**
 * Mask sensitive data in a ticket
 */
export function maskSensitiveData(data: Record<string, any>, fieldsToMask: string[]): Record<string, any> {
  const masked = { ...data }

  for (const field of fieldsToMask) {
    if (masked[field]) {
      const value = String(masked[field])
      if (field.includes('email')) {
        // Mask email: a****@example.com
        const [local, domain] = value.split('@')
        masked[field] = local.charAt(0) + '****@' + domain
      } else if (field.includes('phone')) {
        // Mask phone: ******1234
        masked[field] = '******' + value.slice(-4)
      } else if (field.includes('pan') || field.includes('aadhaar')) {
        // Mask ID: XXXX****XXXX
        masked[field] = value.slice(0, 4) + '****' + value.slice(-4)
      } else {
        // Generic mask
        masked[field] = value.charAt(0) + '*'.repeat(value.length - 2) + value.charAt(value.length - 1)
      }
    }
  }

  return masked
}

/**
 * Anonymize user data
 */
export async function anonymizeUserData(userId: string): Promise<boolean> {
  const supabase = await createClient()

  try {
    // Anonymize in customer_tickets
    await supabase
      .from('customer_tickets')
      .update({
        customer_name: 'Anonymous User',
        customer_email: 'anonymous@deleted.user',
        customer_phone: '0000000000',
        description: '[Content removed for privacy]'
      })
      .eq('customer_id', userId)

    // Anonymize in ticket_messages
    await supabase
      .from('ticket_messages')
      .update({
        sender_name: 'Anonymous',
        message: '[Content removed for privacy]'
      })
      .eq('sender_id', userId)

    // Log the anonymization
    await createAuditLog({
      action: 'data_deleted',
      entity_type: 'user',
      entity_id: userId,
      user_id: 'system',
      details: { reason: 'User data anonymization request' }
    })

    return true
  } catch (error) {
    console.error('Error anonymizing user data:', error)
    return false
  }
}

/**
 * Export user data (GDPR compliance)
 */
export async function exportUserData(userId: string): Promise<Record<string, any>> {
  const supabase = await createClient()

  const userData: Record<string, any> = {}

  // Get user profile
  const { data: profile } = await supabase
    .from('customers')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profile) {
    userData.profile = profile
  }

  // Get tickets
  const { data: tickets } = await supabase
    .from('customer_tickets')
    .select('*')
    .eq('customer_id', userId)

  if (tickets) {
    userData.tickets = tickets
  }

  // Get messages
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('sender_id', userId)

  if (messages) {
    userData.messages = messages
  }

  // Log export
  await createAuditLog({
    action: 'data_exported',
    entity_type: 'user',
    entity_id: userId,
    user_id: userId,
    details: {
      tables_exported: Object.keys(userData),
      record_count: Object.values(userData).reduce((sum, arr) =>
        sum + (Array.isArray(arr) ? arr.length : 1), 0
      )
    }
  })

  return userData
}

// ============================================================================
// DATA RETENTION
// ============================================================================

/**
 * Get data retention policies
 */
export async function getRetentionPolicies(): Promise<DataRetentionPolicy[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('data_retention_policies')
    .select('*')
    .order('entity_type')

  if (error) {
    console.error('Error fetching retention policies:', error)
    return []
  }

  return data || []
}

/**
 * Apply retention policy (archive/anonymize/delete old data)
 */
export async function applyRetentionPolicy(policyId: string): Promise<{
  success: boolean
  records_affected: number
  error?: string
}> {
  const supabase = await createClient()

  // Get policy
  const { data: policy } = await supabase
    .from('data_retention_policies')
    .select('*')
    .eq('id', policyId)
    .maybeSingle()

  if (!policy) {
    return { success: false, records_affected: 0, error: 'Policy not found' }
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days)

  let recordsAffected = 0

  try {
    switch (policy.action) {
      case 'archive': {
        // Move to archive table
        const { data: toArchive } = await supabase
          .from(policy.entity_type)
          .select('*')
          .lt('created_at', cutoffDate.toISOString())
          .eq('status', 'closed')

        if (toArchive && toArchive.length > 0) {
          await supabase.from(`${policy.entity_type}_archive`).insert(toArchive)
          await supabase
            .from(policy.entity_type)
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .eq('status', 'closed')
          recordsAffected = toArchive.length
        }
        break
      }

      case 'anonymize': {
        const { data: toAnonymize } = await supabase
          .from(policy.entity_type)
          .select('id')
          .lt('created_at', cutoffDate.toISOString())

        if (toAnonymize) {
          for (const record of toAnonymize) {
            await supabase
              .from(policy.entity_type)
              .update({
                customer_name: 'Anonymized',
                customer_email: 'anonymized@removed.user',
                customer_phone: '0000000000'
              })
              .eq('id', record.id)
          }
          recordsAffected = toAnonymize.length
        }
        break
      }

      case 'delete': {
        const { count } = await supabase
          .from(policy.entity_type)
          .delete()
          .lt('created_at', cutoffDate.toISOString())
          .eq('status', 'closed')

        recordsAffected = count || 0
        break
      }
    }

    // Update policy last run
    await supabase
      .from('data_retention_policies')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', policyId)

    // Log the action
    await createAuditLog({
      action: 'bulk_operation',
      entity_type: 'system',
      user_id: 'system',
      details: {
        operation: 'retention_policy',
        policy_id: policyId,
        action: policy.action,
        records_affected: recordsAffected
      }
    })

    return { success: true, records_affected: recordsAffected }
  } catch (error: unknown) {
    return { success: false, records_affected: 0, error: error.message }
  }
}

// ============================================================================
// SECURITY ALERTS
// ============================================================================

/**
 * Create security alert
 */
export async function createSecurityAlert(alert: Omit<SecurityAlert, 'id' | 'created_at' | 'resolved'>): Promise<SecurityAlert | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('security_alerts')
    .insert({
      ...alert,
      resolved: false,
      created_at: new Date().toISOString()
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating security alert:', error)
    return null
  }

  return data
}

/**
 * Get security alerts
 */
export async function getSecurityAlerts(options: {
  severity?: string
  type?: string
  resolved?: boolean
  limit?: number
}): Promise<SecurityAlert[]> {
  const supabase = await createClient()

  let query = supabase
    .from('security_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit || 50)

  if (options.severity) {
    query = query.eq('severity', options.severity)
  }

  if (options.type) {
    query = query.eq('type', options.type)
  }

  if (options.resolved !== undefined) {
    query = query.eq('resolved', options.resolved)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching security alerts:', error)
    return []
  }

  return data || []
}

/**
 * Resolve security alert
 */
export async function resolveSecurityAlert(alertId: string, resolvedById: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('security_alerts')
    .update({
      resolved: true,
      resolved_by_id: resolvedById,
      resolved_at: new Date().toISOString()
    })
    .eq('id', alertId)

  return !error
}

/**
 * Detect suspicious activity
 */
export async function detectSuspiciousActivity(userId: string, action: string, ipAddress?: string): Promise<void> {
  const supabase = await createClient()

  // Check for unusual patterns
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Count recent actions from this user
  const { count } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('timestamp', oneHourAgo)

  // Alert if too many actions
  if (count && count > 100) {
    await createSecurityAlert({
      type: 'unusual_activity',
      severity: 'medium',
      title: 'Unusual activity detected',
      description: `User ${userId} performed ${count} actions in the last hour`,
      user_id: userId,
      ip_address: ipAddress
    })
  }

  // Check for multiple IPs
  const { data: ips } = await supabase
    .from('audit_logs')
    .select('ip_address')
    .eq('user_id', userId)
    .gte('timestamp', oneHourAgo)
    .not('ip_address', 'is', null)

  const uniqueIps = new Set(ips?.map(i => i.ip_address))
  if (uniqueIps.size > 5) {
    await createSecurityAlert({
      type: 'suspicious_access',
      severity: 'high',
      title: 'Multiple IP access detected',
      description: `User ${userId} accessed from ${uniqueIps.size} different IPs in the last hour`,
      user_id: userId,
      ip_address: ipAddress
    })
  }
}

// ============================================================================
// COMPLIANCE REPORTING
// ============================================================================

/**
 * Generate compliance report
 */
export async function generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
  const supabase = await createClient()

  // Get audit log counts
  const { count: accessLogs } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())

  const { count: dataExports } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'data_exported')
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())

  const { count: dataDeletions } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'data_deleted')
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())

  // Get ticket metrics
  const { count: totalTickets } = await supabase
    .from('customer_tickets')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const { count: slaBreached } = await supabase
    .from('customer_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('sla_breached', true)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const { count: escalatedTickets } = await supabase
    .from('ticket_escalations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  // Get security incidents
  const { count: incidents } = await supabase
    .from('security_alerts')
    .select('id', { count: 'exact', head: true })
    .in('severity', ['high', 'critical'])
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const slaComplianceRate = totalTickets && totalTickets > 0
    ? ((totalTickets - (slaBreached || 0)) / totalTickets) * 100
    : 100

  const escalationRate = totalTickets && totalTickets > 0
    ? ((escalatedTickets || 0) / totalTickets) * 100
    : 0

  return {
    generated_at: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    total_tickets: totalTickets || 0,
    data_access_logs: accessLogs || 0,
    data_exports: dataExports || 0,
    data_deletions: dataDeletions || 0,
    sla_compliance_rate: Math.round(slaComplianceRate * 10) / 10,
    average_response_time_hours: 4.5, // Would calculate from actual data
    escalation_rate: Math.round(escalationRate * 10) / 10,
    sensitive_data_incidents: incidents || 0,
    policy_violations: 0
  }
}

// ============================================================================
// DEFAULT RETENTION POLICIES
// ============================================================================

export const DEFAULT_RETENTION_POLICIES: Omit<DataRetentionPolicy, 'id' | 'created_at' | 'last_run_at'>[] = [
  {
    name: 'Archive closed tickets after 1 year',
    entity_type: 'customer_tickets',
    retention_days: 365,
    action: 'archive',
    is_active: true
  },
  {
    name: 'Anonymize old customer data after 2 years',
    entity_type: 'customer_tickets',
    retention_days: 730,
    action: 'anonymize',
    is_active: false
  },
  {
    name: 'Delete audit logs after 3 years',
    entity_type: 'audit_logs',
    retention_days: 1095,
    action: 'delete',
    is_active: true
  }
]
