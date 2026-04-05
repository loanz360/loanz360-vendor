/**
 * DSE (Direct Sales Executive) Schedule Module - Shared Types
 *
 * Single source of truth for all DSE schedule component types.
 * Used by: DSEScheduleDashboard, DSEActiveSchedulesList, DSECalendarView,
 *          DSEHistorySchedulesList, DSEScheduleDetailsModal, DSEEditScheduleModal,
 *          DSETeamScheduleView, DSECreateScheduleForm
 */

import type { LucideIcon } from 'lucide-react'

// =====================================================
// MEETING STATUS & TYPE ENUMS
// =====================================================

export type DSEMeetingStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Rescheduled'
  | 'No Show'

export type DSEMeetingType =
  | 'In Person'
  | 'Phone Call'
  | 'Video Call'
  | 'Virtual Meeting'
  | 'Site Visit'

export type DSEMeetingPurpose =
  | 'Introduction'
  | 'Product Demo'
  | 'Proposal Discussion'
  | 'Negotiation'
  | 'Document Collection'
  | 'Contract Signing'
  | 'Review'
  | 'Follow-up'
  | 'Other'

export type DSEMeetingOutcome =
  | 'Successful - Positive Response'
  | 'Successful - Deal Closed'
  | 'Successful - Documents Collected'
  | 'Needs Follow-up'
  | 'Customer Not Interested'
  | 'Rescheduled by Customer'
  | 'Pricing Concern'
  | 'Competitor Comparison'
  | 'Other'

export type DSELocationType =
  | 'Customer Office'
  | 'Our Office'
  | 'Virtual'
  | 'Other'

// =====================================================
// CORE MEETING INTERFACE (shared across ALL components)
// =====================================================

export interface DSEMeeting {
  id: string
  meeting_id: string
  title: string
  description: string | null
  meeting_type: DSEMeetingType
  meeting_purpose: string | null
  scheduled_date: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  location_type: string | null
  location_address: string | null
  location_latitude: number | null
  location_longitude: number | null
  virtual_meeting_link: string | null
  virtual_meeting_provider: string | null
  status: DSEMeetingStatus
  status_reason: string | null
  outcome: string | null
  outcome_notes: string | null
  meeting_notes: string | null
  action_items: DSEActionItem[] | null
  follow_up_required: boolean
  follow_up_date: string | null
  next_steps: string | null
  customer_id: string | null
  lead_id: string | null
  organizer_id: string
  attendees: DSEAttendee[] | null
  external_attendees: DSEExternalAttendee[] | null
  agenda_document_url: string | null
  // Recurring meeting support
  is_recurring: boolean
  recurrence_pattern: DSERecurrencePattern | null
  parent_meeting_id: string | null
  // Meeting effectiveness (enhancement)
  effectiveness_score: number | null
  customer_rating: number | null
  // Check-in tracking (enhancement)
  check_in_time: string | null
  check_in_latitude: number | null
  check_in_longitude: number | null
  check_out_time: string | null
  // Product matching (enhancement)
  products_discussed: string[] | null
  products_interested: string[] | null
  // Metadata
  created_at: string
  updated_at: string
  // Joined relations
  dse_customers?: DSECustomerJoin | null
  dse_leads?: DSELeadJoin | null
}

export interface DSEActionItem {
  item: string
  assignee?: string
  due_date?: string
  completed?: boolean
}

export interface DSEAttendee {
  name: string
  email?: string
  role?: string
  rsvp_status?: 'pending' | 'accepted' | 'declined' | 'tentative'
}

export interface DSEExternalAttendee {
  name: string
  email?: string
  company?: string
}

export interface DSERecurrencePattern {
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly'
  interval: number
  days_of_week?: number[]
  end_date?: string
  occurrences?: number
}

// =====================================================
// JOINED RELATION TYPES
// =====================================================

export interface DSECustomerJoin {
  id: string
  full_name: string
  company_name: string | null
  designation: string | null
  primary_mobile: string
  email: string | null
  customer_status: string
  priority: string
}

export interface DSELeadJoin {
  id: string
  customer_name: string
  company_name: string | null
  mobile: string
  email: string | null
  lead_type: string
  lead_stage: string
  estimated_value: number | null
}

// =====================================================
// MEETING NOTES & REMINDERS
// =====================================================

export interface DSEMeetingNote {
  id: string
  meeting_id: string
  note_title: string | null
  note_content: string
  note_type: DSENoteType
  is_private: boolean
  tags: string[]
  created_by: string
  created_at: string
  updated_at: string
}

