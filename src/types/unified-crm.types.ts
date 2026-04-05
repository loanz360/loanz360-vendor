/**
 * Unified CRM Types
 * Types for the consolidated leads management system using the single `leads` table
 *
 * The `leads` table is the single source of truth for all leads:
 * - ULAP submissions (Phase 1 + Phase 2)
 * - Partner-submitted leads
 * - BDE-assigned leads in pipeline
 * - CAM processing leads
 */

// ============================================================================
// DATA SOURCE TYPES (Legacy - for backward compatibility views)
// ============================================================================

export type DataSource = 'partner_leads' | 'unified_leads' | 'leads'

// ============================================================================
// SOURCE TYPE ENUMS
// ============================================================================

export type LeadSourceType =
  | 'ULAP_BA'
  | 'ULAP_BP'
  | 'ULAP_EMPLOYEE'
  | 'ULAP_CUSTOMER_REFERRAL'
  | 'ULAP_PUBLIC'
  | 'CRO'
  | 'DSE'
  | 'DIGITAL_SALES'
  | 'TELECALLER'
  | 'FIELD_SALES'
  | 'CUSTOMER_DIRECT'
  | 'WEBSITE'
  | 'WALK_IN'
  | 'IVR'
  | 'CHATBOT'

// ============================================================================
// STATUS ENUMS
// ============================================================================

export type LeadStatus =
  | 'NEW'
  | 'PHASE_1_SUBMITTED'
  | 'PHASE_2_IN_PROGRESS'
  | 'PHASE_2_SUBMITTED'
  | 'CAM_PENDING'
  | 'CAM_PROCESSING'
  | 'CAM_COMPLETED'
  | 'CAM_FAILED'
  | 'CAM_SKIPPED'
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'CONTACTED'
  | 'DOC_COLLECTION'
  | 'DOC_VERIFIED'
  | 'BANK_LOGIN'
  | 'BANK_PROCESSING'
  | 'SANCTIONED'
  | 'DISBURSED'
  | 'REJECTED'
  | 'DROPPED'
  | 'ON_HOLD'

export type CAMStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'

export type LeadOutcome =
  | 'DISBURSED'
  | 'REJECTED'
  | 'DROPPED'
  | null

// ============================================================================
// LEAD INTERFACE (Matches new `leads` table schema)
// ============================================================================

export interface Lead {
  id: string
  lead_number: string

  // Source Attribution
  source_type: LeadSourceType
  lead_generator_id?: string | null
  lead_generator_name?: string | null
  lead_generator_role?: string | null
  source_partner_id?: string | null
  source_partner_code?: string | null
  source_partner_name?: string | null
  trace_token?: string | null

  // Customer Information
  customer_id?: string | null
  customer_name: string
  customer_mobile: string
  customer_alternate_mobile?: string | null
  customer_email?: string | null
  customer_city?: string | null
  customer_state?: string | null
  customer_pincode?: string | null
  customer_address?: string | null
  customer_pan?: string | null
  customer_aadhaar?: string | null
  customer_dob?: string | null
  customer_gender?: string | null
  customer_marital_status?: string | null
  customer_subrole?: string | null
  residence_type?: string | null
  years_at_current_address?: number | null

  // Employment Details
  employment_type?: string | null
  company_name?: string | null
  designation?: string | null
  work_experience_years?: number | null
  current_company_years?: number | null
  office_address?: string | null
  office_pincode?: string | null

  // Income Details
  monthly_income?: number | null
  annual_income?: number | null
  other_income?: number | null
  income_proof_type?: string | null

  // Loan Details
  loan_type?: string | null
  loan_category_id?: string | null
  loan_category_code?: string | null
  loan_subcategory_id?: string | null
  loan_subcategory_code?: string | null
  loan_amount?: number | null
  loan_purpose?: string | null
  loan_purpose_detail?: string | null
  loan_tenure_months?: number | null
  preferred_bank?: string | null
  existing_relationship_bank?: string | null

