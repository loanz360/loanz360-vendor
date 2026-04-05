/**
 * Partner Leads Type Definitions
 * Used by BA/BP lead management APIs and components
 */

// ============================================================================
// Enums / Union Types
// ============================================================================

export type LoanType =
  | 'Home Loan'
  | 'Personal Loan'
  | 'Business Loan'
  | 'Loan Against Property'
  | 'Vehicle Loan'
  | 'Education Loan'
  | 'Gold Loan'
  | 'Working Capital Loan'
  | 'MSME Loan'
  | 'Professional Loan'
  | 'Other'
  | string

export type FormStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PHASE_1_SUBMITTED'
  | 'PHASE_2_SUBMITTED'
  | 'COMPLETED'
  | string

export type LeadStatus =
  | 'NEW'
  | 'NEW_UNASSIGNED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'CONTACTED'
  | 'DOCUMENTS_PENDING'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'SANCTIONED'
  | 'DISBURSED'
  | 'CONVERTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CLOSED'
  | 'EXPIRED'
  | string

export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH'

// ============================================================================
// Core Data Types
// ============================================================================

export interface PartnerLead {
  id: string
  lead_id: string
  partner_id: string
  partner_type: string
  customer_name: string | null
  customer_mobile: string | null
  customer_email: string | null
  customer_city: string | null
  loan_type: string | null
  required_loan_amount: number | null
  lead_status: LeadStatus | null
  lead_priority: LeadPriority | null
  form_status: FormStatus | null
  remarks: string | null
  tags: string[] | null
  short_link: string | null
  short_code: string | null
  trace_token: string | null
  created_at: string
  updated_at?: string
  [key: string]: unknown
}

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

export interface LeadFilters {
  form_status?: string
  lead_status?: string
  search?: string
  page?: number
  limit?: number
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateLeadRequest {
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  loan_type?: string
  required_loan_amount?: number
  lead_priority?: LeadPriority
  remarks?: string
  tags?: string[]
}

export interface UpdateLeadRequest {
  customer_name?: string
  customer_mobile?: string
  customer_email?: string
  customer_city?: string
  loan_type?: string
  required_loan_amount?: number
  lead_status?: string
  lead_priority?: LeadPriority
  remarks?: string
  tags?: string[]
}

export interface GenerateLinkRequest {
  customer_mobile: string
  customer_name?: string
  loan_type?: string
  required_loan_amount?: number
  remarks?: string
}

export interface SubmitLoanApplicationRequest {
  full_name: string
  mobile_number: string
  email?: string
  city?: string
  loan_type?: LoanType | string
  required_loan_amount?: number
  short_code?: string
  trace_token?: string
  [key: string]: unknown
}

// ============================================================================
// Response Types
// ============================================================================

interface BaseResponse {
  success: boolean
  error?: string
  code?: string
  message?: string
  suggestion?: string
  existing_lead?: {
    lead_id: string
    system: string
    loan_type: string
  }
  details?: unknown
}

export interface GetLeadResponse extends BaseResponse {
  data?: PartnerLead & {
    referral_tracking?: Record<string, unknown>
    partner_info?: {
      partner_id: string
      full_name: string
      partner_type: string
    }
  }
}

export interface GetLeadsResponse extends BaseResponse {
  data?: PartnerLead[]
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface CreateLeadResponse extends BaseResponse {
  data?: PartnerLead
}

export interface UpdateLeadResponse extends BaseResponse {
  data?: PartnerLead
}

export interface GenerateLinkResponse extends BaseResponse {
  data?: {
    lead_id: string
    short_link: string
    short_code: string
    whatsapp_url: string
    lead: PartnerLead
  }
}

export interface LeadStatsResponse extends BaseResponse {
  data?: LeadStats
}

export interface SubmitLoanApplicationResponse extends BaseResponse {
  data?: {
    lead_id: string
    message: string
  }
}
