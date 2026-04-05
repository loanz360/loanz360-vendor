import NodeCache from 'node-cache'

// Rate limiter configuration
const RATE_LIMIT_WINDOW = 900 // 15 minutes in seconds
const MAX_ATTEMPTS = 5 // Maximum attempts per window
const LOCKOUT_DURATION = 3600 // 1 hour lockout in seconds

// In-memory cache for rate limiting
// In production, consider using Redis for distributed rate limiting
const rateCache = new NodeCache({
  stdTTL: RATE_LIMIT_WINDOW,
  checkperiod: 60 // Check for expired keys every minute
})

const lockoutCache = new NodeCache({
  stdTTL: LOCKOUT_DURATION,
  checkperiod: 60
})

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  resetTime: number
  isLockedOut: boolean
  lockoutResetTime?: number
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now()

  // Check if IP is locked out
  const lockoutKey = `lockout:${identifier}`
  const lockoutTime = lockoutCache.get<number>(lockoutKey)

  if (lockoutTime) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: now + (RATE_LIMIT_WINDOW * 1000),
      isLockedOut: true,
      lockoutResetTime: lockoutTime
    }
  }

  // Check current attempts
  const attemptKey = `attempts:${identifier}`
  const attempts = rateCache.get<number>(attemptKey) || 0

  if (attempts >= MAX_ATTEMPTS) {
    // Lock out the IP
    const lockoutResetTime = now + (LOCKOUT_DURATION * 1000)
    lockoutCache.set(lockoutKey, lockoutResetTime)

    // Clear attempts counter
    rateCache.del(attemptKey)

    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: now + (RATE_LIMIT_WINDOW * 1000),
      isLockedOut: true,
      lockoutResetTime
    }
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - attempts,
    resetTime: now + (RATE_LIMIT_WINDOW * 1000),
    isLockedOut: false
  }
}

export function recordFailedAttempt(identifier: string): void {
  const attemptKey = `attempts:${identifier}`
  const attempts = rateCache.get<number>(attemptKey) || 0
  rateCache.set(attemptKey, attempts + 1, RATE_LIMIT_WINDOW)
}

export function clearFailedAttempts(identifier: string): void {
  const attemptKey = `attempts:${identifier}`
  rateCache.del(attemptKey)
}

export function getRateLimitHeaders(result: RateLimitResult) {
  return {
    'X-RateLimit-Limit': MAX_ATTEMPTS.toString(),
    'X-RateLimit-Remaining': result.remainingAttempts.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    ...(result.isLockedOut && {
      'X-RateLimit-Lockout-Reset': Math.ceil((result.lockoutResetTime || 0) / 1000).toString()
    })
  }
}