export type DSENoteType =
  | 'General'
  | 'Pre-Meeting'
  | 'During Meeting'
  | 'Post-Meeting'
  | 'Follow-Up'
  | 'Action Item'

export interface DSEMeetingReminder {
  id: string
  meeting_id: string
  title: string
  description: string | null
  reminder_datetime: string
  reminder_type: 'Before Meeting' | 'Follow-up' | 'Custom'
  minutes_before: number | null
  status: 'Active' | 'Completed' | 'Cancelled' | 'Snoozed'
  send_email: boolean
  send_push: boolean
  send_sms: boolean
  owner_id: string
  created_at: string
  updated_at: string
}

// =====================================================
// GROUPED MEETINGS (for Active Schedules list)
// =====================================================

export interface DSEGroupedMeetings {
  today: DSEMeeting[]
  tomorrow: DSEMeeting[]
  this_week: DSEMeeting[]
  next_week: DSEMeeting[]
  later: DSEMeeting[]
  total: number
}

// =====================================================
// DASHBOARD TYPES
// =====================================================

export interface DSEScheduleDashboardData {
  today: {
    total: number
    completed: number
    upcoming: number
    cancelled: number
  }
  this_week: {
    total: number
    completed: number
    upcoming: number
    customer_meetings: number
    lead_meetings: number
  }
  this_month: {
    total: number
    completed: number
    cancelled: number
    no_show: number
    attendance_rate: number
    avg_duration_minutes: number
  }
  upcoming_today: DSEMeeting[]
  next_7_days: DSEMeeting[]
  pending_reminders: DSEMeetingReminder[]
  analytics: {
    meeting_types: Record<string, number>
    meeting_purposes: Record<string, number>
    // Enhanced analytics
    meeting_funnel?: DSEMeetingFunnel
    best_time_slots?: DSETimeSlotAnalytics[]
    revenue_attribution?: DSERevenueAttribution
  }
  // SLA compliance (enhancement BL-3)
  sla_alerts?: DSESLAAlert[]
  // Suggested meetings (enhancement BL-1)
  suggested_meetings?: DSESuggestedMeeting[]
}

// =====================================================
// HISTORY TYPES
// =====================================================

export interface DSEHistorySummary {
  total_completed: number
  total_cancelled: number
  total_no_show: number
  total_rescheduled: number
  completion_rate: number
  outcome_breakdown: Record<string, number>
}

// =====================================================
// TEAM SCHEDULE TYPES (for Manager view)
// =====================================================

export interface DSETeamMember {
  id: string
  name: string
  email: string
  meeting_count: number
}

export interface DSETeamMeeting extends DSEMeeting {
  team_member_name: string
  team_member_id: string
  participant_name: string | null
  participant_company: string | null
}

export interface DSETeamSummary {
  total_meetings: number
  total_team_members: number
  meetings_by_status: Record<string, number>
  meetings_by_member: Record<string, number>
}

// =====================================================
// BUSINESS LOGIC ENHANCEMENT TYPES
// =====================================================

// BL-1: Lead-to-Meeting Pipeline Automation
export interface DSESuggestedMeeting {
  lead_id: string
  lead_name: string
  lead_stage: string
  suggested_purpose: DSEMeetingPurpose
  suggested_type: DSEMeetingType
  reason: string
  priority: 'high' | 'medium' | 'low'
  days_since_last_contact: number
}

// BL-2: Meeting Outcome -> Lead Stage Auto-Update
export interface DSEOutcomeLeadMapping {
  outcome: DSEMeetingOutcome
  auto_lead_stage?: string
  auto_action?: string
  requires_confirmation?: boolean
}

export const OUTCOME_LEAD_MAPPINGS: DSEOutcomeLeadMapping[] = [
  { outcome: 'Successful - Deal Closed', auto_lead_stage: 'Won', auto_action: 'create_disbursement_task' },
  { outcome: 'Successful - Documents Collected', auto_lead_stage: 'Documentation', auto_action: 'trigger_doc_verification' },
  { outcome: 'Needs Follow-up', auto_action: 'create_follow_up_meeting', requires_confirmation: true },
  { outcome: 'Customer Not Interested', auto_lead_stage: 'Lost', auto_action: 'ask_loss_reason', requires_confirmation: true },
  { outcome: 'Pricing Concern', auto_action: 'flag_for_manager_review' },
  { outcome: 'Competitor Comparison', auto_action: 'trigger_competitive_alert' },
  { outcome: 'Rescheduled by Customer', auto_action: 'create_rescheduled_meeting' },
]

