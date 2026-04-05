/**
 * Incentive Management - Input Validation Schemas
 * Using Zod for runtime type validation and security
 */

import { z } from 'zod'

// =====================================================
// ENUM SCHEMAS
// =====================================================

export const IncentiveStatusSchema = z.enum(['draft', 'active', 'expired', 'disabled'])
export const IncentiveTypeSchema = z.enum([
  'bonus',
  'commission',
  'reward',
  'cash',
  'voucher',
  'gift',
  'travel',
  'other',
])
export const AllocationStatusSchema = z.enum([
  'eligible',
  'in_progress',
  'achieved',
  'partially_achieved',
  'not_achieved',
  'claimed',
  'expired',
])
export const ClaimStatusSchema = z.enum(['pending', 'approved', 'rejected', 'paid'])
export const MeasurementTypeSchema = z.enum(['count', 'amount', 'percentage'])
export const TargetPeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'program_duration',
])

// =====================================================
// NESTED OBJECT SCHEMAS
// =====================================================

export const PerformanceCriteriaSchema = z.object({
  metric: z
    .string()
    .min(1, 'Metric is required')
    .max(100, 'Metric name too long')
    .regex(/^[a-z_]+$/, 'Metric must be lowercase with underscores'),
  target_value: z.number().positive('Target value must be positive'),
  measurement_type: MeasurementTypeSchema,
  target_period: TargetPeriodSchema.optional(),
  description: z.string().max(500).optional(),
  tiers: z
    .array(
      z.object({
        min: z.number().min(0),
        max: z.number().positive(),
        reward_amount: z.number().positive(),
        reward_percentage: z.number().min(0).max(100).optional(),
      })
    )
    .optional(),
})

export const RewardDetailsSchema = z.object({
  type: z.enum(['fixed', 'tiered', 'percentage', 'variable']),
  slabs: z
    .array(
      z.object({
        min: z.number().min(0),
        max: z.number().positive(),
        amount: z.number().positive(),
      })
    )
    .optional(),
  percentage: z.number().min(0).max(100).optional(),
  base_amount: z.number().positive().optional(),
  voucher_type: z.string().max(100).optional(),
  gift_details: z.string().max(500).optional(),
  travel_destination: z.string().max(200).optional(),
})

// =====================================================
// CREATE INCENTIVE VALIDATION
// =====================================================

export const CreateIncentiveSchema = z
  .object({
    incentive_title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title must be less than 255 characters')
      .trim(),
    incentive_description: z
      .string()
      .max(2000, 'Description must be less than 2000 characters')
      .trim()
      .optional(),
    incentive_type: IncentiveTypeSchema,
    incentive_image_url: z
      .string()
      .url('Invalid image URL')
      .max(500, 'URL too long')
      .optional()
      .or(z.literal('')),
    reward_amount: z
      .number()
      .positive('Reward amount must be positive')
      .max(100000000, 'Reward amount exceeds maximum')
      .optional(),
    reward_currency: z
      .string()
      .length(3, 'Currency must be 3-letter code (e.g., INR, USD)')
      .toUpperCase()
      .default('INR'),
    reward_details: RewardDetailsSchema.optional(),
    start_date: z.string().datetime('Invalid start date format'),
    end_date: z.string().datetime('Invalid end date format'),
    target_category: z.enum(['employee', 'partner', 'customer', 'all']).default('employee'),
    target_all_employees: z.boolean().default(false),
    target_subroles: z
      .array(z.string().uuid('Invalid subrole ID'))
      .default([])
      .refine((arr) => arr.length <= 20, 'Maximum 20 target subroles allowed'),
    performance_criteria: PerformanceCriteriaSchema,
    status: IncentiveStatusSchema.default('draft'),
    display_order: z.number().int().min(0).max(1000).default(0),
    notify_on_launch: z.boolean().default(true),
    notify_before_expiry_days: z.number().int().min(0).max(90).default(5),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: 'End date must be after start date',
    path: ['end_date'],
  })
  .refine(
    (data) => {
      if (!data.target_all_employees && data.target_subroles.length === 0) {
        return false
      }
      return true
    },
    {
      message: 'Either target_all_employees must be true or target_subroles must be provided',
      path: ['target_subroles'],
    }
  )
  .refine(
    (data) => {
      const startDate = new Date(data.start_date)
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      return startDate >= oneDayAgo
    },
    {
      message: 'Start date cannot be more than 1 day in the past',
      path: ['start_date'],
    }
  )

