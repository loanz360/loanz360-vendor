/**
 * Rate Limiter Utility
 *
 * Provides easy-to-use functions for rate limiting various actions
 * Uses Supabase database functions for distributed rate limiting
 */

import { createSupabaseClient } from '@/lib/supabase/client'

export type RateLimitAction =
  | 'email_verification'
  | 'password_reset'
  | 'login_attempt'
  | 'registration'
  | 'forgot_password'
  | 'api_request'

interface RateLimitConfig {
  maxRequests: number
  windowMinutes: number
}

interface RateLimitResult {
  allowed: boolean
  requestsRemaining: number
  resetAt: string
}

// Default rate limit configurations
const RATE_LIMIT_CONFIGS: Record<RateLimitAction, RateLimitConfig> = {
  email_verification: { maxRequests: 3, windowMinutes: 60 },      // 3 per hour
  password_reset: { maxRequests: 3, windowMinutes: 60 },          // 3 per hour
  forgot_password: { maxRequests: 3, windowMinutes: 60 },         // 3 per hour
  login_attempt: { maxRequests: 5, windowMinutes: 15 },           // 5 per 15 minutes
  registration: { maxRequests: 3, windowMinutes: 60 },            // 3 per hour
  api_request: { maxRequests: 100, windowMinutes: 1 },            // 100 per minute
}

/**
 * Check if an action is within rate limit
 *
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param action - Type of action being rate limited
 * @param customConfig - Optional custom rate limit configuration
 * @returns Promise with rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
  customConfig?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  try {
    const supabase = createSupabaseClient()
    const config = {
      ...RATE_LIMIT_CONFIGS[action],
      ...customConfig
    }

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action: action,
      p_max_requests: config.maxRequests,
      p_window_minutes: config.windowMinutes
    })

    if (error) {
      console.error('[Rate Limiter] Error checking rate limit:', error)
      // On error, allow the request (fail open for better UX)
      return {
        allowed: true,
        requestsRemaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000).toISOString()
      }
    }

    return {
      allowed: data.allowed,
      requestsRemaining: data.requests_remaining,
      resetAt: data.reset_at
    }
  } catch (error) {
    console.error('[Rate Limiter] Unexpected error:', error)
    // On error, allow the request (fail open)
    const config = RATE_LIMIT_CONFIGS[action]
    return {
      allowed: true,
      requestsRemaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000).toISOString()
    }
  }
}

/**
 * Throws an error if rate limit is exceeded
 * Use this in API routes for automatic error handling
 */
export async function enforceRateLimit(
  identifier: string,
  action: RateLimitAction,
  customConfig?: Partial<RateLimitConfig>
): Promise<void> {
  const result = await checkRateLimit(identifier, action, customConfig)

  if (!result.allowed) {
    const resetDate = new Date(result.resetAt)
    const minutesUntilReset = Math.ceil(
      (resetDate.getTime() - Date.now()) / (1000 * 60)
    )

    throw new RateLimitError(
      `Rate limit exceeded. Please try again in ${minutesUntilReset} minute(s).`,
      result.resetAt
    )
  }
}

/**
 * Custom error class for rate limit violations
 */
export class RateLimitError extends Error {
  resetAt: string

  constructor(message: string, resetAt: string) {
    super(message)
    this.name = 'RateLimitError'
    this.resetAt = resetAt
  }
}

/**
 * Helper to get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Check various headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback to a default value
  return 'unknown'
}
