/**
 * TeleSales Schedule Module - TypeScript Type Definitions
 *
 * Purpose: Type definitions for the TeleSales schedule system
 * Used by: TeleSales executives for managing calls, tasks, and reminders
 *
 * Features:
 * - Call scheduling and tracking
 * - Task management for follow-ups
 * - Reminder system with multiple channels
 * - Daily targets and performance tracking
 * - Call scripts library
 */

import type {
  ReminderFrequency,
  ReminderStatus,
  NoteAttachment
} from './meetings.types'

// =====================================================
// ENUMS & CONSTANTS
// =====================================================

export type TSCallType =
  | 'OUTBOUND'
  | 'INBOUND'
  | 'SCHEDULED_CALLBACK'
  | 'COLD_CALL'
  | 'WARM_CALL'
  | 'HOT_LEAD_CALL'

export type TSCallPurpose =
  | 'DISCOVERY'
  | 'FOLLOW_UP'
  | 'QUALIFICATION'
  | 'PRODUCT_INFO'
  | 'DOCUMENT_COLLECTION'
  | 'CLOSING'
  | 'CUSTOMER_SERVICE'
  | 'FEEDBACK'
  | 'RE_ENGAGEMENT'
  | 'OTHER'

export type TSCallStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'VOICEMAIL'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'CALLBACK_REQUESTED'

export type TSCallOutcome =
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'NEEDS_MORE_INFO'
  | 'CALLBACK_REQUESTED'
  | 'DO_NOT_CALL'
  | 'WRONG_NUMBER'
  | 'CONVERTED'
  | 'REFERRED'
  | 'UNDECIDED'

export type TSCallDisposition =
  | 'ANSWERED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'VOICEMAIL'
  | 'DISCONNECTED'
  | 'WRONG_NUMBER'
  | 'DO_NOT_CALL'

export type TSTaskCategory =
  | 'CALL_FOLLOW_UP'
  | 'LEAD_QUALIFICATION'
  | 'DOCUMENT_REQUEST'
  | 'DATA_ENTRY'
  | 'CALLBACK'
  | 'ESCALATION'
  | 'REPORTING'
  | 'GENERAL'

export type TSTaskPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'

export type TSTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'

export type TSReminderType =
  | 'CALL_REMINDER'
  | 'CALLBACK_DUE'
  | 'TASK_DEADLINE'
  | 'FOLLOW_UP'
  | 'LEAD_CALLBACK'
  | 'SHIFT_START'
  | 'BREAK_REMINDER'
  | 'CUSTOM'

export type TSScriptType =
  | 'COLD_CALL'
  | 'WARM_CALL'
  | 'FOLLOW_UP'
  | 'OBJECTION_HANDLING'
  | 'CLOSING'
  | 'RE_ENGAGEMENT'
  | 'PRODUCT_INFO'

// =====================================================
// CORE INTERFACES - CALLS
// =====================================================

export interface TSCall {
  id: string
  sales_executive_id: string
  lead_id: string | null

  // Call Details
  title: string
  description?: string
  call_type: TSCallType
  call_purpose: TSCallPurpose
  status: TSCallStatus

  // Scheduling
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number

  // Contact Information
  contact_name?: string
  contact_phone?: string
  contact_email?: string

  // Call Execution
  actual_start_time?: string
  actual_end_time?: string
  actual_duration_seconds?: number

  // Call Outcome
  outcome?: TSCallOutcome
  outcome_notes?: string
  call_disposition?: TSCallDisposition

  // Follow-up
  requires_follow_up: boolean
  follow_up_date?: string
  follow_up_notes?: string
  next_action?: string

  // Lead Information (denormalized)
  lead_name?: string
  lead_stage?: string
  lead_source?: string
  loan_type?: string
  loan_amount?: number

  // Call Quality
  call_quality_score?: number
  customer_satisfaction?: number

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
}

export interface TSCallWithDetails extends TSCall {
  lead?: {
    id: string
    customer_name: string
    mobile: string
    email?: string
    lead_stage: string
    loan_type?: string
    loan_amount?: number
  }
  tasks_count?: number
  reminders_count?: number
}

