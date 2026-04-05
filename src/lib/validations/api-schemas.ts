/**
 * API Input Validation Schemas
 *
 * Comprehensive Zod schemas for all API endpoints
 * SECURITY: Validates all user inputs to prevent injection attacks
 *
 * COMPLIANCE: OWASP A03:2021 - Injection Prevention
 */

import { z } from 'zod'

// =============================================================================
// COMMON VALIDATORS
// =============================================================================

/**
 * Email validation (RFC 5322 compliant)
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .trim()
  .toLowerCase()

/**
 * Phone number validation (Indian format)
 */
export const phoneSchema = z.string()
  .regex(/^[6-9]\d{9}$/, 'Invalid phone number. Must be 10 digits starting with 6-9')
  .length(10, 'Phone number must be exactly 10 digits')

/**
 * PAN number validation
 */
export const panSchema = z.string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g., ABCDE1234F)')
  .length(10, 'PAN must be 10 characters')
  .toUpperCase()

/**
 * Aadhaar number validation
 */
export const aadhaarSchema = z.string()
  .regex(/^\d{12}$/, 'Invalid Aadhaar number. Must be 12 digits')
  .length(12, 'Aadhaar must be 12 digits')

/**
 * Name validation (no special characters except spaces, hyphens, apostrophes)
 */
export const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes')
  .trim()

/**
 * Password validation (enterprise grade)
 */
export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format')

/**
 * Amount validation (financial amounts)
 */
export const amountSchema = z.number()
  .positive('Amount must be positive')
  .finite('Amount must be a finite number')
  .multipleOf(0.01, 'Amount cannot have more than 2 decimal places')
  .max(999999999.99, 'Amount too large')

/**
 * Safe string validation (prevents injection)
 */
export const safeStringSchema = z.string()
  .max(1000, 'Text too long')
  .trim()
  .refine(
    (val) => !/<script|javascript:|on\w+\s*=/i.test(val),
    'Invalid characters detected'
  )

// =============================================================================
// FILE UPLOAD VALIDATION
// =============================================================================

export const fileUploadSchema = z.object({
  filename: z.string()
    .min(1, 'Filename required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename. Use only letters, numbers, dots, dashes, underscores'),
  size: z.number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  mimeType: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
  ], { errorMap: () => ({ message: 'Unsupported file type' }) }),
})

// =============================================================================
// CONTACT/CUSTOMER VALIDATION
// =============================================================================

export const contactSchema = z.object({
  full_name: nameSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: safeStringSchema.max(200).optional(),
  location: safeStringSchema.max(200).optional(),
}).refine(
  (data) => data.email || data.phone,
  {
    message: 'At least one contact method (email or phone) is required',
    path: ['email'],
  }
)

export const customerSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  pan_number: panSchema.optional(),
  aadhaar_number: aadhaarSchema.optional(),
  customer_category: z.enum([
    'INDIVIDUAL',
    'SALARIED',
    'PROPRIETOR',
    'PARTNERSHIP',
    'PRIVATE_LIMITED_COMPANY',
    'PUBLIC_LIMITED_COMPANY',
    'LLP',
    'DOCTOR',
    'LAWYER',
    'PURE_RENTAL',
    'AGRICULTURE',
    'NRI',
    'CHARTERED_ACCOUNTANT',
    'COMPANY_SECRETARY',
    'HUF',
  ]),
  address: z.object({
    street: safeStringSchema.max(200),
    city: safeStringSchema.max(100),
    state: safeStringSchema.max(100),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    country: z.string().default('India'),
  }).optional(),
})

// =============================================================================
// LOAN APPLICATION VALIDATION
// =============================================================================

export const loanApplicationSchema = z.object({
  loan_type: z.enum([
    'HOME_LOAN',
    'PERSONAL_LOAN',
    'BUSINESS_LOAN',
    'CAR_LOAN',
    'EDUCATION_LOAN',
    'GOLD_LOAN',
    'PROPERTY_LOAN',
  ]),
  loan_amount: amountSchema.min(10000, 'Minimum loan amount is ₹10,000'),
  tenure_months: z.number()
    .int()
    .min(1, 'Minimum tenure is 1 month')
    .max(360, 'Maximum tenure is 360 months (30 years)'),
  purpose: safeStringSchema.max(500),
  monthly_income: amountSchema.min(0, 'Monthly income cannot be negative').optional(),
  existing_emi: amountSchema.min(0, 'Existing EMI cannot be negative').default(0),
})

// =============================================================================
// PAYOUT VALIDATION
// =============================================================================

export const payoutSchema = z.object({
  partner_id: uuidSchema,
  payout_type: z.enum(['COMMISSION', 'INCENTIVE', 'BONUS', 'REFERRAL']),
  amount: amountSchema.min(0.01, 'Minimum payout is ₹0.01'),
  description: safeStringSchema.max(500).optional(),
  reference_id: z.string().max(100).optional(),
})

// =============================================================================
// USER MANAGEMENT VALIDATION
// =============================================================================

export const userCreateSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'PARTNER', 'EMPLOYEE', 'CUSTOMER', 'VENDOR']),
  sub_role: z.string().max(50).optional(),
  mobile: phoneSchema.optional(),
})

export const userUpdateSchema = z.object({
  full_name: nameSchema.optional(),
  mobile: phoneSchema.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']).optional(),
  avatar_url: z.string().url().max(500).optional(),
}).strict() // Prevent additional fields

// =============================================================================
// QUERY PARAMETER VALIDATION
// =============================================================================

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z.string().max(50).optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

export const searchSchema = z.object({
  query: safeStringSchema.min(1).max(100),
  filters: z.record(z.string()).optional(),
})

// =============================================================================
// AUDIT LOG VALIDATION
// =============================================================================

export const auditLogSchema = z.object({
  action: z.string().max(50),
  entity_type: z.string().max(50),
  entity_id: uuidSchema.optional(),
  details: z.record(z.any()).optional(),
  ip_address: z.string().regex(/^(?:\d{1,3}\.){3}\d{1,3}$|^[a-fA-F0-9:]+$/, 'Invalid IP address').optional(),
  user_agent: z.string().max(500).optional(),
})

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate and sanitize API input
 * Returns validated data or throws ZodError
 */
export function validateInput<T>(schema: zSchema<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Safe validation that returns success/error without throwing
 */
export function safeValidateInput<T>(
  schema: zSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, errors: result.error }
}

/**
 * Format Zod errors for API response
 */
export function formatValidationErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}

  error.errors.forEach((err) => {
    const path = err.path.join('.')
    if (!formatted[path]) {
      formatted[path] = []
    }
    formatted[path].push(err.message)
  })

  return formatted
}

// =============================================================================
// SANITIZATION HELPERS
// =============================================================================

/**
 * Sanitize string for SQL (additional layer on top of parameterized queries)
 */
export function sanitizeForSQL(input: string): string {
  return input
    .replace(/[;'"\\]/g, '') // Remove SQL metacharacters
    .trim()
}

/**
 * Sanitize string for display (prevent XSS)
 */
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string): { valid: boolean; sanitized?: string; error?: string } {
  const result = emailSchema.safeParse(email)

  if (result.success) {
    return { valid: true, sanitized: result.data }
  }

  return { valid: false, error: result.error.errors[0]?.message || 'Invalid email' }
}

/**
 * Validate and sanitize phone
 */
export function validatePhone(phone: string): { valid: boolean; sanitized?: string; error?: string } {
  const result = phoneSchema.safeParse(phone)

  if (result.success) {
    return { valid: true, sanitized: result.data }
  }

  return { valid: false, error: result.error.errors[0]?.message || 'Invalid phone' }
}
