/**
 * Two-Factor Authentication Setup Session Manager
 * Securely stores 2FA setup data server-side to prevent secret exposure
 *
 * SECURITY: 2FA secrets are NEVER sent to the client
 * - Secrets stored in-memory with 15-minute expiration
 * - Verification token links client to server-side secret
 * - Auto-cleanup prevents memory leaks
 */

import { randomBytes } from 'crypto'
import { logger } from '@/lib/utils/logger'

interface TwoFactorSetupSession {
  adminId: string
  secret: string
  backupCodes: string[]
  createdAt: number
  expiresAt: number
}

// In-memory session store (15-minute TTL)
// In production, use Redis or database with TTL
const setupSessions = new Map<string, TwoFactorSetupSession>()

const SESSION_EXPIRY = 15 * 60 * 1000 // 15 minutes

/**
 * Create a new 2FA setup session
 * Returns a verification token that client uses to complete setup
 */
export function createSetupSession(
  adminId: string,
  secret: string,
  backupCodes: string[]
): string {
  // Generate verification token
  const verificationToken = randomBytes(32).toString('base64url')

  // Store session
  const session: TwoFactorSetupSession = {
    adminId,
    secret,
    backupCodes,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY,
  }

  setupSessions.set(verificationToken, session)

  // Schedule cleanup
  setTimeout(() => {
    deleteSetupSession(verificationToken)
  }, SESSION_EXPIRY)

  logger.info('2FA setup session created', {
    adminId,
    verificationToken: verificationToken.substring(0, 8) + '...',
    expiresAt: new Date(session.expiresAt).toISOString(),
  })

  return verificationToken
}

/**
 * Get 2FA setup session data
 * Returns null if session doesn't exist or has expired
 */
export function getSetupSession(
  verificationToken: string
): TwoFactorSetupSession | null {
  const session = setupSessions.get(verificationToken)

  if (!session) {
    return null
  }

  // Check expiration
  if (Date.now() > session.expiresAt) {
    deleteSetupSession(verificationToken)
    return null
  }

  return session
}

/**
 * Verify that the verification token belongs to the specified admin
 */
export function verifySetupSession(
  verificationToken: string,
  adminId: string
): boolean {
  const session = getSetupSession(verificationToken)

  if (!session) {
    return false
  }

  return session.adminId === adminId
}

/**
 * Delete a setup session after successful 2FA enablement
 */
export function deleteSetupSession(verificationToken: string): void {
  const session = setupSessions.get(verificationToken)

  if (session) {
    logger.info('2FA setup session deleted', {
      adminId: session.adminId,
      verificationToken: verificationToken.substring(0, 8) + '...',
    })
  }

  setupSessions.delete(verificationToken)
}

/**
 * Clean up expired sessions (run periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now()
  let cleanedCount = 0

  for (const [token, session] of setupSessions.entries()) {
    if (now > session.expiresAt) {
      setupSessions.delete(token)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    logger.info('Cleaned up expired 2FA setup sessions', { count: cleanedCount })
  }

  return cleanedCount
}

/**
 * Get active session count (for monitoring)
 */
export function getActiveSessionCount(): number {
  return setupSessions.size
}

// Run cleanup every 5 minutes
setInterval(() => {
  cleanupExpiredSessions()
}, 5 * 60 * 1000)
