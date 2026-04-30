import { z } from 'zod';

export const clockInSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  location_name: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const leaveRequestSchema = z.object({
  leave_type: z.enum(['casual', 'sick', 'privilege', 'compensatory', 'maternity', 'paternity', 'bereavement', 'unpaid']),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  reason: z.string().min(10).max(500),
  is_half_day: z.boolean().default(false),
  half_day_type: z.enum(['first_half', 'second_half']).optional(),
});

export const regularizationSchema = z.object({
  date: z.string().min(1),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  reason: z.string().min(10).max(500),
});