// =====================================================
// CORE INTERFACES - TASKS
// =====================================================

export interface TSTask {
  id: string
  sales_executive_id: string
  lead_id?: string | null
  call_id?: string | null

  // Task Details
  title: string
  description?: string
  category: TSTaskCategory
  priority: TSTaskPriority
  status: TSTaskStatus

  // Scheduling
  due_date: string
  due_time?: string
  completed_at?: string

  // Sub-tasks
  sub_tasks: TSSubTask[]
  progress_percentage: number

  // Linked Entity Info
  lead_name?: string
  call_title?: string

  // Tags & Attachments
  tags: string[]
  attachments: NoteAttachment[]

  // Recurrence
  is_recurring: boolean
  recurrence_pattern?: TSRecurrencePattern

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at?: string
}

export interface TSSubTask {
  id: string
  title: string
  is_completed: boolean
  completed_at?: string
}

export interface TSRecurrencePattern {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  days_of_week?: number[]
  end_date?: string
  occurrences?: number
}

// =====================================================
// CORE INTERFACES - REMINDERS
// =====================================================

export interface TSReminder {
  id: string
  sales_executive_id: string
  lead_id?: string | null
  call_id?: string | null
  task_id?: string | null

  // Details
  title: string
  message?: string
  reminder_type: TSReminderType

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
  call_title?: string
  task_title?: string

  // Metadata
  created_at: string
  updated_at: string
  is_deleted: boolean
}

// =====================================================
// CORE INTERFACES - CALL SCRIPTS
// =====================================================

export interface TSCallScript {
  id: string
  name: string
  description?: string
  script_type: TSScriptType
  loan_type?: string
  content: TSScriptContent
  is_active: boolean
  usage_count: number
  success_rate?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface TSScriptContent {
  sections: TSScriptSection[]
  tips?: string[]
}

export interface TSScriptSection {
  name: string
  content: string
}

// =====================================================
// CORE INTERFACES - DAILY TARGETS
// =====================================================

export interface TSDailyTargets {
  id: string
  sales_executive_id: string
  target_date: string

  // Call Targets
  calls_target: number
  calls_completed: number

  // Connect Targets
  connects_target: number
  connects_achieved: number

  // Quality Targets
  talk_time_target_minutes: number
  talk_time_achieved_minutes: number

  // Conversion Targets
  conversions_target: number
  conversions_achieved: number

  // Callbacks
  callbacks_scheduled: number
  callbacks_completed: number

  // Performance Metrics
  avg_call_duration_seconds: number
  avg_quality_score?: number

