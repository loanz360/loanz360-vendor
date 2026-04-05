/**
 * Rate Limiting Configuration
 * Centralized configuration for all rate-limited endpoints
 *
 * SECURITY FIX MED-01: Standardized rate limiting configuration
 */

export interface RateLimitEndpointConfig {
  endpoint: string
  maxRequests: number
  windowMinutes: number
  blockDurationMinutes: number
  progressivePenalty: boolean
  enabled: boolean
  description: string
}

/**
 * Rate limiting configuration for all endpoints
 * Values from environment variables with secure defaults
 */
export const RATE_LIMIT_CONFIG: Record<string, RateLimitEndpointConfig> = {
  // Authentication endpoints
  LOGIN: {
    endpoint: '/api/auth/login',
    maxRequests: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
    windowMinutes: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || '15', 10),
    blockDurationMinutes: 15,
    progressivePenalty: true,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Login attempts - prevents brute force attacks',
  },

  REGISTER: {
    endpoint: '/api/auth/register',
    maxRequests: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '5', 10),
    windowMinutes: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || '60', 10),
    blockDurationMinutes: 30,
    progressivePenalty: true,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Registration attempts - prevents spam accounts',
  },

  PASSWORD_RESET: {
    endpoint: '/api/auth/forgot-password',
    maxRequests: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_MAX || '3', 10),
    windowMinutes: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW || '60', 10),
    blockDurationMinutes: 60,
    progressivePenalty: true,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Password reset requests - prevents email bombing',
  },

  PASSWORD_RESET_CONFIRM: {
    endpoint: '/api/auth/reset-password',
    maxRequests: 10,
    windowMinutes: 60,
    blockDurationMinutes: 60,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Password reset confirmations',
  },

  // Email verification
  EMAIL_VERIFICATION: {
    endpoint: '/api/auth/verify-email',
    maxRequests: 5,
    windowMinutes: 60,
    blockDurationMinutes: 30,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Email verification requests',
  },

  // Two-factor authentication
  TWO_FACTOR_VERIFY: {
    endpoint: '/api/auth/2fa/verify',
    maxRequests: 5,
    windowMinutes: 15,
    blockDurationMinutes: 30,
    progressivePenalty: true,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: '2FA verification - prevents code guessing',
  },

  // API endpoints
  GENERAL_API: {
    endpoint: '/api/*',
    maxRequests: 100,
    windowMinutes: 1,
    blockDurationMinutes: 5,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'General API rate limit',
  },

  // File uploads
  FILE_UPLOAD: {
    endpoint: '/api/upload',
    maxRequests: 10,
    windowMinutes: 60,
    blockDurationMinutes: 60,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'File upload rate limit',
  },

  // Role-specific endpoints
  SUPERADMIN_API: {
    endpoint: '/api/superadmin/*',
    maxRequests: 200,
    windowMinutes: 1,
    blockDurationMinutes: 5,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Super admin API endpoints',
  },

  EMPLOYEE_API: {
    endpoint: '/api/employees/*',
    maxRequests: 100,
    windowMinutes: 1,
    blockDurationMinutes: 5,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Employee API endpoints',
  },

  CUSTOMER_API: {
    endpoint: '/api/customers/*',
    maxRequests: 50,
    windowMinutes: 1,
    blockDurationMinutes: 5,
    progressivePenalty: false,
    enabled: process.env.BYPASS_RATE_LIMITING !== 'true',
    description: 'Customer API endpoints',
  },
}

/**
 * Get rate limit configuration for an endpoint
 *
 * @param endpoint - API endpoint path
 * @returns Rate limit configuration
 */
export function getRateLimitConfig(endpoint: string): RateLimitEndpointConfig {
  // Exact match
  for (const config of Object.values(RATE_LIMIT_CONFIG)) {
    if (config.endpoint === endpoint) {
      return config
    }
  }

  // Wildcard match
  for (const config of Object.values(RATE_LIMIT_CONFIG)) {
    if (config.endpoint.endsWith('/*')) {
      const baseEndpoint = config.endpoint.slice(0, -2)
      if (endpoint.startsWith(baseEndpoint)) {
        return config
      }
    }
  }

  // Default fallback
  return RATE_LIMIT_CONFIG.GENERAL_API
}

/**
 * Progressive penalty calculator
 * Increases block duration based on number of violations
 *
 * @param violationCount - Number of previous violations
 * @param baseBlockMinutes - Base block duration
 * @returns Calculated block duration in minutes
 */
export function calculateProgressivePenalty(
  violationCount: number,
  baseBlockMinutes: number
): number {
  // Progressive penalty: 1x, 2x, 4x, 8x, 24 hours max
  const multiplier = Math.min(Math.pow(2, violationCount - 1), 96) // Cap at 24 hours (96 * 15 min)
  const calculatedMinutes = baseBlockMinutes * multiplier

  // Maximum 24 hours block
  return Math.min(calculatedMinutes, 24 * 60)
}

/**
 * Check if rate limiting is globally disabled
 * SECURITY FIX CRITICAL-03: Only allow bypass in development
 *
 * @returns True if rate limiting should be bypassed
 */
export function isRateLimitingDisabled(): boolean {
  // SECURITY FIX CRITICAL-03: Only allow bypass in development mode
  if (process.env.NODE_ENV !== 'production' && process.env.BYPASS_RATE_LIMITING === 'true') {
    // eslint-disable-next-line no-console
    console.warn('⚠️  RATE LIMITING BYPASSED - DEVELOPMENT ONLY')
    return true
  }

  // SECURITY: Fail fast if bypass is attempted in production
  if (process.env.NODE_ENV === 'production' && process.env.BYPASS_RATE_LIMITING === 'true') {
    throw new Error('FATAL SECURITY ERROR: BYPASS_RATE_LIMITING cannot be enabled in production')
  }

  return false
}

/**
 * Get rate limit headers for HTTP response
 *
 * @param config - Rate limit configuration
 * @param remaining - Remaining attempts
 * @param resetTime - Reset timestamp
 * @returns Headers object
 */
export function getRateLimitHeaders(
  config: RateLimitEndpointConfig,
  remaining: number,
  resetTime: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(),
    'X-RateLimit-Window': `${config.windowMinutes}m`,
  }
}

/**
 * Validate rate limit configuration
 *
 * @returns Validation result with any errors
 */
export function validateRateLimitConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const [key, config] of Object.entries(RATE_LIMIT_CONFIG)) {
    if (config.maxRequests <= 0) {
      errors.push(`${key}: maxRequests must be greater than 0`)
    }
    if (config.windowMinutes <= 0) {
      errors.push(`${key}: windowMinutes must be greater than 0`)
    }
    if (config.blockDurationMinutes <= 0) {
      errors.push(`${key}: blockDurationMinutes must be greater than 0`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Export configuration summary for monitoring/logging
 */
export function getRateLimitConfigSummary(): string {
  const configs = Object.entries(RATE_LIMIT_CONFIG).map(([key, config]) => {
    return `${key}: ${config.maxRequests} requests/${config.windowMinutes}m (block: ${config.blockDurationMinutes}m)`
  })

  return configs.join('\n')
}
