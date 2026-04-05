/**
 * Token Blacklist System
 * Provides token revocation capability for security
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import crypto from 'crypto'

export interface BlacklistedToken {
  token_hash: string
  user_id: string
  session_id: string
  revoked_at: string
  expires_at: string
  reason?: string
  revoked_by?: string
}

/**
 * Create a hash of the token for storage (don't store actual tokens)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Add token to blacklist
 */
export async function blacklistToken(
  token: string,
  userId: string,
  sessionId: string,
  expiresAt: Date,
  reason?: string,
  revokedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const tokenHash = hashToken(token)

    const { error } = await supabaseAdmin
      .from('token_blacklist')
      .insert({
        token_hash: tokenHash,
        user_id: userId,
        session_id: sessionId,
        revoked_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        reason,
        revoked_by: revokedBy
      } as never)

    if (error) {
      logger.error('Failed to blacklist token', error as Error, { userId, sessionId })
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('Error blacklisting token', error as Error, { userId, sessionId })
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const tokenHash = hashToken(token)

    const { data, error } = await supabaseAdmin
      .from('token_blacklist')
      .select('token_hash')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected for non-blacklisted tokens
      logger.error('Error checking token blacklist', error as Error)
      // Fail closed - if we can't check, treat as blacklisted
      return true
    }

    return data !== null
  } catch (error) {
    logger.error('Error checking token blacklist', error as Error)
    // Fail closed for security
    return true
  }
}

/**
 * Revoke all tokens for a user (force logout everywhere)
 */
export async function revokeAllUserTokens(
  userId: string,
  reason?: string,
  revokedBy?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    // Mark all active sessions as revoked
    const { error } = await supabaseAdmin
      .from('user_sessions')
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason
      } as never)
      .eq('user_id', userId)
      .eq('revoked', false)

    if (error) {
      logger.error('Failed to revoke user tokens', error as Error, { userId })
      return { success: false, count: 0, error: error.message }
    }

    // Also record in audit log
    await supabaseAdmin
      .from('security_audit_log')
      .insert({
        event_type: 'ALL_TOKENS_REVOKED',
        user_id: userId,
        performed_by: revokedBy,
        details: { reason },
        created_at: new Date().toISOString()
      } as never)

    return { success: true, count: 0 }
  } catch (error) {
    logger.error('Error revoking user tokens', error as Error, { userId })
    return { success: false, count: 0, error: 'Internal error' }
  }
}

/**
 * Revoke specific session (logout from specific device)
 */
export async function revokeSession(
  sessionId: string,
  reason?: string,
  _revokedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { error } = await supabaseAdmin
      .from('user_sessions')
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason
      } as never)
      .eq('session_id', sessionId)
      .eq('revoked', false)

    if (error) {
      logger.error('Failed to revoke session', error as Error, { sessionId })
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('Error revoking session', error as Error, { sessionId })
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Check if session is revoked
 */
export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('revoked')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (error) {
      logger.error('Error checking session revocation', error as Error, { sessionId })
      // Fail closed
      return true
    }

    return (data as { revoked?: boolean } | null)?.revoked === true
  } catch (error) {
    logger.error('Error checking session revocation', error as Error, { sessionId })
    // Fail closed for security
    return true
  }
}

/**
 * Clean up expired blacklist entries (call periodically)
 */
export async function cleanupExpiredBlacklistEntries(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { error, count } = await supabaseAdmin
      .from('token_blacklist')
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (error) {
      logger.error('Failed to cleanup blacklist', error as Error)
      return { success: false, deletedCount: 0 }
    }

    return { success: true, deletedCount: count || 0 }
  } catch (error) {
    logger.error('Error cleaning up blacklist', error as Error)
    return { success: false, deletedCount: 0 }
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string) {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('last_activity', { ascending: false })

    if (error) {
      logger.error('Error fetching user sessions', error as Error, { userId })
      return []
    }

    return data || []
  } catch (error) {
    logger.error('Error fetching user sessions', error as Error, { userId })
    return []
  }
}