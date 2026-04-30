import { z } from 'zod';

export const sendNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'error', 'success', 'announcement']).default('info'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  recipients: z.array(z.string().uuid()).min(1).max(1000).optional(),
  recipient_roles: z.array(z.string()).optional(),
  channels: z.array(z.enum(['in_app', 'email', 'sms', 'whatsapp', 'push'])).default(['in_app']),
  scheduled_at: z.string().datetime().optional(),
});

export const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1).max(100),
});
