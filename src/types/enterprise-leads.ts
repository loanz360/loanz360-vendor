/**
 * Enterprise Loan Application System - TypeScript Types
 * Version: 2.0.0
 * Complete type definitions for enhanced system
 */

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

export type FormType = 'BRIEF' | 'DETAILED'

export type FormStatus =
  | 'PENDING'
  | 'OPENED'
  | 'PARTIALLY_FILLED'
  | 'BRIEF_SUBMITTED'
  | 'DETAILED_SUBMITTED'

export type LeadStatus =
  | 'NEW'
  | 'ASSIGNED_TO_BDE'
  | 'IN_PROCESS'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'DOCUMENT_PENDING'
  | 'UNDER_REVIEW'
  | 'SANCTIONED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'DROPPED'
  | 'CLOSED'

export type PartnerType = 'BP' | 'BA' | 'CUSTOMER' | 'EMPLOYEE'

export type CustomerSubrole =
  // Occupation-focused types
  | 'INDIVIDUAL'
  | 'SALARIED'
  | 'SELF_EMPLOYED'
  | 'PROPRIETOR'
  | 'PARTNERSHIP'
  | 'PRIVATE_LIMITED_COMPANY'
  | 'PUBLIC_LIMITED_COMPANY'
  | 'LLP'
  | 'DOCTOR'
  | 'LAWYER'
  | 'CHARTERED_ACCOUNTANT'
  | 'COMPANY_SECRETARY'
  | 'FARMER'
  | 'BUSINESS_OWNER'
  | 'PROFESSIONAL'
  | 'PENSIONER'
  | 'PURE_RENTAL'
  | 'NRI'
  | 'HUF'
  | 'STUDENT'
  | 'HOMEMAKER'
  | 'FREELANCER'
  | 'CONSULTANT'
  | 'ENTREPRENEUR'
  | 'GOVERNMENT_EMPLOYEE'

export type AllocationType = 'AUTO' | 'MANUAL'

export type NoteType = 'DAILY' | 'FOLLOW_UP' | 'CONTACT' | 'STATUS_UPDATE' | 'DOCUMENT' | 'OTHER'

export type InputMethod = 'TYPED' | 'SPEECH_TO_TEXT'

export type CustomerResponse = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'NO_RESPONSE'

export type NotePriority = 'HIGH' | 'MEDIUM' | 'LOW'

export type AlertStatus = 'PENDING' | 'REMINDED' | 'RESOLVED' | 'OVERDUE'

export type StatusType = 'FORM_STATUS' | 'LEAD_STATUS'

export type DocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'DRIVING_LICENSE'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'BANK_STATEMENT'
  | 'SALARY_SLIP'
  | 'ITR'
  | 'FORM_16'
  | 'BUSINESS_PROOF'
  | 'GST_CERTIFICATE'
  | 'PROPERTY_DOCUMENTS'
  | 'PHOTOGRAPH'
  | 'SIGNATURE'
  | 'OTHER'

export type DocumentCategory = 'IDENTITY' | 'INCOME' | 'ADDRESS' | 'BANK' | 'BUSINESS' | 'OTHER'

export type OTPType = 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'MOBILE_VERIFICATION'

export type RegistrationSource = 'BRIEF_FORM' | 'DIRECT' | 'PARTNER_REFERRAL' | 'EMPLOYEE_REFERRAL'

// =====================================================
// ENHANCED CUSTOMER
// =====================================================

export interface EnhancedCustomer {
  id: string
  customer_id: string // CUS-2025-000001
  referral_id: string // REF-000001
  name: string
  mobile: string
  email?: string
  customer_subrole?: CustomerSubrole
  registration_source: RegistrationSource
  registration_completed: boolean
  password_hash?: string
  password_set_at?: string
  last_password_reset?: string
  otp_verified: boolean
  otp_verified_at?: string
  profile_completed_percentage: number
  can_share_referral_links: boolean
  total_referrals_made: number
  successful_referrals: number
  is_active: boolean
  deactivated_at?: string
  deactivation_reason?: string
  created_at: string
  updated_at: string
}

// =====================================================
// ENHANCED PARTNER LEAD
// =====================================================

export interface EnhancedPartnerLead {
  id: string
  partner_id: string
  partner_type: PartnerType
  lead_id: string // L-2025-000001

  // Form details
  form_type: FormType
  form_status: FormStatus
  lead_status: LeadStatus
  progress_percentage: number

  // Customer details
  customer_id?: string
  customer_customer_id?: string
  customer_name?: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  customer_subrole?: CustomerSubrole

  // Loan details
  loan_type?: string
  loan_amount?: number
  loan_purpose?: string
  brief_form_data?: Record<string, unknown>
  detailed_form_data?: Record<string, unknown>