  // Property Details (Secured Loans)
  property_type?: string | null
  property_sub_type?: string | null
  property_address?: string | null
  property_city?: string | null
  property_state?: string | null
  property_pincode?: string | null
  property_value?: number | null
  property_area_sqft?: number | null
  land_area_sqft?: number | null
  property_age_years?: number | null
  property_ownership?: string | null

  // Existing Loans
  has_existing_loans?: boolean
  total_existing_emis?: number | null
  total_outstanding_loans?: number | null
  existing_loans_details?: Record<string, unknown>[] | null

  // Form/Phase Tracking
  form_status?: string | null
  application_phase?: number
  form_completion_percentage?: number
  phase_1_submitted_at?: string | null
  phase_2_submitted_at?: string | null

  // Link Tracking (ULAP)
  short_link?: string | null
  short_code?: string | null
  shared_via_whatsapp?: boolean
  whatsapp_sent_count?: number
  last_whatsapp_sent_at?: string | null

  // CAM Tracking
  cam_required?: boolean
  cam_status?: CAMStatus
  cam_id?: string | null
  cam_initiated_at?: string | null
  cam_completed_at?: string | null
  cam_credit_score?: number | null
  cam_risk_grade?: string | null
  cam_risk_score?: number | null
  cam_recommendation?: string | null
  cam_eligible_amount?: number | null
  cam_foir?: number | null
  cam_dti?: number | null
  cam_provider?: string | null
  cam_error_message?: string | null
  cam_retry_count?: number

  // Lead Status & Quality
  lead_status: LeadStatus
  previous_status?: string | null
  status_changed_at?: string
  status_changed_by?: string | null
  status_changed_by_name?: string | null
  lead_priority?: string
  lead_score?: number
  lead_quality?: string

  // BDE Assignment
  assigned_bde_id?: string | null
  assigned_bde_name?: string | null
  assigned_at?: string | null
  assignment_type?: string | null
  assignment_rule_id?: string | null
  assignment_criteria?: Record<string, unknown> | null
  bde_team_lead_id?: string | null
  bde_team_lead_name?: string | null

  // Document Tracking
  documents_required?: number
  documents_uploaded?: number
  documents_verified?: number
  all_docs_complete?: boolean

  // Communication Tracking
  last_contacted_at?: string | null
  contact_attempts?: number
  last_note_at?: string | null
  notes_count?: number

  // Outcome
  outcome?: LeadOutcome
  outcome_at?: string | null
  outcome_reason?: string | null
  outcome_reason_category?: string | null
  outcome_by?: string | null
  outcome_by_name?: string | null

  // Financial (Post-Sanction)
  sanctioned_amount?: number | null
  sanctioned_at?: string | null
  sanctioned_bank?: string | null
  sanctioned_bank_branch?: string | null
  bank_login_id?: string | null
  bank_login_date?: string | null
  disbursed_amount?: number | null
  disbursed_at?: string | null
  disbursement_reference?: string | null

  // SLA Tracking
  sla_stage_deadline?: string | null
  sla_breached?: boolean
  sla_breach_count?: number

  // Commission/Referral
  commission_eligible?: boolean
  commission_amount?: number | null
  commission_status?: string | null
  commission_paid_at?: string | null
  referrer_customer_id?: string | null
  referral_points_awarded?: number

  // Dynamic Fields
  collected_data?: Record<string, unknown> | null
  phase_1_data?: Record<string, unknown> | null
  phase_2_data?: Record<string, unknown> | null
  property_data?: Record<string, unknown> | null
  document_data?: Record<string, unknown> | null
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
  remarks?: string | null

  // Timestamps
  created_at: string
  updated_at: string
  is_active: boolean
  deleted_at?: string | null
  deleted_by?: string | null
}

// ============================================================================
// NORMALIZED LEAD INTERFACE (For API responses)
// ============================================================================

