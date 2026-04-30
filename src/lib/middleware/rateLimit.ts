import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  limit: number // Maximum requests allowed
  window: number // Time window in seconds
}

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  DEFAULT: { limit: 100, window: 60 }, // 100 requests per minute
  AUTH: { limit: 10, window: 60 }, // 10 auth requests per minute
  UPLOAD: { limit: 20, window: 60 }, // 20 file uploads per minute
  ANALYTICS: { limit: 50, window: 60 }, // 50 analytics requests per minute
  CREATE: { limit: 30, window: 60 }, // 30 create operations per minute

  // Notification-specific rate limits
  NOTIFICATION_SEND_HR: { limit: 10, window: 3600 },
  NOTIFICATION_SEND_ADMIN: { limit: 100, window: 3600 },
  NOTIFICATION_EMAIL: { limit: 50, window: 3600 },
  NOTIFICATION_SMS: { limit: 20, window: 3600 },
  NOTIFICATION_READ: { limit: 200, window: 60 },

  // CAE-specific rate limits
  READ: { limit: 100, window: 60 },
  WRITE: { limit: 20, window: 60 },
  CAE_PROCESS: { limit: 30, window: 60 },
  CAE_HEALTH: { limit: 100, window: 60 },
  CAE_HEALTH_MANUAL: { limit: 20, window: 60 },
  CAE_CAM_GENERATE: { limit: 20, window: 60 },
  CAE_CAM_EXPORT: { limit: 10, window: 60 },
  CAE_RETRY: { limit: 10, window: 60 },
  CAE_PROVIDER_CALL: { limit: 1000, window: 86400 },
}

// ─── Upstash Redis Rate Limiter (distributed, production-safe) ───────────────
// Falls back to in-memory if UPSTASH env vars are not set (dev mode)

async function getUpstashLimiter(config: RateLimitConfig) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const { Redis } = await import('@upstash/redis')

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })

      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.limit, `${config.window} s`),
        analytics: true,
        prefix: 'rl',
      })
    } catch {
      // Fall through to in-memory
    }
  }
  return null
}

// ─── In-memory fallback (development only) ───────────────────────────────────

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

// Clean up old entries periodically (only in long-lived processes)
if (typeof setInterval !== 'undefined') {
  try {
    setInterval(() => {
      const now = Date.now()
      Object.keys(store).forEach((key) => {
        if (store[key].resetTime < now) {
          delete store[key]
        }
      })
    }, 5 * 60 * 1000)
  } catch {
    // Edge runtime doesn't support setInterval - that's fine
  }
}

function inMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const windowMs = config.window * 1000

  let entry = store[key]

  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs }
    store[key] = entry
  }

  entry.count++

  return {
    allowed: entry.count <= config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetTime: entry.resetTime,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Distributed rate limiting middleware
 * Uses Upstash Redis in production, falls back to in-memory in development
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.DEFAULT
): Promise<NextResponse | null> {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      request.headers.get('cf-connecting-ip')?.trim() ||
      'unknown'

    const path = new URL(request.url).pathname
    const key = `${ip}:${path}`

    // Try Upstash Redis first (distributed, production-safe)
    const limiter = await getUpstashLimiter(config)

    if (limiter) {
      const result = await limiter.limit(key)

      if (!result.success) {
        const resetIn = Math.ceil((result.reset - Date.now()) / 1000)
        console.warn(`[RATE_LIMIT] Exceeded for ${ip} on ${path} (Redis)`)

        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
            limit: result.limit,
            remaining: 0,
            resetIn,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': result.limit.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.reset.toString(),
              'Retry-After': resetIn.toString(),
            },
          }
        )
      }

      ;(request as unknown).rateLimitHeaders = {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
      }

      return null
    }

    // Fallback: In-memory rate limiting (development / no Redis)
    const result = inMemoryRateLimit(key, config)

    if (!result.allowed) {
      const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000)
      console.warn(`[RATE_LIMIT] Exceeded for ${ip} on ${path} (in-memory)`)

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
          limit: config.limit,
          remaining: 0,
          resetIn,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': resetIn.toString(),
          },
        }
      )
    }

    ;(request as unknown).rateLimitHeaders = {
      'X-RateLimit-Limit': config.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
    }

    return null
  } catch (error) {
    console.error('Rate limit error:', error)
    // Don't block requests if rate limiting fails
    return null
  }
}

/**
 * Helper to add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const headers = (request as unknown).rateLimitHeaders
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value as string)
    })
  }
  return response
}

/**
 * Clear rate limit for specific client (admin only)
 */
export function clearRateLimit(ip: string, path?: string) {
  if (path) {
    delete store[`${ip}:${path}`]
  } else {
    Object.keys(store).forEach((key) => {
      if (key.startsWith(`${ip}:`)) {
        delete store[key]
      }
    })
  }
}
