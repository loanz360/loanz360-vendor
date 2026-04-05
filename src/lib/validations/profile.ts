import { z } from 'zod'
import { VALIDATION_RULES, CUSTOMER_CATEGORIES, EMPLOYEE_ROLES, PARTNER_TYPES } from '../constants'

// Base profile validation schema
export const baseProfileSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name should only contain letters and spaces'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  mobile: z
    .string()
    .min(1, 'Mobile number is required')
    .regex(VALIDATION_RULES.mobile.pattern, 'Please enter a valid 10-digit mobile number'),
  dateOfBirth: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true
      const birthDate = new Date(date)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      return age >= 18 && age <= 100
    }, 'Age must be between 18 and 100 years'),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
})

// Address validation schema
export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z
    .string()
    .min(1, 'Pincode is required')
    .regex(/^\d{6}$/, 'Please enter a valid 6-digit pincode'),
  country: z.string().min(1, 'Country is required').default('India'),
})

// Customer profile validation schema
export const customerProfileSchema = baseProfileSchema.extend({
  customerCategory: z.nativeEnum(CUSTOMER_CATEGORIES, {
    message: 'Please select a customer category',
  }),
  panNumber: z
    .string()
    .optional()
    .refine((pan) => {
      if (!pan) return true
      return VALIDATION_RULES.pan.pattern.test(pan)
    }, 'Please enter a valid PAN number (e.g., ABCDE1234F)'),
  aadhaarNumber: z
    .string()
    .optional()
    .refine((aadhaar) => {
      if (!aadhaar) return true
      return VALIDATION_RULES.aadhaar.pattern.test(aadhaar)
    }, 'Please enter a valid 12-digit Aadhaar number'),
  currentAddress: addressSchema,
  permanentAddress: addressSchema.optional(),
  sameAsCurrent: z.boolean().default(false),
  incomeDetails: z.object({
    employmentType: z.enum(['Salaried', 'Self-Employed', 'Business', 'Retired', 'Student']).optional(),
    monthlyIncome: z.number().positive('Monthly income must be positive').optional(),
    companyName: z.string().optional(),
    designation: z.string().optional(),
    workExperience: z.number().positive('Work experience must be positive').optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().min(1, 'Emergency contact name is required'),
    relation: z.string().min(1, 'Relation is required'),
    mobile: z.string().regex(VALIDATION_RULES.mobile.pattern, 'Please enter a valid mobile number'),
  }).optional(),
})

// Employee profile validation schema
export const employeeProfileSchema = baseProfileSchema.extend({
  employeeRole: z.nativeEnum(EMPLOYEE_ROLES, {
    message: 'Please select an employee role',
  }),
  employeeId: z.string().optional(), // Auto-generated, read-only
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  location: z.string().min(1, 'Location is required'),
  geography: z.string().optional(),
  joiningDate: z.string().min(1, 'Joining date is required'),
  managerId: z.string().optional(),
  panNumber: z
    .string()
    .min(1, 'PAN number is required')
    .regex(VALIDATION_RULES.pan.pattern, 'Please enter a valid PAN number'),
  aadhaarNumber: z
    .string()
    .min(1, 'Aadhaar number is required')
    .regex(VALIDATION_RULES.aadhaar.pattern, 'Please enter a valid Aadhaar number'),
  currentAddress: addressSchema,
  permanentAddress: addressSchema.optional(),
  sameAsCurrent: z.boolean().default(false),
  emergencyContact: z.object({
    name: z.string().min(1, 'Emergency contact name is required'),
    relation: z.string().min(1, 'Relation is required'),
    mobile: z.string().regex(VALIDATION_RULES.mobile.pattern, 'Please enter a valid mobile number'),
  }),
})

