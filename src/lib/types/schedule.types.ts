/**
 * Schedule Module - TypeScript Type Definitions
 *
 * Purpose: Type definitions for the Channel Partner Executive schedule system
 * Used by: Channel Partner Executives for managing partner and customer meetings
 *
 * Features:
 * - Schedule meetings with Business Associates, Business Partners, Channel Partners
 * - Schedule meetings with Customers
 * - Meeting notes and reminders
 * - Active and historical schedule tracking
 */

import type {
  MeetingStatus,
  MeetingType,
  MeetingOutcome,
  ReminderFrequency,
  ReminderStatus,
  NoteType,
  MeetingAttendee,
  NoteAttachment
} from './meetings.types'

// =====================================================
// ENUMS & CONSTANTS
// =====================================================

export type PartnerType =
  | 'BUSINESS_ASSOCIATE'
  | 'BUSINESS_PARTNER'
  | 'CHANNEL_PARTNER'

export type ScheduleCategory =
  | 'PARTNER_MEETING'
  | 'CUSTOMER_MEETING'
  | 'INTERNAL'
  | 'GENERAL'

export type ParticipantType =
  | 'PARTNER'
  | 'CUSTOMER'

// =====================================================
// CORE INTERFACES
// =====================================================

/**
 * Schedule Interface (extends Meeting)
 */
export interface Schedule {
  id: string
  sales_executive_id: string

  // Participant Information
  partner_id: string | null
  customer_id: string | null
  partner_type: PartnerType | null
  participant_name: string | null
  schedule_category: ScheduleCategory

  // Meeting Details
  title: string
  description?: string
  meeting_type: MeetingType
  status: MeetingStatus

  // Scheduling
  scheduled_date: string
  scheduled_end_date?: string
  duration_minutes: number

  // Location
  location?: string
  is_virtual: boolean
  meeting_link?: string

  // Attendance
  actual_start_time?: string
  actual_end_time?: string
  attendees: MeetingAttendee[]

  // Outcome
  outcome?: MeetingOutcome
  outcome_notes?: string

  // Follow-up
  requires_follow_up: boolean
  follow_up_date?: string
  follow_up_notes?: string

  // Integration
  calendar_event_id?: string

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
}

/**
 * Schedule with Additional Details
 */
export interface ScheduleWithDetails extends Schedule {
  // Partner details
  partner_email?: string
  partner_phone?: string
  partner_company?: string

  // Customer details
  customer_email?: string
  customer_phone?: string

  // Sales executive details
  sales_executive_name?: string
  sales_executive_email?: string

  // Counts
  notes_count?: number
  reminders_count?: number
}

/**
 * Schedule Note Interface
 */
export interface ScheduleNote {
  id: string
  meeting_id: string
  created_by: string

  // Content
  note_title?: string
  note_content: string

  // Categorization
  note_type: NoteType
  is_private: boolean

  // Attachments
  attachments: NoteAttachment[]

  // Tags
  tags: string[]

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
}

/**
 * Schedule Note with Author
 */
export interface ScheduleNoteWithAuthor extends ScheduleNote {
  author_name?: string
  author_email?: string
  author_avatar_url?: string
}

/**
 * Schedule Reminder Interface
 */
export interface ScheduleReminder {
  id: string
  meeting_id: string
  user_id: string

  // Details
  reminder_title: string
  reminder_message?: string

  // Scheduling
  remind_at: string
  frequency: ReminderFrequency

  // Status
  status: ReminderStatus

  // Channels
  send_email: boolean
  send_push: boolean
  send_sms: boolean

  // Tracking
  sent_at?: string
  acknowledged_at?: string
  dismissed_at?: string

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
}

/**
 * Reminder with Schedule Details
 */
export interface ReminderWithSchedule extends ScheduleReminder {
  schedule_title?: string
  schedule_date?: string
  participant_name?: string
  location?: string
  is_virtual?: boolean
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

/**
 * Create Schedule Request
 */
export interface CreateScheduleRequest {
  // Participant (either partner or customer, not both)
  participant_type: ParticipantType
  partner_id?: string
  partner_type?: PartnerType
  customer_id?: string

