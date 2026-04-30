/**
 * SECURITY FIX HIGH-05: Comprehensive Input Length Validation
 *
 * Prevents:
 * - Buffer overflow attacks
 * - DoS via large payloads
 * - Database performance issues
 * - Storage exhaustion
 *
 * Fortune 500 Standard: Enforce strict input limits on all user-provided data
 */

import { z } from 'zod'

/**
 * Input length constraints (characters)
 */
export const INPUT_LIMITS = {
  // Basic fields
  EMAIL: { min: 5, max: 255 },
  NAME: { min: 1, max: 100 },
  PHONE: { min: 10, max: 20 },
  USERNAME: { min: 3, max: 50 },

  // Address fields
  ADDRESS_LINE: { min: 1, max: 255 },
  CITY: { min: 1, max: 100 },
  STATE: { min: 2, max: 100 },
  ZIP: { min: 3, max: 20 },
  COUNTRY: { min: 2, max: 100 },

  // Organization fields
  COMPANY_NAME: { min: 1, max: 255 },
  ORGANIZATION: { min: 1, max: 255 },
  DEPARTMENT: { min: 1, max: 100 },
  JOB_TITLE: { min: 1, max: 150 },

  // Document fields
  TITLE: { min: 1, max: 255 },
  DESCRIPTION: { min: 0, max: 2000 },
  NOTES: { min: 0, max: 5000 },
  COMMENT: { min: 1, max: 1000 },

  // Financial fields
  AMOUNT: { min: 0, max: 20 }, // For string representation
  CURRENCY: { min: 3, max: 3 }, // ISO 4217
  ACCOUNT_NUMBER: { min: 8, max: 34 }, // IBAN max length
  ROUTING_NUMBER: { min: 9, max: 9 },

  // System fields
  URL: { min: 10, max: 2048 },
  UUID: { min: 36, max: 36 },
  TOKEN: { min: 20, max: 512 },
  OTP: { min: 4, max: 8 },

  // Search and filter
  SEARCH_QUERY: { min: 1, max: 100 },
  TAG: { min: 1, max: 50 },
  CATEGORY: { min: 1, max: 100 },

  // File related
  FILE_NAME: { min: 1, max: 255 },
  FILE_PATH: { min: 1, max: 1024 },
  MIME_TYPE: { min: 3, max: 127 },
} as const

/**
 * Common validation schemas with length limits
 */