// BL-3: Customer Contact SLA
export interface DSESLAAlert {
  customer_id: string
  customer_name: string
  priority: string
  days_since_last_contact: number
  required_frequency_days: number
  sla_status: 'ok' | 'warning' | 'breach'
  last_meeting_date: string | null
  suggested_action: string
}

export const SLA_RULES: Record<string, { frequency_days: number; warning_days: number }> = {
  'High': { frequency_days: 7, warning_days: 5 },
  'Medium': { frequency_days: 14, warning_days: 10 },
  'Low': { frequency_days: 30, warning_days: 25 },
  'Default': { frequency_days: 21, warning_days: 15 },
}

// BL-4: Meeting Revenue Attribution
export interface DSERevenueAttribution {
  total_meetings: number
  meetings_leading_to_conversion: number
  total_revenue_attributed: number
  avg_revenue_per_meeting: number
  avg_meetings_per_deal: number
}

// BL-5: Product-Specific Meeting Agendas
export interface DSEMeetingAgendaTemplate {
  loan_type: string
  purpose: DSEMeetingPurpose
  pre_meeting_checklist: string[]
  discussion_points: string[]
  post_meeting_actions: string[]
  required_documents: string[]
}

export const LOAN_TYPE_AGENDAS: DSEMeetingAgendaTemplate[] = [
  {
    loan_type: 'Home Loan',
    purpose: 'Introduction',
    pre_meeting_checklist: [
      'Review customer CIBIL score',
      'Check property details if available',
      'Prepare eligible bank product list',
      'Carry home loan brochures',
    ],
    discussion_points: [
      'Income and employment details',
      'Property type and budget range',
      'Existing EMIs and liabilities',
      'Preferred loan tenure',
      'Co-applicant availability',
      'Expected timeline for property purchase',
    ],
    post_meeting_actions: [
      'Update lead with property details',
      'Run pre-CAM eligibility check',
      'Send product comparison to customer',
      'Schedule document collection meeting',
    ],
    required_documents: [
      'PAN Card', 'Aadhaar Card', 'Salary slips (3 months)',
      'Bank statements (6 months)', 'Form 16', 'Property documents (if available)',
    ],
  },
  {
    loan_type: 'Business Loan',
    purpose: 'Introduction',
    pre_meeting_checklist: [
      'Review business profile',
      'Check GST registration status',
      'Prepare eligible MSME loan products',
      'Carry business loan documents checklist',
    ],
    discussion_points: [
      'Business vintage and nature',
      'Annual turnover and profitability',
      'GST filing compliance',
      'Banking turnover (last 12 months)',
      'Existing business loans',
      'Purpose of loan and amount required',
      'Collateral availability',
    ],
    post_meeting_actions: [
      'Update lead with business details',
      'Run business loan eligibility check',
      'Prepare MSME scheme options',
      'Schedule document collection',
    ],
    required_documents: [
      'GST Registration Certificate', 'GST Returns (12 months)',
      'Bank statements (12 months)', 'ITR (2 years)',
      'Business Registration/License', 'Balance Sheet & P&L',
    ],
  },
  {
    loan_type: 'Personal Loan',
    purpose: 'Introduction',
    pre_meeting_checklist: [
      'Check customer employment type',
      'Review CIBIL score',
      'Prepare personal loan product options',
    ],
    discussion_points: [
      'Employment details and salary',
      'Purpose of personal loan',
      'Preferred EMI and tenure',
      'Existing credit card and loan EMIs',
      'Credit score discussion',
    ],
    post_meeting_actions: [
      'Run pre-approved check with partner banks',
      'Send best rate options to customer',
      'Schedule document submission',
    ],
    required_documents: [
      'PAN Card', 'Aadhaar Card', 'Salary slips (3 months)',
      'Bank statements (3 months)', 'Employment letter',
    ],
  },
  {
    loan_type: 'Loan Against Property',
    purpose: 'Introduction',
    pre_meeting_checklist: [
      'Review property details and valuation estimate',
      'Check LTV ratios of partner banks',
      'Prepare LAP product comparison',
    ],
    discussion_points: [
      'Property type, location, and market value',
      'Property ownership and title status',
      'Existing loans on property',
      'Purpose of LAP and amount needed',
      'Preferred tenure and EMI capacity',
      'Income documentation availability',
    ],
    post_meeting_actions: [
      'Arrange property valuation',
      'Run title verification check',
      'Calculate LTV and eligible amount',
      'Send LAP product comparison',
    ],
    required_documents: [
      'Property documents (sale deed, title deed)',
      'Property valuation report', 'Encumbrance certificate',
      'Income proof', 'Bank statements (6 months)', 'NOC from existing lender (if any)',
    ],
  },
]

