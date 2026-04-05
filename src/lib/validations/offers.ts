import { z } from 'zod'

// Validation schema for creating/updating offers
export const offerSchema = z.object({
  offer_title: z
    .string()
    .min(10, 'Offer title must be at least 10 characters')
    .max(255, 'Offer title must not exceed 255 characters')
    .trim(),

  rolled_out_by: z
    .string()
    .min(2, 'Please select a bank/NBFC')
    .max(255, 'Bank name too long'),

  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must not exceed 2000 characters')
    .trim(),

  offer_image_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),

  image_source: z
    .enum(['upload', 'ai-generated'])
    .default('upload'),

  ai_prompt: z
    .string()
    .max(500, 'AI prompt must not exceed 500 characters')
    .optional()
    .or(z.literal('')),

  states_applicable: z
    .array(z.string())
    .min(1, 'Please select at least one state')
    .max(37, 'Too many states selected'),

  start_date: z
    .string()
    .refine((date) => {
      const startDate = new Date(date)
      return !isNaN(startDate.getTime())
    }, 'Invalid start date'),

  end_date: z
    .string()
    .refine((date) => {
      const endDate = new Date(date)
      return !isNaN(endDate.getTime())
    }, 'Invalid end date'),

  status: z
    .enum(['active', 'expired', 'draft', 'scheduled'])
    .optional()
    .default('active'),

  scheduled_publish_at: z
    .string()
    .datetime({ message: 'Invalid datetime format for scheduled publishing' })
    .optional()
    .or(z.literal(''))
    .or(z.null()),

  timezone: z
    .string()
    .optional()
    .default('Asia/Kolkata'),

  auto_publish_enabled: z
    .boolean()
    .optional()
    .default(false)
}).refine(
  (data) => {
    const start = new Date(data.start_date)
    const end = new Date(data.end_date)
    return end >= start
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date']
  }
).refine(
  (data) => {
    const start = new Date(data.start_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Allow past dates for editing, but warn
    return true // We'll handle this in the UI with a warning
  },
  {
    message: 'Start date should not be in the past',
    path: ['start_date']
  }
).refine(
  (data) => {
    // If status is 'scheduled', scheduled_publish_at must be provided
    if (data.status === 'scheduled') {
      return !!data.scheduled_publish_at && data.scheduled_publish_at !== ''
    }
    return true
  },
  {
    message: 'Scheduled publish date/time is required for scheduled offers',
    path: ['scheduled_publish_at']
  }
).refine(
  (data) => {
    // If scheduled_publish_at is provided, it must be in the future
    if (data.scheduled_publish_at && data.scheduled_publish_at !== '') {
      const scheduledTime = new Date(data.scheduled_publish_at)
      const now = new Date()
      return scheduledTime > now
    }
    return true
  },
  {
    message: 'Scheduled publish time must be in the future',
    path: ['scheduled_publish_at']
  }
)

export const updateOfferSchema = z.object({
  id: z.string().uuid('Invalid offer ID'),
  offer_title: z
    .string()
    .min(10, 'Offer title must be at least 10 characters')
    .max(255, 'Offer title must not exceed 255 characters')
    .trim()
    .optional(),

  rolled_out_by: z
    .string()
    .min(2, 'Please select a bank/NBFC')
    .max(255, 'Bank name too long')
    .optional(),

  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),

  offer_image_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),

  image_source: z
    .enum(['upload', 'ai-generated'])
    .optional(),

  ai_prompt: z
    .string()
    .max(500, 'AI prompt must not exceed 500 characters')
    .optional()
    .or(z.literal('')),

  states_applicable: z
    .array(z.string())
    .min(1, 'Please select at least one state')
    .max(37, 'Too many states selected')
    .optional(),

  start_date: z
    .string()
    .refine((date) => {
      const startDate = new Date(date)
      return !isNaN(startDate.getTime())
    }, 'Invalid start date')
    .optional(),

  end_date: z
    .string()
    .refine((date) => {
      const endDate = new Date(date)
      return !isNaN(endDate.getTime())
    }, 'Invalid end date')
    .optional(),

  status: z
    .enum(['active', 'expired', 'draft', 'scheduled'])
    .optional()
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date)
      const end = new Date(data.end_date)
      return end >= start
    }
    return true
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date']
  }
)

// Validation for recording offer view
export const offerViewSchema = z.object({
  offer_id: z.string().uuid('Invalid offer ID')
})

// Helper type exports
export type OfferFormData = z.infer<typeof offerSchema>
export type UpdateOfferFormData = z.infer<typeof updateOfferSchema>
export type OfferViewData = z.infer<typeof offerViewSchema>
