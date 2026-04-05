/**
 * Secure Logger for Authentication Events
 * Replaces console.log with sanitized, production-safe logging
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export interface SecureLogEntry {
  level: LogLevel
  event: string
  userId?: string
  sessionId?: string
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  timestamp: string
}

class SecureLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private logQueue: SecureLogEntry[] = []
  private readonly maxQueueSize = 100
  private flushInterval: NodeJS.Timeout | null = null

  constructor() {
    // Auto-flush logs every 5 seconds in production
    if (!this.isDevelopment && typeof setInterval !== 'undefined') {
      this.flushInterval = setInterval(() => {
        this.flush()
      }, 5000)
    }
  }

  /**
   * Sanitize sensitive data before logging
   */
  private sanitize(data: unknown): unknown {
    if (!data) return data

    if (typeof data === 'string') {
      // Redact tokens, passwords, secrets
      return this.redactSensitiveStrings(data)
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> | unknown[] = Array.isArray(data) ? [] : {}

      for (const [key, value] of Object.entries(data)) {
        // Completely remove sensitive fields
        if (this.isSensitiveField(key)) {
          (sanitized as Record<string, unknown>)[key] = '[REDACTED]'
        } else if (typeof value === 'object') {
          (sanitized as Record<string, unknown>)[key] = this.sanitize(value)
        } else if (typeof value === 'string') {
          (sanitized as Record<string, unknown>)[key] = this.redactSensitiveStrings(value)
        } else {
          (sanitized as Record<string, unknown>)[key] = value
        }
      }

      return sanitized
    }

    return data
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apikey',
      'api_key',
      'authorization',
      'cookie',
      'csrf',
      'session',
      'refresh_token',
      'access_token',
      'sessiontoken',
      'authtoken',
      'privatekey',
      'private_key'
    ]

    return sensitiveFields.some(field =>
      fieldName.toLowerCase().includes(field)
    )
  }

  /**
   * Redact sensitive patterns in strings
   */
  private redactSensitiveStrings(str: string): string {
    // Redact JWT tokens
    str = str.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')

    // Redact bearer tokens
    str = str.replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer [REDACTED]')

    // Redact email addresses (keep domain for debugging)
    str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[EMAIL]@$2')

    // Redact what looks like passwords (common patterns)
    str = str.replace(/password["\s:=]+[^\s"'}]+/gi, 'password=[REDACTED]')

    // Redact long base64 strings (likely tokens)
    str = str.replace(/[A-Za-z0-9+/]{32,}={0,2}/g, '[BASE64_REDACTED]')

    return str
  }

  /**
   * Log authentication event
   */
  async log(entry: Omit<SecureLogEntry, 'timestamp'>) {
    const logEntry: SecureLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      details: this.sanitize(entry.details) as Record<string, unknown> | undefined
    }

    // In development, log to console (sanitized)
    if (this.isDevelopment) {
      const emoji = this.getEmoji(entry.level)
      console.log(`${emoji} [${entry.level.toUpperCase()}] ${entry.event}`, {
        userId: entry.userId ? `user_${entry.userId.substring(0, 8)}...` : undefined,
        sessionId: entry.sessionId ? `session_${entry.sessionId.substring(0, 8)}...` : undefined,
        ip: entry.ip,
        details: logEntry.details
      })
    }

    // Add to queue for database storage
    this.logQueue.push(logEntry)

    // Flush if queue is getting full
    if (this.logQueue.length >= this.maxQueueSize) {
      await this.flush()
    }

    // For critical errors, flush immediately
    if (entry.level === 'critical' || entry.level === 'error') {
      await this.flush()
    }
  }

  /**
   * Get emoji for log level (development only)
   */
  private getEmoji(level: LogLevel): string {
    const emojis = {
      debug: '🔍',
      info: '📝',
      warn: '⚠️',
      error: '❌',
      critical: '🚨'
    }
    return emojis[level] || '📋'
  }

  /**
   * Flush log queue to database
   */
  private async flush() {
    if (this.logQueue.length === 0) return

    const logsToFlush = [...this.logQueue]
    this.logQueue = []

    // TEMPORARY FIX: Skip database logging to prevent login failures
    // Just log to console for now
    try {
      if (this.isDevelopment) {
        console.log('[Auth Logs] Flushed', logsToFlush.length, 'entries')
      }
      // TODO: Re-enable database logging once root cause is fixed
      /*
      const supabaseAdmin = createSupabaseAdmin()
      const { error } = await supabaseAdmin
        .from('auth_logs')
        .insert(
          logsToFlush.map(entry => ({
            level: entry.level,
            event: entry.event,
            user_id: entry.userId,
            session_id: entry.sessionId,
            ip_address: entry.ip,
            user_agent: entry.userAgent,
            details: entry.details,
            created_at: entry.timestamp
          })) as never
        )

      if (error) {
        console.error('Failed to store auth logs:', error)
      }
      */
    } catch (error) {
      // Silently fail - don't block login
      if (this.isDevelopment) {
        console.error('Error flushing auth logs:', error)
      }
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async debug(event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) {
    await this.log({ level: 'debug', event, details, ...context })
  }

  async info(event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) {
    await this.log({ level: 'info', event, details, ...context })
  }

  async warn(event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) {
    await this.log({ level: 'warn', event, details, ...context })
  }

  async error(event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) {
    await this.log({ level: 'error', event, details, ...context })
  }

  async critical(event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) {
    await this.log({ level: 'critical', event, details, ...context })
  }

  /**
   * Cleanup on shutdown
   */
  async destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }
}

// Export singleton instance
export const secureAuthLogger = new SecureLogger()

// Convenience exports
export const logAuthEvent = {
  debug: (event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) =>
    secureAuthLogger.debug(event, details, context),

  info: (event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) =>
    secureAuthLogger.info(event, details, context),

  warn: (event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) =>
    secureAuthLogger.warn(event, details, context),

  error: (event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) =>
    secureAuthLogger.error(event, details, context),

  critical: (event: string, details?: Record<string, unknown>, context?: Partial<SecureLogEntry>) =>
    secureAuthLogger.critical(event, details, context)
}

/**
 * Shorthand for common auth events
 */
export const authEvents = {
  loginAttempt: (userId: string, success: boolean, ip: string, details?: Record<string, unknown>) =>
    secureAuthLogger.info(success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED', details, { userId, ip }),

  logoutSuccess: (userId: string, sessionId: string) =>
    secureAuthLogger.info('LOGOUT_SUCCESS', {}, { userId, sessionId }),

  tokenRevoked: (userId: string, sessionId: string, reason: string) =>
    secureAuthLogger.warn('TOKEN_REVOKED', { reason }, { userId, sessionId }),

  rateLimitExceeded: (ip: string, endpoint: string) =>
    secureAuthLogger.warn('RATE_LIMIT_EXCEEDED', { endpoint }, { ip }),

  csrfValidationFailed: (ip: string, endpoint: string) =>
    secureAuthLogger.warn('CSRF_VALIDATION_FAILED', { endpoint }, { ip }),

  sessionExpired: (userId: string, sessionId: string) =>
    secureAuthLogger.info('SESSION_EXPIRED', {}, { userId, sessionId }),

  passwordResetRequested: (userId: string, ip: string) =>
    secureAuthLogger.info('PASSWORD_RESET_REQUESTED', {}, { userId, ip }),

  accountLocked: (userId: string, reason: string) =>
    secureAuthLogger.critical('ACCOUNT_LOCKED', { reason }, { userId }),

  suspiciousActivity: (userId: string | undefined, details: Record<string, unknown>, ip: string) =>
    secureAuthLogger.critical('SUSPICIOUS_ACTIVITY', details, { userId, ip })
}