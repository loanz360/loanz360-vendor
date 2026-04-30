import { z } from 'zod';
import { indianPhoneSchema, emailSchema, panSchema, pincodeSchema } from './common';

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: indianPhoneSchema.optional(),
  email: emailSchema.optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  pan_number: panSchema.optional(),
  address: z.object({
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    pincode: pincodeSchema.optional(),
  }).optional(),
  designation: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  emergency_contact: z.object({
    name: z.string().max(100).optional(),
    phone: indianPhoneSchema.optional(),
    relationship: z.string().max(50).optional(),
  }).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const uploadDocumentSchema = z.object({
  document_type: z.string().min(1).max(50),
  document_name: z.string().min(1).max(255),
  file_size: z.number().max(10 * 1024 * 1024).optional(),
});