  // Meeting details
  title: string
  description?: string
  meeting_type: MeetingType

  // Scheduling
  scheduled_date: string
  scheduled_end_date?: string
  duration_minutes?: number

  // Location
  location?: string
  is_virtual?: boolean
  meeting_link?: string

  // Additional
  attendees?: MeetingAttendee[]
  initial_notes?: string
  set_reminders?: boolean
  reminder_times?: string[] // Array of ISO datetime strings
}

/**
 * Update Schedule Request
 */
export interface UpdateScheduleRequest {
  title?: string
  description?: string
  meeting_type?: MeetingType
  status?: MeetingStatus

  scheduled_date?: string
  scheduled_end_date?: string
  duration_minutes?: number

  location?: string
  is_virtual?: boolean
  meeting_link?: string

  attendees?: MeetingAttendee[]

  actual_start_time?: string
  actual_end_time?: string

  outcome?: MeetingOutcome
  outcome_notes?: string

  requires_follow_up?: boolean
  follow_up_date?: string
  follow_up_notes?: string
}

/**
 * Create Note Request
 */
export interface CreateScheduleNoteRequest {
  meeting_id: string
  note_title?: string
  note_content: string
  note_type?: NoteType
  is_private?: boolean
  attachments?: NoteAttachment[]
  tags?: string[]
}

/**
 * Create Reminder Request
 */
export interface CreateScheduleReminderRequest {
  meeting_id: string
  reminder_title: string
  reminder_message?: string
  remind_at: string
  frequency?: ReminderFrequency
  send_email?: boolean
  send_push?: boolean
  send_sms?: boolean
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

/**
 * Schedule Filters
 */
export interface ScheduleFilters {
  status?: MeetingStatus | MeetingStatus[]
  meeting_type?: MeetingType | MeetingType[]
  schedule_category?: ScheduleCategory | ScheduleCategory[]
  partner_type?: PartnerType | PartnerType[]
  partner_id?: string
  customer_id?: string
  date_from?: string
  date_to?: string
  is_virtual?: boolean
  requires_follow_up?: boolean
  search?: string
}

/**
 * Schedule Query Params
 */
export interface ScheduleQueryParams extends ScheduleFilters {
  page?: number
  limit?: number
  sort_by?: 'scheduled_date' | 'created_at' | 'updated_at' | 'title'
  sort_order?: 'asc' | 'desc'
}

// =====================================================
// RESPONSE TYPES
// =====================================================

/**
 * Paginated Schedules Response
 */
export interface SchedulesResponse {
  schedules: ScheduleWithDetails[]
  total: number
  page: number
  limit: number
  total_pages: number
}

/**
 * Active Schedules Response
 */
export interface ActiveSchedulesResponse {
  today: ScheduleWithDetails[]
  tomorrow: ScheduleWithDetails[]
  this_week: ScheduleWithDetails[]
  next_week: ScheduleWithDetails[]
  total: number
}

/**
 * History Response
 */
export interface ScheduleHistoryResponse {
  schedules: ScheduleWithDetails[]
  total: number
  page: number
  limit: number
  total_pages: number
  summary: {
    total_completed: number
    total_cancelled: number
    total_no_show: number
    completion_rate: number
  }
}

/**
 * Schedule Dashboard Summary
 */
export interface ScheduleDashboardSummary {
  today: {
    total: number
    completed: number
    upcoming: number
  }
  this_week: {
    total: number
    completed: number
    upcoming: number
    partner_meetings: number
    customer_meetings: number
  }
  this_month: {
    total: number
    completed: number
    cancelled: number
    attendance_rate: number
    avg_duration_minutes: number
  }
  upcoming_today: UpcomingSchedule[]
  next_7_days: UpcomingSchedule[]
  pending_reminders: ReminderWithSchedule[]
}

/**
 * Upcoming Schedule (for cards/lists)
 */
export interface UpcomingSchedule {
  id: string
  title: string
  participant_name: string | null
  scheduled_date: string
  duration_minutes: number
  is_virtual: boolean
  location?: string
  schedule_category: ScheduleCategory
  meeting_type: MeetingType
  status?: MeetingStatus
}

/**
 * Schedule Card (for list views)
 */
export interface ScheduleCard {
  id: string
  title: string
  participant_name: string | null
  participant_type: ParticipantType | null
  partner_type: PartnerType | null
  schedule_category: ScheduleCategory
  meeting_type: MeetingType
  status: MeetingStatus
  scheduled_date: string
  duration_minutes: number
  location?: string
  is_virtual: boolean
  has_notes: boolean
  has_reminders: boolean
  requires_follow_up: boolean
  time_until_meeting?: string // Human-readable time (e.g., "in 2 hours")
}

// =====================================================
// UI/DISPLAY TYPES
// =====================================================

/**
 * Schedule Form State
 */
export interface ScheduleFormState {
  schedule: Partial<CreateScheduleRequest>
  errors: Partial<Record<keyof CreateScheduleRequest, string>>
  isSubmitting: boolean
  isDirty: boolean
}

/**
 * Filter State
 */
export interface ScheduleFilterState {
  filters: ScheduleFilters
  appliedFilters: ScheduleFilters
  isFilterOpen: boolean
}

/**
 * Tab State
 */
export type ScheduleTab = 'create' | 'active' | 'history'

/**
 * Partner Option (for selector dropdown)
 */
export interface PartnerOption {
  id: string
  full_name: string
  email?: string
  phone?: string
  company_name?: string
  partner_type: PartnerType
  status?: string
}

/**
 * Customer Option (for selector dropdown)
 */
export interface CustomerOption {
  id: string
  full_name: string
  email?: string
  phone?: string
  company?: string
  status?: string
}

/**
 * Conflict Check Result
 */
export interface ConflictCheckResult {
  has_conflict: boolean
  conflicting_meeting?: {
    id: string
    title: string
    scheduled_date: string
    duration_minutes: number
  }
}

// =====================================================
// CONSTANTS & LABELS
// =====================================================

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  BUSINESS_ASSOCIATE: 'Business Associate',
  BUSINESS_PARTNER: 'Business Partner',
  CHANNEL_PARTNER: 'Channel Partner'
}

export const SCHEDULE_CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  PARTNER_MEETING: 'Partner Meeting',
  CUSTOMER_MEETING: 'Customer Meeting',
  INTERNAL: 'Internal Meeting',
  GENERAL: 'General'
}

