/**
 * Universal Loan Application Form Module (ULAFM) - Validation Schemas
 * Version: 1.0.0
 *
 * Comprehensive Zod schemas for loan application form validation
 */

import { z } from 'zod'

// =====================================================
// COMMON VALIDATORS
// =====================================================

/**
 * Indian mobile number validation (10 digits starting with 6-9)
 */
export const indianMobileSchema = z
  .string()
  .min(1, 'Mobile number is required')
  .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number')
  .length(10, 'Mobile number must be exactly 10 digits')

/**
 * Email validation (optional but must be valid if provided)
 */
export const optionalEmailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(255, 'Email is too long')
  .optional()
  .or(z.literal(''))

/**
 * Required email validation
 */
export const requiredEmailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(255, 'Email is too long')
  .toLowerCase()
  .trim()

/**
 * Full name validation
 */
export const fullNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name is too long')
  .regex(
    /^[a-zA-Z\s.''-]+$/,
    'Name can only contain letters, spaces, and basic punctuation'
  )
  .trim()

/**
 * Loan amount validation
 */
export const loanAmountSchema = z
  .number()
  .min(10000, 'Minimum loan amount is ₹10,000')
  .max(100000000, 'Maximum loan amount is ₹10 Crore')
  .optional()

/**
 * Loan purpose validation
 */
export const loanPurposeSchema = z
  .string()
  .max(500, 'Purpose description is too long')
  .optional()
  .or(z.literal(''))

// =====================================================
// LOAN TYPE OPTIONS
// =====================================================

export const LOAN_TYPES = [
  // Consumer Loans
  { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
  { value: 'HOME_LOAN', label: 'Home Loan' },
  { value: 'NEW_CAR_LOAN', label: 'New Car Loan' },
  { value: 'USED_CAR_LOAN', label: 'Used Car Purchase Loan' },
  { value: 'BUSINESS_LOAN', label: 'Business Loan' },
  { value: 'EDUCATION_LOAN', label: 'Education Loan' },
  { value: 'LOAN_AGAINST_PROPERTY', label: 'Loan Against Property' },
  { value: 'GOLD_LOAN', label: 'Gold Loan' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  // Business & Working Capital Loans
  { value: 'WORKING_CAPITAL', label: 'Working Capital' },
  { value: 'MACHINERY_LOAN', label: 'Machinery Loan' },
  { value: 'BILL_DISCOUNTING', label: 'Bill Discounting' },
  { value: 'OVERDRAFT', label: 'OD (Overdraft)' },
  { value: 'CASH_CREDIT', label: 'CC (Cash Credit)' },
  // Property & Asset-Backed Loans
  { value: 'MORTGAGE_LOAN', label: 'Mortgage Loan' },
  { value: 'LOAN_AGAINST_SHARES', label: 'Loan Against Shares' },
  { value: 'LEASE_RENTAL_DISCOUNTING', label: 'Lease Rental Discounting' },
  { value: 'REFINANCE', label: 'Refinance' },
  { value: 'BALANCE_TRANSFER', label: 'Balance Transfer' },
  { value: 'TOP_UP_VEHICLE_LOAN', label: 'Top-up on Existing Vehicle Loan' },
  // Professional-Specific Loans
  { value: 'LOAN_TO_DOCTORS', label: 'Loan to Doctors' },
  { value: 'LOAN_TO_HOSPITALS', label: 'Loan to Hospitals' },
  { value: 'LOAN_TO_EDUCATIONAL_INSTITUTIONS', label: 'Loan to Educational Institutions' },
  { value: 'LOAN_TO_BUILDERS', label: 'Loan to Builders' },
  { value: 'LOAN_TO_PROFESSIONALS', label: 'Loan to Professionals' },
  // NRI Loans
  { value: 'NRI_LOAN', label: 'NRI Loan' },
] as const

export const loanTypeValues = LOAN_TYPES.map((t) => t.value) as [string, ...string[]]

export const loanTypeSchema = z.enum(loanTypeValues, {
  errorMap: () => ({ message: 'Please select a loan type' }),
})

// =====================================================
// QUICK FORM SCHEMA (Tab 1 - Basic Details)
// =====================================================

/**
 * Quick Form Schema - Basic customer inquiry
 * Fields: Name, Mobile, Email (optional), Location, Loan Type
 */
export const ulafQuickFormSchema = z.object({
  customer_full_name: fullNameSchema,
  customer_mobile: indianMobileSchema,
  customer_email: optionalEmailSchema,
  customer_location: z
    .string()
    .min(2, 'Location is required')
    .max(100, 'Location is too long')
    .trim(),
  loan_type: loanTypeSchema,
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service',
  }),
  referral_token: z.string().optional(),
})

export type ULAFQuickFormData = z.infer<typeof ulafQuickFormSchema>

// =====================================================
// MAIN FORM SCHEMA - PHASE 1
// =====================================================

/**
 * Phase 1 Loan Application Form Schema
 * Basic customer details and loan requirements
 */
export const ulafPhase1Schema = z.object({
  // Customer Details
  customer_full_name: fullNameSchema,
  customer_mobile: indianMobileSchema,
  customer_email: optionalEmailSchema,

  // Loan Requirements
  loan_type: loanTypeSchema,
  loan_amount: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
    loanAmountSchema
  ),
  loan_purpose: loanPurposeSchema,

  // Consent
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service',
  }),
  privacy_accepted: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),

  // Hidden fields for attribution (populated automatically)
  referral_token: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
})

