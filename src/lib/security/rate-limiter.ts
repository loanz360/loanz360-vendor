import { createSupabaseClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  lockoutDurationMs: number
}

interface RateLimitResult {
  success: boolean
  remainingAttempts: number
  lockoutExpiresAt: Date | null
  message: string
}

// ✅ SECURITY FIX HIGH-07: Proper TypeScript types instead of 'as any'
interface AccountLockout {
  id?: string
  identifier: string
  type: string
  expires_at: string
  created_at: string
}

interface RateLimitAttempt {
  id?: string
  identifier: string
  type: string
  successful: boolean
  created_at: string
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDurationMs: 30 * 60 * 1000 // 30 minutes
  },
  password_reset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutDurationMs: 60 * 60 * 1000 // 1 hour
  },
  otp_verification: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    lockoutDurationMs: 30 * 60 * 1000 // 30 minutes
  }
}

export class RateLimiter {
  private config: RateLimitConfig
  private type: string

  constructor(type: keyof typeof DEFAULT_CONFIGS) {
    this.type = type
    this.config = DEFAULT_CONFIGS[type]
  }

  async checkRateLimit(identifier: string): Promise<RateLimitResult> {
    try {
      const supabaseClient = createSupabaseClient()
      const now = new Date()
      const windowStart = new Date(now.getTime() - this.config.windowMs)

      // Check current attempts in the time window
      const { data: attempts, error } = await supabaseClient
        .from('rate_limit_attempts')
        .select('*')
        .eq('identifier', identifier)
        .eq('type', this.type)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Rate limit check error', error as Error, { identifier, type: this.type })
        // Allow request if we can't check rate limit
        return {
          success: true,
          remainingAttempts: this.config.maxAttempts,
          lockoutExpiresAt: null,
          message: 'Rate limit check failed, allowing request'
        }
      }

      const currentAttempts = attempts?.length || 0

      // Check if user is currently locked out
      const lockoutClient = createSupabaseClient()
      const { data: lockout, error: lockoutError } = await lockoutClient
        .from('account_lockouts')
        .select('*')
        .eq('identifier', identifier)
        .eq('type', this.type)
        .gt('expires_at', now.toISOString())
        .maybeSingle()

      if (!lockoutError && lockout) {
        // ✅ SECURITY FIX HIGH-07: Proper TypeScript type instead of 'as any'
        const lockoutData = lockout as AccountLockout
        return {
          success: false,
          remainingAttempts: 0,
          lockoutExpiresAt: new Date(lockoutData.expires_at),
          message: `Account locked due to too many failed attempts. Try again after ${new Date(lockoutData.expires_at).toLocaleString()}`
        }
      }

      // Check if max attempts reached
      if (currentAttempts >= this.config.maxAttempts) {
        // Create lockout
        const lockoutExpiresAt = new Date(now.getTime() + this.config.lockoutDurationMs)

        // ✅ SECURITY FIX HIGH-07: Proper TypeScript type instead of 'as any'
        const newLockout: Omit<AccountLockout, 'id'> = {
          identifier,
          type: this.type,
          expires_at: lockoutExpiresAt.toISOString(),
          created_at: now.toISOString()
        }

        const insertClient = createSupabaseClient()
        await insertClient
          .from('account_lockouts')
          .insert(newLockout as never)

        return {
          success: false,
          remainingAttempts: 0,
          lockoutExpiresAt,
          message: `Too many failed attempts. Account locked for ${this.config.lockoutDurationMs / (60 * 1000)} minutes`
        }
      }

      return {
        success: true,
        remainingAttempts: this.config.maxAttempts - currentAttempts,
        lockoutExpiresAt: null,
        message: 'Request allowed'
      }

    } catch (error) {
      logger.error('Rate limiter error', error as Error, { identifier, type: this.type })
      // Allow request on error to prevent service disruption
      return {
        success: true,
        remainingAttempts: this.config.maxAttempts,
        lockoutExpiresAt: null,
        message: 'Rate limiter error, allowing request'
      }
    }
  }

  async recordAttempt(identifier: string, successful: boolean = false): Promise<void> {
    try {
      const now = new Date()

      // Record the attempt
      // ✅ SECURITY FIX HIGH-07: Proper TypeScript type instead of 'as any'
      const newAttempt: Omit<RateLimitAttempt, 'id'> = {
        identifier,
        type: this.type,
        successful,
        created_at: now.toISOString()
      }

      const supabaseClient = createSupabaseClient()
      await supabaseClient
        .from('rate_limit_attempts')
        .insert(newAttempt as never)

      // If successful, clear any existing lockouts
      if (successful) {
        const clearClient = createSupabaseClient()
        await clearClient
          .from('account_lockouts')
          .delete()
          .eq('identifier', identifier)
          .eq('type', this.type)
      }

      // Clean up old attempts (keep only last 24 hours)
      const cleanupTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const cleanupClient = createSupabaseClient()
      await cleanupClient
        .from('rate_limit_attempts')
        .delete()
        .lt('created_at', cleanupTime.toISOString())

      // Clean up expired lockouts
      const lockoutCleanupClient = createSupabaseClient()
      await lockoutCleanupClient
        .from('account_lockouts')
        .delete()
        .lt('expires_at', now.toISOString())

    } catch (error) {
      logger.error('Error recording rate limit attempt', error as Error, { identifier, type: this.type, successful })
    }
  }

  async clearAttempts(identifier: string): Promise<void> {
    try {
      const supabaseClient = createSupabaseClient()
      await supabaseClient
        .from('rate_limit_attempts')
        .delete()
        .eq('identifier', identifier)
        .eq('type', this.type)

      const lockoutClient = createSupabaseClient()
      await lockoutClient
        .from('account_lockouts')
        .delete()
        .eq('identifier', identifier)
        .eq('type', this.type)

    } catch (error) {
      logger.error('Error clearing rate limit attempts', error as Error, { identifier, type: this.type })
    }
  }
}

