/**
 * AI CRM System TypeScript Types - REVISED
 * Matches new database schema with MOVE logic (not copy)
 * Super Admin master database remains permanent
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ContactStatus =
  | 'new'
  | 'contacted' // Initial contact made
  | 'called'
  | 'follow_up'
  | 'not_interested'
  | 'positive' // Ready to move to positive contacts
  | 'converted' // Converted to lead

export type PositiveContactStatus =
  | 'pending' // Just added
  | 'in_progress' // Follow-up in progress
  | 'ready_to_convert' // Ready to become a lead

export type InterestLevel = 'high' | 'medium' | 'low' | 'none'

export type Sentiment = 'positive' | 'neutral' | 'negative'

export type CallOutcome =
  | 'interested'
  | 'not_interested'
  | 'callback'
  | 'wrong_number'
  | 'no_answer'

export type LeadStatus = 'active' | 'follow_up' | 'converted' | 'dropped'

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'docs_pending'
  | 'ready_to_convert'

export type DealStage =
  | 'docs_collected'
  | 'finalized_bank'
  | 'login_complete'
  | 'post_login_pending_cleared'
  | 'process_started_at_bank'
  | 'case_assessed_by_banker'
  | 'pd_complete'
  | 'sanctioned'
  | 'dropped'
  | 'disbursed'

export type DealStatus = 'in_progress' | 'sanctioned' | 'dropped' | 'disbursed'

export type PipelineStage = 'contact' | 'positive' | 'lead' | 'deal'

export type NoteType = 'ai_transcript' | 'manual_note' | 'system_event'

// ============================================================================
// NOTES SYSTEM (Timeline-based)
// ============================================================================

export interface Note {
  id: string
  type: NoteType
  timestamp: string

  // For AI Transcripts (Read-only)
  call_duration?: number // seconds
  transcript?: string // Full speech-to-text
  ai_summary?: string // AI-generated summary
  ai_rating?: number // 0-10
  sentiment?: Sentiment
  interest_level?: InterestLevel
  key_points?: string[] // AI-extracted key discussion points
  positive_points?: string[] // What CRO did well
  improvement_points?: string[] // Areas for improvement
  is_editable: boolean // false for AI transcripts

  // For Manual Notes (Editable)
  content?: string // CRO/BDE written notes

  // For System Events
  event?: string // 'status_changed', 'document_uploaded', 'assigned_to_bde', etc.
  details?: any

  created_by: string // User ID
  created_by_name: string // User name
  created_at: string
}

// ============================================================================
// CALL LOG
// ============================================================================

export interface CallLog {
  id: string
  contact_id: string
  cro_id: string
  duration?: number // seconds
  outcome?: CallOutcome
  transcript?: string
  ai_summary?: string
  ai_rating?: number // 0-10
  sentiment?: Sentiment
  interest_level?: InterestLevel
  key_points?: string[]
  positive_points?: string[]
  improvement_points?: string[]
  coaching_feedback?: string
  created_at: string
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export interface DocumentInfo {
  id: string
  name: string
  url: string
  type: string // 'pdf', 'jpg', 'png', 'doc', 'docx', etc.
  size: number // bytes
  category?: string // 'Identity Proof', 'Address Proof', 'Business Registration', etc.
  uploaded_by: string
  uploaded_by_name: string
  uploaded_at: string
}

// ============================================================================
// DATA POINTS (Super Admin - Master Copy)
// ============================================================================

export interface DataPoint {
  id: string
  file_name: string
  uploaded_by: string
  total_records: number
  assigned_records: number
  unassigned_records: number
  category?: string
  loan_type?: string
  location?: string
  status: 'active' | 'archived'
  notes?: string
  created_at: string
  updated_at: string
}

export interface DataPointUpload {
  file: File
  category?: string
  loan_type?: string
  location?: string
  notes?: string
}

// ============================================================================
// MASTER CONTACTS (Super Admin - NEVER DELETED)
// ============================================================================

export interface MasterContact {
  id: string
  data_point_id?: string

  // Contact Information
  name: string
  phone: string // Primary identifier
  alternate_phone?: string
  email?: string
  location?: string
  city?: string
  state?: string

  // Loan Details
  loan_type?: string
  loan_amount?: number
  business_name?: string
  business_type?: string

  // Assignment Tracking
  assigned_to_cro?: string
  assigned_to_cro_name?: string
  assigned_at?: string

  // Journey Tracking (for reporting only)
  current_stage: PipelineStage // Tracks where contact is currently
  is_interested: boolean // Moved to positive contacts
  is_converted_to_lead: boolean // Moved to leads
  is_converted_to_deal: boolean // Moved to deals

  // Metadata
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

// ============================================================================
// CRO CONTACTS (Working Copy - Will MOVE to positive_contacts)
// ============================================================================

export interface CRMContact {
  id: string
  master_contact_id: string // Link to permanent master record
  cro_id: string

  // Contact Info (copied from master)
  name: string
  phone: string
  alternate_phone?: string
  email?: string
  location?: string
  city?: string
  state?: string
  loan_type?: string
  loan_amount?: number
  business_name?: string
  business_type?: string

  // CRO Status
  status: ContactStatus
  call_count: number
  last_called_at?: string

  // Notes Timeline
  notes: Note[]

  created_at: string
  updated_at: string
}

// ============================================================================
// POSITIVE CONTACTS (After showing interest - Will MOVE to leads)
// ============================================================================

export interface PositiveContact {
  id: string
  master_contact_id: string
  cro_id: string

  // Contact Info (carried forward)
  name: string
  phone: string
  alternate_phone?: string
  email?: string
  location?: string
  city?: string
  state?: string
  loan_type?: string
  loan_amount?: number
  business_name?: string
  business_type?: string

  // Positive Contact Specific
  interest_level: InterestLevel
  ai_rating: number // 0-10
  ai_summary: string
  added_by_ai: boolean // true if AI suggested despite CRO rejection (AI CRM Suggest tag)

  // Status
  status: PositiveContactStatus
  call_count: number
  last_called_at?: string
  whatsapp_sent_count: number
  last_whatsapp_sent_at?: string

  // Notes Timeline (carried forward)
  notes: Note[]

  created_at: string
  updated_at: string
}

// ============================================================================
// CRM LEADS (CRO Management - Will MOVE to deals)
// ============================================================================

export interface CRMLead {
  id: string
  master_contact_id: string
  cro_id: string

  // Customer Details (carried forward)
  customer_name: string
  phone: string
  alternate_phone?: string
  email?: string
  location?: string

  // Loan Information
  loan_type: string
  loan_amount: number
  loan_purpose?: string
  business_name?: string
  business_type?: string
  monthly_income?: number

  // Lead Status
  status: LeadStatus
  stage: LeadStage

  // Follow-up
  next_follow_up_date?: string
  follow_up_notes?: string

  // Documents (Unlimited)
  documents: DocumentInfo[]

  // Notes Timeline (carried forward)
  notes: Note[]

  call_count: number
  last_called_at?: string

  created_at: string
  updated_at: string
}

// ============================================================================
// CRM DEALS (CRO/BDE Management - Final stage)
// ============================================================================

export interface CRMDeal {
  id: string
  master_contact_id: string
  lead_id: string // Reference to original lead
  cro_id: string // Original CRO
  bde_id?: string // Assigned BDE

  // Customer Details
  customer_name: string
  phone: string
  email?: string
  location?: string

  // Loan Information
  loan_type: string
  loan_amount: number
  loan_purpose?: string
  business_name?: string
  monthly_income?: number

  // Deal Stage and Status
  stage: DealStage
  status: DealStatus

  // Documents (carried forward)
  documents: DocumentInfo[]

  // Notes Timeline (Both CRO and BDE, carried forward)
  notes: Note[]

  // Important Dates
  assigned_at?: string
  assigned_to_bde_at?: string
  last_updated_by_bde_at?: string
  sanctioned_at?: string
  disbursed_at?: string
  dropped_at?: string
  drop_reason?: string

  // Financial Tracking
  sanctioned_amount?: number
  disbursed_amount?: number

  created_at: string
  updated_at: string
}

// ============================================================================
// CRO PROFILE (Professional Details)
// ============================================================================

export interface CROProfilePreferences {
  loan_type_preferences: string[] // ['Business Term Loan', 'Working Capital', etc.]
  preferred_locations: string[] // ['Mumbai', 'Bangalore', etc.]
}

// ============================================================================
// AI ANALYSIS & TRANSCRIPTION
// ============================================================================

export interface TranscriptionRequest {
  contact_id: string
  cro_id: string
  audio_file: Blob // Audio recording
  call_start_time: string
  call_end_time: string
  duration: number // seconds
}

export interface TranscriptionResponse {
  transcript: string // Full speech-to-text
  ai_analysis: AIAnalysis
  duration: number
}

export interface AIAnalysis {
  summary: string
  rating: number // 0-10
  sentiment: Sentiment
  interest_level: InterestLevel
  key_points: string[]
  positive_points: string[]
  improvement_points: string[]
  recommendation: 'add_to_positive' | 'keep_in_contacts' | 'not_interested'
}

// ============================================================================
// MOVE OPERATIONS
// ============================================================================

export interface MoveToPositiveRequest {
  contact_id: string
  ai_analysis?: AIAnalysis // Optional for manual moves
  cro_approved: boolean // Did CRO agree with AI?
  manual_move?: boolean // If true, ai_analysis is not required
}

export interface ConvertToLeadRequest {
  positive_contact_id: string
  loan_purpose?: string
  monthly_income?: number
  additional_notes?: string
}

export interface ConvertToDealRequest {
  lead_id: string
  bde_id?: string // Optional, can be auto-assigned
  notes?: string
}

// ============================================================================
// ASSIGNMENT
// ============================================================================

export interface ContactAssignment {
  contact_ids: string[]
  cro_id: string
  assignment_mode: 'manual' | 'smart' // smart = location OR loan type
  assigned_at: string
}

export interface SmartAssignmentResult {
  cro_id: string
  cro_name: string
  reason: string // Why this CRO was selected
  matches: {
    location_match: boolean
    loan_type_match: boolean
    workload_score: number
  }
}

// ============================================================================
// WHATSAPP
// ============================================================================

export interface WhatsAppMessageLog {
  id: string
  contact_id: string
  cro_id: string
  message: string
  sent_at: string
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetrics {
  id: string
  user_id: string
  metric_date: string
  user_role: 'CRO' | 'BDE'

  // CRO Metrics
  calls_made: number
  calls_connected: number
  positive_calls: number
  not_interested_calls: number
  not_contacted_calls: number
  follow_up_calls: number
  avg_call_duration?: number
  total_call_duration: number

  // Lead metrics
  leads_created: number
  leads_converted_to_deals: number
  expected_loan_volume: number

  // AI Performance
  avg_ai_rating?: number
  ai_score?: number
  best_points?: string[]
  improvement_areas?: string[]

  // BDE Metrics
  deals_assigned: number
  deals_in_progress: number
  deals_sanctioned: number
  deals_disbursed: number
  deals_dropped: number
  total_sanctioned_amount: number
  total_disbursed_amount: number

  created_at: string
  updated_at: string
}

export interface CROAnalytics {
  today: {
    callsMade: number
    callsConnected: number
    positiveCalls: number
    avgCallDuration: number
    leadsCreated: number
    avgAIRating: number
  }
  week: {
    callsMade: number
    callsConnected: number
    positiveCalls: number
    leadsCreated: number
    leadsConverted: number
  }
  month: {
    callsMade: number
    leadsCreated: number
    leadsConverted: number
    avgAIRating: number
    aiScore: number
    grade: string
    percentileRank: number
  }
  performance: {
    bestPoints: string[]
    improvementAreas: string[]
    trends: {
      callQuality: 'up' | 'down' | 'stable'
      callVolume: 'up' | 'down' | 'stable'
      conversionRate: 'up' | 'down' | 'stable'
    }
  }
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export interface SuperAdminDashboard {
  total_data_points: number
  total_contacts: number
  assigned_contacts: number
  unassigned_contacts: number
  contacts_in_positive: number
  contacts_in_leads: number
  contacts_in_deals: number
  total_leads: number
  total_deals: number
  active_cros: number
  active_bdes: number
  today_calls: number
  today_positive_calls: number
  conversion_rate: number
  avg_ai_rating: number
  top_performers: TopPerformer[]
  trend_data: TrendData[]
}

export interface CRODashboard {
  assigned_contacts: number
  positive_contacts: number
  active_leads: number
  converted_deals: number
  calls_made_today: number
  calls_connected_today: number
  positive_calls_today: number
  not_interested_today: number
  follow_ups_scheduled: number
  expected_loan_volume: number
  avg_call_duration: number
  avg_ai_rating: number
  best_points_today: string[]
  improvement_areas: string[]
  trend_data: TrendData[]
}

export interface BDEDashboard {
  total_deals: number
  deals_in_progress: number
  deals_sanctioned: number
  deals_disbursed: number
  deals_dropped: number
  total_sanctioned_amount: number
  total_disbursed_amount: number
  conversion_rate: number
  avg_days_to_sanction: number
  stage_distribution: StageDistribution[]
  pending_updates: number
}

export interface TopPerformer {
  user_id: string
  name: string
  role: string
  metric: string
  value: number
  best_points: string[]
}

export interface TrendData {
  date: string
  calls_made: number
  calls_connected: number
  positive_calls: number
}

export interface StageDistribution {
  stage: DealStage
  count: number
  percentage: number
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

// ============================================================================
// DSE PROPOSALS & BDE DEAL UPDATES SYSTEM
// ============================================================================

// Deal source types
export type DealSourceType = 'cro' | 'dse' | 'online' | 'partner' | 'chatbot'

// Activity types for BDE updates
export type ActivityType =
  | 'customer_call'
  | 'bank_visit'
  | 'document_collection'
  | 'document_submission'
  | 'internal_review'
  | 'customer_meeting'
  | 'banker_meeting'
  | 'verification_call'
  | 'follow_up'
  | 'status_check'
  | 'other'

// Interaction modes
export type InteractionMode = 'call' | 'meeting' | 'email' | 'whatsapp' | 'in_person' | 'sms'

// Interaction with whom
export type InteractionWith = 'customer' | 'banker' | 'internal' | 'verifier' | 'lawyer' | 'other'

// Update sources
export type UpdateSource = 'manual' | 'reminder_popup' | 'scheduled' | 'mobile_app'

// Reminder types
export type ReminderType = '3_hour' | 'daily_summary' | 'critical' | 'escalation'

// Reminder status
export type ReminderStatus = 'pending' | 'shown' | 'completed' | 'snoozed' | 'expired' | 'escalated'

// Priority levels
export type PriorityLevel = 'low' | 'normal' | 'high' | 'critical'

// Supported languages for speech-to-text
export type SupportedLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr' | 'gu' | 'bn' | 'ml'

// ============================================================================
// PENDING ITEM STRUCTURE
// ============================================================================

export interface PendingItem {
  id: string
  item: string
  priority: PriorityLevel
  due_date?: string
  completed: boolean
  completed_at?: string
  notes?: string
}

// ============================================================================
// DEAL UPDATE (3-Hourly BDE Updates)
// ============================================================================

export interface DealUpdate {
  id: string
  deal_id: string
  bde_id: string
  bde_name?: string

  // Stage and Status at time of update
  stage_at_update: DealStage
  status_at_update: DealStatus
  stage_changed_to?: DealStage
  status_changed_to?: DealStatus

  // Notes with speech-to-text support
  notes_original?: string
  notes_translated?: string
  original_language: SupportedLanguage
  target_language?: SupportedLanguage
  translation_confidence?: number

  // Activity tracking
  activity_type?: ActivityType
  activity_description?: string

  // Interaction details
  interaction_with?: InteractionWith
  interaction_mode?: InteractionMode
  interaction_summary?: string

  // Customer/Banker details
  customer_response?: string
  banker_feedback?: string
  documents_discussed?: string[]

  // Pending items
  pending_items: PendingItem[]

  // Next action planning
  next_action?: string
  next_action_date?: string
  next_action_time?: string

  // Attachments
  attachments: DocumentInfo[]

  // Update metadata
  update_source: UpdateSource
  update_duration_seconds?: number
  is_overdue: boolean
  hours_since_last_update?: number

  // Location (for field updates)
  update_latitude?: number
  update_longitude?: number
  update_location_name?: string

  created_at: string
  updated_at: string
}

// ============================================================================
// CREATE DEAL UPDATE REQUEST
// ============================================================================

export interface CreateDealUpdateRequest {
  deal_id: string

  // Stage update (optional)
  new_stage?: DealStage
  new_status?: DealStatus

  // Notes (speech-to-text or manual)
  notes: string
  original_language?: SupportedLanguage
  translate_to?: SupportedLanguage

  // Activity details
  activity_type?: ActivityType
  activity_description?: string

  // Interaction details
  interaction_with?: InteractionWith
  interaction_mode?: InteractionMode
  interaction_summary?: string

  // Customer/Banker details
  customer_response?: string
  banker_feedback?: string

  // Pending items
  pending_items?: PendingItem[]

  // Next action
  next_action?: string
  next_action_date?: string
  next_action_time?: string

  // Source
  update_source?: UpdateSource

  // Location
  latitude?: number
  longitude?: number
  location_name?: string
}

// ============================================================================
// BDE ASSIGNMENT CONFIGURATION
// ============================================================================

export interface BDEAssignmentConfig {
  id: string
  bde_id: string
  bde_name?: string

  // Specialization
  loan_types: string[]
  locations: string[]

  // Loan amount range
  min_loan_amount?: number
  max_loan_amount?: number

  // Capacity
  max_active_deals: number
  current_active_deals: number

  // Assignment preferences
  priority_weight: number
  auto_assign_enabled: boolean

  // Working hours
  working_hours_start: string
  working_hours_end: string
  working_days: number[]
  timezone: string

  // Update frequency
  update_frequency_hours: number

  // Status
  is_active: boolean
  is_on_leave: boolean
  leave_start_date?: string
  leave_end_date?: string

  // Performance metrics
  avg_deal_closure_days?: number
  success_rate?: number
  total_deals_handled: number

  created_at: string
  updated_at: string
}

// ============================================================================
// DEAL UPDATE REMINDER
// ============================================================================

export interface DealUpdateReminder {
  id: string
  deal_id: string
  bde_id: string

  // Deal info (populated from join)
  customer_name?: string
  phone?: string
  loan_type?: string
  loan_amount?: number
  current_stage?: DealStage
  current_status?: DealStatus
  last_update_at?: string

  // Reminder details
  reminder_type: ReminderType
  scheduled_at: string
  priority: PriorityLevel

  // Status
  status: ReminderStatus
  shown_at?: string
  completed_at?: string
  snoozed_until?: string
  snooze_count: number
  max_snooze_allowed: number

  // Escalation
  escalated_at?: string
  escalated_to?: string
  escalation_reason?: string

  // Reference
  update_id?: string

  // Notification tracking
  push_notification_sent: boolean
  email_notification_sent: boolean
  in_app_notification_sent: boolean

  // Calculated fields
  hours_overdue?: number

  created_at: string
}

// ============================================================================
// DEAL STAGE HISTORY
// ============================================================================

export interface DealStageHistory {
  id: string
  deal_id: string

  from_stage?: DealStage
  to_stage: DealStage
  from_status?: DealStatus
  to_status?: DealStatus

  changed_by?: string
  changed_by_name?: string
  change_reason?: string
  update_id?: string

  notes?: string
  metadata?: Record<string, any>

  created_at: string
}

// ============================================================================
// DSE PROPOSAL (Deal view for DSE)
// ============================================================================

export interface DSEProposal {
  deal_id: string
  customer_name: string
  phone: string
  email?: string
  location?: string

  // Loan details
  loan_type: string
  loan_amount: number
  loan_purpose?: string
  business_name?: string

  // Current state
  current_stage: DealStage
  current_status: DealStatus

  // BDE assignment
  bde_id?: string
  bde_name?: string
  assigned_at?: string

  // Last update info
  last_update_at?: string
  last_update_notes?: string
  last_update_stage?: DealStage

  // Financial tracking
  sanctioned_amount?: number
  disbursed_amount?: number

  // Documents
  documents: DocumentInfo[]

  // Statistics
  total_updates: number
  days_since_assignment: number
  is_overdue: boolean
}

// ============================================================================
// DSE PROPOSAL DETAIL (Extended view)
// ============================================================================

export interface DSEProposalDetail extends DSEProposal {
  // Lead source info
  source_lead_type?: string
  dse_lead_id?: string

  // Timeline
  updates: DealUpdate[]
  stage_history: DealStageHistory[]

  // Important dates
  created_at: string
  sanctioned_at?: string
  disbursed_at?: string
  dropped_at?: string
  drop_reason?: string
}

// ============================================================================
// CONVERT DSE LEAD TO DEAL REQUEST
// ============================================================================

export interface ConvertDSELeadToDealRequest {
  dse_lead_id: string
  loan_type: string
  loan_amount: number
  loan_purpose?: string

  // Customer details (may already be in lead)
  customer_name: string
  phone: string
  email?: string
  location?: string
  business_name?: string

  // Documents to transfer
  document_ids?: string[]

  // Auto-assign BDE or specify
  auto_assign_bde?: boolean
  specific_bde_id?: string

  // Notes
  conversion_notes?: string
}

// ============================================================================
// SPEECH TO TEXT TYPES
// ============================================================================

export interface SpeechToTextResult {
  transcript: string
  confidence: number
  language: SupportedLanguage
  is_final: boolean
  alternatives?: string[]
}

export interface TranslationResult {
  original_text: string
  translated_text: string
  source_language: SupportedLanguage
  target_language: SupportedLanguage
  confidence: number
}

// ============================================================================
// DSE PROPOSALS FILTER & SORT
// ============================================================================

export interface DSEProposalsFilter {
  status?: DealStatus | DealStatus[]
  stage?: DealStage | DealStage[]
  loan_type?: string
  bde_id?: string
  date_from?: string
  date_to?: string
  is_overdue?: boolean
  search?: string
}

export type DSEProposalsSortField =
  | 'updated_at'
  | 'assigned_at'
  | 'loan_amount'
  | 'customer_name'
  | 'current_stage'
  | 'days_since_assignment'

export interface DSEProposalsSortOptions {
  field: DSEProposalsSortField
  direction: 'asc' | 'desc'
}

// ============================================================================
// BDE DEALS REQUIRING UPDATES
// ============================================================================

export interface DealRequiringUpdate {
  deal_id: string
  customer_name: string
  phone: string
  loan_type: string
  loan_amount: number
  current_stage: DealStage
  last_update_at?: string
  hours_since_update: number
  priority: PriorityLevel
}

// ============================================================================
// DEAL ASSIGNMENT RESULT
// ============================================================================

export interface DealAssignmentResult {
  success: boolean
  deal_id: string
  bde_id?: string
  bde_name?: string
  assignment_reason?: string
  error?: string
}