export type ULAFPhase1FormData = z.infer<typeof ulafPhase1Schema>

// =====================================================
// EXTENDED FORM SCHEMA - PHASE 2 (Future)
// =====================================================

/**
 * Phase 2 Extended Form Schema
 * Additional fields for KYC and detailed loan processing
 */
export const ulafPhase2Schema = ulafPhase1Schema.extend({
  // Personal Details
  date_of_birth: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true
        const date = new Date(val)
        const age =
          (new Date().getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        return age >= 18 && age <= 70
      },
      { message: 'Age must be between 18 and 70 years' }
    ),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  marital_status: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),

  // Address Details
  address_line_1: z.string().max(200).optional(),
  address_line_2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be 6 digits')
    .optional()
    .or(z.literal('')),

  // Employment Details
  employment_type: z
    .enum([
      'SALARIED',
      'SELF_EMPLOYED',
      'BUSINESS_OWNER',
      'PROFESSIONAL',
      'RETIRED',
      'STUDENT',
      'HOMEMAKER',
      'OTHER',
    ])
    .optional(),
  employer_name: z.string().max(200).optional(),
  monthly_income: z.number().positive().optional(),
  work_experience_years: z.number().int().min(0).max(50).optional(),

  // Identity Documents
  pan_number: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  aadhaar_last_4: z
    .string()
    .regex(/^\d{4}$/, 'Enter last 4 digits of Aadhaar')
    .optional()
    .or(z.literal('')),
})

export type ULAFPhase2FormData = z.infer<typeof ulafPhase2Schema>

// =====================================================
// TOKEN VALIDATION SCHEMAS
// =====================================================

export const senderTypes = [
  'EMPLOYEE',
  'PARTNER',
  'BUSINESS_ASSOCIATE',
  'CHANNEL_PARTNER',
  'CUSTOMER',
  'AGENT',
  'AFFILIATE',
  'SYSTEM',
] as const

export const senderTypeSchema = z.enum(senderTypes)

export const sourceMediums = [
  'WHATSAPP',
  'EMAIL',
  'SMS',
  'QR_CODE',
  'SOCIAL_MEDIA',
  'WEBSITE',
  'DIRECT',
  'REFERRAL',
  'ORGANIC',
] as const

export const sourceMediumSchema = z.enum(sourceMediums)

/**
 * Create Token Request Schema
 */
export const createTokenSchema = z.object({
  sender_type: senderTypeSchema,
  sender_subrole: z.string().max(100).optional(),
  sender_name: z.string().max(255).optional(),
  sender_email: z.string().email().max(255).optional(),
  sender_mobile: indianMobileSchema.optional(),

  campaign_id: z.string().max(100).optional(),
  campaign_name: z.string().max(255).optional(),
  source: sourceMediumSchema.optional(),
  medium: z.string().max(100).optional(),

  expires_in_days: z.number().int().min(1).max(365).optional(),
  max_uses: z.number().int().min(1).optional(),
})

export type CreateTokenData = z.infer<typeof createTokenSchema>

// =====================================================
// APPLICATION SUBMISSION SCHEMA
// =====================================================

/**
 * Full Application Submission Schema (for API)
 * Supports both Quick Form and Detailed Form submissions
 */
export const submitApplicationSchema = z.object({
  // Form type indicator
  form_type: z.enum(['quick', 'detailed']).optional().default('detailed'),

  // Token for attribution
  token: z.string().optional(),
  referral_token: z.string().optional(),

  // Customer details
  customer_full_name: fullNameSchema,
  customer_mobile: indianMobileSchema,
  customer_email: optionalEmailSchema,
  customer_location: z.string().max(100).optional(), // For Quick Form

  // Loan details
  loan_type: loanTypeSchema,
  loan_amount: z.number().positive().optional(),
  loan_purpose: loanPurposeSchema,

  // Additional fields (extensible)
  additional_fields: z.record(z.unknown()).optional(),

  // Consent
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'Terms must be accepted',
  }),
  privacy_accepted: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),

  // UTM parameters
  utm_source: z.string().max(255).optional(),
  utm_medium: z.string().max(255).optional(),
  utm_campaign: z.string().max(255).optional(),
  utm_term: z.string().max(255).optional(),
  utm_content: z.string().max(255).optional(),
})

export type SubmitApplicationData = z.infer<typeof submitApplicationSchema>

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format validation errors for display
 */
export function formatValidationErrors(
  errors: z.ZodError
): Record<string, string> {
  const formatted: Record<string, string> = {}

  errors.errors.forEach((err) => {
    const path = err.path.join('.')
    if (!formatted[path]) {
      formatted[path] = err.message
    }
  })

  return formatted
}

/**
 * Validate form data safely
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, errors: formatValidationErrors(result.error) }
}

/**
 * Get loan type label from value
 */
export function getLoanTypeLabel(value: string): string {
  const loanType = LOAN_TYPES.find((t) => t.value === value)
  return loanType?.label || value
}

/**
 * Format mobile number for display
 */
export function formatMobileNumber(mobile: string): string {
  if (mobile.length !== 10) return mobile
  return `${mobile.slice(0, 5)} ${mobile.slice(5)}`
}

/**
 * Format loan amount for display (Indian numbering system)
 */
export function formatLoanAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
