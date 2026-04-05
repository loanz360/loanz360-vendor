// TeleSales Enterprise Features Types

// =====================================================
// POWER DIALER QUEUE
// =====================================================

export interface TSCallQueueItem {
  id: string
  sales_executive_id: string
  campaign_id: string | null
  lead_id: string | null
  contact_name: string
  contact_phone: string
  contact_phone_normalized: string | null
  contact_email: string | null
  queue_position: number
  priority: number
  priority_reason: string | null
  earliest_call_time: string | null
  latest_call_time: string | null
  preferred_time_slots: TSTimeSlot[] | null
  timezone: string
  attempt_count: number
  max_attempts: number
  last_attempt_at: string | null
  last_attempt_result: TSAttemptResult | null
  next_attempt_after: string | null
  status: TSQueueStatus
  locked_by: string | null
  locked_at: string | null
  lock_expires_at: string | null
  lead_score: number | null
  lead_source: string | null
  loan_type: string | null
  loan_amount: number | null
  previous_interaction_summary: string | null
  assigned_script_id: string | null
  custom_talking_points: string[] | null
  final_disposition: string | null
  removed_reason: string | null
  removed_at: string | null
  removed_by: string | null
  created_at: string
  updated_at: string
}

export interface TSTimeSlot {
  day: string
  start: string
  end: string
}

export type TSQueueStatus =
  | 'QUEUED'
  | 'DIALING'
  | 'CONNECTED'
  | 'IN_CALL'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'REMOVED'
  | 'RESCHEDULED'
  | 'MAX_ATTEMPTS'

export type TSAttemptResult =
  | 'CONNECTED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'VOICEMAIL'
  | 'INVALID_NUMBER'
  | 'DNC'
  | 'CALLBACK_SCHEDULED'

// =====================================================
// AGENT AVAILABILITY
// =====================================================

export interface TSAgentAvailability {
  id: string
  sales_executive_id: string
  status: TSAgentStatus
  status_reason: string | null
  status_changed_at: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  actual_login_time: string | null
  actual_logout_time: string | null
  current_break_type: TSBreakType | null
  break_start_time: string | null
  total_break_minutes: number
  allowed_break_minutes: number
  max_concurrent_chats: number
  current_active_calls: number
  current_active_chats: number
  skills: TSAgentSkill[]
  languages: string[]
  can_handle_escalations: boolean
  routing_priority: number
  calls_handled_today: number
  avg_handle_time_today: number
  quality_score_today: number | null
  assigned_queues: string[] | null
  excluded_campaigns: string[] | null
  created_at: string
  updated_at: string
}

export type TSAgentStatus =
  | 'AVAILABLE'
  | 'ON_CALL'
  | 'AFTER_CALL_WORK'
  | 'BREAK'
  | 'LUNCH'
  | 'TRAINING'
  | 'MEETING'
  | 'OFFLINE'
  | 'AWAY'

export type TSBreakType =
  | 'SHORT_BREAK'
  | 'LUNCH'
  | 'PERSONAL'
  | 'TRAINING'
  | 'MEETING'
  | 'SYSTEM_ISSUE'

export interface TSAgentSkill {
  skill: string
  level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'
}

// =====================================================
// CAMPAIGNS
// =====================================================