export const commonSchemas = {
  // Basic fields
  email: z.string()
    .min(INPUT_LIMITS.EMAIL.min, 'Email is too short')
    .max(INPUT_LIMITS.EMAIL.max, 'Email is too long (max 255 characters)')
    .email('Invalid email format')
    .trim()
    .toLowerCase(),

  name: z.string()
    .min(INPUT_LIMITS.NAME.min, 'Name is required')
    .max(INPUT_LIMITS.NAME.max, 'Name is too long (max 100 characters)')
    .trim()
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),

  phone: z.string()
    .min(INPUT_LIMITS.PHONE.min, 'Phone number is too short')
    .max(INPUT_LIMITS.PHONE.max, 'Phone number is too long (max 20 characters)')
    .trim()
    .regex(/^[+]?[0-9\s\-()]+$/, 'Invalid phone number format'),

  username: z.string()
    .min(INPUT_LIMITS.USERNAME.min, 'Username must be at least 3 characters')
    .max(INPUT_LIMITS.USERNAME.max, 'Username is too long (max 50 characters)')
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores'),

  // Address fields
  addressLine: z.string()
    .min(INPUT_LIMITS.ADDRESS_LINE.min, 'Address is required')
    .max(INPUT_LIMITS.ADDRESS_LINE.max, 'Address is too long (max 255 characters)')
    .trim(),

  city: z.string()
    .min(INPUT_LIMITS.CITY.min, 'City is required')
    .max(INPUT_LIMITS.CITY.max, 'City is too long (max 100 characters)')
    .trim(),

  state: z.string()
    .min(INPUT_LIMITS.STATE.min, 'State is required')
    .max(INPUT_LIMITS.STATE.max, 'State is too long (max 100 characters)')
    .trim(),

  zip: z.string()
    .min(INPUT_LIMITS.ZIP.min, 'ZIP code is too short')
    .max(INPUT_LIMITS.ZIP.max, 'ZIP code is too long (max 20 characters)')
    .trim(),

  country: z.string()
    .min(INPUT_LIMITS.COUNTRY.min, 'Country is required')
    .max(INPUT_LIMITS.COUNTRY.max, 'Country is too long (max 100 characters)')
    .trim(),

  // Organization fields
  companyName: z.string()
    .min(INPUT_LIMITS.COMPANY_NAME.min, 'Company name is required')
    .max(INPUT_LIMITS.COMPANY_NAME.max, 'Company name is too long (max 255 characters)')
    .trim(),

  department: z.string()
    .max(INPUT_LIMITS.DEPARTMENT.max, 'Department name is too long (max 100 characters)')
    .trim()
    .optional(),

  jobTitle: z.string()
    .max(INPUT_LIMITS.JOB_TITLE.max, 'Job title is too long (max 150 characters)')
    .trim()
    .optional(),

  // Document fields
  title: z.string()
    .min(INPUT_LIMITS.TITLE.min, 'Title is required')
    .max(INPUT_LIMITS.TITLE.max, 'Title is too long (max 255 characters)')
    .trim(),

  description: z.string()
    .max(INPUT_LIMITS.DESCRIPTION.max, 'Description is too long (max 2000 characters)')
    .trim()
    .optional(),

  notes: z.string()
    .max(INPUT_LIMITS.NOTES.max, 'Notes are too long (max 5000 characters)')
    .trim()
    .optional(),

  comment: z.string()
    .min(INPUT_LIMITS.COMMENT.min, 'Comment cannot be empty')
    .max(INPUT_LIMITS.COMMENT.max, 'Comment is too long (max 1000 characters)')
    .trim(),

  // Search and filter
  searchQuery: z.string()
    .min(INPUT_LIMITS.SEARCH_QUERY.min, 'Search query is too short')
    .max(INPUT_LIMITS.SEARCH_QUERY.max, 'Search query is too long (max 100 characters)')
    .trim(),

  tag: z.string()
    .min(INPUT_LIMITS.TAG.min, 'Tag is required')
    .max(INPUT_LIMITS.TAG.max, 'Tag is too long (max 50 characters)')
    .trim(),

  category: z.string()
    .min(INPUT_LIMITS.CATEGORY.min, 'Category is required')
    .max(INPUT_LIMITS.CATEGORY.max, 'Category is too long (max 100 characters)')
    .trim(),

  // System fields
  url: z.string()
    .min(INPUT_LIMITS.URL.min, 'URL is too short')
    .max(INPUT_LIMITS.URL.max, 'URL is too long (max 2048 characters)')
    .url('Invalid URL format')
    .trim(),

  uuid: z.string()
    .length(INPUT_LIMITS.UUID.min, 'Invalid UUID format')
    .uuid('Invalid UUID format'),

  otp: z.string()
    .min(INPUT_LIMITS.OTP.min, 'OTP is too short')
    .max(INPUT_LIMITS.OTP.max, 'OTP is too long')
    .regex(/^[0-9]+$/, 'OTP must contain only numbers'),

  // File related
  fileName: z.string()
    .min(INPUT_LIMITS.FILE_NAME.min, 'File name is required')
    .max(INPUT_LIMITS.FILE_NAME.max, 'File name is too long (max 255 characters)')
    .trim()
    .regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, 'File name contains invalid characters'),
}

/**
 * Sanitize input by trimming, limiting length, and removing dangerous characters
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input) return ''

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
}

/**
 * Sanitize HTML input by removing dangerous tags and attributes
 * For production: use DOMPurify or similar library
 */
export function sanitizeHTML(html: string): string {
  if (!html) return ''

  // Basic sanitization - in production, use DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove inline event handlers
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, INPUT_LIMITS.NOTES.max)
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(
  arr: T[],
  maxLength: number,
  fieldName: string = 'Array'
): { valid: boolean; error?: string } {
  if (arr.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum length of ${maxLength} items`
    }
  }
  return { valid: true }
}

/**
 * Validate object depth (prevent deeply nested payloads)
 */
export function validateObjectDepth(
  obj: unknown,
  maxDepth: number = 10,
  currentDepth: number = 0
): boolean {
  if (currentDepth > maxDepth) return false

  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (!validateObjectDepth(obj[key], maxDepth, currentDepth + 1)) {
        return false
      }
    }
  }

  return true
}

/**
 * Example usage in API routes:
 *
 * ```typescript
 * import { commonSchemas, sanitizeInput } from '@/lib/validation/input-validation'
 *
 * const schema = z.object({
 *   email: commonSchemas.email,
 *   name: commonSchemas.name,
 *   phone: commonSchemas.phone,
 *   description: commonSchemas.description,
 * })
 *
 * // Or custom with sanitization:
 * const cleanedInput = sanitizeInput(userInput, 500)
 * ```
 */
