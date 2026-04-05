import DOMPurify from 'dompurify'

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param dirty - The potentially unsafe HTML string
 * @param options - DOMPurify configuration options
 * @returns Safe HTML string
 */
export function sanitizeHtml(
  dirty: string,
  options: Record<string, unknown> = {}
): string {
  // Only run on client side
  if (typeof window === 'undefined') {
    return dirty
  }

  const defaultOptions = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
    ...options
  }

  return DOMPurify.sanitize(dirty, defaultOptions)
}

/**
 * Sanitizes text content by removing all HTML tags
 * @param text - The potentially unsafe text
 * @returns Safe plain text
 */
export function sanitizeText(text: string): string {
  if (typeof window === 'undefined') {
    // Server-side: basic HTML entity encoding
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  // Client-side: use DOMPurify to strip all HTML
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Server-side HTML entity encoding (works without DOM)
 */
export function encodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize input for safe use in JSONB fields
 * Prevents JSON injection attacks
 */
export function sanitizeForJsonb(value: unknown): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    // Remove null bytes and other control characters
    let sanitized = value.replace(/[\x00-\x1F\x7F]/g, '')
    // Escape any potential JSON breaking characters in strings
    sanitized = encodeHtmlEntities(sanitized)
    return sanitized
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeForJsonb(item))
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      // Sanitize keys as well
      const sanitizedKey = key.replace(/[^\w\-_.]/g, '_')
      sanitized[sanitizedKey] = sanitizeForJsonb(val)
    }
    return sanitized
  }

  return String(value)
}

/**
 * Sanitize user input from chatbot
 * More aggressive sanitization for untrusted input
 */
export function sanitizeChatInput(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Limit length
  let sanitized = input.slice(0, 10000)

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Encode HTML entities
  sanitized = encodeHtmlEntities(sanitized)

  // Remove potential script injection patterns
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '')

  return sanitized.trim()
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null

  const trimmed = email.trim().toLowerCase()

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) return null

  // Max length check
  if (trimmed.length > 254) return null

  return trimmed
}

/**
 * Validate and sanitize phone number
 */
export function sanitizePhone(phone: string): string | null {
  if (!phone || typeof phone !== 'string') return null

  // Remove all non-digit characters except + at start
  let cleaned = phone.replace(/[^\d+]/g, '')

  // Ensure + is only at the start
  if (cleaned.includes('+') && !cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/\+/g, '')
  }

  // Check reasonable length (5-15 digits is standard)
  const digitCount = cleaned.replace(/\D/g, '').length
  if (digitCount < 5 || digitCount > 15) return null

  return cleaned
}

/**
 * Sanitize collected data from chatbot
 */
export function sanitizeCollectedData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    // Sanitize key
    const sanitizedKey = key
      .replace(/[^\w\-_.]/g, '_')
      .slice(0, 100)

    // Sanitize value based on type
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeChatInput(value)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[sanitizedKey] = value
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item =>
        typeof item === 'string' ? sanitizeChatInput(item) : item
      )
    } else if (value && typeof value === 'object') {
      sanitized[sanitizedKey] = sanitizeCollectedData(
        value as Record<string, unknown>
      )
    }
  }

  return sanitized
}