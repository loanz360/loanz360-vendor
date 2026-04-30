/**
 * Universal CAM Types
 * Type definitions for the comprehensive Credit Appraisal Memo structure
 */

// ============================================================================
// Section 1: Applicant Profile
// ============================================================================
export interface ApplicantProfile {
  // Personal Details
  name: string
  dob: string | null
  age: number | null
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null
  marital_status: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | null

  // Contact
  mobile: string
  alternate_mobile: string | null
  email: string | null

  // Identity
  pan: string | null
  pan_verified: boolean
  aadhaar_last_4: string | null
  aadhaar_verified: boolean

  // Address
  current_address: Address | null
  permanent_address: Address | null
  address_verified: boolean

  // DigiLocker
  digilocker_connected: boolean
  digilocker_documents: string[]

  // Overall KYC Status
  kyc_status: 'COMPLETE' | 'PARTIAL' | 'PENDING'
  kyc_completion_percent: number

  // Identity Verification Summary
  identity_verification: {
    pan_status: 'VERIFIED' | 'PENDING' | 'FAILED' | 'NOT_AVAILABLE'
    aadhaar_status: 'VERIFIED' | 'PENDING' | 'FAILED' | 'NOT_AVAILABLE'
    name_match_score: number // 0-100
    dob_match: boolean
    photo_match: boolean
  }
}

export interface Address {
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  country: string
  type: 'OWNED' | 'RENTED' | 'COMPANY_PROVIDED' | 'FAMILY' | 'OTHER'
  years_at_address: number | null
}

// ============================================================================
// Section 2: Employment & Income
// ============================================================================
export interface EmploymentIncome {
  employment_type: 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'RETIRED' | 'HOUSEWIFE' | 'STUDENT' | 'OTHER'

  // For Salaried
  salaried_details: SalariedDetails | null

  // For Self-Employed / Business
  business_details: BusinessDetails | null

  // Income Summary
  gross_monthly_income: number
  net_monthly_income: number
  other_income: number
  other_income_source: string | null
  total_monthly_income: number
  annual_income: number

  // Co-Applicant Income
  co_applicant_income: number | null
  combined_income: number

  // Verification
  income_verified: boolean
  income_verification_source: 'ITR' | 'BANK_STATEMENT' | 'SALARY_SLIP' | 'GST' | 'SELF_DECLARED'
  income_stability_score: number // 0-100

  // ITR Details
  itr_filed: boolean
  itr_years: number
  itr_amounts: number[] // Last 3 years
  itr_average: number
}

export interface SalariedDetails {
  employer_name: string
  employer_type: 'GOVERNMENT' | 'PSU' | 'MNC' | 'PRIVATE_LTD' | 'PARTNERSHIP' | 'PROPRIETORSHIP' | 'OTHER'
  employer_category: 'CAT_A' | 'CAT_B' | 'CAT_C' | 'CAT_D' | 'UNCLASSIFIED'
  industry: string | null
  designation: string | null
  department: string | null
  employee_id: string | null

  // Experience
  total_experience_months: number
  current_job_months: number
  job_stability_score: number // 0-100

  // Salary
  gross_salary: number
  basic_salary: number | null
  hra: number | null
  special_allowance: number | null
  pf_contribution: number | null
  net_salary: number
  salary_credit_mode: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH'
}

export interface BusinessDetails {
  business_name: string
  business_type: 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LTD' | 'PUBLIC_LTD' | 'OTHER'
  industry: string | null
  nature_of_business: string | null

  // Registration
  registration_type: 'REGISTERED' | 'UNREGISTERED'
  registration_number: string | null
  date_of_incorporation: string | null
  business_vintage_months: number

  // GST
  gst_registered: boolean
  gst_number: string | null
  gst_filing_status: 'REGULAR' | 'IRREGULAR' | 'NOT_FILED' | 'NOT_APPLICABLE'
  annual_turnover: number | null
  average_monthly_turnover: number | null

  // Udyam/MSME
  udyam_registered: boolean
  udyam_number: string | null
  msme_category: 'MICRO' | 'SMALL' | 'MEDIUM' | null

  // Profit
  net_profit_margin: number | null
  average_monthly_profit: number | null
}

// ============================================================================
// Section 3: Credit Analysis
// ============================================================================
export interface CreditAnalysis {
  // Credit Score
  credit_score: number | null
  credit_score_source: 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF' | null
  credit_score_date: string | null
  credit_grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'NTC' | null // NTC = New To Credit

  // Account Summary
  total_accounts: number
  active_accounts: number
  closed_accounts: number
  written_off_accounts: number
  settled_accounts: number
  overdue_accounts: number

  // Current Obligations
  existing_loans: ExistingLoan[]
  total_outstanding: number
  total_monthly_emi: number

  // Payment History
  on_time_payment_percent: number // Last 24 months
  max_dpd_12_months: number // Days Past Due
  max_dpd_24_months: number
  delinquency_count: number

