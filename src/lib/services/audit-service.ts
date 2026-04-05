/**
 * Audit Service
 * Logs all admin actions for compliance and security monitoring
 */

import { createClient } from '@/lib/supabase/server'

export type AuditEventType =
  | 'chatbot.created'
  | 'chatbot.updated'
  | 'chatbot.deleted'
  | 'chatbot.published'
  | 'chatbot.unpublished'
  | 'flow.saved'
  | 'flow.published'
  | 'flow.rolled_back'
  | 'lead.created'
  | 'lead.assigned'
  | 'lead.status_changed'
  | 'lead.merged'
  | 'settings.changed'
  | 'api_key.rotated'
  | 'user.login'
  | 'user.logout'
  | 'user.permission_changed'
  | 'export.generated'
  | 'bulk_action.performed'

export type EntityType =
  | 'chatbot'
  | 'chatbot_flow'
  | 'online_lead'
  | 'user'
  | 'settings'
  | 'api_key'
  | 'export'

export type ActorType = 'user' | 'system' | 'api' | 'webhook'

interface AuditLogEntry {
  event_type: AuditEventType
  entity_type: EntityType
  entity_id: string
  actor_id?: string
  actor_type?: ActorType
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  metadata?: Record<string, unknown>
  ip_address?: string
}

interface AuditQueryOptions {
  entityType?: EntityType
  entityId?: string
  actorId?: string
  eventType?: AuditEventType
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

class AuditService {
  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase.from('chatbot_audit_log').insert({
        event_type: entry.event_type,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        actor_id: entry.actor_id || null,
        actor_type: entry.actor_type || 'system',
        old_values: entry.old_values || null,
        new_values: entry.new_values || null,
        metadata: entry.metadata || null,
        ip_address: entry.ip_address || null
      })
    } catch (error) {
      // Log to console but don't throw - audit failures shouldn't break operations
      console.error('Audit log failed:', error)
    }
  }

  /**
   * Log chatbot creation
   */
  async logChatbotCreated(
    chatbotId: string,
    chatbotData: Record<string, unknown>,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      event_type: 'chatbot.created',
      entity_type: 'chatbot',
      entity_id: chatbotId,
      actor_id: actorId,
      actor_type: 'user',
      new_values: chatbotData,
      ip_address: ipAddress
    })
  }

  /**
   * Log chatbot update
   */
  async logChatbotUpdated(
    chatbotId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    // Only log fields that changed
    const changes: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}

    for (const key of Object.keys(newData)) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = newData[key]
        oldValues[key] = oldData[key]
      }
    }

    if (Object.keys(changes).length === 0) return

    await this.log({
      event_type: 'chatbot.updated',
      entity_type: 'chatbot',
      entity_id: chatbotId,
      actor_id: actorId,
      actor_type: 'user',
      old_values: oldValues,
      new_values: changes,
      ip_address: ipAddress
    })
  }

  /**
   * Log chatbot deletion
   */
  async logChatbotDeleted(
    chatbotId: string,
    chatbotData: Record<string, unknown>,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      event_type: 'chatbot.deleted',
      entity_type: 'chatbot',
      entity_id: chatbotId,
      actor_id: actorId,
      actor_type: 'user',
      old_values: chatbotData,
      ip_address: ipAddress
    })
  }

  /**
   * Log flow save
   */
  async logFlowSaved(
    flowId: string,
    chatbotId: string,
    nodesCount: number,
    edgesCount: number,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      event_type: 'flow.saved',
      entity_type: 'chatbot_flow',
      entity_id: flowId,
      actor_id: actorId,
      actor_type: 'user',
      new_values: { nodes_count: nodesCount, edges_count: edgesCount },
      metadata: { chatbot_id: chatbotId },
      ip_address: ipAddress
    })
  }

  /**
   * Log flow publish
   */
  async logFlowPublished(
    flowId: string,
    versionNumber: number,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      event_type: 'flow.published',
      entity_type: 'chatbot_flow',
      entity_id: flowId,
      actor_id: actorId,
      actor_type: 'user',
      new_values: { version_number: versionNumber, published: true },
      ip_address: ipAddress
    })
  }

  /**
   * Log flow rollback
   */
  async logFlowRolledBack(
    flowId: string,
    fromVersion: number,
    toVersion: number,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      event_type: 'flow.rolled_back',
      entity_type: 'chatbot_flow',
      entity_id: flowId,
      actor_id: actorId,
      actor_type: 'user',
      old_values: { version: fromVersion },
      new_values: { version: toVersion },
      ip_address: ipAddress
    })
  }

  /**
   * Log lead creation
   */
  async logLeadCreated(
    leadId: string,
    chatbotId: string,
    source: string
  ): Promise<void> {
    await this.log({
      event_type: 'lead.created',
      entity_type: 'online_lead',
      entity_id: leadId,
      actor_type: 'system',
      new_values: { chatbot_id: chatbotId, source }
    })
  }

  /**
   * Log lead assignment
   */
  async logLeadAssigned(
    leadId: string,
    assignedTo: string,
    assignmentMode: string,
    actorId?: string
  ): Promise<void> {
    await this.log({
      event_type: 'lead.assigned',
      entity_type: 'online_lead',
      entity_id: leadId,
      actor_id: actorId,
      actor_type: actorId ? 'user' : 'system',
      new_values: { assigned_to: assignedTo, assignment_mode: assignmentMode }
    })
  }

  /**
   * Log API key rotation
   */
  async logApiKeyRotated(
    chatbotId: string,
    actorId: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      event_type: 'api_key.rotated',
      entity_type: 'api_key',
      entity_id: chatbotId,
      actor_id: actorId,
      actor_type: 'user',
      metadata: { rotated_at: new Date().toISOString() },
      ip_address: ipAddress
    })
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions = {}): Promise<{
    data: unknown[]
    total: number
  }> {
    const supabase = await createClient()
    const limit = options.limit || 50
    const offset = options.offset || 0

    let query = supabase
      .from('chatbot_audit_log')
      .select('*', { count: 'exact' })

    if (options.entityType) {
      query = query.eq('entity_type', options.entityType)
    }
    if (options.entityId) {
      query = query.eq('entity_id', options.entityId)
    }
    if (options.actorId) {
      query = query.eq('actor_id', options.actorId)
    }
    if (options.eventType) {
      query = query.eq('event_type', options.eventType)
    }
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      data: data || [],
      total: count || 0
    }
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityHistory(
    entityType: EntityType,
    entityId: string,
    limit = 100
  ): Promise<unknown[]> {
    const result = await this.query({
      entityType,
      entityId,
      limit
    })
    return result.data
  }
}

// Export singleton instance
export const auditService = new AuditService()
export default auditService