  // BDE assignment
  assigned_bde_id?: string
  assigned_bde_name?: string
  assigned_at?: string
  last_contacted_at?: string
  last_note_at?: string
  total_notes_count: number
  pending_notes_count: number

  // Documents
  document_count: number
  has_all_required_documents: boolean

  // Timestamps
  brief_submitted_at?: string
  detailed_submitted_at?: string
  can_proceed_to_detailed: boolean

  // Reassignment tracking
  is_reassigned: boolean
  reassigned_count: number
  previous_bde_ids?: string[]

  // Status editing
  bde_can_edit_status_history: boolean

  // Final status
  converted: boolean
  sanctioned_amount?: number
  sanctioned_at?: string
  rejection_reason?: string
  rejected_at?: string
  closed_at?: string
  closure_reason?: string

  // Tracking
  trace_token: string
  short_link?: string
  short_code?: string
  whatsapp_sent: boolean
  whatsapp_sent_at?: string

  created_at: string
  updated_at: string
}

// =====================================================
// LEAD ALLOCATION
// =====================================================

export interface LeadAllocation {
  id: string
  lead_id: string
  bde_id: string
  bde_name: string
  bde_email?: string
  allocation_type: AllocationType
  allocated_by?: string
  allocated_by_name?: string
  allocation_reason?: string
  allocated_at: string
  is_current_assignment: boolean
  deallocated_at?: string
  deallocation_reason?: string
  workload_at_allocation: number
  notes?: string
  created_at: string
  updated_at: string
}

// =====================================================
// BDE NOTE
// =====================================================

export interface BDENote {
  id: string
  lead_id: string
  bde_id: string
  bde_name: string
  note_date: string // Date only (YYYY-MM-DD)
  note_text: string
  note_type: NoteType
  input_method: InputMethod
  audio_duration_seconds?: number
  is_mandatory_note: boolean
  tags?: string[]
  customer_response?: CustomerResponse
  next_follow_up_date?: string
  priority?: NotePriority
  attachments?: unknown; created_at: string
  updated_at: string
}

// =====================================================
// PENDING NOTES ALERT
// =====================================================

export interface BDEPendingNotesAlert {
  id: string
  bde_id: string
  lead_id: string
  lead_lead_id: string
  customer_name?: string
  customer_mobile?: string
  pending_for_date: string
  alert_status: AlertStatus
  first_reminded_at?: string
  last_reminded_at?: string
  reminder_count: number
  resolved_at?: string
  note_added_at?: string
  note_id?: string
  created_at: string
}

// =====================================================
// STATUS HISTORY
// =====================================================

export interface StatusHistory {
  id: string
  lead_id: string
  changed_by_id?: string
  changed_by_name?: string
  changed_by_role?: string
  from_status?: string
  to_status: string
  status_type: StatusType
  change_reason?: string
  additional_notes?: string
  is_edited: boolean
  edited_at?: string
  edited_by_id?: string
  edited_by_name?: string
  original_from_status?: string
  original_to_status?: string
  change_metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// =====================================================
// LEAD DOCUMENT
// =====================================================

export interface LeadDocument {
  id: string
  lead_id: string
  customer_id?: string
  uploaded_by_id?: string
  uploaded_by_type?: string
  uploaded_by_name?: string
  document_type: DocumentType
  document_category?: DocumentCategory
  file_name: string
  original_file_name?: string
  file_size_bytes: number
  original_file_size_bytes?: number
  file_type: string
  mime_type?: string
  s3_bucket: string
  s3_key: string
  s3_region?: string
  s3_url?: string
  is_compressed: boolean
  compression_ratio?: number
  is_required: boolean
  is_verified: boolean
  verified_by_id?: string
  verified_by_name?: string
  verified_at?: string
  verification_notes?: string
  is_rejected: boolean
  rejection_reason?: string
  rejected_at?: string
  rejected_by_id?: string
  expires_at?: string
  is_encrypted: boolean
  encryption_key_id?: string
  thumbnail_s3_key?: string
  thumbnail_url?: string
  metadata?: unknown; tags?: string[]
  upload_ip?: string
  upload_user_agent?: string
  created_at: string
  updated_at: string
}

// =====================================================
// CUSTOMER PROFILE DOCUMENT
// =====================================================

export interface CustomerProfileDocument {
  id: string
  customer_id: string
  document_type: DocumentType
  document_category?: DocumentCategory
  file_name: string
  original_file_name?: string
  file_size_bytes: number
  original_file_size_bytes?: number
  file_type: string
  mime_type?: string
  s3_bucket: string
  s3_key: string
  s3_region?: string
  s3_url?: string
  is_compressed: boolean
  compression_ratio?: number
  is_profile_picture: boolean
  is_signature: boolean
  is_active: boolean
  replaced_by_id?: string
  replaced_at?: string
  metadata?: unknown; created_at: string
  updated_at: string
}

// =====================================================
// OTP VERIFICATION
// =====================================================

export interface OTPVerification {
  id: string
  customer_id?: string
  mobile?: string
  email?: string
  otp_code: string
  otp_type: OTPType
  purpose?: string
  is_verified: boolean
  verified_at?: string
  expires_at: string
  attempt_count: number
  max_attempts: number
  is_expired: boolean
  is_blocked: boolean
  blocked_until?: string
  verification_ip?: string
  verification_user_agent?: string
  created_at: string
  updated_at: string
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

// Brief Form Submission
export interface BriefFormRequest {
  // Originator details (trace token OR manual fields)
  trace_token?: string
  originator_type?: PartnerType
  originator_id?: string

