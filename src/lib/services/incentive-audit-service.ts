/**
 * Incentive Audit Trail Service
 * Comprehensive audit logging for compliance and security
 */

import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type EntityType = 'incentive' | 'allocation' | 'claim' | 'progress' | 'target_audience'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'pay'
  | 'claim'
  | 'activate'
  | 'expire'
  | 'disable'

export type ActionCategory = 'data_modification' | 'status_change' | 'approval' | 'payment'

export interface AuditContext {
  performedBy: string // User ID
  performedByName?: string
  performedByRole?: string
  performedByIP?: string
  userAgent?: string
  sessionId?: string
  requestId?: string
  reason?: string
}

export interface AuditLogEntry {
  id: string
  entityType: EntityType
  entityId: string
  action: AuditAction
  actionCategory: ActionCategory
  performedBy: string
  performedByName?: string
  performedByRole?: string
  performedByIP?: string
  userAgent?: string
  oldValues?: unknown; newValues?: unknown; changedFields?: string[]
  reason?: string
  requestId?: string
  sessionId?: string
  checksum: string
  previousChecksum?: string
  performedAt: string
}

export interface AuditHistoryEntry {
  id: string
  action: string
  actionCategory: string
  performedByName: string
  performedByRole: string
  changedFields: string[]
  oldValues: unknown; newValues: unknown; reason?: string
  performedAt: string
  checksumValid: boolean
}

export interface AuditSummary {
  entityType: string
  action: string
  actionCount: number
  uniqueUsers: number
  lastPerformedAt: string
}

export interface IntegrityReport {
  totalRecords: number
  validChecksums: number
  invalidChecksums: number
  brokenChains: number
  integrityScore: number
}

// =====================================================
// AUDIT TRAIL SERVICE CLASS
// =====================================================

export class IncentiveAuditService {
  /**
   * Log an audit trail entry
   */
  static async logAudit(params: {
    entityType: EntityType
    entityId: string
    action: AuditAction
    actionCategory: ActionCategory
    context: AuditContext
    oldValues?: unknown; newValues?: unknown  }): Promise<string | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.rpc('log_audit_trail', {
        p_entity_type: params.entityType,
        p_entity_id: params.entityId,
        p_action: params.action,
        p_action_category: params.actionCategory,
        p_performed_by: params.context.performedBy,
        p_performed_by_name: params.context.performedByName || null,
        p_performed_by_role: params.context.performedByRole || null,
        p_old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
        p_new_values: params.newValues ? JSON.stringify(params.newValues) : null,
        p_reason: params.context.reason || null,
        p_performed_by_ip: params.context.performedByIP || null,
        p_user_agent: params.context.userAgent || null,
        p_session_id: params.context.sessionId || null,
        p_request_id: params.context.requestId || null,
      })

      if (error) {
        logger.error('Failed to log audit trail', error)
        return null
      }