export interface NormalizedLead {
  id: string
  lead_number: string

  // Data source (now always 'leads')
  data_source: DataSource
  original_id: string
  original_table: string

  // Customer Information
  customer_name: string
  customer_mobile: string
  customer_email?: string | null
  customer_city?: string | null
  customer_state?: string | null

  // Loan Details
  loan_type: string
  loan_amount?: number | null
  loan_category?: string | null
  loan_subcategory?: string | null

  // Source Attribution
  source_type: string
  source_display: string
  partner_id?: string | null
  partner_name?: string | null
  partner_type?: string | null
  lead_generator_id?: string | null
  lead_generator_name?: string | null

  // Status Information
  status: string
  status_display: string
  form_status?: string | null
  cam_status?: string | null
  application_phase?: number

  // BDE Assignment
  assigned_bde_id?: string | null
  assigned_bde_name?: string | null
  assigned_at?: string | null

  // Form Progress
  form_completion_percentage?: number | null

  // Priority
  priority_level?: string | null
  lead_score?: number | null

  // Outcome
  outcome?: string | null
  outcome_at?: string | null

  // Financial
  sanctioned_amount?: number | null
  disbursed_amount?: number | null

  // CAM Info
  cam_credit_score?: number | null
  cam_risk_grade?: string | null
  cam_eligible_amount?: number | null

  // Timestamps
  created_at: string
  updated_at: string

