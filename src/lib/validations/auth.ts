// Dynamic schema creation to prevent build-time initialization errors
import { z } from 'zod'
import { VALIDATION_RULES, PARTNER_TYPES, EMPLOYEE_ROLES, CUSTOMER_CATEGORIES } from '../constants'

// Schema factories - create schemas on-demand instead of at module load time
// This prevents "Cannot access 'z' before initialization" during Next.js SSG

export const getLoginSchema = () => z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(VALIDATION_RULES.password.minLength, `Password must be at least ${VALIDATION_RULES.password.minLength} characters`)
    .max(128, 'Password is too long'),
  rememberMe: z.boolean().optional(),
})

export const getRegisterSchema = () => z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name is too long')
    .regex(/^[a-zA-Z\s]+$/, 'Full name can only contain letters and spaces'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(VALIDATION_RULES.password.minLength, `Password must be at least ${VALIDATION_RULES.password.minLength} characters`)
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  role: z.enum(['CUSTOMER', 'PARTNER', 'VENDOR', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  subRole: z.string().optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export const getForgotPasswordSchema = () => z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

export const getResetPasswordSchema = () => z.object({
  password: z
    .string()
    .min(VALIDATION_RULES.password.minLength, `Password must be at least ${VALIDATION_RULES.password.minLength} characters`)
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export const getChangePasswordSchema = () => z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(VALIDATION_RULES.password.minLength, `Password must be at least ${VALIDATION_RULES.password.minLength} characters`)
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ['newPassword'],
})

export const getMobileVerificationSchema = () => z.object({
  otp: z
    .string()
    .min(6, 'OTP must be 6 digits')
    .max(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
})

// REMOVED: Module-level schema exports to prevent TDZ errors
// DO NOT add: export const loginSchema = getLoginSchema()
// Always use factory functions: getLoginSchema(), getRegisterSchema(), etc.

// Type inference using ReturnType to avoid module-load execution
export type LoginInput = z.infer<ReturnType<typeof getLoginSchema>>
export type RegisterInput = z.infer<ReturnType<typeof getRegisterSchema>>
export type ForgotPasswordInput = z.infer<ReturnType<typeof getForgotPasswordSchema>>
export type ResetPasswordInput = z.infer<ReturnType<typeof getResetPasswordSchema>>
export type ChangePasswordInput = z.infer<ReturnType<typeof getChangePasswordSchema>>
export type MobileVerificationInput = z.infer<ReturnType<typeof getMobileVerificationSchema>>
