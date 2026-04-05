/**
 * Input Sanitization and XSS Protection
 * Comprehensive sanitization for all user inputs
 */

import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Sanitize plain text (strip all HTML)
 */
export function sanitizeText(text: string): string {
  if (!text) return ''

  // Remove all HTML tags
  const stripped = text.replace(/<[^>]*>/g, '')

  // Decode HTML entities
  const decoded = validator.unescape(stripped)

  // Trim whitespace
  return decoded.trim()
}

/**
 * Sanitize contest title
 */
export function sanitizeContestTitle(title: string): string {
  const sanitized = sanitizeText(title)

  // Limit length
  if (sanitized.length > 255) {
    throw new Error('Contest title must be 255 characters or less')
  }

  // Check for empty
  if (!sanitized || sanitized.trim().length === 0) {
    throw new Error('Contest title is required')
  }

  return sanitized
}

/**
 * Sanitize contest description (allow basic formatting)
 */
export function sanitizeContestDescription(description: string): string {
  if (!description) return ''

  const sanitized = sanitizeHtml(description)

  // Limit length (10,000 characters)
  if (sanitized.length > 10000) {
    throw new Error('Contest description must be 10,000 characters or less')
  }

  return sanitized
}

/**
 * Sanitize contest rules (allow basic formatting)
 */
export function sanitizeContestRules(rules: string): string {
  if (!rules) return ''

  const sanitized = sanitizeHtml(rules)

  // Limit length (50,000 characters)
  if (sanitized.length > 50000) {
    throw new Error('Contest rules must be 50,000 characters or less')
  }

  return sanitized
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return ''

  // Validate URL format
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
  })) {
    throw new Error('Invalid URL format')
  }

  // Additional check for malicious protocols
  const lowercaseUrl = url.toLowerCase()
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']

  for (const protocol of dangerousProtocols) {
    if (lowercaseUrl.includes(protocol)) {
      throw new Error('Dangerous URL protocol detected')
    }
  }

  return url
}

/**
 * Validate UUID
 */
export function validateUuid(uuid: string): boolean {
  return validator.isUUID(uuid, 4)
}

/**
 * Sanitize UUID
 */
export function sanitizeUuid(uuid: string): string {
  if (!validateUuid(uuid)) {
    throw new Error('Invalid UUID format')
  }
  return uuid
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  return validator.isEmail(email)
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  const normalized = validator.normalizeEmail(email)
  if (!normalized || !validateEmail(normalized)) {
    throw new Error('Invalid email format')
  }
  return normalized
}

/**
 * Validate date string
 */
export function validateDate(dateString: string): boolean {
  return validator.isISO8601(dateString)
}

/**
 * Sanitize date
 */
export function sanitizeDate(dateString: string): string {
  if (!validateDate(dateString)) {
    throw new Error('Invalid date format. Use ISO 8601 format.')
  }

  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date')
  }

  return date.toISOString()
}

/**
 * Validate integer
 */
export function validateInteger(value: any): boolean {
  return validator.isInt(String(value))
}

/**
 * Sanitize integer
 */
export function sanitizeInteger(value: any, min?: number, max?: number): number {
  const num = parseInt(String(value), 10)

  if (isNaN(num)) {
    throw new Error('Invalid integer')
  }

  if (min !== undefined && num < min) {
    throw new Error(`Value must be at least ${min}`)
  }

  if (max !== undefined && num > max) {
    throw new Error(`Value must be at most ${max}`)
  }

  return num
}

/**
 * Validate decimal/float
 */
export function validateDecimal(value: any): boolean {
  return validator.isFloat(String(value))
}

/**
 * Sanitize decimal
 */
export function sanitizeDecimal(value: any, min?: number, max?: number): number {
  const num = parseFloat(String(value))

  if (isNaN(num)) {
    throw new Error('Invalid decimal number')
  }

  if (min !== undefined && num < min) {
    throw new Error(`Value must be at least ${min}`)
  }

  if (max !== undefined && num > max) {
    throw new Error(`Value must be at most ${max}`)
  }

  return num
}

/**
 * Sanitize enum value
 */
export function sanitizeEnum<T extends string>(
  value: string,
  allowedValues: T[],
  fieldName: string = 'Value'
): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    )
  }
  return value as T
}

/**
 * Sanitize array of values
 */
export function sanitizeArray<T>(
  arr: any[],
  itemSanitizer: (item: any) => T,
  minLength?: number,
  maxLength?: number
): T[] {
  if (!Array.isArray(arr)) {
    throw new Error('Value must be an array')
  }

  if (minLength !== undefined && arr.length < minLength) {
    throw new Error(`Array must contain at least ${minLength} items`)
  }

  if (maxLength !== undefined && arr.length > maxLength) {
    throw new Error(`Array must contain at most ${maxLength} items`)
  }

  return arr.map(item => itemSanitizer(item))
}

