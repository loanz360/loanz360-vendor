/**
 * Rate Limiter Middleware
 * Implements token bucket rate limiting for API endpoints
 */

interface RateLimitEntry {
  tokens: number
  lastRefill: number
}

interface RateLimitConfig {
  maxTokens: number      // Maximum tokens in bucket
  refillRate: number     // Tokens per second to add
  windowMs: number       // Time window for cleanup
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Public chatbot APIs - more restrictive
  PUBLIC_CHATBOT: {
    maxTokens: 30,      // 30 requests burst
    refillRate: 1,      // 1 request per second
    windowMs: 60000     // 1 minute window
  },
  // Session creation - very restrictive to prevent abuse
  SESSION_CREATE: {
    maxTokens: 10,      // 10 requests burst
    refillRate: 0.2,    // 1 request per 5 seconds
    windowMs: 60000
  },
  // Message processing - moderate
  MESSAGE: {
    maxTokens: 60,      // 60 requests burst
    refillRate: 2,      // 2 requests per second
    windowMs: 60000
  },
  // Admin APIs - more lenient
  ADMIN: {
    maxTokens: 100,
    refillRate: 5,
    windowMs: 60000
  }
} as const

/**
 * Clean up expired entries from the store
 */
function cleanupStore() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  const expiryTime = now - CLEANUP_INTERVAL
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastRefill < expiryTime) {
      rateLimitStore.delete(key)
    }
  }
  lastCleanup = now
}

/**
 * Get or create a rate limit entry
 */
function getEntry(key: string, config: RateLimitConfig): RateLimitEntry {
  let entry = rateLimitStore.get(key)

  if (!entry) {
    entry = {
      tokens: config.maxTokens,
      lastRefill: Date.now()
    }
    rateLimitStore.set(key, entry)
  }

  return entry
}

/**
 * Refill tokens based on time elapsed
 */
function refillTokens(entry: RateLimitEntry, config: RateLimitConfig): void {
  const now = Date.now()
  const timePassed = (now - entry.lastRefill) / 1000 // Convert to seconds
  const tokensToAdd = timePassed * config.refillRate

  entry.tokens = Math.min(config.maxTokens, entry.tokens + tokensToAdd)
  entry.lastRefill = now
}

/**
 * Check if request is allowed under rate limit
 * @param identifier - Unique identifier (e.g., IP address, chatbot ID)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.PUBLIC_CHATBOT
): {
  allowed: boolean
  remaining: number
  resetIn: number
  limit: number
} {
  cleanupStore()

  const entry = getEntry(identifier, config)
  refillTokens(entry, config)

  if (entry.tokens >= 1) {
    entry.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
      resetIn: Math.ceil((config.maxTokens - entry.tokens) / config.refillRate),
      limit: config.maxTokens
    }
  }

  return {
    allowed: false,
    remaining: 0,
    resetIn: Math.ceil((1 - entry.tokens) / config.refillRate),
    limit: config.maxTokens
  }
}

/**
 * Create a combined rate limit key from multiple identifiers
 */
export function createRateLimitKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':')
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: ReturnType<typeof checkRateLimit>): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
    'Retry-After': result.allowed ? '' : result.resetIn.toString()
  }
}

/**
 * Rate limit by IP address
 */
export function rateLimitByIP(
  ip: string,
  endpoint: string,
  config?: RateLimitConfig
): ReturnType<typeof checkRateLimit> {
  const key = createRateLimitKey('ip', ip, endpoint)
  return checkRateLimit(key, config)
}

/**
 * Rate limit by chatbot ID (to prevent abuse of specific chatbots)
 */
export function rateLimitByChatbot(
  chatbotId: string,
  config?: RateLimitConfig
): ReturnType<typeof checkRateLimit> {
  const key = createRateLimitKey('chatbot', chatbotId)
  return checkRateLimit(key, config)
}

/**
 * Combined rate limit check (both IP and chatbot)
 */
export function rateLimitCombined(
  ip: string,
  chatbotId: string,
  endpoint: string,
  config?: RateLimitConfig
): ReturnType<typeof checkRateLimit> {
  // Check IP-based limit first
  const ipResult = rateLimitByIP(ip, endpoint, config)
  if (!ipResult.allowed) {
    return ipResult
  }

  // Check chatbot-based limit
  const chatbotResult = rateLimitByChatbot(chatbotId, config)
  if (!chatbotResult.allowed) {
    return chatbotResult
  }

  // Return the more restrictive remaining count
  return ipResult.remaining < chatbotResult.remaining ? ipResult : chatbotResult
}

/**
 * Extract IP address from request headers
 */
export function getClientIP(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         headers.get('x-real-ip') ||
         headers.get('cf-connecting-ip') ||
         'unknown'
}