// Convenience functions for common use cases
export const loginRateLimiter = new RateLimiter('login')
export const passwordResetRateLimiter = new RateLimiter('password_reset')
export const otpRateLimiter = new RateLimiter('otp_verification')

// IP-based rate limiting for additional security
export class IPRateLimiter {
  private static instances: Map<string, IPRateLimiter> = new Map()
  private attempts: Map<string, { count: number; resetTime: number }> = new Map()
  private maxAttempts: number
  private windowMs: number

  constructor(maxAttempts: number = 100, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  static getInstance(key: string = 'default'): IPRateLimiter {
    if (!this.instances.has(key)) {
      this.instances.set(key, new IPRateLimiter())
    }
    return this.instances.get(key)!
  }

  checkIPRateLimit(ip: string): { allowed: boolean; remainingAttempts: number } {
    const now = Date.now()
    const attemptData = this.attempts.get(ip)

    if (!attemptData || now > attemptData.resetTime) {
      // Reset window
      this.attempts.set(ip, { count: 1, resetTime: now + this.windowMs })
      return { allowed: true, remainingAttempts: this.maxAttempts - 1 }
    }

    if (attemptData.count >= this.maxAttempts) {
      return { allowed: false, remainingAttempts: 0 }
    }

    attemptData.count++
    return { allowed: true, remainingAttempts: this.maxAttempts - attemptData.count }
  }

  recordIPAttempt(ip: string): void {
    const now = Date.now()
    const attemptData = this.attempts.get(ip)

    if (!attemptData || now > attemptData.resetTime) {
      this.attempts.set(ip, { count: 1, resetTime: now + this.windowMs })
    } else {
      attemptData.count++
    }
  }

  clearIPAttempts(ip: string): void {
    this.attempts.delete(ip)
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [ip, data] of this.attempts.entries()) {
      if (now > data.resetTime) {
        this.attempts.delete(ip)
      }
    }
  }
}

export const globalIPRateLimiter = IPRateLimiter.getInstance('global')