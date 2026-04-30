import { z } from 'zod';

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Search/Filter
export const searchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

// UUID param
export const uuidParam = z.string().uuid('Invalid ID format');

// Common ID param
export const idParam = z.object({
  id: z.string().min(1),
});

// File upload metadata
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().max(10 * 1024 * 1024, 'File too large (max 10MB)'),
});

// Indian phone number
export const indianPhoneSchema = z.string().regex(
  /^(\+91|91)?[6-9]\d{9}$/,
  'Invalid Indian phone number'
);

// Indian pincode
export const pincodeSchema = z.string().regex(/^\d{6}$/, 'Invalid pincode');

// PAN number
export const panSchema = z.string().regex(
  /^[A-Z]{5}\d{4}[A-Z]$/,
  'Invalid PAN number'
);

// Aadhaar (last 4 digits only for security)
export const aadhaarLastFourSchema = z.string().regex(/^\d{4}$/, 'Invalid Aadhaar last 4 digits');

// Amount (Indian Rupees)
export const amountSchema = z.number().positive('Amount must be positive').max(100_00_00_000, 'Amount too large');

// Email
export const emailSchema = z.string().email().max(255);
