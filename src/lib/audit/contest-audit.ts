/**
 * Contest Audit Logging System
 * Tracks all changes to contests for compliance and debugging
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'

export enum ContestAuditAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  STATUS_CHANGED = 'status_changed',
  PARTICIPANT_ADDED = 'participant_added',
  PARTICIPANT_REMOVED = 'participant_removed',
  LEADERBOARD_REFRESHED = 'leaderboard_refreshed',
  ANALYTICS_REFRESHED = 'analytics_refreshed',
  CONTEST_EVALUATED = 'contest_evaluated',
  PUBLISHED = 'published',
  DISABLED = 'disabled',
}

export interface ContestAuditLog {
  contest_id: string
  action: ContestAuditAction
  changed_by: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
  ip_address?: string
  user_agent?: string
}

/**
 * Log a contest action to the audit log
 */
export async function logContestAction(log: ContestAuditLog): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()

    const auditEntry = {
      contest_id: log.contest_id,
      action: log.action,
      changed_by: log.changed_by,
      changes: log.changes || null,
      metadata: log.metadata || null,
      ip_address: log.ip_address || null,
      user_agent: log.user_agent || null,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('contest_audit_log').insert(auditEntry)

    if (error) {
      // Don't throw - audit failures shouldn't block the operation
      logger.error('Failed to write contest audit log', error)
    } else {
      logger.info(`Contest audit log: ${log.action} on contest ${log.contest_id} by ${log.changed_by}`)
    }
  } catch (error) {
    logger.error('Error in logContestAction', error instanceof Error ? error : undefined)
  }
}

/**
 * Log contest creation
 */
export async function logContestCreated(
  contestId: string,
  userId: string,
  contestData: Record<string, any>,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  await logContestAction({
    contest_id: contestId,
    action: ContestAuditAction.CREATED,
    changed_by: userId,
    metadata: {
      contest_title: contestData.contest_title,
      contest_type: contestData.contest_type,
      status: contestData.status,
    },
    ip_address: request?.ip,
    user_agent: request?.userAgent,
  })
}

/**
 * Log contest update
 */
export async function logContestUpdated(
  contestId: string,
  userId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  // Calculate changes
  const changes: Record<string, { old: any; new: any }> = {}

  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      }
    }
  }

  if (Object.keys(changes).length > 0) {
    await logContestAction({
      contest_id: contestId,
      action: ContestAuditAction.UPDATED,
      changed_by: userId,
      changes,
      ip_address: request?.ip,
      user_agent: request?.userAgent,
    })
  }
}

/**
 * Log contest deletion
 */
export async function logContestDeleted(
  contestId: string,
  userId: string,
  contestTitle: string,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  await logContestAction({
    contest_id: contestId,
    action: ContestAuditAction.DELETED,
    changed_by: userId,
    metadata: {
      contest_title: contestTitle,
    },
    ip_address: request?.ip,
    user_agent: request?.userAgent,
  })
}

/**
 * Log contest status change
 */
export async function logContestStatusChanged(
  contestId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  await logContestAction({
    contest_id: contestId,
    action: ContestAuditAction.STATUS_CHANGED,
    changed_by: userId,
    changes: {
      status: { old: oldStatus, new: newStatus },
    },
    ip_address: request?.ip,
    user_agent: request?.userAgent,
  })
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string | undefined {
  const headers = request.headers
  return (
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('cf-connecting-ip') ||
    undefined
  )
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}
