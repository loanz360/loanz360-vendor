/**
 * Input Sanitization Utility
 * Prevents XSS, SQL injection, and other input-based attacks
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  })
}

/**
 * Sanitize plain text input (strip all HTML)
 */
export function sanitizeText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  // Remove any HTML
  const cleaned = sanitizeText(email)

  // Trim and lowercase
  return cleaned.trim().toLowerCase()
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  // Remove all non-numeric characters except + at start
  return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
}

/**
 * Sanitize alphanumeric input (IDs, usernames, etc.)
 */
export function sanitizeAlphanumeric(input: string, allowSpaces = false): string {
  const cleaned = sanitizeText(input)

  if (allowSpaces) {
    return cleaned.replace(/[^a-zA-Z0-9\s]/g, '').trim()
  }

  return cleaned.replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Sanitize file name to prevent directory traversal
 */
export function sanitizeFileName(fileName: string): string {
  // Remove HTML first
  const cleaned = sanitizeText(fileName)

  // Remove path separators and dangerous characters
  return cleaned
    .replace(/[\/\\]/g, '') // Remove slashes
    .replace(/\.\./g, '') // Remove .. (directory traversal)
    .replace(/[<>:"|?*]/g, '') // Remove invalid file name characters
    .trim()
}

/**
 * Sanitize URL to prevent javascript: and data: URLs
 */
export function sanitizeUrl(url: string): string {
  const cleaned = sanitizeText(url).trim()

  // Allowed protocols
  const allowedProtocols = ['http:', 'https:', 'mailto:']

  try {
    const urlObj = new URL(cleaned)

    if (!allowedProtocols.includes(urlObj.protocol)) {
      return ''
    }

    return urlObj.toString()
  } catch {
    // If not a valid URL, return empty string
    return ''
  }
}

/**
 * Sanitize SQL input (basic - use parameterized queries as primary defense)
 */
export function sanitizeSqlInput(input: string): string {
  // Remove HTML first
  const cleaned = sanitizeText(input)

  // Escape single quotes (double them)
  return cleaned.replace(/'/g, "''")
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    sanitizeHtml?: boolean
    allowedKeys?: string[]
  } = {}
): T {
  const { sanitizeHtml: shouldSanitizeHtml = true, allowedKeys } = options

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip keys not in allowedKeys if specified
    if (allowedKeys && !allowedKeys.includes(key)) {
      continue
    }

    // Recursively sanitize objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, options)
    }
    // Sanitize arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? shouldSanitizeHtml
            ? sanitizeHtml(item)
            : sanitizeText(item)
          : item
      )
    }
    // Sanitize strings
    else if (typeof value === 'string') {
      sanitized[key] = shouldSanitizeHtml ? sanitizeHtml(value) : sanitizeText(value)
    }
    // Keep other types as-is (numbers, booleans, null)
    else {
      sanitized[key] = value
    }
  }

  return sanitized as T
}

/**
 * Validate and sanitize user input for auth forms
 */
export interface AuthFormData {
  email?: string
  password?: string
  full_name?: string
  mobile?: string
  [key: string]: unknown
}

export function sanitizeAuthInput(data: AuthFormData): AuthFormData {
  const sanitized: AuthFormData = {}

  if (data.email) {
    sanitized.email = sanitizeEmail(data.email)
  }

  // Never sanitize passwords - they should be hashed as-is
  if (data.password) {
    sanitized.password = data.password
  }

  if (data.full_name) {
    sanitized.full_name = sanitizeText(data.full_name).trim()
  }

  if (data.mobile) {
    sanitized.mobile = sanitizePhone(data.mobile)
  }

  // Sanitize any other string fields
  for (const [key, value] of Object.entries(data)) {
    if (!['email', 'password', 'full_name', 'mobile'].includes(key) && typeof value === 'string') {
      sanitized[key] = sanitizeText(value)
    }
  }

  return sanitized
}

/**
 * Check for common XSS patterns
 */
export function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\(/gi,
    /expression\(/gi,
  ]

  return xssPatterns.some((pattern) => pattern.test(input))
}

/**
 * Check for common SQL injection patterns
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\s|^)(union|select|insert|update|delete|drop|create|alter|exec|execute)(\s|$)/gi,
    /--/g, // SQL comment
    /;.*?/g, // Statement terminator
    /\/\*/g, // Multi-line comment start
    /xp_/gi, // SQL Server extended procedures
  ]

  return sqlPatterns.some((pattern) => pattern.test(input))
}

/**
 * Comprehensive input validation and sanitization
 */
export function validateAndSanitize(
  input: string,
  options: {
    maxLength?: number
    allowHtml?: boolean
    checkXSS?: boolean
    checkSQL?: boolean
  } = {}
): {
  sanitized: string
  isValid: boolean
  errors: string[]
} {
  const {
    maxLength = 1000,
    allowHtml = false,
    checkXSS = true,
    checkSQL = true,
  } = options

  const errors: string[] = []

  // Check length
  if (input.length > maxLength) {
    errors.push(`Input exceeds maximum length of ${maxLength} characters`)
  }

  // Check for XSS
  if (checkXSS && containsXSS(input)) {
    errors.push('Input contains potentially malicious XSS patterns')
  }

  // Check for SQL injection
  if (checkSQL && containsSQLInjection(input)) {
    errors.push('Input contains potentially malicious SQL patterns')
  }

  // Sanitize
  const sanitized = allowHtml ? sanitizeHtml(input) : sanitizeText(input)

  return {
    sanitized,
    isValid: errors.length === 0,
    errors,
  }
}