// =====================================================
// ANALYTICS ENHANCEMENT TYPES
// =====================================================

// ANA-1: Meeting Funnel Analytics
export interface DSEMeetingFunnel {
  scheduled: number
  confirmed: number
  attended: number
  positive_outcome: number
  deal_closed: number
  conversion_rate: number
}

// ANA-2: Best Time Slot Analytics
export interface DSETimeSlotAnalytics {
  day_of_week: string
  time_slot: string
  total_meetings: number
  successful_meetings: number
  success_rate: number
}

// ANA-4: Customer Engagement Score
export interface DSECustomerEngagement {
  customer_id: string
  customer_name: string
  meetings_attended: number
  meetings_scheduled: number
  attendance_rate: number
  documents_provided_rate: number
  response_time_avg_hours: number
  engagement_score: number
  engagement_trend: 'increasing' | 'stable' | 'decreasing'
}

// =====================================================
// UI CONSTANTS (shared across all components)
// =====================================================

export const DSE_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Scheduled': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Confirmed': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  'In Progress': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Completed': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Cancelled': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  'Rescheduled': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  'No Show': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
}

export const DSE_MEETING_TYPES: { value: DSEMeetingType; label: string }[] = [
  { value: 'In Person', label: 'In Person' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'Video Call', label: 'Video Call' },
  { value: 'Virtual Meeting', label: 'Virtual Meeting' },
  { value: 'Site Visit', label: 'Site Visit' },
]

export const DSE_MEETING_PURPOSES: DSEMeetingPurpose[] = [
  'Introduction', 'Product Demo', 'Proposal Discussion', 'Negotiation',
  'Document Collection', 'Contract Signing', 'Review', 'Follow-up', 'Other',
]

export const DSE_MEETING_OUTCOMES: DSEMeetingOutcome[] = [
  'Successful - Positive Response',
  'Successful - Deal Closed',
  'Successful - Documents Collected',
  'Needs Follow-up',
  'Customer Not Interested',
  'Rescheduled by Customer',
  'Pricing Concern',
  'Competitor Comparison',
  'Other',
]

export const DSE_DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours (Half day)' },
]

export const DSE_GROUP_COLORS: Record<string, string> = {
  today: 'text-cyan-400 border-cyan-500/30',
  tomorrow: 'text-blue-400 border-blue-500/30',
  this_week: 'text-green-400 border-green-500/30',
  next_week: 'text-purple-400 border-purple-500/30',
  later: 'text-gray-400 border-gray-500/30',
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format time string (HH:mm) to 12-hour format
 */
export function formatTime12h(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

/**
 * Format date string (YYYY-MM-DD) to readable format
 * Uses 'T00:00:00' to prevent timezone shifting
 */
export function formatScheduleDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', options || {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date to long format (for detail views)
 */
export function formatScheduleDateLong(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format datetime string to readable format
 */
export function formatScheduleDateTime(datetime: string): string {
  if (!datetime) return ''
  const date = new Date(datetime)
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Calculate end time from start time and duration
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
}

/**
 * Check if a meeting is currently active (can be edited/cancelled)
 */
export function isActiveMeeting(status: string): boolean {
  return ['Scheduled', 'Confirmed', 'In Progress'].includes(status)
}

/**
 * Check if a meeting is in the past (history)
 */
export function isHistoryMeeting(status: string): boolean {
  return ['Completed', 'Cancelled', 'No Show', 'Rescheduled'].includes(status)
}

/**
 * Get participant name from meeting data
 */
export function getMeetingParticipantName(meeting: DSEMeeting): string | null {
  return meeting.dse_customers?.full_name || meeting.dse_leads?.customer_name || null
}

/**
 * Get participant company from meeting data
 */
export function getMeetingParticipantCompany(meeting: DSEMeeting): string | null {
  return meeting.dse_customers?.company_name || meeting.dse_leads?.company_name || null
}

/**
 * Check if a URL is safe (http/https only) - prevents XSS via javascript: URLs
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Get today's date in YYYY-MM-DD format (timezone-safe)
 */
export function getTodayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
