/**
 * Meetings Module - TypeScript Type Definitions
 *
 * Purpose: Type definitions for the meetings scheduling and management system
 * Used by: Direct Sales Executives for managing customer meetings
 *
 * Features:
 * - Meeting scheduling and tracking
 * - Meeting notes with attachments
 * - Reminder system
 * - Meeting metrics and analytics
 */

// =====================================================
// ENUMS
// =====================================================

export type MeetingStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'

export type MeetingType =
  | 'INITIAL_CONSULTATION'
  | 'FOLLOW_UP'
  | 'PRODUCT_DEMO'
  | 'NEGOTIATION'
  | 'CONTRACT_SIGNING'
  | 'CUSTOMER_ONBOARDING'
  | 'FEEDBACK_SESSION'
  | 'FIELD_VISIT'
  | 'VIRTUAL_MEETING'
  | 'OTHER'

export type MeetingOutcome =
  | 'SUCCESSFUL'
  | 'NEEDS_FOLLOW_UP'
  | 'CONVERTED_TO_LEAD'
  | 'DEAL_CLOSED'
  | 'LOST_OPPORTUNITY'
  | 'POSTPONED'
  | 'CANCELLED_BY_CLIENT'
  | 'NO_OUTCOME'

export type ReminderFrequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type ReminderStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'DISMISSED' | 'EXPIRED'

export type NoteType = 'GENERAL' | 'ACTION_ITEM' | 'DECISION' | 'QUESTION' | 'FOLLOW_UP'

// =====================================================
// INTERFACES
// =====================================================

/**
 * Meeting Attendee
 */
export interface MeetingAttendee {
  name: string
  email?: string
  role?: string
  phone?: string
}

/**
 * Note Attachment
 */
export interface NoteAttachment {
  filename: string
  url: string
  type: string
  size: number
  uploadedAt?: string
}

/**
 * Main Meeting Interface
 */
export interface Meeting {
  id: string
  sales_executive_id: string
  customer_id: string | null

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
 * Meeting with Customer Details (for display)
 */
export interface MeetingWithDetails extends Meeting {
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  sales_executive_name?: string
  notes_count?: number
  reminders_count?: number
}

/**
 * Meeting Note Interface
 */
export interface MeetingNote {
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
 * Meeting Note with Author Details
 */
export interface MeetingNoteWithAuthor extends MeetingNote {
  author_name?: string
  author_email?: string
}

/**
 * Meeting Reminder Interface
 */
export interface MeetingReminder {
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
 * Reminder with Meeting Details
 */
export interface ReminderWithMeeting extends MeetingReminder {
  meeting_title?: string
  meeting_date?: string
  meeting_location?: string
  customer_name?: string
}

/**
 * Meeting Metrics Interface
 */
export interface MeetingMetrics {
  id: string
  sales_executive_id: string

  // Period
  metric_date: string
  month: number
  year: number

  // Counts
  meetings_scheduled: number
  meetings_completed: number
  meetings_cancelled: number
  meetings_no_show: number

  // Types
  initial_consultations: number
  follow_ups: number
  product_demos: number
  contract_signings: number

  // Outcomes
  successful_meetings: number
  leads_converted: number
  deals_closed: number

  // Time
  total_meeting_time_minutes: number
  average_meeting_duration_minutes: number

  // Efficiency
  attendance_rate: number
  conversion_rate: number

