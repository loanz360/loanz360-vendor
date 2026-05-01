/**
 * Tests for API retry with exponential backoff
 */

interface RetryConfig {
  maxRetries: number
  retryDelay: number
  backoffMultiplier: number
  retryableStatuses: number[]
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  return config.retryDelay * Math.pow(config.backoffMultiplier, attempt)
}

function isRetryable(status: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(status)
}

describe('Retry delay calculation', () => {
  test('first retry uses base delay', () => {
    expect(calculateDelay(0, DEFAULT_CONFIG)).toBe(1000)
  })

  test('second retry doubles delay', () => {
    expect(calculateDelay(1, DEFAULT_CONFIG)).toBe(2000)
  })

  test('third retry quadruples delay', () => {
    expect(calculateDelay(2, DEFAULT_CONFIG)).toBe(4000)
  })

  test('respects custom multiplier', () => {
    const config = { ...DEFAULT_CONFIG, backoffMultiplier: 3 }
    expect(calculateDelay(1, config)).toBe(3000)
    expect(calculateDelay(2, config)).toBe(9000)
  })

  test('respects custom base delay', () => {
    const config = { ...DEFAULT_CONFIG, retryDelay: 500 }
    expect(calculateDelay(0, config)).toBe(500)
    expect(calculateDelay(1, config)).toBe(1000)
  })
})

describe('Retryable status check', () => {
  test('408 (timeout) is retryable', () => {
    expect(isRetryable(408, DEFAULT_CONFIG)).toBe(true)
  })

  test('429 (rate limited) is retryable', () => {
    expect(isRetryable(429, DEFAULT_CONFIG)).toBe(true)
  })

  test('500-504 are retryable', () => {
    expect(isRetryable(500, DEFAULT_CONFIG)).toBe(true)
    expect(isRetryable(502, DEFAULT_CONFIG)).toBe(true)
    expect(isRetryable(503, DEFAULT_CONFIG)).toBe(true)
    expect(isRetryable(504, DEFAULT_CONFIG)).toBe(true)
  })

  test('400 is NOT retryable', () => {
    expect(isRetryable(400, DEFAULT_CONFIG)).toBe(false)
  })

  test('401 is NOT retryable', () => {
    expect(isRetryable(401, DEFAULT_CONFIG)).toBe(false)
  })

  test('404 is NOT retryable', () => {
    expect(isRetryable(404, DEFAULT_CONFIG)).toBe(false)
  })

  test('422 is NOT retryable', () => {
    expect(isRetryable(422, DEFAULT_CONFIG)).toBe(false)
  })

  test('custom retryable statuses', () => {
    const config = { ...DEFAULT_CONFIG, retryableStatuses: [502, 503] }
    expect(isRetryable(500, config)).toBe(false)
    expect(isRetryable(502, config)).toBe(true)
  })
})
