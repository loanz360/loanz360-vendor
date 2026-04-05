/**
 * Server-Side Session Validation
 *
 * Enforces session timeouts on the server side
 * SECURITY: Prevents session hijacking and unauthorized access
 *
 * COMPLIANCE: PCI-DSS 8.1.8 (Session timeout after 15 minutes of inactivity)
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { ErrorCode, createErrorResponse } from '@/lib/errors/error-codes'

export interface SessionTimeoutConfig {
  // Absolute timeout: Maximum session duration regardless of activity
  absoluteTimeoutMs: number

  // Idle timeout: Maximum time of inactivity before session expires
  idleTimeoutMs: number

  // Sensitive operations require re-authentication (in minutes)
  sensitiveOperationTimeoutMs: number
}

/**
 * Default timeout configuration
 * Based on PCI-DSS and OWASP recommendations
 */
export const DEFAULT_SESSION_TIMEOUT: SessionTimeoutConfig = {
  absoluteTimeoutMs: 8 * 60 * 60 * 1000, // 8 hours - max session duration
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes - idle timeout (PCI-DSS recommends 15 min)
  sensitiveOperationTimeoutMs: 15 * 60 * 1000, // 15 minutes - re-auth for sensitive ops
}

/**
 * Stricter timeout for high-value operations (payouts, loan approvals, etc.)
 */
export const SENSITIVE_SESSION_TIMEOUT: SessionTimeoutConfig = {
  absoluteTimeoutMs: 4 * 60 * 60 * 1000, // 4 hours
  idleTimeoutMs: 15 * 60 * 1000, // 15 minutes (PCI-DSS requirement)
  sensitiveOperationTimeoutMs: 5 * 60 * 1000, // 5 minutes
}

export interface SessionValidationResult {
  valid: boolean
  userId?: string
  error?: {
    code: ErrorCode
    message: string
  }
  sessionAge?: number
  idleTime?: number
  requiresReauth?: boolean
}

/**
 * Validate session timeout on server side
 */
export async function validateSessionTimeout(
  config: SessionTimeoutConfig = DEFAULT_SESSION_TIMEOUT
): Promise<SessionValidationResult> {
  const supabase = await createClient()

  try {
    // Get authenticated user (secure server-side validation)
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return {
        valid: false,
        error: {
          code: ErrorCode.AUTH_SESSION_EXPIRED,
          message: 'No active session',
        },
      }
    }

    // Get user data for last_login tracking
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('last_login, created_at')
      .eq('id', authUser.id)
      .maybeSingle()

    if (userError || !user) {
      return {
        valid: false,
        error: {
          code: ErrorCode.AUTH_SESSION_EXPIRED,
          message: 'User not found',
        },
      }
    }

    const now = new Date()
    const sessionCreatedAt = new Date(authUser.created_at)
    const lastActivity = user.last_login ? new Date(user.last_login) : sessionCreatedAt

    // Calculate session age and idle time
    const sessionAge = now.getTime() - sessionCreatedAt.getTime()
    const idleTime = now.getTime() - lastActivity.getTime()

    // Check absolute timeout
    if (sessionAge >= config.absoluteTimeoutMs) {
      logger.info('Session expired - absolute timeout', {
        userId: authUser.id,
        sessionAge: Math.floor(sessionAge / 1000 / 60),
        maxAge: Math.floor(config.absoluteTimeoutMs / 1000 / 60),
      })

      // Sign out expired session
      await supabase.auth.signOut()

      return {
        valid: false,
        error: {
          code: ErrorCode.AUTH_SESSION_EXPIRED,
          message: 'Session expired due to maximum duration',
        },
        sessionAge,
        idleTime,
      }
    }

    // Check idle timeout
    if (idleTime >= config.idleTimeoutMs) {
      logger.info('Session expired - idle timeout', {
        userId: authUser.id,
        idleTime: Math.floor(idleTime / 1000 / 60),
        maxIdle: Math.floor(config.idleTimeoutMs / 1000 / 60),
      })

      // Sign out expired session
      await supabase.auth.signOut()

      return {
        valid: false,
        error: {
          code: ErrorCode.AUTH_SESSION_EXPIRED,
          message: 'Session expired due to inactivity',
        },
        sessionAge,
        idleTime,
      }
    }

    // Session is valid - update last activity
    await supabase
      .from('users')
      .update({
        last_login: now.toISOString(),
      })
      .eq('id', authUser.id)

    return {
      valid: true,
      userId: authUser.id,
      sessionAge,
      idleTime,
    }
  } catch (error) {
    logger.error('Session validation failed', { error })
    return {
      valid: false,
      error: {
        code: ErrorCode.SYS_INTERNAL_ERROR,
        message: 'Session validation error',
      },
    }
  }
}

