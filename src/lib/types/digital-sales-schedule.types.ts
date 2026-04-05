/**
 * Digital Sales Schedule Module - TypeScript Type Definitions
 *
 * Purpose: Type definitions for the Digital Sales schedule system
 * Used by: Digital Sales executives for managing online leads, meetings, tasks, and reminders
 *
 * Features:
 * - Meeting scheduling with online leads
 * - Task management with Kanban board
 * - Reminder system with multiple channels
 * - Calendar views and analytics
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

export type DSMeetingType =
  | 'VIDEO_CALL'
  | 'PHONE_CALL'
  | 'SCREEN_SHARE_DEMO'
  | 'WEBINAR'
  | 'CHAT_SESSION'
  | 'EMAIL_FOLLOW_UP'
  | 'VIRTUAL_CONSULTATION'

export type DSMeetingPurpose =
  | 'DISCOVERY_CALL'
  | 'PRODUCT_DEMO'
  | 'FOLLOW_UP'
  | 'CLOSING_CALL'
  | 'ONBOARDING'
  | 'DOCUMENT_COLLECTION'
  | 'QUERY_RESOLUTION'
  | 'RELATIONSHIP_BUILDING'
  | 'UPSELL_CROSS_SELL'
  | 'FEEDBACK'
  | 'OTHER'

export type TaskCategory =
  | 'LEAD_FOLLOW_UP'
  | 'DOCUMENT_COLLECTION'
  | 'PROPOSAL_PREPARATION'
  | 'VERIFICATION'
  | 'APPLICATION_PROCESSING'
  | 'CUSTOMER_COMMUNICATION'
  | 'INTERNAL_MEETING'
  | 'REPORTING'
  | 'GENERAL'

export type TaskPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'

export type ReminderType =
  | 'MEETING_REMINDER'
  | 'TASK_DEADLINE'
  | 'FOLLOW_UP'
  | 'LEAD_CALLBACK'
  | 'DOCUMENT_PENDING'
  | 'CUSTOM'

// =====================================================
// CORE INTERFACES - MEETINGS
// =====================================================

export interface DSMeeting {
  id: string
  sales_executive_id: string
  lead_id: string | null
  customer_id: string | null

  // Meeting Details
  title: string
  description?: string
  meeting_type: DSMeetingType
  meeting_purpose: DSMeetingPurpose
  status: MeetingStatus

  // Scheduling
  scheduled_date: string
  scheduled_end_date?: string
  start_time: string
  end_time: string
  duration_minutes: number

  // Virtual Meeting
  is_virtual: boolean
  meeting_link?: string
  meeting_platform?: string // Zoom, Google Meet, Teams, etc.

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

  // Lead Information (denormalized for quick access)
  lead_name?: string
  lead_mobile?: string
  lead_email?: string
  lead_stage?: string

  // Customer Information
  customer_name?: string
  customer_mobile?: string
  customer_email?: string

  // Integration
  calendar_event_id?: string

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
}

export interface DSMeetingWithDetails extends DSMeeting {
  notes_count?: number
  reminders_count?: number
  tasks_count?: number
}

// =====================================================
// CORE INTERFACES - TASKS
// =====================================================

export interface DSTask {
  id: string
  sales_executive_id: string
  lead_id?: string | null
  customer_id?: string | null
  meeting_id?: string | null

  // Task Details
  title: string
  description?: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus

  // Scheduling
  due_date: string
  due_time?: string
  completed_at?: string

  // Sub-tasks
  sub_tasks: DSSubTask[]
  progress_percentage: number

  // Linked Entity Info
  lead_name?: string
  customer_name?: string
  meeting_title?: string

  // Comments & Attachments
  comments_count?: number
  attachments: NoteAttachment[]

  // Tags
  tags: string[]

  // Recurring
  is_recurring: boolean
  recurrence_pattern?: RecurrencePattern

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
}

export interface DSSubTask {
  id: string
  title: string
  is_completed: boolean
  completed_at?: string
}

export interface RecurrencePattern {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number // e.g., every 2 weeks
  days_of_week?: number[] // 0=Sunday, 6=Saturday
  end_date?: string
  occurrences?: number
}

// =====================================================
// CORE INTERFACES - REMINDERS
// =====================================================

export interface DSReminder {
  id: string
  sales_executive_id: string
  lead_id?: string | null
  customer_id?: string | null
  meeting_id?: string | null
  task_id?: string | null

  // Details
  title: string
  message?: string
  reminder_type: ReminderType

  // Scheduling
  remind_at: string
  frequency: ReminderFrequency
  snooze_until?: string

  // Status
  status: ReminderStatus

  // Channels
  send_in_app: boolean
  send_email: boolean
  send_push: boolean
  send_sms: boolean

  // Tracking
  sent_at?: string
  acknowledged_at?: string
  dismissed_at?: string
  snoozed_count: number

  // Linked Entity Info
  lead_name?: string
  customer_name?: string
  meeting_title?: string
  task_title?: string

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
}

// =====================================================
// REQUEST/RESPONSE TYPES - MEETINGS
// =====================================================

export interface CreateDSMeetingRequest {
  lead_id?: string
  customer_id?: string
  title: string
  description?: string
  meeting_type: DSMeetingType
  meeting_purpose: DSMeetingPurpose
  scheduled_date: string
  start_time: string
  duration_minutes?: number
  meeting_link?: string
  meeting_platform?: string
  attendees?: MeetingAttendee[]
  set_reminder?: boolean
  reminder_minutes_before?: number
}

export interface UpdateDSMeetingRequest {
  title?: string
  description?: string
  meeting_type?: DSMeetingType
  meeting_purpose?: DSMeetingPurpose
  status?: MeetingStatus
  scheduled_date?: string
  start_time?: string
  duration_minutes?: number
  meeting_link?: string
  meeting_platform?: string
  attendees?: MeetingAttendee[]
  actual_start_time?: string
  actual_end_time?: string
  outcome?: MeetingOutcome
  outcome_notes?: string
  requires_follow_up?: boolean
  follow_up_date?: string
  follow_up_notes?: string
}

// =====================================================
// REQUEST/RESPONSE TYPES - TASKS
// =====================================================

export interface CreateDSTaskRequest {
  title: string
  description?: string
  category: TaskCategory
  priority: TaskPriority
  due_date: string
  due_time?: string
  lead_id?: string
  customer_id?: string
  meeting_id?: string
  sub_tasks?: { title: string }[]
  tags?: string[]
  attachments?: NoteAttachment[]
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern
}

export interface UpdateDSTaskRequest {
  title?: string
  description?: string
  category?: TaskCategory
  priority?: TaskPriority
  status?: TaskStatus
  due_date?: string
  due_time?: string
  sub_tasks?: DSSubTask[]
  tags?: string[]
  attachments?: NoteAttachment[]
}

// =====================================================
// REQUEST/RESPONSE TYPES - REMINDERS
// =====================================================

export interface CreateDSReminderRequest {
  title: string
  message?: string
  reminder_type: ReminderType
  remind_at: string
  frequency?: ReminderFrequency
  lead_id?: string
  customer_id?: string
  meeting_id?: string
  task_id?: string
  send_in_app?: boolean
  send_email?: boolean
  send_push?: boolean
  send_sms?: boolean
}

export interface UpdateDSReminderRequest {
  title?: string
  message?: string
  remind_at?: string
  frequency?: ReminderFrequency
  status?: ReminderStatus
  send_in_app?: boolean
  send_email?: boolean
  send_push?: boolean
  send_sms?: boolean
}

// =====================================================
// DASHBOARD TYPES
// =====================================================

export interface DSDashboardSummary {
  today: {
    meetings: number
    meetings_completed: number
    meetings_upcoming: number
    tasks_due: number
    tasks_completed: number
    tasks_overdue: number
    reminders: number
  }
  this_week: {
    meetings: number
    meetings_completed: number
    tasks_total: number
    tasks_completed: number
    leads_contacted: number
    follow_ups_done: number
  }
  this_month: {
    meetings: number
    meetings_completed: number
    attendance_rate: number
    tasks_completed: number
    completion_rate: number
    avg_meeting_duration: number
    conversion_rate: number
  }
  upcoming_meetings: DSMeetingWithDetails[]
  pending_tasks: DSTask[]
  active_reminders: DSReminder[]
  overdue_tasks: DSTask[]
  follow_up_required: DSMeetingWithDetails[]
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

export interface DSMeetingFilters {
  status?: MeetingStatus | MeetingStatus[]
  meeting_type?: DSMeetingType | DSMeetingType[]
  meeting_purpose?: DSMeetingPurpose | DSMeetingPurpose[]
  lead_id?: string
  customer_id?: string
  date_from?: string
  date_to?: string
  requires_follow_up?: boolean
  search?: string
}

export interface DSTaskFilters {
  status?: TaskStatus | TaskStatus[]
  category?: TaskCategory | TaskCategory[]
  priority?: TaskPriority | TaskPriority[]
  lead_id?: string
  customer_id?: string
  meeting_id?: string
  date_from?: string
  date_to?: string
  is_overdue?: boolean
  search?: string
}

export interface DSReminderFilters {
  status?: ReminderStatus | ReminderStatus[]
  reminder_type?: ReminderType | ReminderType[]
  date_from?: string
  date_to?: string
  search?: string
}

export interface DSQueryParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// =====================================================
// ANALYTICS TYPES
// =====================================================

export interface DSScheduleAnalytics {
  period: {
    start_date: string
    end_date: string
  }
  meetings: {
    total: number
    completed: number
    cancelled: number
    no_show: number
    attendance_rate: number
    avg_duration_minutes: number
    by_type: Record<DSMeetingType, number>
    by_purpose: Record<DSMeetingPurpose, number>
    by_outcome: Record<MeetingOutcome, number>
  }
  tasks: {
    total: number
    completed: number
    pending: number
    overdue: number
    completion_rate: number
    avg_completion_time_hours: number
    by_category: Record<TaskCategory, number>
    by_priority: Record<TaskPriority, number>
  }
  productivity: {
    meetings_per_day: number
    tasks_completed_per_day: number
    follow_up_rate: number
    response_time_hours: number
  }
  trends: {
    date: string
    meetings: number
    tasks_completed: number
    leads_contacted: number
  }[]
}

// =====================================================
// CALENDAR EVENT TYPES
// =====================================================

export interface DSCalendarEvent {
  id: string
  title: string
  type: 'meeting' | 'task' | 'reminder'
  start: Date
  end: Date
  allDay?: boolean
  color: string
  borderColor: string
  data: DSMeeting | DSTask | DSReminder
}

// =====================================================
// UI/DISPLAY TYPES
// =====================================================

export interface DSMeetingCard {
  id: string
  title: string
  lead_name?: string
  customer_name?: string
  meeting_type: DSMeetingType
  meeting_purpose: DSMeetingPurpose
  status: MeetingStatus
  scheduled_date: string
  start_time: string
  duration_minutes: number
  is_virtual: boolean
  meeting_link?: string
  has_notes: boolean
  has_reminders: boolean
  requires_follow_up: boolean
  time_until?: string
}

export interface DSTaskCard {
  id: string
  title: string
  description?: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  due_date: string
  due_time?: string
  lead_name?: string
  customer_name?: string
  progress_percentage: number
  sub_tasks_total: number
  sub_tasks_completed: number
  is_overdue: boolean
  tags: string[]
}

// =====================================================
// CONSTANTS & LABELS
// =====================================================

export const DS_MEETING_TYPE_LABELS: Record<DSMeetingType, string> = {
  VIDEO_CALL: 'Video Call',
  PHONE_CALL: 'Phone Call',
  SCREEN_SHARE_DEMO: 'Screen Share Demo',
  WEBINAR: 'Webinar',
  CHAT_SESSION: 'Chat Session',
  EMAIL_FOLLOW_UP: 'Email Follow-up',
  VIRTUAL_CONSULTATION: 'Virtual Consultation'
}

export const DS_MEETING_PURPOSE_LABELS: Record<DSMeetingPurpose, string> = {
  DISCOVERY_CALL: 'Discovery Call',
  PRODUCT_DEMO: 'Product Demo',
  FOLLOW_UP: 'Follow-up',
  CLOSING_CALL: 'Closing Call',
  ONBOARDING: 'Onboarding',
  DOCUMENT_COLLECTION: 'Document Collection',
  QUERY_RESOLUTION: 'Query Resolution',
  RELATIONSHIP_BUILDING: 'Relationship Building',
  UPSELL_CROSS_SELL: 'Upsell/Cross-sell',
  FEEDBACK: 'Feedback',
  OTHER: 'Other'
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  LEAD_FOLLOW_UP: 'Lead Follow-up',
  DOCUMENT_COLLECTION: 'Document Collection',
  PROPOSAL_PREPARATION: 'Proposal Preparation',
  VERIFICATION: 'Verification',
  APPLICATION_PROCESSING: 'Application Processing',
  CUSTOMER_COMMUNICATION: 'Customer Communication',
  INTERNAL_MEETING: 'Internal Meeting',
  REPORTING: 'Reporting',
  GENERAL: 'General'
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'green'
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled'
}

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  MEETING_REMINDER: 'Meeting Reminder',
  TASK_DEADLINE: 'Task Deadline',
  FOLLOW_UP: 'Follow-up',
  LEAD_CALLBACK: 'Lead Callback',
  DOCUMENT_PENDING: 'Document Pending',
  CUSTOM: 'Custom'
}

// =====================================================
// MEETING TEMPLATES
// =====================================================

export interface MeetingTemplate {
  id: string
  name: string
  meeting_type: DSMeetingType
  meeting_purpose: DSMeetingPurpose
  duration_minutes: number
  description?: string
  default_agenda?: string
}

export const DEFAULT_MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'discovery',
    name: 'Discovery Call',
    meeting_type: 'VIDEO_CALL',
    meeting_purpose: 'DISCOVERY_CALL',
    duration_minutes: 30,
    description: 'Initial call to understand customer requirements',
    default_agenda: '1. Introduction\n2. Understand requirements\n3. Explain products\n4. Next steps'
  },
  {
    id: 'demo',
    name: 'Product Demo',
    meeting_type: 'SCREEN_SHARE_DEMO',
    meeting_purpose: 'PRODUCT_DEMO',
    duration_minutes: 45,
    description: 'Detailed product demonstration',
    default_agenda: '1. Quick recap\n2. Product walkthrough\n3. Q&A\n4. Pricing discussion'
  },
  {
    id: 'follow_up',
    name: 'Follow-up Call',
    meeting_type: 'PHONE_CALL',
    meeting_purpose: 'FOLLOW_UP',
    duration_minutes: 15,
    description: 'Quick follow-up on previous discussion',
    default_agenda: '1. Recap previous meeting\n2. Address concerns\n3. Update status\n4. Next steps'
  },
  {
    id: 'closing',
    name: 'Closing Call',
    meeting_type: 'VIDEO_CALL',
    meeting_purpose: 'CLOSING_CALL',
    duration_minutes: 30,
    description: 'Final discussion to close the deal',
    default_agenda: '1. Final terms review\n2. Documentation\n3. Sign-off\n4. Onboarding plan'
  }
]

// =====================================================
// TASK TEMPLATES
// =====================================================

export interface TaskTemplate {
  id: string
  name: string
  category: TaskCategory
  priority: TaskPriority
  sub_tasks: { title: string }[]
}

export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'lead_followup',
    name: 'Lead Follow-up Process',
    category: 'LEAD_FOLLOW_UP',
    priority: 'HIGH',
    sub_tasks: [
      { title: 'Review lead information' },
      { title: 'Prepare talking points' },
      { title: 'Make follow-up call' },
      { title: 'Update lead status' },
      { title: 'Schedule next action' }
    ]
  },
  {
    id: 'doc_collection',
    name: 'Document Collection',
    category: 'DOCUMENT_COLLECTION',
    priority: 'MEDIUM',
    sub_tasks: [
      { title: 'Send document checklist to customer' },
      { title: 'Follow up on pending documents' },
      { title: 'Verify received documents' },
      { title: 'Upload to system' },
      { title: 'Confirm completion with customer' }
    ]
  },
  {
    id: 'proposal_prep',
    name: 'Proposal Preparation',
    category: 'PROPOSAL_PREPARATION',
    priority: 'HIGH',
    sub_tasks: [
      { title: 'Gather customer requirements' },
      { title: 'Calculate loan options' },
      { title: 'Prepare comparison sheet' },
      { title: 'Get manager approval' },
      { title: 'Send proposal to customer' }
    ]
  }
]

// =====================================================
// DURATION PRESETS
// =====================================================

export interface DurationPreset {
  label: string
  minutes: number
}

export const DS_DURATION_PRESETS: DurationPreset[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 }
]

// =====================================================
// REMINDER PRESETS
// =====================================================

export interface ReminderPreset {
  label: string
  minutes_before: number
}

export const DS_REMINDER_PRESETS: ReminderPreset[] = [
  { label: '5 minutes before', minutes_before: 5 },
  { label: '15 minutes before', minutes_before: 15 },
  { label: '30 minutes before', minutes_before: 30 },
  { label: '1 hour before', minutes_before: 60 },
  { label: '2 hours before', minutes_before: 120 },
  { label: '1 day before', minutes_before: 1440 }
]

// =====================================================
// PLATFORM OPTIONS
// =====================================================

export const MEETING_PLATFORMS = [
  { value: 'google_meet', label: 'Google Meet', icon: 'video' },
  { value: 'zoom', label: 'Zoom', icon: 'video' },
  { value: 'teams', label: 'Microsoft Teams', icon: 'video' },
  { value: 'webex', label: 'Webex', icon: 'video' },
  { value: 'phone', label: 'Phone Call', icon: 'phone' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'message' },
  { value: 'other', label: 'Other', icon: 'globe' }
]