  // Metadata
  collected_data?: Record<string, unknown> | null
  tags?: string[] | null
  remarks?: string | null
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface UnifiedCRMLeadsFilter {
  source_type?: LeadSourceType | LeadSourceType[] | string
  lead_status?: LeadStatus | LeadStatus[] | string
  cam_status?: CAMStatus | string
  outcome?: LeadOutcome | string
  assigned_bde_id?: string
  lead_generator_id?: string
  customer_city?: string
  loan_type?: string
  priority_level?: string
  date_from?: string
  date_to?: string
  search?: string
  application_phase?: number
}

export interface UnifiedCRMLeadsPagination {
  page: number
  limit: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface UnifiedCRMLeadsResponse {
  leads: NormalizedLead[]
  total: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: UnifiedCRMStats
}

export interface UnifiedCRMStats {
  total_leads: number
  by_source: Record<string, number>
  by_status: Record<string, number>
  by_table: {
    partner_leads: number
    unified_leads: number
  }
  by_outcome?: {
    disbursed: number
    rejected: number
    dropped: number
    in_progress: number
  }
  by_phase?: {
    phase_0: number // New
    phase_1: number // Phase 1 submitted
    phase_2: number // Phase 2 submitted/in progress
    cam: number     // CAM processing
    bde: number     // BDE pipeline
  }
  by_cam_status?: {
    not_required: number
    pending: number
    processing: number
    completed: number
    failed: number
    skipped: number
  }
  financial?: {
    total_loan_amount: number
    total_sanctioned: number
    total_disbursed: number
  }
  today_new_leads: number
  this_week_leads: number
}

// ============================================================================
// PARTNER LEAD STATS (For partner dashboards)
// ============================================================================

export interface LeadStats {
  total_leads: number
  pending_leads: number
  opened_leads: number
  filled_leads: number
  submitted_leads: number
  converted_leads: number
  dropped_leads: number
  whatsapp_sent_count: number
  conversion_rate: number
}

export interface LeadStatsResponse {
  success: boolean
  data?: LeadStats
  error?: string
}

// ============================================================================
// LOAN TYPES (For partner forms)
// ============================================================================

export type LoanType =
  | 'Home Loan'
  | 'Personal Loan'
  | 'Business Loan'
  | 'Loan Against Property'
  | 'Vehicle Loan'
  | 'Education Loan'
  | 'Gold Loan'
  | 'Other'

export interface GenerateLinkResponse {
  success: boolean
  data?: {
    lead_id: string
    lead_number: string
    short_link: string
    short_code: string
    whatsapp_url: string
  }
  error?: string
}

// ============================================================================
// SOURCE DISPLAY MAPPING
// ============================================================================

export const SOURCE_DISPLAY_MAP: Record<string, string> = {
  // ULAP Sources
  ULAP_BA: 'ULAP (BA)',
  ULAP_BP: 'ULAP (BP)',
  ULAP_EMPLOYEE: 'ULAP (Employee)',
  ULAP_CUSTOMER_REFERRAL: 'ULAP (Referral)',
  ULAP_PUBLIC: 'ULAP (Public)',

  // Employee Sources
  CRO: 'CRO',
  DSE: 'Direct Sales',
  DIGITAL_SALES: 'Digital Sales',
  TELECALLER: 'Telecaller',
  FIELD_SALES: 'Field Sales',

  // Customer Sources
  CUSTOMER_DIRECT: 'Direct Customer',

  // Other Sources
  WEBSITE: 'Website',
  WALK_IN: 'Walk-In',
  IVR: 'IVR',
  CHATBOT: 'Chatbot',
}

// ============================================================================
// STATUS DISPLAY MAPPING
// ============================================================================

export const STATUS_DISPLAY_MAP: Record<string, string> = {
  // Application Phases
  NEW: 'New',
  PHASE_1_SUBMITTED: 'Phase 1 Complete',
  PHASE_2_IN_PROGRESS: 'Phase 2 In Progress',
  PHASE_2_SUBMITTED: 'Phase 2 Complete',

  // CAM Statuses
  CAM_PENDING: 'CAM Pending',
  CAM_PROCESSING: 'CAM Processing',
  CAM_COMPLETED: 'CAM Completed',
  CAM_FAILED: 'CAM Failed',
  CAM_SKIPPED: 'CAM Skipped',

  // BDE Pipeline Statuses
  PENDING_ASSIGNMENT: 'Pending Assignment',
  ASSIGNED: 'Assigned',
  CONTACTED: 'Contacted',
  DOC_COLLECTION: 'Document Collection',
  DOC_VERIFIED: 'Documents Verified',
  BANK_LOGIN: 'Bank Login',
  BANK_PROCESSING: 'Bank Processing',
  SANCTIONED: 'Sanctioned',
  DISBURSED: 'Disbursed',

  // Terminal Statuses
  REJECTED: 'Rejected',
  DROPPED: 'Dropped',
  ON_HOLD: 'On Hold',
}

// ============================================================================
// STATUS COLOR MAPPING
// ============================================================================

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Application Phases
  NEW: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  PHASE_1_SUBMITTED: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  PHASE_2_IN_PROGRESS: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  PHASE_2_SUBMITTED: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },

  // CAM Statuses
  CAM_PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  CAM_PROCESSING: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  CAM_COMPLETED: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30' },
  CAM_FAILED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  CAM_SKIPPED: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },

  // BDE Pipeline Statuses
  PENDING_ASSIGNMENT: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  ASSIGNED: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  CONTACTED: { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
  DOC_COLLECTION: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  DOC_VERIFIED: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
  BANK_LOGIN: { bg: 'bg-lime-500/20', text: 'text-lime-400', border: 'border-lime-500/30' },
  BANK_PROCESSING: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  SANCTIONED: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  DISBURSED: { bg: 'bg-green-600/20', text: 'text-green-500', border: 'border-green-600/30' },

  // Terminal Statuses
  REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  DROPPED: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  ON_HOLD: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
}

// ============================================================================
// SOURCE COLOR MAPPING
// ============================================================================

export const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  // ULAP Sources
  ULAP_BA: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  ULAP_BP: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  ULAP_EMPLOYEE: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  ULAP_CUSTOMER_REFERRAL: { bg: 'bg-lime-500/20', text: 'text-lime-400' },
  ULAP_PUBLIC: { bg: 'bg-orange-500/20', text: 'text-orange-400' },

  // Employee Sources
  CRO: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  DSE: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
  DIGITAL_SALES: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  TELECALLER: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
  FIELD_SALES: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },

  // Customer Sources
  CUSTOMER_DIRECT: { bg: 'bg-pink-500/20', text: 'text-pink-400' },

  // Other Sources
  WEBSITE: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  WALK_IN: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  IVR: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400' },
  CHATBOT: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
}