/**
 * Check if user can perform sensitive operation
 * Sensitive operations require recent authentication
 */
export async function canPerformSensitiveOperation(
  userId: string,
  config: SessionTimeoutConfig = SENSITIVE_SESSION_TIMEOUT
): Promise<{
  allowed: boolean
  requiresReauth: boolean
  timeSinceLogin?: number
}> {
  const supabase = await createClient()

  try {
    const { data: user } = await supabase.from('users').select('last_login').eq('id', userId).maybeSingle()

    if (!user || !user.last_login) {
      return {
        allowed: false,
        requiresReauth: true,
      }
    }

    const lastLogin = new Date(user.last_login)
    const now = new Date()
    const timeSinceLogin = now.getTime() - lastLogin.getTime()

    // Check if last login was within sensitive operation timeout
    const allowed = timeSinceLogin <= config.sensitiveOperationTimeoutMs

    if (!allowed) {
      logger.info('Sensitive operation requires re-authentication', {
        userId,
        timeSinceLogin: Math.floor(timeSinceLogin / 1000 / 60),
        requiredTime: Math.floor(config.sensitiveOperationTimeoutMs / 1000 / 60),
      })
    }

    return {
      allowed,
      requiresReauth: !allowed,
      timeSinceLogin,
    }
  } catch (error) {
    logger.error('Sensitive operation check failed', { error, userId })
    return {
      allowed: false,
      requiresReauth: true,
    }
  }
}

/**
 * Middleware helper to enforce session timeout
 *
 * Usage in API routes:
 * ```typescript
 * import { requireValidSession } from '@/lib/auth/session-validation'
 *
 * export async function POST(request: NextRequest) {
 *   const validation = await requireValidSession()
 *   if (!validation.valid) {
 *     return NextResponse.json(
 *       { error: validation.error?.message },
 *       { status: 401 }
 *     )
 *   }
 *   const userId = validation.userId
 *   // ... rest of handler
 * }
 * ```
 */
export async function requireValidSession(
  config: SessionTimeoutConfig = DEFAULT_SESSION_TIMEOUT
): Promise<SessionValidationResult> {
  return await validateSessionTimeout(config)
}

/**
 * Middleware helper for sensitive operations
 *
 * Usage in API routes for payouts, loan approvals, etc.:
 * ```typescript
 * import { requireRecentAuth } from '@/lib/auth/session-validation'
 *
 * export async function POST(request: NextRequest) {
 *   const { allowed, userId } = await requireRecentAuth()
 *   if (!allowed) {
 *     return NextResponse.json(
 *       { error: 'This action requires re-authentication. Please log in again.' },
 *       { status: 403 }
 *     )
 *   }
 *   // ... process sensitive operation
 * }
 * ```
 */
export async function requireRecentAuth(
  config: SessionTimeoutConfig = SENSITIVE_SESSION_TIMEOUT
): Promise<{
  allowed: boolean
  userId?: string
  requiresReauth: boolean
  error?: { code: ErrorCode; message: string }
}> {
  // First validate basic session
  const sessionValidation = await validateSessionTimeout(DEFAULT_SESSION_TIMEOUT)

  if (!sessionValidation.valid) {
    return {
      allowed: false,
      requiresReauth: true,
      error: sessionValidation.error,
    }
  }

  // Then check sensitive operation timeout
  const sensitiveCheck = await canPerformSensitiveOperation(sessionValidation.userId!, config)

  if (!sensitiveCheck.allowed) {
    return {
      allowed: false,
      userId: sessionValidation.userId,
      requiresReauth: true,
      error: {
        code: ErrorCode.AUTH_2FA_REQUIRED,
        message: 'Re-authentication required for this operation',
      },
    }
  }

  return {
    allowed: true,
    userId: sessionValidation.userId,
    requiresReauth: false,
  }
}

/**
 * Get session info for client (for countdown/warning UI)
 */
export async function getSessionInfo(): Promise<{
  valid: boolean
  timeUntilExpiry?: number
  expiresAt?: string
  sessionAge?: number
  idleTime?: number
} | null> {
  const validation = await validateSessionTimeout()

  if (!validation.valid) {
    return {
      valid: false,
    }
  }

  const timeUntilAbsoluteExpiry = DEFAULT_SESSION_TIMEOUT.absoluteTimeoutMs - (validation.sessionAge || 0)
  const timeUntilIdleExpiry = DEFAULT_SESSION_TIMEOUT.idleTimeoutMs - (validation.idleTime || 0)
  const timeUntilExpiry = Math.min(timeUntilAbsoluteExpiry, timeUntilIdleExpiry)

  return {
    valid: true,
    timeUntilExpiry,
    expiresAt: new Date(Date.now() + timeUntilExpiry).toISOString(),
    sessionAge: validation.sessionAge,
    idleTime: validation.idleTime,
  }
}
