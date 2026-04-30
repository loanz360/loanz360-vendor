import { z } from 'zod';
import { amountSchema, indianPhoneSchema, panSchema } from './common';

export const loanApplicationSchema = z.object({
  loan_type: z.enum([
    'personal', 'home', 'business', 'car', 'gold', 'education',
    'mortgage', 'nri', 'doctor', 'hospital', 'working_capital',
    'bill_discounting', 'loan_against_shares', 'machinery', 'builders', 'lease_rental'
  ]),
  loan_amount: amountSchema,
  tenure_months: z.number().int().min(6).max(360),
  purpose: z.string().max(500).optional(),
  applicant: z.object({
    full_name: z.string().min(2).max(100),
    phone: indianPhoneSchema,
    email: z.string().email(),
    pan: panSchema.optional(),
    date_of_birth: z.string().optional(),
    employment_type: z.enum(['salaried', 'self_employed', 'business', 'professional', 'retired', 'student']).optional(),
    monthly_income: amountSchema.optional(),
  }),
});

export const emiCalculatorSchema = z.object({
  principal: z.number().positive().max(100_00_00_000),
  rate: z.number().min(0.01).max(50),
  tenure: z.number().int().min(1).max(360),
});
