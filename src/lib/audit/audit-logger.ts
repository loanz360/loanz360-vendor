/**
 * AUDIT TRAIL LOGGER
 * Enterprise-grade audit logging for compliance and forensics
 *
 * Features:
 * - Automatic change tracking
 * - IP address and user agent capture
 * - Request correlation
 * - GDPR compliant
 * - SOC 2 ready
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export type AuditEventType =
  | 'partner.created'
  | 'partner.updated'
  | 'partner.deleted'
  | 'partner.status_changed'
  | 'contest.created'
  | 'contest.updated'
  | 'contest.deleted'
  | 'contest.status_changed'
  | 'contest.evaluated'
  | 'participant.added'
  | 'participant.score_updated'
  | 'payout.processed'
  | 'payout.approved'
  | 'payout.rejected'
  // Notification events
  | 'notification.created'
  | 'notification.sent'
  | 'notification.delivered'
  | 'notification.failed'
  | 'notification.scheduled'
  | 'notification.cancelled'
  | 'template.created'
  | 'template.updated'
  | 'template.deleted'
  | 'provider.created'
  | 'provider.updated'
  | 'provider.deleted'
  | 'provider.activated'
  | 'provider.deactivated'
  | 'settings.updated'
  | 'user.subscribed'
  | 'user.unsubscribed'
  | 'campaign.created'
  | 'campaign.started'
  | 'campaign.completed'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'

export type EntityType = 'partner' | 'contest' | 'participant' | 'payout' | 'user' | 'notification' | 'template' | 'provider' | 'campaign' | 'subscription' | 'approval' | 'settings'

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AuditLogEntry {
  eventType: AuditEventType
  entityType: EntityType
  entityId: string
  actorId: string
  actorType?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
  severity?: AuditSeverity
  requestId?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Log an audit event
 */
export async function logAudit(entry: AuditLogEntry): Promise<string | null> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase.rpc('log_partner_audit', {
      p_event_type: entry.eventType,
      p_entity_type: entry.entityType,
      p_entity_id: entry.entityId,
      p_actor_id: entry.actorId,
      p_actor_type: entry.actorType || 'super_admin',
      p_old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      p_new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
      p_metadata: JSON.stringify({
        ...entry.metadata,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        timestamp: new Date().toISOString()
      }),
      p_severity: entry.severity || 'info',
      p_request_id: entry.requestId
    })

    if (error) {
      console.error('Audit log error:', error)
      return null
    }

    return data as string
  } catch (error) {
    console.error('Failed to log audit:', error)
    return null
  }
}

/**
 * Log partner creation
 */
export async function logPartnerCreated(
  partnerId: string,
  partnerData: Record<string, unknown>,
  actorId: string,
  request?: NextRequest
): Promise<void> {
  await logAudit({
    eventType: 'partner.created',
    entityType: 'partner',
    entityId: partnerId,
    actorId,
    newValues: partnerData,
    severity: 'info',
    ipAddress: request ? getClientIp(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
    requestId: request ? generateRequestId(request) : undefined
  })
}

/**
 * Log partner update
 */
export async function logPartnerUpdated(
  partnerId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  actorId: string,
  request?: NextRequest
): Promise<void> {
  // Only log fields that actually changed
  const changes = getChangedFields(oldData, newData)

  if (Object.keys(changes.changed).length === 0) {
    return // No actual changes, skip logging
  }

  await logAudit({
    eventType: 'partner.updated',
    entityType: 'partner',
    entityId: partnerId,
    actorId,
    oldValues: changes.old,
    newValues: changes.new,
    severity: 'info',
    ipAddress: request ? getClientIp(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
    requestId: request ? generateRequestId(request) : undefined,
    metadata: {
      changed_fields: changes.changed
    }
  })
}

/**
 * Log partner deletion
 */
export async function logPartnerDeleted(
  partnerId: string,
  partnerData: Record<string, unknown>,
  actorId: string,
  request?: NextRequest
): Promise<void> {
  await logAudit({
    eventType: 'partner.deleted',
    entityType: 'partner',
    entityId: partnerId,
    actorId,
    oldValues: partnerData,
    severity: 'warning',
    ipAddress: request ? getClientIp(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
    requestId: request ? generateRequestId(request) : undefined
  })
}

/**
 * Log contest creation
 */
export async function logContestCreated(
  contestId: string,
  contestData: Record<string, unknown>,
  actorId: string,
  request?: NextRequest
): Promise<void> {
  await logAudit({
    eventType: 'contest.created',
    entityType: 'contest',
    entityId: contestId,
    actorId,
    newValues: contestData,
    severity: 'info',
    ipAddress: request ? getClientIp(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
    requestId: request ? generateRequestId(request) : undefined
  })
}

/**
 * Log contest evaluation
 */
export async function logContestEvaluated(
  contestId: string,
  evaluationData: Record<string, unknown>,
  actorId: string,
  request?: NextRequest
): Promise<void> {
  await logAudit({
    eventType: 'contest.evaluated',
    entityType: 'contest',
    entityId: contestId,
    actorId,
    newValues: evaluationData,
    severity: 'info',
    ipAddress: request ? getClientIp(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
    requestId: request ? generateRequestId(request) : undefined
  })
}

/**
 * Get audit trail for an entity
 */
export async function getEntityAuditTrail(
  entityType: EntityType,
  entityId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase.rpc('get_entity_audit_trail', {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_limit: limit
    })

    if (error) {
      console.error('Failed to get audit trail:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Audit trail fetch error:', error)
    return []
  }
}

/**
 * Get recent audit logs with filters
 */
export async function getRecentAuditLogs(params: {
  eventType?: AuditEventType
  actorId?: string
  severity?: AuditSeverity
  limit?: number
  offset?: number
}): Promise<any[]> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase.rpc('get_recent_audit_logs', {
      p_event_type: params.eventType || null,
      p_actor_id: params.actorId || null,
      p_severity: params.severity || null,
      p_limit: params.limit || 100,
      p_offset: params.offset || 0
    })

    if (error) {
      console.error('Failed to get recent audit logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Recent audit logs fetch error:', error)
    return []
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string | undefined {
  // Check various headers for real IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return undefined
}

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(request: NextRequest): string {
  // Use existing request ID if available
  const existingId = request.headers.get('x-request-id')
  if (existingId) {
    return existingId
  }

  // Generate new request ID
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get only changed fields between two objects
 */
function getChangedFields(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): {
  changed: string[]
  old: Record<string, unknown>
  new: Record<string, unknown>
} {
  const changed: string[] = []
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}

  // Check for modified fields
  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changed.push(key)
      oldValues[key] = oldData[key]
      newValues[key] = newData[key]
    }
  }

  return { changed, old: oldValues, new: newValues }
}

/**
 * Sanitize sensitive data before logging
 */
export function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data }
  const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'private_key']

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}
