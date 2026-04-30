import { z } from 'zod';
import { indianPhoneSchema, emailSchema, amountSchema, pincodeSchema } from './common';

export const createLeadSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: indianPhoneSchema,
  email: emailSchema.optional(),
  loan_type: z.string().min(1),
  loan_amount: amountSchema.optional(),
  city: z.string().max(100).optional(),
  pincode: pincodeSchema.optional(),
  source: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  assigned_to: z.string().uuid().optional(),
});

export const assignLeadSchema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(100),
  assigned_to: z.string().uuid(),
  notes: z.string().max(500).optional(),
});
