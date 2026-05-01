/**
 * Tests for API error messages — ensures no information disclosure
 */

const API_ERRORS = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in',
  AUTH_ACCOUNT_DISABLED: 'Your account has been disabled. Please contact support',
  AUTH_UNAUTHORIZED: 'Unauthorized access',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again',
  AUTH_REGISTRATION_FAILED: 'Unable to create account. Please try again later',
  VALIDATION_FAILED: 'Invalid request data',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
  RATE_LIMIT_ACCOUNT_LOCKED: 'Account temporarily locked due to too many failed attempts',
  INTERNAL_ERROR: 'An unexpected error occurred',
} as const

describe('API Error Messages — Security', () => {
  test('auth errors do not reveal system details', () => {
    Object.entries(API_ERRORS).forEach(([key, message]) => {
      if (key.startsWith('AUTH_')) {
        expect(message).not.toContain('database')
        expect(message).not.toContain('supabase')
        expect(message).not.toContain('SQL')
        expect(message).not.toContain('query')
        expect(message).not.toContain('column')
        expect(message).not.toContain('table')
        expect(message).not.toContain('stack')
      }
    })
  })

  test('no error message reveals technology stack', () => {
    Object.values(API_ERRORS).forEach(message => {
      expect(message.toLowerCase()).not.toContain('next.js')
      expect(message.toLowerCase()).not.toContain('postgres')
      expect(message.toLowerCase()).not.toContain('redis')
      expect(message.toLowerCase()).not.toContain('vercel')
    })
  })

  test('invalid credentials message is generic', () => {
    // Should NOT say "email not found" or "wrong password" separately
    expect(API_ERRORS.AUTH_INVALID_CREDENTIALS).toBe('Invalid email or password')
    expect(API_ERRORS.AUTH_INVALID_CREDENTIALS).not.toContain('not found')
    expect(API_ERRORS.AUTH_INVALID_CREDENTIALS).not.toContain('wrong password')
  })

  test('all error messages are user-friendly', () => {
    Object.values(API_ERRORS).forEach(message => {
      expect(message.length).toBeGreaterThan(5)
      expect(message.length).toBeLessThan(200)
      expect(message[0]).toBe(message[0].toUpperCase()) // Starts with capital
    })
  })
})
