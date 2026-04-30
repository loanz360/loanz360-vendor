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
