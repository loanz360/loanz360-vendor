/**
 * Schedule Module - Zod Validation Schemas
 *
 * Purpose: Validation schemas for schedule creation, updates, and filtering
 */

import { z } from 'zod'

// =====================================================
// ENUM SCHEMAS
// =====================================================

export const partnerTypeSchema = z.enum([
  'BUSINESS_ASSOCIATE',
  'BUSINESS_PARTNER',
  'CHANNEL_PARTNER'
])

export const scheduleCategorySchema = z.enum([
  'PARTNER_MEETING',
  'CUSTOMER_MEETING',
  'INTERNAL',
  'GENERAL'
])

export const participantTypeSchema = z.enum(['PARTNER', 'CUSTOMER'])

export const meetingStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW'
])

export const meetingTypeSchema = z.enum([
  'INITIAL_CONSULTATION',
  'FOLLOW_UP',
  'PRODUCT_DEMO',
  'NEGOTIATION',
  'CONTRACT_SIGNING',
  'CUSTOMER_ONBOARDING',
  'FEEDBACK_SESSION',
  'FIELD_VISIT',
  'VIRTUAL_MEETING',
  'OTHER'
])

export const meetingOutcomeSchema = z.enum([
  'SUCCESSFUL',
  'NEEDS_FOLLOW_UP',
  'CONVERTED_TO_LEAD',
  'DEAL_CLOSED',
  'LOST_OPPORTUNITY',
  'POSTPONED',
  'CANCELLED_BY_CLIENT',
  'NO_OUTCOME'
])

export const reminderFrequencySchema = z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'])

export const reminderStatusSchema = z.enum([
  'PENDING',
  'SENT',
  'ACKNOWLEDGED',
  'DISMISSED',
  'EXPIRED'
])

export const noteTypeSchema = z.enum([
  'GENERAL',
  'ACTION_ITEM',
  'DECISION',
  'QUESTION',
  'FOLLOW_UP'
])

// =====================================================
// SHARED SCHEMAS
// =====================================================

export const meetingAttendeeSchema = z.object({
  name: z.string().min(1, 'Attendee name is required'),
  email: z.string().email('Invalid email').optional(),
  role: z.string().optional(),
  phone: z.string().optional()
})

export const noteAttachmentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  url: z.string().url('Invalid URL'),
  type: z.string().min(1, 'File type is required'),
  size: z.number().positive('File size must be positive'),
  uploadedAt: z.string().optional()
})

// =====================================================
// CREATE SCHEDULE SCHEMA
// =====================================================

