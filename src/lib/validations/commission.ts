import { z } from 'zod';
import { amountSchema } from './common';

export const createCommissionSchema = z.object({
  loan_id: z.string().uuid(),
  partner_id: z.string().uuid(),
  amount: amountSchema,
  percentage: z.number().min(0).max(100).optional(),
  type: z.enum(['upfront', 'trail', 'bonus', 'override']).default('upfront'),
  notes: z.string().max(500).optional(),
});

export const approvePayoutSchema = z.object({
  payout_ids: z.array(z.string().uuid()).min(1).max(100),
  approved_by: z.string().uuid(),
  notes: z.string().max(500).optional(),
});