export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  PARTNER: 'Partner',
  CUSTOMER: 'Customer'
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Schedule Statistics
 */
export interface ScheduleStatistics {
  total_scheduled: number
  total_completed: number
  total_cancelled: number
  total_no_show: number
  completion_rate: number
  attendance_rate: number
  avg_duration_minutes: number
  partner_meetings_count: number
  customer_meetings_count: number
  by_partner_type: {
    business_associate: number
    business_partner: number
    channel_partner: number
  }
  by_meeting_type: Record<MeetingType, number>
}

/**
 * Reminder Preset
 */
export interface ReminderPreset {
  label: string
  value: string // relative time (e.g., '1_hour_before', '1_day_before')
  minutes_before: number
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { label: '15 minutes before', value: '15_min_before', minutes_before: 15 },
  { label: '1 hour before', value: '1_hour_before', minutes_before: 60 },
  { label: '2 hours before', value: '2_hours_before', minutes_before: 120 },
  { label: '1 day before', value: '1_day_before', minutes_before: 1440 },
  { label: '2 days before', value: '2_days_before', minutes_before: 2880 }
]

/**
 * Duration Preset
 */
export interface DurationPreset {
  label: string
  minutes: number
}

export const DURATION_PRESETS: DurationPreset[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: 'Half day (4 hours)', minutes: 240 },
  { label: 'Full day (8 hours)', minutes: 480 }
]