// ============================================================================
// PARTNER TYPE (For trace tokens and partner management)
// ============================================================================

export type PartnerType = 'BUSINESS_PARTNER' | 'BUSINESS_ASSOCIATE' | 'CHANNEL_PARTNER'

// ============================================================================
// TRACE TOKEN STRUCTURE
// ============================================================================

/**
 * Decoded trace token structure for partner referrals
 */
export interface TraceToken {
  role: PartnerType
  userId: string
  partnerId: string
  partnerCode: string
  timestamp: number
  randomKey: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getSourceDisplay(source: string): string {
  return SOURCE_DISPLAY_MAP[source] || source.replace(/_/g, ' ')
}

export function getStatusDisplay(status: string): string {
  return STATUS_DISPLAY_MAP[status] || status.replace(/_/g, ' ')
}

export function getStatusColor(status: string): { bg: string; text: string; border: string } {
  return STATUS_COLORS[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' }
}

export function getSourceColor(source: string): { bg: string; text: string } {
  return SOURCE_COLORS[source] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
}

export function isULAPSource(source: string): boolean {
  return source.startsWith('ULAP_')
}

export function isEmployeeSource(source: string): boolean {
  return ['CRO', 'DSE', 'DIGITAL_SALES', 'TELECALLER', 'FIELD_SALES'].includes(source)
}

export function isInCAMPhase(status: string): boolean {
  return status.startsWith('CAM_')
}

export function isInBDEPipeline(status: string): boolean {
  return ['ASSIGNED', 'CONTACTED', 'DOC_COLLECTION', 'DOC_VERIFIED', 'BANK_LOGIN', 'BANK_PROCESSING', 'SANCTIONED'].includes(status)
}

export function isTerminalStatus(status: string): boolean {
  return ['DISBURSED', 'REJECTED', 'DROPPED'].includes(status)
}

export function getPhaseFromStatus(status: string): number {
  if (status === 'NEW') return 0
  if (status === 'PHASE_1_SUBMITTED') return 1
  if (status.startsWith('PHASE_2')) return 2
  if (status.startsWith('CAM_')) return 3
  return 4 // BDE pipeline
}

// ============================================================================
// BDE PIPELINE TYPES (Consolidated from unified-leads.types.ts)
// ============================================================================

export type UnifiedLeadStage =
  | 'ASSIGNED'
  | 'CONTACTED'
  | 'DOC_COLLECTION'
  | 'DOC_VERIFIED'
  | 'BANK_LOGIN'
  | 'BANK_PROCESSING'
  | 'SANCTIONED'
  | 'DISBURSED'
  | 'REJECTED'
  | 'DROPPED'

export type UnifiedLeadOutcome = 'DISBURSED' | 'REJECTED' | 'DROPPED'

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type LeadQualityType = 'COLD' | 'WARM' | 'HOT'
export type AssignmentType = 'AUTO' | 'MANUAL' | 'REASSIGN' | 'ESCALATION'
export type CustomerSubrole = 'SALARIED' | 'SELF_EMPLOYED' | 'PROFESSIONAL' | 'BUSINESS' | 'OTHER'
export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'PROFESSIONAL' | 'BUSINESS_OWNER' | 'RETIRED' | 'OTHER'

export type NoteType =
  | 'DAILY_UPDATE'
  | 'CALL_LOG'
  | 'MEETING'
  | 'DOCUMENT'
  | 'STATUS_CHANGE'
  | 'ESCALATION'
  | 'GENERAL'
  | 'FOLLOW_UP'
  | 'CUSTOMER_RESPONSE'

export type CustomerResponse = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'NO_RESPONSE'

export type DocumentCategory =
  | 'IDENTITY'
  | 'ADDRESS'
  | 'INCOME'
  | 'BANK'
  | 'PROPERTY'
  | 'BUSINESS'
  | 'OTHER'

export type CommissionStatusType = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'

// ============================================================================
// UNIFIED LEAD INTERFACE (BDE Pipeline)
// ============================================================================

export interface UnifiedLead {
  id: string
  lead_number: string

  // Source Attribution
  source_type: LeadSourceType | string
  source_lead_id?: string
  source_lead_table?: string
  source_user_id?: string
  source_user_name?: string
  source_partner_id?: string
  source_partner_name?: string
  trace_token?: string

  // Customer Information
  customer_id?: string
  customer_name: string
  customer_mobile: string
  customer_alternate_mobile?: string
  customer_email?: string
  customer_city?: string
  customer_state?: string
  customer_pincode?: string
  customer_address?: string
  customer_subrole?: CustomerSubrole

  // Loan Details
  loan_type: string
  loan_amount?: number
  loan_purpose?: string
  loan_tenure_months?: number
  employment_type?: EmploymentType
  monthly_income?: number
  company_name?: string

  // Current Status (BDE Pipeline)
  current_stage: UnifiedLeadStage
  previous_stage?: UnifiedLeadStage
  stage_changed_at?: string
  stage_changed_by?: string
  stage_changed_by_name?: string

  // Assignment
  assigned_bde_id?: string
  assigned_bde_name?: string
  assigned_at?: string
  assignment_type?: AssignmentType
  assignment_rule_id?: string

  // BDM (Team Lead)
  bde_team_lead_id?: string
  bde_team_lead_name?: string

  // Processing Flags
  is_priority: boolean
  priority_level: PriorityLevel

  // Quality & Scoring
  lead_score: number
  lead_quality: LeadQualityType

  // Document Tracking
  documents_required: number
  documents_uploaded: number
  documents_verified: number
  all_docs_complete: boolean

  // Communication
  last_contacted_at?: string
  contact_attempts: number
  last_note_at?: string
  notes_count: number

  // Outcome
  outcome?: UnifiedLeadOutcome
  outcome_at?: string
  outcome_reason?: string
  outcome_reason_category?: string
  outcome_by?: string
  outcome_by_name?: string

  // Financial (Post-Sanction)
  sanctioned_amount?: number
  sanctioned_at?: string
  sanctioned_bank?: string
  sanctioned_bank_branch?: string
  bank_login_id?: string
  bank_login_date?: string
  disbursed_amount?: number
  disbursed_at?: string
  disbursement_reference?: string

  // SLA Tracking
  sla_stage_deadline?: string
  sla_breached: boolean
  sla_breach_count: number

  // Commission (for partners)
  commission_eligible: boolean
  commission_amount?: number
  commission_status?: CommissionStatusType
  commission_paid_at?: string

  // Referral Points (for customer referrals)
  referrer_customer_id?: string
  referral_points_awarded: number

  // Metadata
  tags?: string[]
  custom_fields?: Record<string, unknown>

  // Timestamps
  created_at: string
  updated_at: string
  converted_at?: string

  // Soft Delete
  is_active: boolean
  deleted_at?: string
  deleted_by?: string
}

// ============================================================================
// BDE PIPELINE REQUEST/RESPONSE TYPES
// ============================================================================

export interface UpdateUnifiedLeadStageRequest {
  lead_id: string
  new_stage: UnifiedLeadStage
  changed_by_id: string
  changed_by_name: string
  changed_by_role: string
  reason?: string
  outcome_reason_category?: string
}

export interface AssignLeadRequest {
  lead_id: string
  bde_id: string
  assigned_by_id: string
  assigned_by_name: string
  assigned_by_role: string
  reason?: string
}

export interface AddLeadNoteRequest {
  lead_id: string
  note_type: NoteType
  note_text: string
  author_id: string
  author_name: string
  author_role: string
  call_duration_seconds?: number
  call_outcome?: string
  customer_response?: CustomerResponse
  next_action?: string
  next_action_date?: string
  next_action_time?: string
  is_mandatory?: boolean
  attachments?: NoteAttachment[]
}

export interface NoteAttachment {
  file_name: string
  file_url: string
  file_type: string
  file_size: number
}

export interface UnifiedLeadNote {
  id: string
  lead_id: string
  author_id: string
  author_name: string
  author_role: string
  note_type: NoteType
  note_text: string
  call_duration_seconds?: number
  call_outcome?: string
  customer_response?: CustomerResponse
  next_action?: string
  next_action_date?: string
  next_action_time?: string
  is_mandatory: boolean
  note_date: string
  attachments?: NoteAttachment[]
  created_at: string
}

// ============================================================================
// BDE PIPELINE FILTERS & PAGINATION
// ============================================================================

export interface UnifiedLeadsFilter {
  source_type?: LeadSourceType | LeadSourceType[] | string | string[]
  current_stage?: UnifiedLeadStage | UnifiedLeadStage[]
  assigned_bde_id?: string
  bde_team_lead_id?: string
  source_user_id?: string
  source_partner_id?: string
  customer_city?: string
  loan_type?: string
  priority_level?: PriorityLevel
  lead_quality?: LeadQualityType
  sla_breached?: boolean
  outcome?: UnifiedLeadOutcome
  date_from?: string
  date_to?: string
  search?: string
}

export interface UnifiedLeadsPagination {
  page: number
  page_size: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface UnifiedLeadsResponse {
  leads: UnifiedLead[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============================================================================
// BDE PIPELINE DASHBOARD STATS
// ============================================================================

export interface BDEPipelineStats {
  bde_id: string
  bde_name: string
  total_leads: number
  by_stage: Record<UnifiedLeadStage, number>
  converted_count: number
  rejected_count: number
  dropped_count: number
  conversion_rate: number
  sla_breach_count: number
  average_time_per_stage: Record<UnifiedLeadStage, number>
}

export interface SuperAdminDashboardStats {
  total_unified_leads: number
  leads_by_source: Record<string, number>
  leads_by_stage: Record<UnifiedLeadStage, number>
  leads_by_outcome: {
    disbursed: number
    rejected: number
    dropped: number
    in_progress: number
  }
  total_disbursed_amount: number
  total_sanctioned_amount: number
  sla_breached_count: number
  today_new_leads: number
  this_week_conversions: number
  this_month_disbursements: number
  top_performing_bdes: BDEPerformance[]
  source_performance: SourcePerformanceStats[]
}

export interface BDEPerformance {
  bde_id: string
  bde_name: string
  total_leads: number
  disbursed_count: number
  disbursed_amount: number
  conversion_rate: number
}

export interface SourcePerformanceStats {
  source_type: string
  total_leads: number
  converted_to_crm: number
  disbursed_count: number
  rejected_count: number
  dropped_count: number
  average_loan_amount: number
  total_disbursed_amount: number
  conversion_rate: number
  average_time_to_disbursement: number
}

// ============================================================================
// CONVERSION TYPES
// ============================================================================

export interface ConvertToUnifiedLeadParams {
  source_type: LeadSourceType | string
  source_lead_id: string
  source_table: string
  source_user_id: string
  source_user_name: string
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  customer_state?: string
  loan_type: string
  loan_amount?: number
  employment_type?: EmploymentType
  monthly_income?: number
  source_partner_id?: string
  source_partner_name?: string
  assign_bde_id?: string
  customer_id?: string
  referrer_customer_id?: string
}

export interface ConversionResult {
  success: boolean
  unified_lead_id?: string
  lead_number?: string
  assigned_bde_id?: string
  assigned_bde_name?: string
  error?: string
}
