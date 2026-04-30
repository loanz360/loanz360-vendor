import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8).max(128),
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid phone number').optional(),
  role: z.enum(['EMPLOYEE', 'PARTNER', 'CUSTOMER', 'ADMIN', 'SUPER_ADMIN', 'VENDOR']).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
  token: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// Compatibility exports — pages use function-style getters
export const getForgotPasswordSchema = () => forgotPasswordSchema;
export const getLoginSchema = () => loginSchema;
export const getRegisterSchema = () => registerSchema;
export const getResetPasswordSchema = () => resetPasswordSchema;
export const getChangePasswordSchema = () => changePasswordSchema;

// Type exports for form inputs
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