export interface TSCampaign {
  id: string
  name: string
  code: string | null
  description: string | null
  campaign_type: TSCampaignType
  product_type: string | null
  target_segment: string | null
  status: TSCampaignStatus
  start_date: string | null
  end_date: string | null
  calling_hours_start: string
  calling_hours_end: string
  calling_days: number[]
  timezone: string
  total_leads_target: number | null
  daily_calls_target: number | null
  conversion_target_percentage: number | null
  revenue_target: number | null
  total_leads_loaded: number
  total_calls_made: number
  total_connects: number
  total_conversions: number
  total_revenue: number
  script_id: string | null
  max_attempts_per_lead: number
  min_retry_interval_hours: number
  priority: number
  assigned_teams: string[] | null
  assigned_agents: string[] | null
  min_agents_required: number
  requires_consent: boolean
  consent_script: string | null
  dnc_check_enabled: boolean
  regulatory_approved: boolean
  regulatory_approval_ref: string | null
  avg_handle_time_seconds: number | null
  avg_quality_score: number | null
  conversion_rate: number | null
  cost_per_lead: number | null
  cost_per_conversion: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TSCampaignType =
  | 'OUTBOUND'
  | 'INBOUND'
  | 'BLENDED'
  | 'CALLBACK'
  | 'SURVEY'
  | 'RETENTION'

export type TSCampaignStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED'

export interface TSCampaignLead {
  id: string
  campaign_id: string
  lead_id: string | null
  contact_name: string
  contact_phone: string
  contact_email: string | null
  status: TSCampaignLeadStatus
  priority: number
  assigned_to: string | null
  assigned_at: string | null
  attempt_count: number
  last_attempt_at: string | null
  last_attempt_result: string | null
  next_attempt_after: string | null
  final_outcome: string | null
  outcome_at: string | null
  outcome_notes: string | null
  converted_amount: number | null
  loaded_at: string
  updated_at: string
}

export type TSCampaignLeadStatus =
  | 'PENDING'
  | 'IN_QUEUE'
  | 'IN_PROGRESS'
  | 'CALLBACK_SCHEDULED'
  | 'COMPLETED'
  | 'DNC'
  | 'INVALID'
  | 'MAX_ATTEMPTS'

// =====================================================
// ESCALATIONS
// =====================================================

export interface TSEscalation {
  id: string
  call_id: string | null
  task_id: string | null
  lead_id: string | null
  escalation_type: TSEscalationType
  severity: TSSeverity
  reason: string
  description: string | null
  escalated_by: string
  escalated_from: string | null
  escalated_to: string | null
  sla_breach_time: string | null
  response_due_by: string | null
  resolution_due_by: string | null
  status: TSEscalationStatus
  acknowledged_at: string | null
  acknowledged_by: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
  resolution_type: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_sentiment: string | null
  compensation_offered: number | null
  compensation_approved: boolean | null
  root_cause_category: string | null
  root_cause_details: string | null
  preventive_action: string | null
  attachments: any[]
  call_recording_url: string | null
  created_at: string
  updated_at: string
}

export type TSEscalationType =
  | 'CUSTOMER_COMPLAINT'
  | 'SLA_BREACH'
  | 'QUALITY_ISSUE'
  | 'SUPERVISOR_REQUEST'
  | 'TECHNICAL_ISSUE'
  | 'COMPLIANCE_VIOLATION'
  | 'HIGH_VALUE_DEAL'
  | 'VIP_CUSTOMER'
  | 'LEGAL_THREAT'

export type TSSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type TSEscalationStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'PENDING_CUSTOMER'
  | 'PENDING_APPROVAL'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'

// =====================================================
// DISPOSITIONS
// =====================================================

export interface TSDispositionConfig {
  id: string
  code: string
  name: string
  description: string | null
  category: TSDispositionCategory
  is_final: boolean
  requires_callback: boolean
  requires_notes: boolean
  min_notes_length: number
  auto_create_task: boolean
  task_template: any | null
  default_callback_hours: number | null
  remove_from_queue: boolean
  add_to_dnc: boolean
  counts_as_contact: boolean
  counts_as_conversion: boolean
  revenue_recognition: string
  display_order: number
  color: string | null
  icon: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TSDispositionCategory =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'NEUTRAL'
  | 'CALLBACK'
  | 'TECHNICAL'
  | 'COMPLIANCE'

// =====================================================
// UI HELPER CONSTANTS
// =====================================================

export const AGENT_STATUS_COLORS: Record<TSAgentStatus, { bg: string; text: string }> = {
  'AVAILABLE': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'ON_CALL': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'AFTER_CALL_WORK': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'BREAK': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'LUNCH': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  'TRAINING': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  'MEETING': { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  'OFFLINE': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  'AWAY': { bg: 'bg-red-500/20', text: 'text-red-400' }
}

export const SEVERITY_COLORS: Record<TSSeverity, { bg: string; text: string; border: string }> = {
  'LOW': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  'MEDIUM': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'HIGH': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'CRITICAL': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' }
}

export const CAMPAIGN_STATUS_COLORS: Record<TSCampaignStatus, { bg: string; text: string }> = {
  'DRAFT': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  'PENDING_APPROVAL': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'APPROVED': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'ACTIVE': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'PAUSED': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  'COMPLETED': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'CANCELLED': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'ARCHIVED': { bg: 'bg-gray-500/20', text: 'text-gray-500' }
}

export const QUEUE_STATUS_COLORS: Record<TSQueueStatus, { bg: string; text: string }> = {
  'QUEUED': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'DIALING': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'CONNECTED': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'IN_CALL': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'COMPLETED': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'SKIPPED': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  'REMOVED': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'RESCHEDULED': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  'MAX_ATTEMPTS': { bg: 'bg-red-500/20', text: 'text-red-400' }
}
