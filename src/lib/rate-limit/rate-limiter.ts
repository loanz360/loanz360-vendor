/**
 * RATE LIMITING SYSTEM
 * Enterprise-grade rate limiting for API protection
 *
 * Features:
 * - In-memory rate limiting (no Redis required for small-scale)
 * - Per-user and per-IP limits
 * - Configurable time windows
 * - Rate limit headers in response
 * - Automatic cleanup of old entries
 * - DDoS protection
 */

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key)
      }
    }
  }

  async check(key: string, config: RateLimitConfig): Promise<{
    allowed: boolean
    limit: number
    remaining: number
    resetTime: number
  }> {
    const now = Date.now()
    let entry = this.store.get(key)

    // If no entry or entry expired, create new one
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs
      }
      this.store.set(key, entry)
    }

    // Increment request count
    entry.count++

    const allowed = entry.count <= config.maxRequests

    return {
      allowed,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetTime: entry.resetTime
    }
  }

  reset(key: string): void {
    this.store.delete(key)
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter()

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from auth header or session
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    // Extract user ID from JWT or session
    // This is a simplified version - adjust based on your auth system
    const match = authHeader.match(/user_id=([^;]+)/)
    if (match) return `user:${match[1]}`
  }

  // Fall back to IP address
  return `ip:${getClientIp(request)}`
}

/**
 * Get client IP address
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp

  return 'unknown'
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(
  response: NextResponse,
  result: { limit: number; remaining: number; resetTime: number }
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())
  return response
}

/**
 * Rate limit middleware factory
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    keyGenerator: getClientIdentifier,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    ...config
  }

  return async function rateLimitMiddleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Generate rate limit key
    const key = defaultConfig.keyGenerator!(request)

    // Check rate limit
    const result = await globalRateLimiter.check(key, defaultConfig)

    // If rate limit exceeded
    if (!result.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      )

      addRateLimitHeaders(response, result)
      response.headers.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString())

      return response
    }

    // Execute handler
    let response: NextResponse
    try {
      response = await handler(request)

      // Add rate limit headers to successful response
      addRateLimitHeaders(response, result)
    } catch (error) {
      // If handler throws, still add rate limit headers
      response = NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
      addRateLimitHeaders(response, result)
      throw error
    }

    return response
  }
}

/**
 * Predefined rate limiters for common use cases
 */

// Strict limiter for authentication endpoints (5 requests per 15 minutes)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5
})

// Standard limiter for read operations (60 requests per minute)
export const readRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60
})

// Write limiter for create/update/delete (30 requests per minute)
export const writeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30
})

// Generous limiter for public endpoints (100 requests per minute)
export const publicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100
})

// Very strict limiter for expensive operations (10 requests per hour)
export const expensiveRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10
})

/**
 * Simple rate limit decorator for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config?: Partial<RateLimitConfig>
) {
  const limiter = createRateLimiter(config)
  return (request: NextRequest) => limiter(request, handler)
}

/**
 * IP-based rate limiter (ignores user authentication)
 */
export const ipRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyGenerator: (request) => `ip:${getClientIp(request)}`
})

/**
 * User-based rate limiter (requires authentication)
 */
export const userRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (request) => {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const match = authHeader.match(/user_id=([^;]+)/)
      if (match) return `user:${match[1]}`
    }
    return `ip:${getClientIp(request)}`
  }
})

// Export the global rate limiter for manual control
export { globalRateLimiter }

/**
 * Reset rate limit for a specific key (useful for testing)
 */
export function resetRateLimit(request: NextRequest): void {
  const key = getClientIdentifier(request)
  globalRateLimiter.reset(key)
}

/**
 * Check rate limit without incrementing (useful for monitoring)
 */
export async function checkRateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const key = getClientIdentifier(request)
  const fullConfig: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 60,
    ...config
  }

  // Get current state without incrementing
  const entry = globalRateLimiter['store'].get(key)
  if (!entry) {
    return {
      allowed: true,
      limit: fullConfig.maxRequests,
      remaining: fullConfig.maxRequests
    }
  }

  return {
    allowed: entry.count < fullConfig.maxRequests,
    limit: fullConfig.maxRequests,
    remaining: Math.max(0, fullConfig.maxRequests - entry.count)
  }
}