      return data as string
    } catch (error) {
      logger.error('Error in logAudit', error instanceof Error ? error : undefined)
      return null
    }
  }

  /**
   * Get audit history for a specific entity
   */
  static async getEntityHistory(
    entityType: EntityType,
    entityId: string
  ): Promise<AuditHistoryEntry[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.rpc('get_entity_audit_history', {
        p_entity_type: entityType,
        p_entity_id: entityId,
      })

      if (error) {
        logger.error('Failed to get audit history', error)
        return []
      }

      return (data || []) as AuditHistoryEntry[]
    } catch (error) {
      logger.error('Error in getEntityHistory', error instanceof Error ? error : undefined)
      return []
    }
  }

  /**
   * Get audit summary for reporting
   */
  static async getAuditSummary(
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditSummary[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.rpc('get_audit_summary', {
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null,
      })

      if (error) {
        logger.error('Failed to get audit summary', error)
        return []
      }

      return (data || []) as AuditSummary[]
    } catch (error) {
      logger.error('Error in getAuditSummary', error instanceof Error ? error : undefined)
      return []
    }
  }

  /**
   * Verify audit trail integrity for an entity
   */
  static async verifyIntegrity(
    entityType: EntityType,
    entityId: string
  ): Promise<IntegrityReport | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.rpc('verify_audit_integrity', {
        p_entity_type: entityType,
        p_entity_id: entityId,
      })

      if (error) {
        logger.error('Failed to verify audit integrity', error)
        return null
      }

      return data?.[0] as IntegrityReport
    } catch (error) {
      logger.error('Error in verifyIntegrity', error instanceof Error ? error : undefined)
      return null
    }
  }

  /**
   * Get audit trail for compliance report
   */
  static async getComplianceReport(
    startDate: Date,
    endDate: Date,
    entityType?: EntityType
  ): Promise<AuditLogEntry[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('incentive_audit_log')
        .select('*')
        .gte('performed_at', startDate.toISOString())
        .lte('performed_at', endDate.toISOString())
        .order('performed_at', { ascending: false })

      if (entityType) {
        query = query.eq('entity_type', entityType)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Failed to get compliance report', error)
        return []
      }

      return (data || []) as AuditLogEntry[]
    } catch (error) {
      logger.error('Error in getComplianceReport', error instanceof Error ? error : undefined)
      return []
    }
  }

  /**
   * Search audit logs
   */
  static async searchAuditLogs(params: {
    entityType?: EntityType
    action?: AuditAction
    performedBy?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }): Promise<{ data: AuditLogEntry[]; total: number }> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('incentive_audit_log')
        .select('*', { count: 'exact' })
        .order('performed_at', { ascending: false })

      if (params.entityType) {
        query = query.eq('entity_type', params.entityType)
      }

      if (params.action) {
        query = query.eq('action', params.action)
      }

      if (params.performedBy) {
        query = query.eq('performed_by', params.performedBy)
      }

      if (params.startDate) {
        query = query.gte('performed_at', params.startDate.toISOString())
      }

      if (params.endDate) {
        query = query.lte('performed_at', params.endDate.toISOString())
      }

      const limit = params.limit || 50
      const offset = params.offset || 0

      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        logger.error('Failed to search audit logs', error)
        return { data: [], total: 0 }
      }

      return {
        data: (data || []) as AuditLogEntry[],
        total: count || 0,
      }
    } catch (error) {
      logger.error('Error in searchAuditLogs', error instanceof Error ? error : undefined)
      return { data: [], total: 0 }
    }
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalActions: number
    actionsByType: Record<string, number>
    recentActions: AuditLogEntry[]
  }> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('incentive_audit_log')
        .select('*')
        .eq('performed_by', userId)

      if (startDate) {
        query = query.gte('performed_at', startDate.toISOString())
      }

      if (endDate) {
        query = query.lte('performed_at', endDate.toISOString())
      }

      const { data, error } = await query.order('performed_at', { ascending: false })

      if (error) {
        logger.error('Failed to get user activity summary', error)
        return { totalActions: 0, actionsByType: {}, recentActions: [] }
      }

      const logs = (data || []) as AuditLogEntry[]

      // Count actions by type
      const actionsByType: Record<string, number> = {}
      logs.forEach((log) => {
        const key = `${log.entityType}:${log.action}`
        actionsByType[key] = (actionsByType[key] || 0) + 1
      })

      return {
        totalActions: logs.length,
        actionsByType,
        recentActions: logs.slice(0, 10),
      }
    } catch (error) {
      logger.error('Error in getUserActivitySummary', error instanceof Error ? error : undefined)
      return { totalActions: 0, actionsByType: {}, recentActions: []}}
  }

  /**
   * Detect suspicious activity
   */
  static async detectSuspiciousActivity(
    lookbackHours: number = 24
  ): Promise<{
    rapidChanges: AuditLogEntry[]
    unusualActions: AuditLogEntry[]
    multipleFailedAttempts: AuditLogEntry[]
  }> {
    try {
      const supabase = await createClient()
      const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)

      // Get all recent audit logs
      const { data: logs, error } = await supabase
        .from('incentive_audit_log')
        .select('*')
        .gte('performed_at', since.toISOString())
        .order('performed_at', { ascending: false })

      if (error || !logs) {
        logger.error('Failed to detect suspicious activity', error)
        return { rapidChanges: [], unusualActions: [], multipleFailedAttempts: [] }
      }

      const auditLogs = logs as AuditLogEntry[]

      // Detect rapid changes (same entity modified >5 times in 1 hour)
      const entityChanges: Record<string, AuditLogEntry[]> = {}
      auditLogs.forEach((log) => {
        const key = `${log.entityType}:${log.entityId}`
        if (!entityChanges[key]) entityChanges[key] = []
        entityChanges[key].push(log)
      })

      const rapidChanges = Object.values(entityChanges)
        .filter((changes) => changes.length >= 5)
        .flat()

      // Detect unusual actions (deletions, mass updates)
      const unusualActions = auditLogs.filter(
        (log) => log.action === 'delete' || log.actionCategory === 'data_modification'
      )

      return {
        rapidChanges,
        unusualActions,
        multipleFailedAttempts: [], // Would need error logs to implement
      }
    } catch (error) {
      logger.error('Error in detectSuspiciousActivity', error instanceof Error ? error : undefined)
      return { rapidChanges: [], unusualActions: [], multipleFailedAttempts: [] }
    }
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract request context from Next.js request
 */
export function extractRequestContext(request: Request): Partial<AuditContext> {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
  const userAgent = request.headers.get('user-agent') || undefined
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  return {
    performedByIP: ip,
    userAgent,
    requestId,
  }
}

/**
 * Get changed fields between two objects
 */
export function getChangedFields(oldObj: unknown, newObj: unknown): string[] {
  const changed: string[] = []

  if (!oldObj || !newObj) return changed

  Object.keys(newObj).forEach((key) => {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changed.push(key)
    }
  })

  return changed
}

/**
 * Format audit log entry for display
 */
export function formatAuditEntry(entry: AuditHistoryEntry): string {
  const action = entry.action.toUpperCase()
  const user = entry.performedByName || 'Unknown'
  const date = new Date(entry.performedAt).toLocaleString()

  let message = `${action} by ${user} on ${date}`

  if (entry.changedFields && entry.changedFields.length > 0) {
    message += ` - Changed: ${entry.changedFields.join(', ')}`
  }

  if (entry.reason) {
    message += ` - Reason: ${entry.reason}`
  }

  return message
}
