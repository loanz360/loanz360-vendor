/**
 * Partner Profile Validation Schemas
 * Zod schemas for validating BA, BP, CP profile data
 */

import { z } from 'zod'

/**
 * Personal Details Validation Schema
 */
export const personalDetailsSchema = z.object({
  // Profile Picture (optional, URL)
  profile_picture_url: z.string().url().nullable().optional(),

  // Basic Information (Required)
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name cannot exceed 255 characters')
    .regex(/^[a-zA-Z\s.]+$/, 'Full name can only contain letters, spaces, and periods'),

  mobile_number: z
    .string()
    .regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits')
    .refine((val) => val.length === 10, 'Mobile number must be 10 digits'),

  work_email: z
    .string()
    .email('Invalid email address')
    .toLowerCase(),

  // Present Address
  present_address: z
    .string()
    .min(10, 'Present address must be at least 10 characters')
    .max(500, 'Present address cannot exceed 500 characters'),

  present_address_proof_url: z.string().url().nullable().optional(),
  present_address_proof_type: z.string().nullable().optional(),

  state_name: z
    .string()
    .min(2, 'Please select a state')
    .max(100, 'State name cannot exceed 100 characters'),

  state_code: z
    .string()
    .min(2, 'State code is required')
    .max(10, 'State code cannot exceed 10 characters')
    .toUpperCase(),

  pincode: z
    .string()
    .regex(/^[0-9]{6}$/, 'PIN code must be exactly 6 digits'),

  // Permanent Address
  permanent_address: z
    .string()
    .min(10, 'Permanent address must be at least 10 characters')
    .max(500, 'Permanent address cannot exceed 500 characters'),

  permanent_address_proof_url: z.string().url().nullable().optional(),
  permanent_address_proof_type: z.string().nullable().optional(),

  // Bio / Description
  bio_description: z
    .string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
    .default(''),
})

/**
 * Bank Details Validation Schema
 */
export const bankDetailsSchema = z.object({
  bank_name: z
    .string()
    .min(2, 'Bank name is required')
    .max(255, 'Bank name cannot exceed 255 characters')
    .regex(/^[a-zA-Z\s&]+$/, 'Bank name can only contain letters, spaces, and &'),

  branch_name: z
    .string()
    .min(2, 'Branch name is required')
    .max(255, 'Branch name cannot exceed 255 characters'),

  account_number: z
    .string()
    .min(9, 'Account number must be at least 9 digits')
    .max(18, 'Account number cannot exceed 18 digits')
    .regex(/^[0-9]+$/, 'Account number must contain only digits'),

  ifsc_code: z
    .string()
    .length(11, 'IFSC code must be exactly 11 characters')
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g., SBIN0001234)')
    .toUpperCase(),

  micr_code: z
    .string()
    .regex(/^[0-9]{9}$/, 'MICR code must be exactly 9 digits')
    .nullable()
    .optional()
    .or(z.literal('')),

  account_holder_name: z
    .string()
    .min(2, 'Account holder name is required')
    .max(255, 'Account holder name cannot exceed 255 characters')
    .regex(/^[a-zA-Z\s.]+$/, 'Account holder name can only contain letters, spaces, and periods'),

  cancelled_cheque_url: z.string().url().nullable().optional(),
})

/**
 * Complete Partner Profile Validation Schema
 * Combines personal and bank details
 */
export const partnerProfileSchema = z.object({
  // Personal Details
  ...personalDetailsSchema.shape,

  // Bank Details
  ...bankDetailsSchema.shape,
})

/**
 * Partial Update Schema
 * Allows updating individual sections
 */
export const partnerProfileUpdateSchema = partnerProfileSchema.partial()

/**
 * File Upload Validation Schema
 */
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  type: z.enum([
    'profile_picture',
    'present_address_proof',
    'permanent_address_proof',
    'cancelled_cheque',
  ]),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB
  allowedTypes: z.array(z.string()).default([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ]),
})

/**
 * Type inference from schemas
 */
export type PersonalDetailsInput = z.infer<typeof personalDetailsSchema>
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>
export type PartnerProfileInput = z.infer<typeof partnerProfileSchema>
export type PartnerProfileUpdateInput = z.infer<typeof partnerProfileUpdateSchema>
export type FileUploadInput = z.infer<typeof fileUploadSchema>

/**
 * Helper function to validate personal details
 */
export function validatePersonalDetails(data: unknown): {
  success: boolean
  data?: PersonalDetailsInput
  errors?: z.ZodError
} {
  try {
    const result = personalDetailsSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

/**
 * Helper function to validate bank details
 */
export function validateBankDetails(data: unknown): {
  success: boolean
  data?: BankDetailsInput
  errors?: z.ZodError
} {
  try {
    const result = bankDetailsSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

/**
 * Helper function to validate complete partner profile
 */
export function validatePartnerProfile(data: unknown): {
  success: boolean
  data?: PartnerProfileInput
  errors?: z.ZodError
} {
  try {
    const result = partnerProfileSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

/**
 * Extract error messages from Zod error
 */
export function getZodErrorMessages(error: z.ZodError): Record<string, string> {
  const messages: Record<string, string> = {}
  error.errors.forEach((err) => {
    const path = err.path.join('.')
    messages[path] = err.message
  })
  return messages
}