/**
 * Sanitize boolean
 */
export function sanitizeBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  throw new Error('Invalid boolean value')
}

/**
 * Sanitize JSON object
 */
export function sanitizeJson(json: any): any {
  if (typeof json === 'string') {
    try {
      return JSON.parse(json)
    } catch (error) {
      throw new Error('Invalid JSON format')
    }
  }
  return json
}

/**
 * Validate pagination parameters
 */
export interface PaginationParams {
  limit: number
  offset: number
}

export function sanitizePaginationParams(
  limit: string | null,
  offset: string | null
): PaginationParams {
  const sanitizedLimit = sanitizeInteger(limit || '50', 1, 500)
  const sanitizedOffset = sanitizeInteger(offset || '0', 0, 1000000)

  return {
    limit: sanitizedLimit,
    offset: sanitizedOffset,
  }
}

/**
 * Comprehensive contest data sanitization
 */
export interface SanitizedContestData {
  contest_title: string
  contest_description?: string
  contest_image_url?: string
  contest_rules?: string
  contest_type: 'performance' | 'sales' | 'engagement' | 'custom'
  target_category: string
  target_all_partners: boolean
  start_date: string
  end_date: string
  evaluation_criteria: any
  evaluation_frequency: 'realtime' | 'hourly' | 'daily'
  auto_evaluate: boolean
  reward_details?: any
  winner_count: number
  reward_tiers?: any
  enable_leaderboard: boolean
  leaderboard_visibility: 'public' | 'private' | 'rank_only'
  show_scores: boolean
  notification_enabled: boolean
  status: 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled'
}

export function sanitizeContestData(data: any): SanitizedContestData {
  // Required fields
  const contest_title = sanitizeContestTitle(data.contest_title)
  const start_date = sanitizeDate(data.start_date)
  const end_date = sanitizeDate(data.end_date)

  // Validate date range
  if (new Date(end_date) <= new Date(start_date)) {
    throw new Error('End date must be after start date')
  }

  // Optional fields with defaults
  const contest_description = data.contest_description
    ? sanitizeContestDescription(data.contest_description)
    : undefined

  const contest_rules = data.contest_rules
    ? sanitizeContestRules(data.contest_rules)
    : undefined

  const contest_image_url = data.contest_image_url
    ? sanitizeUrl(data.contest_image_url)
    : undefined

  // Enums
  const contest_type = sanitizeEnum(
    data.contest_type || 'performance',
    ['performance', 'sales', 'engagement', 'custom'],
    'Contest type'
  )

  const evaluation_frequency = sanitizeEnum(
    data.evaluation_frequency || 'daily',
    ['realtime', 'hourly', 'daily'],
    'Evaluation frequency'
  )

  const leaderboard_visibility = sanitizeEnum(
    data.leaderboard_visibility || 'public',
    ['public', 'private', 'rank_only'],
    'Leaderboard visibility'
  )

  const status = sanitizeEnum(
    data.status || 'draft',
    ['draft', 'scheduled', 'active', 'expired', 'disabled'],
    'Status'
  )

  // Booleans
  const target_all_partners = sanitizeBoolean(data.target_all_partners ?? true)
  const auto_evaluate = sanitizeBoolean(data.auto_evaluate ?? true)
  const enable_leaderboard = sanitizeBoolean(data.enable_leaderboard ?? true)
  const show_scores = sanitizeBoolean(data.show_scores ?? true)
  const notification_enabled = sanitizeBoolean(data.notification_enabled ?? true)

  // Numbers
  const winner_count = sanitizeInteger(data.winner_count || 1, 1, 1000)

  // JSON objects
  const evaluation_criteria = sanitizeJson(data.evaluation_criteria)
  const reward_details = data.reward_details ? sanitizeJson(data.reward_details) : undefined
  const reward_tiers = data.reward_tiers ? sanitizeJson(data.reward_tiers) : undefined

  return {
    contest_title,
    contest_description,
    contest_image_url,
    contest_rules,
    contest_type,
    target_category: sanitizeText(data.target_category || 'partner'),
    target_all_partners,
    start_date,
    end_date,
    evaluation_criteria,
    evaluation_frequency,
    auto_evaluate,
    reward_details,
    winner_count,
    reward_tiers,
    enable_leaderboard,
    leaderboard_visibility,
    show_scores,
    notification_enabled,
    status,
  }
}