  created_at: string
  updated_at: string
}

// =====================================================
// REQUEST/RESPONSE TYPES - CALLS
// =====================================================

export interface CreateTSCallRequest {
  lead_id?: string
  title: string
  description?: string
  call_type: TSCallType
  call_purpose: TSCallPurpose
  scheduled_date: string
  scheduled_time: string
  duration_minutes?: number
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  set_reminder?: boolean
  reminder_minutes_before?: number
}

export interface UpdateTSCallRequest {
  title?: string
  description?: string
  call_type?: TSCallType
  call_purpose?: TSCallPurpose
  status?: TSCallStatus
  scheduled_date?: string
  scheduled_time?: string
  duration_minutes?: number
  actual_start_time?: string
  actual_end_time?: string
  actual_duration_seconds?: number
  outcome?: TSCallOutcome
  outcome_notes?: string
  call_disposition?: TSCallDisposition
  requires_follow_up?: boolean
  follow_up_date?: string
  follow_up_notes?: string
  next_action?: string
  call_quality_score?: number
  customer_satisfaction?: number
}

// =====================================================
// REQUEST/RESPONSE TYPES - TASKS
// =====================================================

export interface CreateTSTaskRequest {
  title: string
  description?: string
  category: TSTaskCategory
  priority: TSTaskPriority
  due_date: string
  due_time?: string
  lead_id?: string
  call_id?: string
  sub_tasks?: { title: string }[]
  tags?: string[]
  attachments?: NoteAttachment[]
  is_recurring?: boolean
  recurrence_pattern?: TSRecurrencePattern
}

export interface UpdateTSTaskRequest {
  title?: string
  description?: string
  category?: TSTaskCategory
  priority?: TSTaskPriority
  status?: TSTaskStatus
  due_date?: string
  due_time?: string
  sub_tasks?: TSSubTask[]
  tags?: string[]
  attachments?: NoteAttachment[]
}

// =====================================================
// REQUEST/RESPONSE TYPES - REMINDERS
// =====================================================

export interface CreateTSReminderRequest {
  title: string
  message?: string
  reminder_type: TSReminderType
  remind_at: string
  frequency?: ReminderFrequency
  lead_id?: string
  call_id?: string
  task_id?: string
  send_in_app?: boolean
  send_email?: boolean
  send_push?: boolean
  send_sms?: boolean
}

export interface UpdateTSReminderRequest {
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

export interface TSDashboardSummary {
  today: {
    calls_scheduled: number
    calls_completed: number
    calls_remaining: number
    connects: number
    talk_time_minutes: number
    tasks_due: number
    tasks_completed: number
    tasks_overdue: number
    reminders: number
    callbacks_due: number
  }
  this_week: {
    calls_total: number
    calls_completed: number
    connects: number
    talk_time_minutes: number
    conversions: number
    tasks_completed: number
    avg_call_duration_seconds: number
  }
  this_month: {
    calls_total: number
    calls_completed: number
    connect_rate: number
    conversion_rate: number
    avg_quality_score: number
    tasks_completed: number
    total_talk_time_hours: number
  }
  targets: TSDailyTargets | null
  upcoming_calls: TSCallWithDetails[]
  pending_tasks: TSTask[]
  active_reminders: TSReminder[]
  overdue_tasks: TSTask[]
  callbacks_due: TSCallWithDetails[]
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

export interface TSCallFilters {
  status?: TSCallStatus | TSCallStatus[]
  call_type?: TSCallType | TSCallType[]
  call_purpose?: TSCallPurpose | TSCallPurpose[]
  lead_id?: string
  date_from?: string
  date_to?: string
  requires_follow_up?: boolean
  outcome?: TSCallOutcome | TSCallOutcome[]
  search?: string
}

export interface TSTaskFilters {
  status?: TSTaskStatus | TSTaskStatus[]
  category?: TSTaskCategory | TSTaskCategory[]
  priority?: TSTaskPriority | TSTaskPriority[]
  lead_id?: string
  call_id?: string
  date_from?: string
  date_to?: string
  is_overdue?: boolean
  search?: string
}

export interface TSReminderFilters {
  status?: ReminderStatus | ReminderStatus[]
  reminder_type?: TSReminderType | TSReminderType[]
  date_from?: string
  date_to?: string
  search?: string
}

export interface TSQueryParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// =====================================================
// ANALYTICS TYPES
// =====================================================

export interface TSScheduleAnalytics {
  period: {
    start_date: string
    end_date: string
  }
  calls: {
    total: number
    completed: number
    connects: number
    no_answer: number
    connect_rate: number
    avg_duration_seconds: number
    by_type: Record<TSCallType, number>
    by_purpose: Record<TSCallPurpose, number>
    by_outcome: Record<TSCallOutcome, number>
    by_disposition: Record<TSCallDisposition, number>
  }
  tasks: {
    total: number
    completed: number
    pending: number
    overdue: number
    completion_rate: number
    avg_completion_time_hours: number
    by_category: Record<TSTaskCategory, number>
    by_priority: Record<TSTaskPriority, number>
  }
  productivity: {
    calls_per_day: number
    talk_time_per_day_minutes: number
    conversion_rate: number
    avg_quality_score: number
    callbacks_completed_rate: number
  }
  trends: {
    date: string
    calls: number
    connects: number
    conversions: number
    talk_time_minutes: number
  }[]
}

// =====================================================
// CALENDAR EVENT TYPES
// =====================================================

export interface TSCalendarEvent {
  id: string
  title: string
  type: 'call' | 'task' | 'reminder' | 'callback'
  start: Date
  end: Date
  allDay?: boolean
  color: string
  borderColor: string
  data: TSCall | TSTask | TSReminder
}

// =====================================================
// UI/DISPLAY TYPES
// =====================================================

export interface TSCallCard {
  id: string
  title: string
  lead_name?: string
  contact_phone?: string
  call_type: TSCallType
  call_purpose: TSCallPurpose
  status: TSCallStatus
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  outcome?: TSCallOutcome
  requires_follow_up: boolean
  time_until?: string
  lead_stage?: string
}

export interface TSTaskCard {
  id: string
  title: string
  description?: string
  category: TSTaskCategory
  priority: TSTaskPriority
  status: TSTaskStatus
  due_date: string
  due_time?: string
  lead_name?: string
  call_title?: string
  progress_percentage: number
  sub_tasks_total: number
  sub_tasks_completed: number
  is_overdue: boolean
  tags: string[]
}

// =====================================================
// CONSTANTS & LABELS
// =====================================================

export const TS_CALL_TYPE_LABELS: Record<TSCallType, string> = {
  OUTBOUND: 'Outbound Call',
  INBOUND: 'Inbound Call',
  SCHEDULED_CALLBACK: 'Scheduled Callback',
  COLD_CALL: 'Cold Call',
  WARM_CALL: 'Warm Call',
  HOT_LEAD_CALL: 'Hot Lead Call'
}

export const TS_CALL_PURPOSE_LABELS: Record<TSCallPurpose, string> = {
  DISCOVERY: 'Discovery',
  FOLLOW_UP: 'Follow-up',
  QUALIFICATION: 'Qualification',
  PRODUCT_INFO: 'Product Information',
  DOCUMENT_COLLECTION: 'Document Collection',
  CLOSING: 'Closing',
  CUSTOMER_SERVICE: 'Customer Service',
  FEEDBACK: 'Feedback',
  RE_ENGAGEMENT: 'Re-engagement',
  OTHER: 'Other'
}

export const TS_CALL_STATUS_LABELS: Record<TSCallStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  NO_ANSWER: 'No Answer',
  BUSY: 'Busy',
  VOICEMAIL: 'Voicemail',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  CALLBACK_REQUESTED: 'Callback Requested'
}

export const TS_CALL_OUTCOME_LABELS: Record<TSCallOutcome, string> = {
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not Interested',
  NEEDS_MORE_INFO: 'Needs More Info',
  CALLBACK_REQUESTED: 'Callback Requested',
  DO_NOT_CALL: 'Do Not Call',
  WRONG_NUMBER: 'Wrong Number',
  CONVERTED: 'Converted',
  REFERRED: 'Referred',
  UNDECIDED: 'Undecided'
}

export const TS_TASK_CATEGORY_LABELS: Record<TSTaskCategory, string> = {
  CALL_FOLLOW_UP: 'Call Follow-up',
  LEAD_QUALIFICATION: 'Lead Qualification',
  DOCUMENT_REQUEST: 'Document Request',
  DATA_ENTRY: 'Data Entry',
  CALLBACK: 'Callback',
  ESCALATION: 'Escalation',
  REPORTING: 'Reporting',
  GENERAL: 'General'
}

export const TS_TASK_PRIORITY_LABELS: Record<TSTaskPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
}

export const TS_TASK_PRIORITY_COLORS: Record<TSTaskPriority, string> = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'green'
}