// Partner profile validation schema
export const partnerProfileSchema = baseProfileSchema.extend({
  partnerType: z.nativeEnum(PARTNER_TYPES, {
    message: 'Please select a partner type',
  }),
  partnerId: z.string().optional(), // Auto-generated, read-only
  businessName: z.string().min(1, 'Business name is required'),
  registrationNumber: z.string().optional(),
  gstNumber: z
    .string()
    .optional()
    .refine((gst) => {
      if (!gst) return true
      return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)
    }, 'Please enter a valid GST number'),
  panNumber: z
    .string()
    .min(1, 'PAN number is required')
    .regex(VALIDATION_RULES.pan.pattern, 'Please enter a valid PAN number'),
  businessAddress: addressSchema,
  personalAddress: addressSchema.optional(),
  sameAsBusinessAddress: z.boolean().default(false),
  bankDetails: z.object({
    accountHolderName: z.string().min(1, 'Account holder name is required'),
    accountNumber: z.string().min(1, 'Account number is required'),
    ifscCode: z
      .string()
      .min(1, 'IFSC code is required')
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code'),
    bankName: z.string().min(1, 'Bank name is required'),
    branchName: z.string().min(1, 'Branch name is required'),
  }),
  references: z.array(z.object({
    name: z.string().min(1, 'Reference name is required'),
    mobile: z.string().regex(VALIDATION_RULES.mobile.pattern, 'Please enter a valid mobile number'),
    relation: z.string().min(1, 'Relation is required'),
  })).min(2, 'At least 2 references are required').max(3, 'Maximum 3 references allowed'),
})

// Vendor profile validation schema
export const vendorProfileSchema = baseProfileSchema.extend({
  vendorType: z.enum(['Collection', 'Auction', 'Service'], {
    message: 'Please select a vendor type',
  }),
  vendorId: z.string().optional(), // Auto-generated, read-only
  companyName: z.string().min(1, 'Company name is required'),
  registrationNumber: z.string().optional(),
  gstNumber: z
    .string()
    .optional()
    .refine((gst) => {
      if (!gst) return true
      return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)
    }, 'Please enter a valid GST number'),
  panNumber: z
    .string()
    .min(1, 'PAN number is required')
    .regex(VALIDATION_RULES.pan.pattern, 'Please enter a valid PAN number'),
  businessAddress: addressSchema,
  serviceAreas: z.array(z.string()).min(1, 'At least one service area is required'),
  specializations: z.array(z.string()).optional(),
})

// Profile update schema (partial updates)
export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  mobile: z.string().regex(VALIDATION_RULES.mobile.pattern, 'Please enter a valid mobile number').optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  currentAddress: addressSchema.partial().optional(),
  permanentAddress: addressSchema.partial().optional(),
  emergencyContact: z.object({
    name: z.string().min(1, 'Emergency contact name is required'),
    relation: z.string().min(1, 'Relation is required'),
    mobile: z.string().regex(VALIDATION_RULES.mobile.pattern, 'Please enter a valid mobile number'),
  }).optional(),
})

// Document upload schema
export const documentUploadSchema = z.object({
  documentType: z.enum([
    'PAN_CARD',
    'AADHAAR_CARD',
    'ADDRESS_PROOF',
    'INCOME_PROOF',
    'BANK_STATEMENT',
    'BUSINESS_REGISTRATION',
    'GST_CERTIFICATE',
    'OTHER'
  ]),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  fileType: z.string().refine(
    (type) => ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(type),
    'Only PDF, JPG, JPEG, and PNG files are allowed'
  ),
})

// KYC verification schema
export const kycVerificationSchema = z.object({
  panCard: z.object({
    number: z.string().regex(VALIDATION_RULES.pan.pattern, 'Please enter a valid PAN number'),
    verified: z.boolean().default(false),
    documentUrl: z.string().url().optional(),
  }),
  aadhaarCard: z.object({
    number: z.string().regex(VALIDATION_RULES.aadhaar.pattern, 'Please enter a valid Aadhaar number'),
    verified: z.boolean().default(false),
    documentUrl: z.string().url().optional(),
  }),
  addressProof: z.object({
    type: z.enum(['Utility Bill', 'Bank Statement', 'Rental Agreement', 'Other']),
    verified: z.boolean().default(false),
    documentUrl: z.string().url().optional(),
  }).optional(),
})

// Export types for TypeScript
export type BaseProfileInput = z.infer<typeof baseProfileSchema>
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>
export type EmployeeProfileInput = z.infer<typeof employeeProfileSchema>
export type PartnerProfileInput = z.infer<typeof partnerProfileSchema>
export type VendorProfileInput = z.infer<typeof vendorProfileSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>
export type KYCVerificationInput = z.infer<typeof kycVerificationSchema>
export type AddressInput = z.infer<typeof addressSchema>