  // Credit Utilization (for credit cards)
  total_credit_limit: number
  total_credit_used: number
  credit_utilization_percent: number

  // Enquiries
  enquiries_last_30_days: number
  enquiries_last_90_days: number
  enquiries_last_6_months: number
  enquiries_last_12_months: number

  // Negative Remarks
  negative_remarks: string[]
  has_defaults: boolean
  has_settlements: boolean
  has_write_offs: boolean
}

export interface ExistingLoan {
  loan_type: string
  lender_name: string
  sanctioned_amount: number
  outstanding_amount: number
  emi_amount: number
  tenure_months: number
  remaining_tenure: number
  disbursement_date: string | null
  status: 'ACTIVE' | 'CLOSED' | 'OVERDUE' | 'WRITTEN_OFF' | 'SETTLED'
  payment_status: 'REGULAR' | 'IRREGULAR' | 'DEFAULT'
}

// ============================================================================
// Section 4: Financial Analysis (Bank Statement)
// ============================================================================
export interface FinancialAnalysis {
  // Bank Account
  bank_name: string
  account_number_masked: string // XXXX-1234
  account_type: 'SAVINGS' | 'CURRENT' | 'SALARY'
  account_vintage_months: number

  // Analysis Period
  analysis_period_from: string
  analysis_period_to: string
  analysis_months: number

  // Balance Summary
  average_monthly_balance: number
  minimum_balance: number
  maximum_balance: number
  month_end_balances: number[]

  // Cash Flow
  total_credits: number
  total_debits: number
  average_monthly_inflows: number
  average_monthly_outflows: number
  net_monthly_surplus: number

  // Credit Analysis
  salary_credits_detected: number
  salary_regularity_score: number // 0-100
  salary_employer_name: string | null
  average_salary_credit: number

  // EMI/Loan Outflows
  emi_outflows_detected: number
  total_emi_outflow: number

  // Bounce Analysis
  cheque_bounces: number
  emi_bounces: number
  nach_bounces: number
  total_bounces: number
  bounce_ratio: number // percentage

  // Other Insights
  cash_withdrawals: number
  cash_withdrawal_ratio: number
  high_value_transactions: number // > 1 lakh
  suspicious_transactions: number

  // Scores
  banking_habits_score: number // 0-100
  cash_flow_score: number // 0-100
}

// ============================================================================
// Section 5: Risk Assessment
// ============================================================================
export interface RiskAssessment {
  // Overall
  overall_risk_score: number // 0-100 (lower is better)
  risk_grade: 'A' | 'B' | 'C' | 'D' | 'E'

  // Component Scores
  risk_components: {
    credit_risk: RiskComponent
    income_risk: RiskComponent
    employment_risk: RiskComponent
    fraud_risk: RiskComponent
    regulatory_risk: RiskComponent
    collateral_risk: RiskComponent | null
  }

  // Risk Flags
  risk_flags: RiskFlag[]
  critical_flags_count: number
  high_flags_count: number
  medium_flags_count: number
  low_flags_count: number

  // Regulatory Checks
  aml_pep_status: 'CLEAR' | 'MATCH_FOUND' | 'PENDING' | 'NOT_CHECKED'
  aml_pep_details: string | null
  court_records_status: 'CLEAR' | 'CASES_FOUND' | 'PENDING' | 'NOT_CHECKED'
  court_records_details: string | null
  cersai_check_status: 'CLEAR' | 'ENCUMBERED' | 'PENDING' | 'NOT_CHECKED' | 'NOT_APPLICABLE'
}

export interface RiskComponent {
  score: number // 0-100
  level: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
  factors: string[]
}

export interface RiskFlag {
  id: string
  category: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
  recommendation: string
  auto_generated: boolean
}

// ============================================================================
// Section 6: Eligibility Calculation
// ============================================================================
export interface EligibilityCalculation {
  // Eligibility Status
  is_eligible: boolean
  eligibility_reasons: string[]
  ineligibility_reasons: string[]

  // Key Ratios
  foir: number // Fixed Obligation to Income Ratio (%)
  foir_limit: number
  foir_status: 'WITHIN_LIMIT' | 'NEAR_LIMIT' | 'EXCEEDED'

  dti: number // Debt to Income Ratio (%)
  dti_limit: number
  dti_status: 'WITHIN_LIMIT' | 'NEAR_LIMIT' | 'EXCEEDED'

  ltv: number | null // Loan to Value (for secured loans)
  ltv_limit: number | null
  ltv_status: 'WITHIN_LIMIT' | 'NEAR_LIMIT' | 'EXCEEDED' | 'NOT_APPLICABLE'

  // Calculation Details
  net_monthly_income: number
  existing_emi: number
  max_allowed_new_emi: number
  available_income_for_emi: number

  // Eligibility Results
  requested_amount: number
  max_eligible_amount: number
  recommended_amount: number
  recommended_tenure_months: number
  recommended_interest_rate: number
  estimated_emi: number