export const TS_TASK_STATUS_LABELS: Record<TSTaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled'
}

export const TS_REMINDER_TYPE_LABELS: Record<TSReminderType, string> = {
  CALL_REMINDER: 'Call Reminder',
  CALLBACK_DUE: 'Callback Due',
  TASK_DEADLINE: 'Task Deadline',
  FOLLOW_UP: 'Follow-up',
  LEAD_CALLBACK: 'Lead Callback',
  SHIFT_START: 'Shift Start',
  BREAK_REMINDER: 'Break Reminder',
  CUSTOM: 'Custom'
}

export const TS_SCRIPT_TYPE_LABELS: Record<TSScriptType, string> = {
  COLD_CALL: 'Cold Call',
  WARM_CALL: 'Warm Call',
  FOLLOW_UP: 'Follow-up',
  OBJECTION_HANDLING: 'Objection Handling',
  CLOSING: 'Closing',
  RE_ENGAGEMENT: 'Re-engagement',
  PRODUCT_INFO: 'Product Information'
}

// =====================================================
// CALL TEMPLATES
// =====================================================

export interface CallTemplate {
  id: string
  name: string
  call_type: TSCallType
  call_purpose: TSCallPurpose
  duration_minutes: number
  description?: string
}

export const DEFAULT_CALL_TEMPLATES: CallTemplate[] = [
  {
    id: 'cold_call',
    name: 'Cold Call',
    call_type: 'COLD_CALL',
    call_purpose: 'DISCOVERY',
    duration_minutes: 10,
    description: 'Initial outreach to new leads'
  },
  {
    id: 'follow_up',
    name: 'Follow-up Call',
    call_type: 'OUTBOUND',
    call_purpose: 'FOLLOW_UP',
    duration_minutes: 15,
    description: 'Follow up on previous conversation'
  },
  {
    id: 'callback',
    name: 'Scheduled Callback',
    call_type: 'SCHEDULED_CALLBACK',
    call_purpose: 'FOLLOW_UP',
    duration_minutes: 15,
    description: 'Customer requested callback'
  },
  {
    id: 'hot_lead',
    name: 'Hot Lead Call',
    call_type: 'HOT_LEAD_CALL',
    call_purpose: 'CLOSING',
    duration_minutes: 20,
    description: 'Priority call for ready-to-convert leads'
  },
  {
    id: 'document',
    name: 'Document Collection',
    call_type: 'OUTBOUND',
    call_purpose: 'DOCUMENT_COLLECTION',
    duration_minutes: 10,
    description: 'Follow up for pending documents'
  }
]

