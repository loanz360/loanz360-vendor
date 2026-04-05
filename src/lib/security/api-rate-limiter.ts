/**
 * API Rate Limiting
 *
 * Comprehensive rate limiting for all API endpoints
 * Prevents DoS attacks, brute force attempts, and resource exhaustion
 *
 * SECURITY: Multi-tier rate limiting (per-IP, per-user, per-endpoint)
 * COMPLIANCE: OWASP API Security Top 10
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import type { NextRequest } from 'next/server'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  message?: string
  skipSuccessfulRequests?: boolean
  keyGenerator?: (request: NextRequest) => Promise<string>
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

/**
 * Rate limit tiers for different endpoint types
 */
export const RATE_LIMIT_TIERS = {
  // Authentication endpoints (stricter)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  },

  // Read operations (moderate)
  READ: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },

  // Write operations (stricter)
  WRITE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many write requests. Please slow down.',
  },

  // File uploads (very strict)
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many file uploads. Please try again later.',
  },

  // Public API (strict)
  PUBLIC: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Rate limit exceeded. Please try again later.',
  },

  // Admin operations (less strict but monitored)
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    message: 'Too many admin requests.',
  },
} as const

/**
 * Get client identifier (IP + User Agent hash)
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

  const userAgent = request.headers.get('user-agent') || 'unknown'

  // Create unique identifier combining IP and UA hash
  const hash = Buffer.from(userAgent).toString('base64').slice(0, 10)

  return `${ip}_${hash}`
}

/**
 * Check rate limit using database
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = await createClient()

  // Generate unique key for this request
  const key = config.keyGenerator
    ? await config.keyGenerator(request)
    : getClientIdentifier(request)

  const endpoint = new URL(request.url).pathname
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  try {
    // Get or create rate limit record
    const { data: existing, error } = await supabase
      .from('rate_limit_attempts')
      .select('*')
      .eq('ip_address', key)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString())
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // Error other than "no rows returned"
      logger.error('Rate limit check failed', { error, key, endpoint })

      // Fail open (allow request) but log the error
      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        reset: new Date(now.getTime() + config.windowMs),
      }
    }

    // Calculate reset time
    const resetTime = existing
      ? new Date(new Date(existing.window_start).getTime() + config.windowMs)
      : new Date(now.getTime() + config.windowMs)

    if (existing) {
      // Update existing record
      const newCount = existing.attempt_count + 1

      if (newCount > config.maxRequests) {
        // Rate limit exceeded
        logger.warn('Rate limit exceeded', {
          key,
          endpoint,
          attempts: newCount,
          limit: config.maxRequests,
        })

        // Update counter
        await supabase
          .from('rate_limit_attempts')
          .update({
            attempt_count: newCount,
            last_attempt_at: now.toISOString(),
          })
          .eq('id', existing.id)

        // Check if should block
        if (newCount >= config.maxRequests * 2) {
          // Excessive attempts - add to blocks table
          await supabase.from('rate_limit_blocks').insert({
            ip_address: key,
            endpoint,
            block_type: 'RATE_LIMIT',
            blocked_until: new Date(now.getTime() + config.windowMs * 2).toISOString(),
            block_reason: 'Excessive requests',
            attempt_count: newCount,
          })
        }

        return {
          success: false,
          limit: config.maxRequests,
          remaining: 0,
          reset: resetTime,
          retryAfter: Math.ceil((resetTime.getTime() - now.getTime()) / 1000),
        }
      }

      // Update counter
      await supabase
        .from('rate_limit_attempts')
        .update({
          attempt_count: newCount,
          last_attempt_at: now.toISOString(),
        })
        .eq('id', existing.id)

      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - newCount,
        reset: resetTime,
      }
    } else {
      // Create new record
      await supabase.from('rate_limit_attempts').insert({
        ip_address: key,
        endpoint,
        attempt_count: 1,
        first_attempt_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
        window_start: now.toISOString(),
      })

      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        reset: resetTime,
      }
    }
  } catch (error) {
    logger.error('Rate limit error', { error, key, endpoint })

    // Fail open but log
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: new Date(now.getTime() + config.windowMs),
    }
  }
}

/**
 * Check if IP/user is blocked
 */
export async function isBlocked(request: NextRequest): Promise<boolean> {
  const supabase = await createClient()
  const key = getClientIdentifier(request)
  const now = new Date()

  const { data } = await supabase
    .from('rate_limit_blocks')
    .select('*')
    .eq('ip_address', key)
    .gte('blocked_until', now.toISOString())
    .limit(1)
    .maybeSingle()

  return !!data
}

/**
 * Apply rate limiting to API route
 * Usage in API route:
 *
 * export async function GET(request: NextRequest) {
 *   const rateLimit = await applyRateLimit(request, RATE_LIMIT_TIERS.READ)
 *   if (!rateLimit.success) {
 *     return NextResponse.json(
 *       { error: 'Rate limit exceeded' },
 *       { status: 429, headers: rateLimit.headers }
 *     )
 *   }
 *   // ... rest of handler
 * }
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{
  success: boolean
  headers: Record<string, string>
  retryAfter?: number
}> {
  // Check if blocked first
  if (await isBlocked(request)) {
    logger.warn('Blocked IP attempted request', {
      ip: getClientIdentifier(request),
      endpoint: new URL(request.url).pathname,
    })

    return {
      success: false,
      headers: {
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'Retry-After': '3600', // 1 hour
      },
      retryAfter: 3600,
    }
  }

  const result = await checkRateLimit(request, config)

  const headers = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toISOString(),
  }

  if (!result.success && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  return {
    success: result.success,
    headers,
    retryAfter: result.retryAfter,
  }
}

/**
 * Rate limit decorator for API routes
 */
export function withRateLimit(tier: keyof typeof RATE_LIMIT_TIERS) {
  return function (handler: (request: NextRequest) => Promise<Response>) {
    return async function (request: NextRequest): Promise<Response> {
      const rateLimit = await applyRateLimit(request, RATE_LIMIT_TIERS[tier])

      if (!rateLimit.success) {
        return new Response(
          JSON.stringify({
            error: RATE_LIMIT_TIERS[tier].message,
            retryAfter: rateLimit.retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...rateLimit.headers,
            },
          }
        )
      }

      const response = await handler(request)

      // Add rate limit headers to successful response
      Object.entries(rateLimit.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }
  }
}