  // Customer details
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  customer_subrole: CustomerSubrole

  // Loan details
  loan_type: string
  loan_amount: number
  loan_purpose?: string

  // Additional data
  additional_data?: Record<string, unknown>
}

export interface BriefFormResponse {
  success: boolean
  customer_id?: string
  customer_customer_id?: string
  referral_id?: string
  lead_id?: string
  lead_lead_id?: string
  message?: string
  next_steps?: {
    can_set_password: boolean
    can_fill_detailed_form: boolean
    detailed_form_url?: string
  }
  error?: string
}

// Detailed Form Submission
export interface DetailedFormRequest {
  customer_id: string
  lead_id: string

  // Personal details
  date_of_birth?: string
  gender?: string
  marital_status?: string
  father_name?: string
  mother_name?: string
  spouse_name?: string

  // Address details
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  pincode?: string

  // Employment details
  employment_type?: string
  employer_name?: string
  job_title?: string
  work_experience_years?: number
  monthly_income?: number
  annual_income?: number

  // Existing loans
  existing_loans?: Array<{
    lender: string
    type: string
    amount: number
    emi: number
    outstanding: number
  }>

  // Additional data
  additional_data?: Record<string, unknown>
}

export interface DetailedFormResponse {
  success: boolean
  lead_id?: string
  message?: string
  auto_assigned_bde?: {
    bde_id: string
    bde_name: string
    bde_email?: string
  }
  next_steps?: {
    documents_required: string[]
    upload_url?: string
  }
  error?: string
}

// OTP Request/Verification
export interface OTPRequest {
  mobile: string
  otp_type: OTPType
  purpose?: string
}

export interface OTPResponse {
  success: boolean
  message?: string
  otp_id?: string
  expires_at?: string
  error?: string
}

export interface OTPVerifyRequest {
  mobile: string
  otp_code: string
  otp_type: OTPType
}

export interface OTPVerifyResponse {
  success: boolean
  verified: boolean
  customer_id?: string
  requires_password_setup?: boolean
  access_token?: string
  error?: string
}

// Document Upload
export interface DocumentUploadRequest {
  lead_id?: string
  customer_id?: string
  document_type: DocumentType
  document_category: DocumentCategory
  file: File | Buffer
  is_required?: boolean
}

export interface DocumentUploadResponse {
  success: boolean
  document?: LeadDocument
  message?: string
  error?: string
}

// BDE Notes
export interface BDENoteRequest {
  lead_id: string
  note_text: string
  note_type?: NoteType
  input_method?: InputMethod
  audio_duration_seconds?: number
  customer_response?: CustomerResponse
  next_follow_up_date?: string
  priority?: NotePriority
  tags?: string[]
}

export interface BDENoteResponse {
  success: boolean
  note?: BDENote
  resolved_alert?: boolean
  message?: string
  error?: string
}

// BDE Dashboard Stats
export interface BDEDashboardStats {
  total_assigned: number
  in_process: number
  contacted_today: number
  pending_notes: number
  follow_ups_due: number
  document_pending: number
  qualified: number
  converted_this_month: number
  workload_percentage: number
}

// Lead Assignment
export interface LeadReassignRequest {
  lead_id: string
  new_bde_id: string
  reason: string
  notes?: string
}

export interface LeadReassignResponse {
  success: boolean
  allocation?: LeadAllocation
  message?: string
  error?: string
}

// Customer Dashboard Stats
export interface CustomerDashboardStats {
  total_applications: number
  in_progress: number
  sanctioned: number
  rejected: number
  total_referrals: number
  successful_referrals: number
  referral_earnings?: number
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data?: T[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  error?: string
}

export interface SearchFilters {
  search?: string
  form_status?: FormStatus
  lead_status?: LeadStatus
  assigned_bde_id?: string
  date_from?: string
  date_to?: string
  has_pending_notes?: boolean
  has_pending_documents?: boolean
}

export interface SortOptions {
  field: string
  order: 'asc' | 'desc'
}