// =====================================================
// DURATION PRESETS
// =====================================================

export interface DurationPreset {
  label: string
  minutes: number
}

export const TS_DURATION_PRESETS: DurationPreset[] = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '20 min', minutes: 20 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 }
]

// =====================================================
// REMINDER PRESETS
// =====================================================

export interface ReminderPreset {
  label: string
  minutes_before: number
}

export const TS_REMINDER_PRESETS: ReminderPreset[] = [
  { label: '2 minutes before', minutes_before: 2 },
  { label: '5 minutes before', minutes_before: 5 },
  { label: '10 minutes before', minutes_before: 10 },
  { label: '15 minutes before', minutes_before: 15 },
  { label: '30 minutes before', minutes_before: 30 },
  { label: '1 hour before', minutes_before: 60 }
]

// =====================================================
// CALL DISPOSITION COLORS
// =====================================================

export const TS_DISPOSITION_COLORS: Record<TSCallDisposition, { bg: string; text: string }> = {
  ANSWERED: { bg: 'bg-green-500/20', text: 'text-green-400' },
  NO_ANSWER: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  BUSY: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  VOICEMAIL: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  DISCONNECTED: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  WRONG_NUMBER: { bg: 'bg-red-500/20', text: 'text-red-400' },
  DO_NOT_CALL: { bg: 'bg-red-500/20', text: 'text-red-400' }
}

// =====================================================
// CALL OUTCOME COLORS
// =====================================================

export const TS_OUTCOME_COLORS: Record<TSCallOutcome, { bg: string; text: string }> = {
  INTERESTED: { bg: 'bg-green-500/20', text: 'text-green-400' },
  NOT_INTERESTED: { bg: 'bg-red-500/20', text: 'text-red-400' },
  NEEDS_MORE_INFO: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  CALLBACK_REQUESTED: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  DO_NOT_CALL: { bg: 'bg-red-500/20', text: 'text-red-400' },
  WRONG_NUMBER: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  CONVERTED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  REFERRED: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  UNDECIDED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' }
}
