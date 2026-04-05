/**
 * Centralized Session Configuration
 * All session timeout and expiry values in one place
 */

export const SESSION_CONFIG = {
  // Session token lifetimes (in seconds)
  SESSION_LIFETIME: {
    SUPER_ADMIN: 24 * 60 * 60, // 24 hours
    ADMIN: 12 * 60 * 60, // 12 hours
    EMPLOYEE: 8 * 60 * 60, // 8 hours (collection/sales agents)
    PARTNER: 12 * 60 * 60, // 12 hours (business partners)
    CUSTOMER: 7 * 24 * 60 * 60, // 7 days (remember me)
    DEFAULT: 12 * 60 * 60, // 12 hours
  },

  // Cookie max age (in seconds)
  COOKIE_MAX_AGE: {
    SESSION: 7 * 24 * 60 * 60, // 7 days (max for any session)
    CSRF: 60 * 60, // 1 hour
    REMEMBER_ME: 30 * 24 * 60 * 60, // 30 days
  },

  // Refresh token settings
  REFRESH_TOKEN: {
    LIFETIME: 30 * 24 * 60 * 60, // 30 days
    GRACE_PERIOD: 5 * 60, // 5 minutes grace period for refresh
  },

  // Inactivity timeout (in seconds)
  INACTIVITY_TIMEOUT: {
    SUPER_ADMIN: 30 * 60, // 30 minutes
    ADMIN: 60 * 60, // 1 hour
    EMPLOYEE: 60 * 60, // 1 hour
    PARTNER: 2 * 60 * 60, // 2 hours
    CUSTOMER: 4 * 60 * 60, // 4 hours
    DEFAULT: 60 * 60, // 1 hour
  },

  // Token cleanup and maintenance
  CLEANUP: {
    EXPIRED_TOKENS: 24 * 60 * 60, // Clean up expired tokens older than 24 hours
    EXPIRED_SESSIONS: 7 * 24 * 60 * 60, // Clean up expired sessions older than 7 days
    AUTH_LOGS: 90 * 24 * 60 * 60, // Keep auth logs for 90 days
  },

  // Rate limiting windows
  RATE_LIMIT: {
    LOGIN_WINDOW: 15 * 60, // 15 minutes
    LOGIN_MAX_ATTEMPTS: 5, // 5 attempts
    LOCKOUT_DURATION: 24 * 60 * 60, // 24 hours

    PASSWORD_RESET_WINDOW: 60 * 60, // 1 hour
    PASSWORD_RESET_MAX_ATTEMPTS: 3, // 3 attempts

    REGISTRATION_WINDOW: 60 * 60, // 1 hour
    REGISTRATION_MAX_ATTEMPTS: 5, // 5 registrations

    API_WINDOW: 60, // 1 minute
    API_MAX_REQUESTS: 60, // 60 requests per minute
  },

  // CSRF token settings
  CSRF: {
    TOKEN_LENGTH: 32,
    MAX_AGE: 60 * 60, // 1 hour
  },

  // Session fingerprint settings
  FINGERPRINT: {
    REQUIRE_IP_MATCH: false, // Don't require IP match (mobile networks change IPs)
    REQUIRE_USER_AGENT_MATCH: true, // Require user agent match
    ALLOW_MULTIPLE_DEVICES: true, // Allow same user on multiple devices
    MAX_CONCURRENT_SESSIONS: {
      SUPER_ADMIN: 3,
      ADMIN: 5,
      EMPLOYEE: 2,
      PARTNER: 3,
      CUSTOMER: 5,
      DEFAULT: 3,
    },
  },
} as const

/**
 * Get session lifetime for a specific role
 */
export function getSessionLifetime(role: string): number {
  const roleKey = role.toUpperCase() as keyof typeof SESSION_CONFIG.SESSION_LIFETIME

  if (roleKey in SESSION_CONFIG.SESSION_LIFETIME) {
    return SESSION_CONFIG.SESSION_LIFETIME[roleKey]
  }

  return SESSION_CONFIG.SESSION_LIFETIME.DEFAULT
}

/**
 * Get inactivity timeout for a specific role
 */
export function getInactivityTimeout(role: string): number {
  const roleKey = role.toUpperCase() as keyof typeof SESSION_CONFIG.INACTIVITY_TIMEOUT

  if (roleKey in SESSION_CONFIG.INACTIVITY_TIMEOUT) {
    return SESSION_CONFIG.INACTIVITY_TIMEOUT[roleKey]
  }

  return SESSION_CONFIG.INACTIVITY_TIMEOUT.DEFAULT
}

/**
 * Get maximum concurrent sessions for a role
 */
export function getMaxConcurrentSessions(role: string): number {
  const roleKey = role.toUpperCase() as keyof typeof SESSION_CONFIG.FINGERPRINT.MAX_CONCURRENT_SESSIONS

  if (roleKey in SESSION_CONFIG.FINGERPRINT.MAX_CONCURRENT_SESSIONS) {
    return SESSION_CONFIG.FINGERPRINT.MAX_CONCURRENT_SESSIONS[roleKey]
  }

  return SESSION_CONFIG.FINGERPRINT.MAX_CONCURRENT_SESSIONS.DEFAULT
}

/**
 * Check if a session is expired based on role
 */
export function isSessionExpired(
  createdAt: Date,
  lastActivity: Date,
  role: string
): {
  expired: boolean
  reason?: 'lifetime' | 'inactivity'
} {
  const now = Date.now()
  const createdTime = createdAt.getTime()
  const lastActivityTime = lastActivity.getTime()

  const lifetimeMs = getSessionLifetime(role) * 1000
  const inactivityTimeoutMs = getInactivityTimeout(role) * 1000

  // Check if session exceeded its lifetime
  if (now - createdTime > lifetimeMs) {
    return { expired: true, reason: 'lifetime' }
  }

  // Check if session exceeded inactivity timeout
  if (now - lastActivityTime > inactivityTimeoutMs) {
    return { expired: true, reason: 'inactivity' }
  }

  return { expired: false }
}

/**
 * Get expiry date for a new session
 */
export function getSessionExpiryDate(role: string): Date {
  const lifetimeMs = getSessionLifetime(role) * 1000
  return new Date(Date.now() + lifetimeMs)
}