// =====================================================
// UPDATE INCENTIVE VALIDATION
// =====================================================

export const UpdateIncentiveSchema = z
  .object({
    incentive_title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title must be less than 255 characters')
      .trim()
      .optional(),
    incentive_description: z
      .string()
      .max(2000, 'Description must be less than 2000 characters')
      .trim()
      .optional(),
    incentive_type: IncentiveTypeSchema.optional(),
    incentive_image_url: z
      .string()
      .url('Invalid image URL')
      .max(500, 'URL too long')
      .optional()
      .or(z.literal('')),
    reward_amount: z
      .number()
      .positive('Reward amount must be positive')
      .max(100000000, 'Reward amount exceeds maximum')
      .optional(),
    reward_currency: z
      .string()
      .length(3, 'Currency must be 3-letter code (e.g., INR, USD)')
      .toUpperCase()
      .optional(),
    reward_details: RewardDetailsSchema.optional(),
    start_date: z.string().datetime('Invalid start date format').optional(),
    end_date: z.string().datetime('Invalid end date format').optional(),
    target_all_employees: z.boolean().optional(),
    target_subroles: z
      .array(z.string().uuid('Invalid subrole ID'))
      .refine((arr) => arr.length <= 20, 'Maximum 20 target subroles allowed')
      .optional(),
    performance_criteria: PerformanceCriteriaSchema.optional(),
    status: IncentiveStatusSchema.optional(),
    display_order: z.number().int().min(0).max(1000).optional(),
    notify_before_expiry_days: z.number().int().min(0).max(90).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) > new Date(data.start_date)
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

// =====================================================
// CLAIM VALIDATION
// =====================================================

export const CreateClaimSchema = z.object({
  allocation_id: z.string().uuid('Invalid allocation ID'),
  claimed_amount: z
    .number()
    .positive('Claimed amount must be positive')
    .max(100000000, 'Claimed amount exceeds maximum'),
  payment_method: z
    .enum(['bank_transfer', 'cash', 'check', 'digital_wallet', 'payroll', 'other'])
    .optional(),
  claim_notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
})

export const ReviewClaimSchema = z.object({
  claim_id: z.string().uuid('Invalid claim ID'),
  claim_status: z.enum(['approved', 'rejected', 'paid']),
  review_notes: z.string().max(1000, 'Review notes must be less than 1000 characters').optional(),
  payment_reference: z
    .string()
    .min(1, 'Payment reference is required for paid status')
    .max(200, 'Payment reference too long')
    .optional(),
})

// =====================================================
// PROGRESS UPDATE VALIDATION
// =====================================================

export const UpdateProgressSchema = z.object({
  allocation_id: z.string().uuid('Invalid allocation ID'),
  metric_name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z_]+$/, 'Metric name must be lowercase with underscores'),
  metric_value: z.number().min(0, 'Metric value cannot be negative'),
  milestone_reached: z.string().max(50).optional(),
  milestone_reward: z.number().positive().optional(),
})

// =====================================================
// QUERY PARAMETER VALIDATION
// =====================================================

export const IncentiveListQuerySchema = z.object({
  status: IncentiveStatusSchema.optional(),
  subrole: z.string().uuid().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('50'),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0))
    .default('0'),
  search: z.string().max(200).optional(),
})

export const ClaimListQuerySchema = z.object({
  status: ClaimStatusSchema.optional(),
  user_id: z.string().uuid().optional(),
  incentive_id: z.string().uuid().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('50'),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0))
    .default('0'),
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Validate and parse request body with Zod schema
 * Returns validated data or throws with detailed error messages
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; details: any }> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      return {
        success: false,
        error: 'Validation failed',
        details: errors,
      }
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Invalid JSON in request body',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string; details: any } {
  try {
    const params = Object.fromEntries(searchParams.entries())
    const result = schema.safeParse(params)

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      return {
        success: false,
        error: 'Invalid query parameters',
        details: errors,
      }
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse query parameters',
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