  // Post-Loan Projections
  post_loan_foir: number
  post_loan_dti: number
  post_loan_net_surplus: number
}

// ============================================================================
// Section 7: Lender Recommendations
// ============================================================================
export interface LenderRecommendation {
  rank: number
  lender_id: string
  lender_code: string
  lender_name: string
  lender_type: 'BANK' | 'NBFC' | 'HFC' | 'SMALL_FINANCE_BANK'
  lender_logo_url: string | null

  // Offer Details
  max_eligible_amount: number
  offered_interest_rate: number
  offered_tenure_months: number
  estimated_emi: number
  processing_fee: number
  processing_fee_percent: number

  // Scoring
  match_score: number // 0-100
  approval_probability: number // 0-100

  // Matching Factors
  matching_factors: {
    credit_score_match: boolean
    income_match: boolean
    age_match: boolean
    location_match: boolean
    loan_type_match: boolean
    employment_match: boolean
  }

  // Flags
  is_best_match: boolean
  fast_track_eligible: boolean
  pre_approved: boolean

  // Processing
  avg_processing_days: number
}

// ============================================================================
// Section 8: Document Status
// ============================================================================
export interface DocumentStatus {
  // Mandatory Documents
  mandatory_documents: DocumentItem[]
  mandatory_complete: boolean
  mandatory_count: number
  mandatory_uploaded: number

  // Additional Documents
  additional_documents: DocumentItem[]

  // Overall Status
  total_documents: number
  uploaded_documents: number
  verified_documents: number
  rejected_documents: number
  pending_documents: number

  completion_percent: number
}

export interface DocumentItem {
  id: string
  name: string
  category: 'IDENTITY' | 'ADDRESS' | 'INCOME' | 'EMPLOYMENT' | 'PROPERTY' | 'BUSINESS' | 'OTHER'
  is_mandatory: boolean
  status: 'NOT_UPLOADED' | 'UPLOADED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'
  uploaded_at: string | null
  verified_at: string | null
  rejection_reason: string | null
  file_url: string | null
  file_type: string | null
}

// ============================================================================
// Section 9: Final Assessment
// ============================================================================
export interface FinalAssessment {
  // Profile Strength
  profile_strength_score: number // 0-100
  profile_strength_label: 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'VERY_WEAK'

  // Profile Status
  profile_status: 'READY_TO_PROCESS' | 'NEEDS_ATTENTION' | 'REQUIRES_REVIEW' | 'NOT_RECOMMENDED' | 'PENDING'
  status_reason: string

  // Strengths
  strengths: string[]

  // Concerns
  concerns: string[]

  // Pending Actions
  pending_actions: PendingAction[]

  // Assignment
  assigned_to_bde_id: string | null
  assigned_to_bde_name: string | null
  assigned_at: string | null
  assignment_reason: string | null

  // Best Lender
  recommended_lender_id: string | null
  recommended_lender_name: string | null
}

export interface PendingAction {
  id: string
  action: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  due_by: string | null
  assigned_to: string | null
}

// ============================================================================
// Complete CAM Structure
// ============================================================================
export interface UniversalCAM {
  // Header
  cam_id: string
  lead_id: string
  lead_number: string
  version: number
  generated_at: string

  // Loan Request
  loan_type: string
  requested_amount: number
  requested_tenure_months: number | null

  // Source
  lead_source: 'CUSTOMER' | 'PARTNER_BA' | 'PARTNER_BP' | 'PARTNER_CP' | 'EMPLOYEE' | 'REFERRAL' | 'WEBSITE' | 'CHATBOT'
  source_reference_id: string | null
  source_reference_name: string | null

  // Sections
  applicant_profile: ApplicantProfile
  employment_income: EmploymentIncome
  credit_analysis: CreditAnalysis
  financial_analysis: FinancialAnalysis
  risk_assessment: RiskAssessment
  eligibility: EligibilityCalculation
  lender_recommendations: LenderRecommendation[]
  document_status: DocumentStatus
  final_assessment: FinalAssessment

  // Meta
  is_latest: boolean
  status: 'GENERATING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'
  created_at: string
  updated_at: string
}

// ============================================================================
// Input Types for CAM Generation
// ============================================================================
export interface CAMGenerationInput {
  lead_id: string
  loan_type: string
  requested_amount: number
  requested_tenure_months?: number

  // Customer Data
  customer_data: {
    profile: Partial<ApplicantProfile>
    employment?: Partial<EmploymentIncome>
  }

  // Verification Results
  verification_results?: {
    identity?: unknown; credit_bureau?: unknown; income?: unknown; bank_statement?: unknown; aml_screening?: unknown  }

  // Options
  options?: {
    skip_lender_matching?: boolean
    max_lenders?: number
    preferred_lenders?: string[]
  }
}

export interface CAMGenerationResult {
  success: boolean
  cam?: UniversalCAM
  cam_id?: string
  error?: string
  warnings?: string[]
}
