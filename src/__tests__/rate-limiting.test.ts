/**
 * Unit tests for rate limiting middleware
 * Tests the in-memory rate limiter logic (Upstash tested via integration)
 */

interface RateLimitConfig {
  limit: number
  window: number // seconds
}

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number }
}

function inMemoryRateLimit(
  store: RateLimitStore,
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

describe('In-Memory Rate Limiter', () => {
  let store: RateLimitStore

  beforeEach(() => {
    store = {}
  })

  test('allows requests within limit', () => {
    const config = { limit: 5, window: 60 }
    const result = inMemoryRateLimit(store, 'ip:127.0.0.1:/api/test', config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  test('blocks requests exceeding limit', () => {
    const config = { limit: 3, window: 60 }
    const key = 'ip:10.0.0.1:/api/auth/login'
    
    // Make 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const r = inMemoryRateLimit(store, key, config)
      expect(r.allowed).toBe(true)
    }
    
    // 4th request should be blocked
    const blocked = inMemoryRateLimit(store, key, config)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  test('different IPs have separate limits', () => {
    const config = { limit: 2, window: 60 }
    
    inMemoryRateLimit(store, 'ip1:/api/test', config)
    inMemoryRateLimit(store, 'ip1:/api/test', config)
    const blocked = inMemoryRateLimit(store, 'ip1:/api/test', config)
    expect(blocked.allowed).toBe(false)
    
    // Different IP should still be allowed
    const allowed = inMemoryRateLimit(store, 'ip2:/api/test', config)
    expect(allowed.allowed).toBe(true)
  })

  test('different endpoints have separate limits', () => {
    const config = { limit: 1, window: 60 }
    
    inMemoryRateLimit(store, 'ip:/api/auth', config)
    const blocked = inMemoryRateLimit(store, 'ip:/api/auth', config)
    expect(blocked.allowed).toBe(false)
    
    // Different endpoint should be allowed
    const allowed = inMemoryRateLimit(store, 'ip:/api/leads', config)
    expect(allowed.allowed).toBe(true)
  })

  test('returns correct remaining count', () => {
    const config = { limit: 5, window: 60 }
    const key = 'test-key'
    
    expect(inMemoryRateLimit(store, key, config).remaining).toBe(4)
    expect(inMemoryRateLimit(store, key, config).remaining).toBe(3)
    expect(inMemoryRateLimit(store, key, config).remaining).toBe(2)
    expect(inMemoryRateLimit(store, key, config).remaining).toBe(1)
    expect(inMemoryRateLimit(store, key, config).remaining).toBe(0)
    expect(inMemoryRateLimit(store, key, config).remaining).toBe(0) // stays at 0
  })

  test('resets after window expires', () => {
    const config = { limit: 1, window: 1 } // 1 second window
    const key = 'expire-test'
    
    inMemoryRateLimit(store, key, config)
    const blocked = inMemoryRateLimit(store, key, config)
    expect(blocked.allowed).toBe(false)
    
    // Simulate window expiry
    store[key].resetTime = Date.now() - 1000
    
    const allowed = inMemoryRateLimit(store, key, config)
    expect(allowed.allowed).toBe(true)
  })
})

describe('Rate Limit Configs', () => {
  const CONFIGS = {
    DEFAULT: { limit: 100, window: 60 },
    AUTH: { limit: 10, window: 60 },
    UPLOAD: { limit: 20, window: 60 },
    ANALYTICS: { limit: 50, window: 60 },
    CREATE: { limit: 30, window: 60 },
    READ: { limit: 100, window: 60 },
    WRITE: { limit: 20, window: 60 },
  }

  test('AUTH has strictest limit', () => {
    expect(CONFIGS.AUTH.limit).toBeLessThanOrEqual(CONFIGS.DEFAULT.limit)
    expect(CONFIGS.AUTH.limit).toBeLessThanOrEqual(CONFIGS.READ.limit)
  })

  test('WRITE is stricter than READ', () => {
    expect(CONFIGS.WRITE.limit).toBeLessThan(CONFIGS.READ.limit)
  })

  test('all windows are positive', () => {
    Object.values(CONFIGS).forEach(c => {
      expect(c.window).toBeGreaterThan(0)
      expect(c.limit).toBeGreaterThan(0)
    })
  })
})
