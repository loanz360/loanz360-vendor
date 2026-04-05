import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

/**
 * Admin Validation Schema and Utilities
 * Enterprise-grade validation with XSS prevention
 */

// Enhanced email validation (RFC 5322 compliant)
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

// International phone number validation (E.164 format)
const phoneRegex = /^\+?[1-9]\d{1,14}$/

// Name validation (allows letters, spaces, hyphens, apostrophes)
const nameRegex = /^[a-zA-Z\s\-'\.]{2,100}$/

// UUID validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input) return ''

  // Remove any HTML tags and dangerous characters
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
  })

  return sanitized.trim()
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeString(value) as any
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value)
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return sanitized
}

/**
 * Create Admin Validation Schema
 */
export const createAdminSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .regex(nameRegex, 'Full name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(sanitizeString),

  email: z
    .string()
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must not exceed 255 characters')
    .regex(emailRegex, 'Invalid email format')
    .transform((email) => sanitizeString(email).toLowerCase()),

  mobile_number: z
    .string()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(15, 'Mobile number must not exceed 15 digits')
    .regex(phoneRegex, 'Invalid mobile number format (use E.164 format: +1234567890)')
    .transform(sanitizeString),

  present_address: z
    .string()
    .min(10, 'Present address must be at least 10 characters')
    .max(500, 'Present address must not exceed 500 characters')
    .transform(sanitizeString),

  permanent_address: z
    .string()
    .min(10, 'Permanent address must be at least 10 characters')
    .max(500, 'Permanent address must not exceed 500 characters')
    .transform(sanitizeString),

  location: z
    .string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location must not exceed 100 characters')
    .transform(sanitizeString),

  profile_picture_url: z
    .string()
    .url('Invalid profile picture URL')
    .max(1000, 'URL must not exceed 1000 characters')
    .optional()
    .nullable()
    .transform((url) => url ? sanitizeString(url) : null),

  notes: z
    .string()
    .max(2000, 'Notes must not exceed 2000 characters')
    .optional()
    .nullable()
    .transform((notes) => notes ? sanitizeString(notes) : null),

  created_by_user_id: z
    .string()
    .regex(uuidRegex, 'Invalid user ID format')
    .optional()
    .nullable(),
})

/**
 * Update Admin Validation Schema
 */
export const updateAdminSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .regex(nameRegex, 'Full name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(sanitizeString)
    .optional(),

  email: z
    .string()
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must not exceed 255 characters')
    .regex(emailRegex, 'Invalid email format')
    .transform((email) => sanitizeString(email).toLowerCase())
    .optional(),

  mobile_number: z
    .string()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(15, 'Mobile number must not exceed 15 digits')
    .regex(phoneRegex, 'Invalid mobile number format (use E.164 format: +1234567890)')
    .transform(sanitizeString)
    .optional(),

  present_address: z
    .string()
    .min(10, 'Present address must be at least 10 characters')
    .max(500, 'Present address must not exceed 500 characters')
    .transform(sanitizeString)
    .optional(),

  permanent_address: z
    .string()
    .min(10, 'Permanent address must be at least 10 characters')
    .max(500, 'Permanent address must not exceed 500 characters')
    .transform(sanitizeString)
    .optional(),

  location: z
    .string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location must not exceed 100 characters')
    .transform(sanitizeString)
    .optional(),

  profile_picture_url: z
    .string()
    .url('Invalid profile picture URL')
    .max(1000, 'URL must not exceed 1000 characters')
    .optional()
    .nullable()
    .transform((url) => url ? sanitizeString(url) : null),

  notes: z
    .string()
    .max(2000, 'Notes must not exceed 2000 characters')
    .optional()
    .nullable()
    .transform((notes) => notes ? sanitizeString(notes) : null),

  updated_by_user_id: z
    .string()
    .regex(uuidRegex, 'Invalid user ID format')
    .optional()
    .nullable(),

  last_known_update: z
    .string()
    .datetime('Invalid timestamp format')
    .optional(),
})

/**
 * Query Parameter Validation Schema
 */
export const queryParamsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'Page must be at least 1').max(10000, 'Page must not exceed 10000')),

  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must not exceed 100')),

  status: z
    .enum(['all', 'enabled', 'disabled'])
    .optional()
    .default('all'),

  search: z
    .string()
    .max(200, 'Search query must not exceed 200 characters')
    .optional()
    .transform((val) => val ? sanitizeString(val) : ''),

  location: z
    .string()
    .max(100, 'Location filter must not exceed 100 characters')
    .optional()
    .transform((val) => val ? sanitizeString(val) : ''),

  sortBy: z
    .enum(['created_at', 'updated_at', 'full_name', 'email', 'admin_unique_id', 'status', 'location'])
    .optional()
    .default('created_at'),

  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
})

/**
 * Permission Update Validation Schema
 */
export const updatePermissionSchema = z.object({
  module_key: z
    .string()
    .min(1, 'Module key is required')
    .max(100, 'Module key must not exceed 100 characters')
    .regex(/^[a-z0-9_-]+$/, 'Module key must be lowercase alphanumeric with hyphens/underscores')
    .transform(sanitizeString),

  is_enabled: z.boolean({
    required_error: 'is_enabled is required',
    invalid_type_error: 'is_enabled must be a boolean',
  }),

  updated_by_user_id: z
    .string()
    .regex(uuidRegex, 'Invalid user ID format')
    .optional()
    .nullable(),
})

/**
 * Bulk Permission Update Validation Schema
 */
export const bulkUpdatePermissionsSchema = z.object({
  permissions: z
    .array(
      z.object({
        module_key: z
          .string()
          .min(1, 'Module key is required')
          .max(100, 'Module key must not exceed 100 characters')
          .regex(/^[a-z0-9_-]+$/, 'Module key must be lowercase alphanumeric with hyphens/underscores')
          .transform(sanitizeString),

        is_enabled: z.boolean(),
      })
    )
    .min(1, 'At least one permission must be provided')
    .max(100, 'Cannot update more than 100 permissions at once'),

  updated_by_user_id: z
    .string()
    .regex(uuidRegex, 'Invalid user ID format')
    .optional()
    .nullable(),
})

/**
 * Status Update Validation Schema
 */
export const updateStatusSchema = z.object({
  status: z.enum(['enabled', 'disabled'], {
    required_error: 'Status is required',
    invalid_type_error: 'Status must be either "enabled" or "disabled"',
  }),

  updated_by_user_id: z
    .string()
    .regex(uuidRegex, 'Invalid user ID format')
    .optional()
    .nullable(),
})

/**
 * UUID Parameter Validation
 */
export const uuidParamSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid UUID format'),
})

/**
 * Validation Error Formatter
 */
export function formatValidationErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
}

/**
 * Type exports for TypeScript
 */
export type CreateAdminInput = z.infer<typeof createAdminSchema>
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>
export type QueryParamsInput = z.infer<typeof queryParamsSchema>
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>
export type BulkUpdatePermissionsInput = z.infer<typeof bulkUpdatePermissionsSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
