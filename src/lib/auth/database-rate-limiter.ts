/**
 * Database-backed Rate Limiter
 * Fortune 500 Enterprise Standard - Works across serverless instances
 *
 * SECURITY: Uses database for distributed rate limiting
 * This ensures rate limits work correctly in serverless environments
 * where in-memory stores don't persist across invocations
 *
 * Features:
 * - Distributed rate limiting across all instances
 * - Failed attempt tracking
 * - IP-based and user-based limits
 * - Sliding window algorithm
 * - Automatic cleanup of old entries
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number | null
  total: number
}

export interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockDurationMs?: number
}

/**
 * Check rate limit for a given identifier and endpoint
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  maxAttempts: number = 100,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  try {
    const supabase = createSupabaseAdmin()
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowMs)

    // Clean up old entries first (async, don't wait)
    cleanupOldEntries(supabase, endpoint, windowMs).catch(() => { /* Rate limit cleanup is best-effort */ })

    // Count attempts in current window
    const { count, error } = await supabase
      .from('rate_limit_entries')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart.toISOString())

    if (error) {
      console.error('Rate limit check error:', error)
      // On error, allow the request but log it
      return { allowed: true, remaining: maxAttempts, resetAt: null, total: 0 }
    }

    const currentCount = count || 0
    const remaining = Math.max(0, maxAttempts - currentCount)
    const allowed = currentCount < maxAttempts

    // Record this attempt
    if (allowed) {
      await supabase
        .from('rate_limit_entries')
        .insert({
          identifier,
          endpoint,
          created_at: now.toISOString()
        })
        .catch(() => { /* Rate limit cleanup is best-effort */ })
    }

    return {
      allowed,
      remaining,
      resetAt: allowed ? null : now.getTime() + windowMs,
      total: currentCount
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // On error, allow the request
    return { allowed: true, remaining: maxAttempts, resetAt: null, total: 0 }
  }
}

/**
 * Record a failed authentication attempt
 */
export async function recordFailedAttempt(
  identifier: string,
  endpoint: string,
  targetAccount?: string,
  userAgent?: string
): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()

    await supabase
      .from('failed_auth_attempts')
      .insert({
        identifier,
        endpoint,
        target_account: targetAccount,
        user_agent: userAgent?.slice(0, 500),
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to record failed attempt:', error)
  }
}

/**
 * Clear failed attempts for a given identifier and endpoint
 * Called after successful authentication to reset the counter
 */
export async function clearFailedAttempts(
  identifier: string,
  endpoint: string
): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()

    await supabase
      .from('failed_auth_attempts')
      .delete()
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
  } catch (error) {
    console.error('Failed to clear failed attempts:', error)
  }
}

/**
 * Check if an IP is blocked due to too many failed attempts
 */
export async function isIPBlocked(
  ip: string,
  maxFailedAttempts: number = 10,
  blockDurationMs: number = 3600000 // 1 hour
): Promise<{ blocked: boolean; unblockAt?: Date }> {
  try {
    const supabase = createSupabaseAdmin()
    const windowStart = new Date(Date.now() - blockDurationMs)

    const { count } = await supabase
      .from('failed_auth_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', ip)
      .gte('created_at', windowStart.toISOString())

    const failedCount = count || 0
    const blocked = failedCount >= maxFailedAttempts

    return {
      blocked,
      unblockAt: blocked ? new Date(Date.now() + blockDurationMs) : undefined
    }
  } catch (error) {
    console.error('IP block check error:', error)
    return { blocked: false }
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
  }

  if (result.resetAt) {
    headers['X-RateLimit-Reset'] = Math.ceil(result.resetAt / 1000).toString()
    headers['Retry-After'] = Math.ceil((result.resetAt - Date.now()) / 1000).toString()
  }

  return headers
}

/**
 * Clean up old rate limit entries
 */