export const createScheduleSchema = z
  .object({
    // Participant information
    participant_type: participantTypeSchema,
    partner_id: z.string().uuid('Invalid partner ID').optional(),
    partner_type: partnerTypeSchema.optional(),
    customer_id: z.string().uuid('Invalid customer ID').optional(),

    // Meeting details
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title must not exceed 255 characters'),
    description: z.string().max(2000, 'Description too long').optional(),
    meeting_type: meetingTypeSchema,

    // Scheduling
    scheduled_date: z.string().datetime('Invalid date/time format'),
    scheduled_end_date: z.string().datetime('Invalid date/time format').optional(),
    duration_minutes: z
      .number()
      .int('Duration must be a whole number')
      .min(15, 'Minimum duration is 15 minutes')
      .max(480, 'Maximum duration is 8 hours')
      .default(60),

    // Location
    location: z.string().max(500, 'Location too long').optional(),
    is_virtual: z.boolean().default(false),
    meeting_link: z.string().url('Invalid meeting link').optional(),

    // Additional
    attendees: z.array(meetingAttendeeSchema).default([]),
    initial_notes: z.string().max(5000, 'Notes too long').optional(),
    set_reminders: z.boolean().default(true),
    reminder_times: z.array(z.string().datetime()).default([])
  })
  .refine(
    (data) => {
      // Either partner_id or customer_id must be provided
      return data.partner_id || data.customer_id
    },
    {
      message: 'Either partner or customer must be selected',
      path: ['participant_type']
    }
  )
  .refine(
    (data) => {
      // If participant_type is PARTNER, partner_id must be provided
      if (data.participant_type === 'PARTNER') {
        return !!data.partner_id
      }
      return true
    },
    {
      message: 'Partner must be selected when participant type is Partner',
      path: ['partner_id']
    }
  )
  .refine(
    (data) => {
      // If participant_type is CUSTOMER, customer_id must be provided
      if (data.participant_type === 'CUSTOMER') {
        return !!data.customer_id
      }
      return true
    },
    {
      message: 'Customer must be selected when participant type is Customer',
      path: ['customer_id']
    }
  )
  .refine(
    (data) => {
      // If participant_type is PARTNER, partner_type must be provided
      if (data.participant_type === 'PARTNER') {
        return !!data.partner_type
      }
      return true
    },
    {
      message: 'Partner type must be specified',
      path: ['partner_type']
    }
  )
  .refine(
    (data) => {
      // If is_virtual is true, meeting_link should be provided (warning, not error)
      // This is just a soft validation
      return true
    },
    {
      message: 'Meeting link recommended for virtual meetings',
      path: ['meeting_link']
    }
  )
  .refine(
    (data) => {
      // Scheduled date must be in the future
      const scheduledDate = new Date(data.scheduled_date)
      const now = new Date()
      return scheduledDate > now
    },
    {
      message: 'Scheduled date must be in the future',
      path: ['scheduled_date']
    }
  )
  .refine(
    (data) => {
      // If scheduled_end_date is provided, it must be after scheduled_date
      if (data.scheduled_end_date) {
        const startDate = new Date(data.scheduled_date)
        const endDate = new Date(data.scheduled_end_date)
        return endDate > startDate
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['scheduled_end_date']
    }
  )

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>

// =====================================================
// UPDATE SCHEDULE SCHEMA
// =====================================================

export const updateScheduleSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title must not exceed 255 characters')
      .optional(),
    description: z.string().max(2000, 'Description too long').optional(),
    meeting_type: meetingTypeSchema.optional(),
    status: meetingStatusSchema.optional(),

    scheduled_date: z.string().datetime('Invalid date/time format').optional(),
    scheduled_end_date: z.string().datetime('Invalid date/time format').optional(),
    duration_minutes: z
      .number()
      .int('Duration must be a whole number')
      .min(15, 'Minimum duration is 15 minutes')
      .max(480, 'Maximum duration is 8 hours')
      .optional(),

    location: z.string().max(500, 'Location too long').optional(),
    is_virtual: z.boolean().optional(),
    meeting_link: z.string().url('Invalid meeting link').optional(),

    attendees: z.array(meetingAttendeeSchema).optional(),

    actual_start_time: z.string().datetime('Invalid date/time format').optional(),
    actual_end_time: z.string().datetime('Invalid date/time format').optional(),

    outcome: meetingOutcomeSchema.optional(),
    outcome_notes: z.string().max(2000, 'Outcome notes too long').optional(),

    requires_follow_up: z.boolean().optional(),
    follow_up_date: z.string().optional(),
    follow_up_notes: z.string().max(2000, 'Follow-up notes too long').optional()
  })
  .refine(
    (data) => {
      // If scheduled_end_date is provided, it must be after scheduled_date
      if (data.scheduled_date && data.scheduled_end_date) {
        const startDate = new Date(data.scheduled_date)
        const endDate = new Date(data.scheduled_end_date)
        return endDate > startDate
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['scheduled_end_date']
    }
  )
  .refine(
    (data) => {
      // If actual_end_time is provided, it must be after actual_start_time
      if (data.actual_start_time && data.actual_end_time) {
        const startTime = new Date(data.actual_start_time)
        const endTime = new Date(data.actual_end_time)
        return endTime > startTime
      }
      return true
    },
    {
      message: 'Actual end time must be after actual start time',
      path: ['actual_end_time']
    }
  )

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>

// =====================================================
// CREATE NOTE SCHEMA
// =====================================================

export const createScheduleNoteSchema = z.object({
  meeting_id: z.string().uuid('Invalid meeting ID'),
  note_title: z.string().max(255, 'Title too long').optional(),
  note_content: z
    .string()
    .min(1, 'Note content is required')
    .max(10000, 'Note content too long'),
  note_type: noteTypeSchema.default('GENERAL'),
  is_private: z.boolean().default(false),
  attachments: z.array(noteAttachmentSchema).default([]),
  tags: z.array(z.string().max(50, 'Tag too long')).default([])
})

export type CreateScheduleNoteInput = z.infer<typeof createScheduleNoteSchema>

// =====================================================
// CREATE REMINDER SCHEMA
// =====================================================

export const createScheduleReminderSchema = z
  .object({
    meeting_id: z.string().uuid('Invalid meeting ID'),
    reminder_title: z
      .string()
      .min(1, 'Reminder title is required')
      .max(255, 'Title too long'),
    reminder_message: z.string().max(1000, 'Message too long').optional(),
    remind_at: z.string().datetime('Invalid date/time format'),
    frequency: reminderFrequencySchema.default('ONCE'),
    send_email: z.boolean().default(true),
    send_push: z.boolean().default(true),
    send_sms: z.boolean().default(false)
  })
  .refine(
    (data) => {
      // remind_at must be in the future
      const remindAt = new Date(data.remind_at)
      const now = new Date()
      return remindAt > now
    },
    {
      message: 'Reminder time must be in the future',
      path: ['remind_at']
    }
  )

export type CreateScheduleReminderInput = z.infer<typeof createScheduleReminderSchema>

// =====================================================
// FILTER SCHEMA
// =====================================================

export const scheduleFiltersSchema = z.object({
  status: z.union([meetingStatusSchema, z.array(meetingStatusSchema)]).optional(),
  meeting_type: z.union([meetingTypeSchema, z.array(meetingTypeSchema)]).optional(),
  schedule_category: z
    .union([scheduleCategorySchema, z.array(scheduleCategorySchema)])
    .optional(),
  partner_type: z.union([partnerTypeSchema, z.array(partnerTypeSchema)]).optional(),
  partner_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  is_virtual: z.boolean().optional(),
  requires_follow_up: z.boolean().optional(),
  search: z.string().max(255).optional()
})

export type ScheduleFiltersInput = z.infer<typeof scheduleFiltersSchema>

// =====================================================
// QUERY PARAMS SCHEMA
// =====================================================

export const scheduleQueryParamsSchema = scheduleFiltersSchema.extend({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z
    .enum(['scheduled_date', 'created_at', 'updated_at', 'title'])
    .default('scheduled_date'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
})

export type ScheduleQueryParamsInput = z.infer<typeof scheduleQueryParamsSchema>

// =====================================================
// CONFLICT CHECK SCHEMA
// =====================================================

export const conflictCheckSchema = z.object({
  scheduled_date: z.string().datetime('Invalid date/time format'),
  duration_minutes: z
    .number()
    .int()
    .min(15, 'Minimum duration is 15 minutes')
    .max(480, 'Maximum duration is 8 hours'),
  exclude_meeting_id: z.string().uuid().optional()
})

export type ConflictCheckInput = z.infer<typeof conflictCheckSchema>

// =====================================================
// BATCH OPERATIONS SCHEMA
// =====================================================

export const batchUpdateStatusSchema = z.object({
  meeting_ids: z.array(z.string().uuid()).min(1, 'At least one meeting ID required'),
  status: meetingStatusSchema
})

export type BatchUpdateStatusInput = z.infer<typeof batchUpdateStatusSchema>

export const batchDeleteSchema = z.object({
  meeting_ids: z.array(z.string().uuid()).min(1, 'At least one meeting ID required')
})

export type BatchDeleteInput = z.infer<typeof batchDeleteSchema>

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Validate and parse create schedule input
 */
export function validateCreateSchedule(data: unknown): CreateScheduleInput {
  return createScheduleSchema.parse(data)
}

/**
 * Validate and parse update schedule input
 */
export function validateUpdateSchedule(data: unknown): UpdateScheduleInput {
  return updateScheduleSchema.parse(data)
}

/**
 * Validate and parse create note input
 */
export function validateCreateNote(data: unknown): CreateScheduleNoteInput {
  return createScheduleNoteSchema.parse(data)
}

/**
 * Validate and parse create reminder input
 */
export function validateCreateReminder(data: unknown): CreateScheduleReminderInput {
  return createScheduleReminderSchema.parse(data)
}

/**
 * Validate and parse filters
 */
export function validateFilters(data: unknown): ScheduleFiltersInput {
  return scheduleFiltersSchema.parse(data)
}

/**
 * Validate and parse query params
 */
export function validateQueryParams(data: unknown): ScheduleQueryParamsInput {
  return scheduleQueryParamsSchema.parse(data)
}

/**
 * Safe parse with error handling
 */
export function safeValidateCreateSchedule(data: unknown) {
  return createScheduleSchema.safeParse(data)
}

export function safeValidateUpdateSchedule(data: unknown) {
  return updateScheduleSchema.safeParse(data)
}
