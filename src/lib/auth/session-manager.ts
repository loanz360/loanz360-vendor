/**
 * SuperAdmin Session Manager
 * E11: Session concurrency control - max 2 active sessions per admin
 * E6: Enhanced session security
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

const MAX_CONCURRENT_SESSIONS = 2

/**
 * Hash a session ID for secure storage
 */
export function hashSessionId(sessionId: string): string {
  return crypto.createHash('sha256').update(sessionId).digest('hex')
}

/**
 * Generate a cryptographically secure session ID
 */
export function generateSecureSessionId(): string {
  return `sa_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`
}

/**
 * Enforce session concurrency limits
 * Revokes oldest sessions if limit exceeded
 */
export async function enforceSessionLimit(superAdminId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()

    // Get all active sessions for this admin, ordered by creation (newest first)
    const { data: sessions, error } = await supabase
      .from('super_admin_sessions')
      .select('id, created_at')
      .eq('super_admin_id', superAdminId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error || !sessions) return

    // If over limit, deactivate oldest sessions
    if (sessions.length >= MAX_CONCURRENT_SESSIONS) {
      const sessionsToRevoke = sessions.slice(MAX_CONCURRENT_SESSIONS - 1)
      const idsToRevoke = sessionsToRevoke.map(s => s.id)

      if (idsToRevoke.length > 0) {
        await supabase
          .from('super_admin_sessions')
          .update({ is_active: false, revoked_at: new Date().toISOString(), revoke_reason: 'SESSION_LIMIT_EXCEEDED' })
          .in('id', idsToRevoke)

        apiLogger.info('Revoked excess sessions', {
          superAdminId,
          revokedCount: idsToRevoke.length,
        })
      }
    }
  } catch (error) {
    apiLogger.error('Error enforcing session limit', error)
  }
}

/**
 * Revoke all sessions for a super admin (e.g., on password change)
 */
export async function revokeAllSessions(superAdminId: string, reason: string = 'MANUAL_REVOKE'): Promise<number> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('super_admin_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq('super_admin_id', superAdminId)
      .eq('is_active', true)
      .select('id')

    if (error) {
      apiLogger.error('Error revoking sessions', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    apiLogger.error('Error in revokeAllSessions', error)
    return 0
  }
}

/**
 * Check if a session is still valid and active
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    const { data: session, error } = await supabase
      .from('super_admin_sessions')
      .select('id, is_active, expires_at')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !session) return false

    // Check expiration
    const expiresAt = new Date(session.expires_at)
    if (expiresAt <= new Date()) {
      // Session expired - mark as inactive
      await supabase
        .from('super_admin_sessions')
        .update({ is_active: false, revoke_reason: 'EXPIRED' })
        .eq('id', session.id)
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Update last activity timestamp for a session
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()
    await supabase
      .from('super_admin_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('is_active', true)
  } catch {
    // Non-critical - silently ignore
  }
}