async function cleanupOldEntries(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  endpoint: string,
  windowMs: number
): Promise<void> {
  const cutoff = new Date(Date.now() - windowMs * 2)

  await supabase
    .from('rate_limit_entries')
    .delete()
    .eq('endpoint', endpoint)
    .lt('created_at', cutoff.toISOString())
}

/**
 * Advanced rate limiter with multiple strategies
 */
export class AdvancedRateLimiter {
  private supabase: ReturnType<typeof createSupabaseAdmin>

  constructor() {
    this.supabase = createSupabaseAdmin()
  }

  /**
   * Token bucket rate limiting
   */
  async checkTokenBucket(
    identifier: string,
    endpoint: string,
    config: {
      bucketSize: number
      refillRate: number // tokens per second
      tokensRequired?: number
    }
  ): Promise<RateLimitResult> {
    const { bucketSize, refillRate, tokensRequired = 1 } = config
    const now = Date.now()

    try {
      // Get or create bucket
      const { data: bucket } = await this.supabase
        .from('token_buckets')
        .select('*')
        .eq('identifier', identifier)
        .eq('endpoint', endpoint)
        .maybeSingle()

      let tokens: number
      let lastRefill: number

      if (bucket) {
        // Calculate tokens to add based on time elapsed
        const elapsed = (now - new Date(bucket.last_refill).getTime()) / 1000
        const tokensToAdd = elapsed * refillRate
        tokens = Math.min(bucketSize, bucket.tokens + tokensToAdd)
        lastRefill = now
      } else {
        tokens = bucketSize
        lastRefill = now
      }

      // Check if we have enough tokens
      if (tokens >= tokensRequired) {
        // Consume tokens
        const newTokens = tokens - tokensRequired

        await this.supabase
          .from('token_buckets')
          .upsert({
            identifier,
            endpoint,
            tokens: newTokens,
            last_refill: new Date(lastRefill).toISOString()
          })

        return {
          allowed: true,
          remaining: Math.floor(newTokens),
          resetAt: null,
          total: bucketSize - Math.floor(newTokens)
        }
      } else {
        // Calculate when we'll have enough tokens
        const tokensNeeded = tokensRequired - tokens
        const waitTime = (tokensNeeded / refillRate) * 1000

        return {
          allowed: false,
          remaining: 0,
          resetAt: now + waitTime,
          total: bucketSize
        }
      }
    } catch (error) {
      console.error('Token bucket error:', error)
      return { allowed: true, remaining: 1, resetAt: null, total: 0 }
    }
  }

  /**
   * Sliding window log rate limiting (most accurate)
   */
  async checkSlidingWindow(
    identifier: string,
    endpoint: string,
    config: {
      maxRequests: number
      windowMs: number
    }
  ): Promise<RateLimitResult> {
    return checkRateLimit(identifier, endpoint, config.maxRequests, config.windowMs)
  }
}

/**
 * Endpoint-specific rate limit configurations
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - strict limits
  '/api/customer/login-password': { maxAttempts: 5, windowMs: 900000, blockDurationMs: 1800000 },
  '/api/customer/login-otp': { maxAttempts: 5, windowMs: 900000, blockDurationMs: 1800000 },
  '/api/customer/register': { maxAttempts: 3, windowMs: 3600000 },
  '/api/customer/forgot-password': { maxAttempts: 3, windowMs: 3600000 },
  '/api/auth/login': { maxAttempts: 5, windowMs: 900000, blockDurationMs: 1800000 },
  '/api/superadmin/auth/simple-login': { maxAttempts: 3, windowMs: 900000, blockDurationMs: 3600000 },

  // OTP endpoints - moderate limits
  '/api/customer/send-otp': { maxAttempts: 5, windowMs: 300000 },
  '/api/customer/verify-otp': { maxAttempts: 5, windowMs: 300000 },

  // General API endpoints - relaxed limits
  '/api/default': { maxAttempts: 100, windowMs: 60000 },

  // Public endpoints - very strict
  '/api/public/loan-application-form': { maxAttempts: 10, windowMs: 3600000 },
}

/**
 * Get rate limit config for an endpoint
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS['/api/default']
}