  // Metadata
  created_at: string
  updated_at: string
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

/**
 * Create Meeting Request
 */
export interface CreateMeetingRequest {
  customer_id?: string
  title: string
  description?: string
  meeting_type: MeetingType
  scheduled_date: string
  scheduled_end_date?: string
  duration_minutes?: number
  location?: string
  is_virtual?: boolean
  meeting_link?: string
  attendees?: MeetingAttendee[]
}

/**
 * Update Meeting Request
 */
export interface UpdateMeetingRequest {
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
export interface CreateNoteRequest {
  meeting_id: string
  note_title?: string
  note_content: string
  note_type?: NoteType
  is_private?: boolean
  attachments?: NoteAttachment[]
  tags?: string[]
}

/**
 * Update Note Request
 */
export interface UpdateNoteRequest {
  note_title?: string
  note_content?: string
  note_type?: NoteType
  is_private?: boolean
  attachments?: NoteAttachment[]
  tags?: string[]
}

/**
 * Create Reminder Request
 */
export interface CreateReminderRequest {
  meeting_id: string
  reminder_title: string
  reminder_message?: string
  remind_at: string
  frequency?: ReminderFrequency
  send_email?: boolean
  send_push?: boolean
  send_sms?: boolean
}

/**
 * Update Reminder Request
 */
export interface UpdateReminderRequest {
  reminder_title?: string
  reminder_message?: string
  remind_at?: string
  frequency?: ReminderFrequency
  status?: ReminderStatus
  send_email?: boolean
  send_push?: boolean
  send_sms?: boolean
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

/**
 * Meeting Filters
 */
export interface MeetingFilters {
  status?: MeetingStatus | MeetingStatus[]
  meeting_type?: MeetingType | MeetingType[]
  customer_id?: string
  date_from?: string
  date_to?: string
  is_virtual?: boolean
  requires_follow_up?: boolean
  search?: string
}

/**
 * Meetings Query Params
 */
export interface MeetingsQueryParams extends MeetingFilters {
  page?: number
  limit?: number
  sort_by?: 'scheduled_date' | 'created_at' | 'updated_at'
  sort_order?: 'asc' | 'desc'
}

/**
 * Statistics Period
 */
export interface StatisticsPeriod {
  start_date: string
  end_date: string
}

// =====================================================
// RESPONSE TYPES
// =====================================================

/**
 * Paginated Meetings Response
 */
export interface MeetingsResponse {
  meetings: MeetingWithDetails[]
  total: number
  page: number
  limit: number
  total_pages: number
}

/**
 * Meeting Statistics Response
 */
export interface MeetingStatisticsResponse {
  total_scheduled: number
  total_completed: number
  total_cancelled: number
  attendance_rate: number
  conversion_rate: number
  total_meeting_time_hours: number
}

/**
 * Upcoming Meetings Response
 */
export interface UpcomingMeeting {
  id: string
  title: string
  meeting_type: MeetingType
  status: MeetingStatus
  scheduled_date: string
  duration_minutes: number
  customer_name?: string
  location?: string
  is_virtual: boolean
}

/**
 * Dashboard Summary
 */
export interface MeetingsDashboardSummary {
  today: {
    total: number
    completed: number
    upcoming: number
  }
  this_week: {
    total: number
    completed: number
    upcoming: number
  }
  this_month: {
    total: number
    completed: number
    conversion_rate: number
    attendance_rate: number
  }
  upcoming_meetings: UpcomingMeeting[]
  pending_reminders: ReminderWithMeeting[]
  recent_notes: MeetingNoteWithAuthor[]
}

// =====================================================
// UI/DISPLAY TYPES
// =====================================================

/**
 * Meeting Card (for list view)
 */
export interface MeetingCard {
  id: string
  title: string
  customer_name?: string
  meeting_type: MeetingType
  status: MeetingStatus
  scheduled_date: string
  duration_minutes: number
  location?: string
  is_virtual: boolean
  has_notes: boolean
  has_reminders: boolean
  requires_follow_up: boolean
}

/**
 * Calendar Event (for calendar view)
 */
export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: MeetingType
  status: MeetingStatus
  customer_name?: string
  location?: string
  is_virtual: boolean
  backgroundColor?: string
  borderColor?: string
}

/**
 * Meeting Type Config (for UI display)
 */
export interface MeetingTypeConfig {
  value: MeetingType
  label: string
  icon: string
  color: string
  description?: string
}

/**
 * Meeting Status Config (for UI display)
 */
export interface MeetingStatusConfig {
  value: MeetingStatus
  label: string
  color: string
  badgeColor: string
  icon: string
}

// =====================================================
// CONSTANTS
// =====================================================

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  INITIAL_CONSULTATION: 'Initial Consultation',
  FOLLOW_UP: 'Follow Up',
  PRODUCT_DEMO: 'Product Demo',
  NEGOTIATION: 'Negotiation',
  CONTRACT_SIGNING: 'Contract Signing',
  CUSTOMER_ONBOARDING: 'Customer Onboarding',
  FEEDBACK_SESSION: 'Feedback Session',
  FIELD_VISIT: 'Field Visit',
  VIRTUAL_MEETING: 'Virtual Meeting',
  OTHER: 'Other'
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No Show'
}

export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  SUCCESSFUL: 'Successful',
  NEEDS_FOLLOW_UP: 'Needs Follow Up',
  CONVERTED_TO_LEAD: 'Converted to Lead',
  DEAL_CLOSED: 'Deal Closed',
  LOST_OPPORTUNITY: 'Lost Opportunity',
  POSTPONED: 'Postponed',
  CANCELLED_BY_CLIENT: 'Cancelled by Client',
  NO_OUTCOME: 'No Outcome'
}

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  GENERAL: 'General Note',
  ACTION_ITEM: 'Action Item',
  DECISION: 'Decision Made',
  QUESTION: 'Question',
  FOLLOW_UP: 'Follow Up Required'
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Form State for Meeting Creation/Editing
 */
export interface MeetingFormState {
  meeting: Partial<Meeting>
  errors: Partial<Record<keyof Meeting, string>>
  isSubmitting: boolean
  isDirty: boolean
}

/**
 * Filter State for Meetings List
 */
export interface MeetingsFilterState {
  filters: MeetingFilters
  appliedFilters: MeetingFilters
  isFilterOpen: boolean
}
