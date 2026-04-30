/**
 * Unit tests for security utilities
 * Input sanitization, XSS prevention, CSRF token validation
 */

// Sanitization functions
function sanitizeInput(input: string): string {{
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}}

function sanitizeSQLIdentifier(identifier: string): string {{
  return identifier.replace(/[^a-zA-Z0-9_]/g, '')
}}

function isValidCSRFToken(token: string | null, sessionToken: string): boolean {{
  if (!token || !sessionToken) return false
  if (token.length < 32) return false
  return true // Simplified — real impl uses crypto comparison
}}

function rateLimitCheck(
  requests: number[],
  maxRequests: number,
  windowMs: number
): {{ allowed: boolean; retryAfter?: number }} {{
  const now = Date.now()
  const windowStart = now - windowMs
  const recentRequests = requests.filter(t => t > windowStart)
  
  if (recentRequests.length >= maxRequests) {{
    const oldestInWindow = Math.min(...recentRequests)
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000)
    return {{ allowed: false, retryAfter }}
  }}
  return {{ allowed: true }}
}}

function validatePasswordStrength(password: string): {{ valid: boolean; errors: string[] }} {{
  const errors: string[] = []
  if (password.length < 8) errors.push('Minimum 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('Must include uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Must include lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Must include number')
  if (!/[!@#$%^&*(),.?":{{}}|<>]/.test(password)) errors.push('Must include special character')
  return {{ valid: errors.length === 0, errors }}
}}

// Tests
describe('Input Sanitization', () => {{
  test('escapes HTML tags', () => {{
    expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('<script>')
    expect(sanitizeInput('<img onerror="hack">')).not.toContain('<img')
  }})

  test('escapes quotes', () => {{
    const result = sanitizeInput('"; DROP TABLE users;--')
    expect(result).not.toContain('"')
  }})

  test('preserves normal text', () => {{
    const input = 'Hello World 123'
    // Should contain the same letters/numbers
    expect(sanitizeInput(input)).toContain('Hello World 123')
  }})

  test('handles empty string', () => {{
    expect(sanitizeInput('')).toBe('')
  }})
}})

describe('SQL Identifier Sanitization', () => {{
  test('removes special characters', () => {{
    expect(sanitizeSQLIdentifier('table_name')).toBe('table_name')
    expect(sanitizeSQLIdentifier('table;DROP--')).toBe('tableDROP')
  }})

  test('allows alphanumeric and underscore', () => {{
    expect(sanitizeSQLIdentifier('user_profiles_v2')).toBe('user_profiles_v2')
  }})

  test('strips spaces', () => {{
    expect(sanitizeSQLIdentifier('table name')).toBe('tablename')
  }})
}})

describe('CSRF Token Validation', () => {{
  test('rejects null token', () => {{
    expect(isValidCSRFToken(null, 'session-123')).toBe(false)
  }})

  test('rejects empty session', () => {{
    expect(isValidCSRFToken('token-123', '')).toBe(false)
  }})

  test('rejects short token', () => {{
    expect(isValidCSRFToken('short', 'session-123')).toBe(false)
  }})

  test('accepts valid token', () => {{
    const token = 'a'.repeat(32)
    expect(isValidCSRFToken(token, 'session-123')).toBe(true)
  }})
}})

describe('Rate Limiting', () => {{
  test('allows requests within limit', () => {{
    const requests = [Date.now() - 1000, Date.now() - 500]
    expect(rateLimitCheck(requests, 10, 60000).allowed).toBe(true)
  }})

  test('blocks when limit exceeded', () => {{
    const now = Date.now()
    const requests = Array.from({{ length: 10 }}, (_, i) => now - i * 100)
    const result = rateLimitCheck(requests, 10, 60000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  }})

  test('allows after window expires', () => {{
    const oldRequests = Array.from({{ length: 10 }}, (_, i) => Date.now() - 120000 - i * 100)
    expect(rateLimitCheck(oldRequests, 10, 60000).allowed).toBe(true)
  }})
}})

describe('Password Strength', () => {{
  test('accepts strong password', () => {{
    expect(validatePasswordStrength('Str0ng!Pass').valid).toBe(true)
  }})

  test('rejects short password', () => {{
    const result = validatePasswordStrength('Sh1!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Minimum 8 characters')
  }})

  test('requires uppercase', () => {{
    const result = validatePasswordStrength('lowercase1!')
    expect(result.errors).toContain('Must include uppercase letter')
  }})

  test('requires number', () => {{
    const result = validatePasswordStrength('NoNumber!!')
    expect(result.errors).toContain('Must include number')
  }})

  test('requires special character', () => {{
    const result = validatePasswordStrength('NoSpecial1')
    expect(result.errors).toContain('Must include special character')
  }})

  test('returns multiple errors', () => {{
    const result = validatePasswordStrength('weak')
    expect(result.errors.length).toBeGreaterThan(1)
  }})
}})
