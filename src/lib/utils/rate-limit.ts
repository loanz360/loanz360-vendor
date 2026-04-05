/**
 * Rate Limiting Utility - Enterprise-grade API Protection
 *
 * Implements sliding window rate limiting for API endpoints
 * to prevent abuse and ensure fair usage
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000 // 1 minute
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetAt) {
        rateLimitStore.delete(key)
      }
    }
    lastCleanup = now
  }
}

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
  keyGenerator?: (req: NextRequest) => string // Custom key generator
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter?: number
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // Standard API endpoints
  standard: {
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  // Write operations (POST, PUT, DELETE)
  write: {
    windowMs: 60000, // 1 minute
    maxRequests: 30, // 30 writes per minute
  },
  // EMI calculation endpoints (more lenient for calculator usage)
  emiCalculation: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 calculations per minute
  },
  // Sensitive operations (sharing, follow-ups)
  sensitive: {
    windowMs: 60000, // 1 minute
    maxRequests: 20, // 20 sensitive operations per minute
  },
  // Statistics endpoints
  stats: {
    windowMs: 60000, // 1 minute
    maxRequests: 30, // 30 stats requests per minute
  },
  // Strict rate limiting (for abuse prevention)
  strict: {
    windowMs: 60000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  },
}

/**
 * Generate rate limit key from request
 */
function defaultKeyGenerator(req: NextRequest): string {
  // Try to get user ID from auth header or session
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    // Use a hash of the auth token
    return `auth:${hashString(authHeader)}`
  }

  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `ip:${ip}`
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard
): RateLimitResult {
  cleanupExpiredEntries()

  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
  } = config

  const key = keyGenerator(req)
  const endpoint = req.nextUrl.pathname
  const fullKey = `${key}:${endpoint}`

  const now = Date.now()
  const record = rateLimitStore.get(fullKey)

  if (!record || now > record.resetAt) {
    // Start new window
    rateLimitStore.set(fullKey, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  // Check if limit exceeded
  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfter,
    }
  }

  // Increment count
  record.count++
  rateLimitStore.set(fullKey, record)

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  }
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(
  handler: (req: NextRequest, context?: unknown) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard
) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    const result = checkRateLimit(req, config)

    if (!result.success) {
      return NextResponse.json(
        {
          error: config.message || 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toString(),
            'Retry-After': result.retryAfter?.toString() || '60',
          },
        }
      )
    }

    // Call the actual handler
    const response = await handler(req, context)

    // Add rate limit headers to response
    const headers = new Headers(response.headers)
    headers.set('X-RateLimit-Limit', result.limit.toString())
    headers.set('X-RateLimit-Remaining', result.remaining.toString())
    headers.set('X-RateLimit-Reset', result.resetAt.toString())

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/**
 * Create a rate limited handler with custom config
 */
export function createRateLimitedHandler(
  config: Partial<RateLimitConfig> = {}
) {
  const finalConfig = {
    ...RATE_LIMIT_CONFIGS.standard,
    ...config,
  }

  return <T extends (req: NextRequest, context?: unknown) => Promise<NextResponse>>(
    handler: T
  ) => withRateLimit(handler, finalConfig)
}

/**
 * Decorators for common rate limit scenarios
 */
export const rateLimitDecorators = {
  standard: createRateLimitedHandler(RATE_LIMIT_CONFIGS.standard),
  write: createRateLimitedHandler(RATE_LIMIT_CONFIGS.write),
  emiCalculation: createRateLimitedHandler(RATE_LIMIT_CONFIGS.emiCalculation),
  sensitive: createRateLimitedHandler(RATE_LIMIT_CONFIGS.sensitive),
  stats: createRateLimitedHandler(RATE_LIMIT_CONFIGS.stats),
  strict: createRateLimitedHandler(RATE_LIMIT_CONFIGS.strict),
}

/**
 * Helper to add rate limit headers manually
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
  return response
}

/**
 * Check if request is from a trusted source (bypass rate limiting)
 */
export function isTrustedSource(req: NextRequest): boolean {
  // Check for internal API key
  const apiKey = req.headers.get('x-api-key')
  if (apiKey === process.env.INTERNAL_API_KEY) {
    return true
  }

  // Check for admin user (you can add more sophisticated checks)
  const isAdmin = req.headers.get('x-user-role') === 'admin'
  if (isAdmin) {
    return true
  }

  return false
}

/**
 * Rate limiter with bypass for trusted sources
 */
export function withTrustedBypass(
  handler: (req: NextRequest, context?: unknown) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard
) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    // Skip rate limiting for trusted sources
    if (isTrustedSource(req)) {
      return handler(req, context)
    }

    return withRateLimit(handler, config)(req, context)
  }
}
