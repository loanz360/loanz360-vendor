/**
 * Credit Appraisal Engine (CAE) Type Definitions
 * Defines interfaces for CAE processing, providers, and results
 */

export type CAEProviderType = 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF' | 'INTERNAL' | 'MOCK'

export type CAMStatus = 'NOT_STARTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'UNGRADED'

export interface CAEProviderConfig {
  id: string
  name: string
  provider_type: CAEProviderType
  api_endpoint?: string
  api_key?: string
  is_active: boolean
  priority: number
  timeout_ms: number
  retry_count: number
  config?: Record<string, unknown>
}

export interface CAERequest {
  lead_id: string
  customer_name: string
  customer_mobile: string
  customer_pan?: string
  customer_aadhar?: string
  customer_dob?: string
  customer_email?: string
  customer_address?: string
  customer_city?: string
  customer_state?: string
  customer_pincode?: string
  loan_type: string
  loan_amount: number
  employment_type: string
  monthly_income: number
  employer_name?: string
  years_of_employment?: number
  existing_emis?: number
  co_applicants?: CAECoApplicant[]
}

export interface CAECoApplicant {
  name: string
  mobile?: string
  pan?: string
  aadhar?: string
  dob?: string
  relationship: string
  income?: number
  income_considered: boolean
  income_percentage: number
}

export interface CAEResponse {
  success: boolean
  provider: CAEProviderType
  request_id: string
  timestamp: string
  processing_time_ms: number
  data?: CAEResult
  error?: string
  error_code?: string
}

export interface CAEResult {
  credit_score?: number
  credit_score_range?: { min: number; max: number }
  risk_grade: RiskGrade
  risk_score: number // 0-100

  // Loan eligibility
  eligible_loan_amount: number
  max_loan_amount: number
  recommended_tenure_months?: number
  recommended_interest_rate?: number

  // EMI calculations
  emi_capacity: number
  foir: number // Fixed Obligations to Income Ratio
  ltv?: number // Loan to Value (for secured loans)
  dti: number // Debt to Income ratio

  // Bureau data
  bureau_data?: {
    total_accounts: number
    active_accounts: number
    overdue_accounts: number
    written_off_accounts: number
    enquiries_last_6_months: number
    enquiries_last_12_months: number
    dpd_30_plus_count: number
    dpd_60_plus_count: number
    dpd_90_plus_count: number
    oldest_account_age_months: number
    total_outstanding: number
    total_emis: number
  }

  // Income assessment
  income_assessment?: {
    declared_income: number
    verified_income?: number
    income_source: string
    stability_score: number
    income_documents_required: string[]
  }

  // Flags and alerts
  flags: CAEFlag[]
  alerts: CAEAlert[]

  // Recommendation
  recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REFER' | 'DECLINE'
  recommendation_notes: string[]
  conditions?: string[]

  // Raw provider response (for debugging)
  raw_response?: unknown}

export interface CAEFlag {
  code: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  source: string
}

export interface CAEAlert {
  type: 'FRAUD' | 'RISK' | 'COMPLIANCE' | 'INFO'
  code: string
  message: string
  action_required?: string
}

export interface CreditAppraisalRecord {
  id: string
  lead_id: string
  cam_id: string
  provider: CAEProviderType
  status: CAMStatus
  request_payload: CAERequest
  response_payload?: CAEResponse
  credit_score?: number
  risk_grade?: RiskGrade
  risk_score?: number
  eligible_loan_amount?: number
  recommendation?: string
  processing_time_ms?: number
  error_message?: string
  retry_count: number
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface CAEProviderAdapter {
  provider: CAEProviderType
  name: string

  // Core methods
  processAppraisal(request: CAERequest): Promise<CAEResponse>
  getStatus(requestId: string): Promise<CAEResponse>

  // Health check
  healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }>
}

export interface CAEBusinessRule {
  id: string
  rule_name: string
  rule_type: 'ELIGIBILITY' | 'RISK' | 'PRICING' | 'COMPLIANCE'
  loan_type?: string
  employment_type?: string
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  priority: number
  is_active: boolean
}
