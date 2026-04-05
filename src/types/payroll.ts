// =====================================================
// PAYROLL TYPE DEFINITIONS (Fix L4: Remove 'any' types)
// Comprehensive TypeScript interfaces for payroll module
// =====================================================

/**
 * Employee Salary Structure
 */
export interface EmployeeSalary {
  id: string
  user_id: string

  // Earnings
  basic_salary: number
  hra: number
  da: number
  special_allowance: number
  medical_allowance: number
  conveyance_allowance: number
  education_allowance: number
  performance_bonus: number
  other_allowances: number

  // Calculated fields
  gross_salary: number
  total_deductions: number
  net_salary: number
  ctc: number

  // Deductions
  pf_employee: number
  pf_employer: number
  esi_employee: number
  esi_employer: number
  professional_tax: number
  tds: number
  loan_deduction: number
  advance_deduction: number
  other_deductions: number

  // Validity
  effective_from: string
  effective_to: string | null
  is_active: boolean

  // Payment details
  salary_grade: string | null
  payment_mode: 'bank_transfer' | 'cash' | 'cheque'
  bank_account_number: string | null
  bank_name: string | null
  bank_ifsc: string | null

  // Audit
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

/**
 * Payslip Record
 */
export interface Payslip {
  id: string
  user_id: string
  payroll_run_id: string

  // Period
  month: number
  year: number
  period_start_date: string
  period_end_date: string

  // Earnings
  basic_salary: number
  hra: number
  da: number
  special_allowance: number
  medical_allowance: number
  conveyance_allowance: number
  education_allowance: number
  performance_bonus: number
  other_allowances: number
  gross_salary: number

  // Deductions
  pf_employee: number
  pf_employer: number
  esi_employee: number
  esi_employer: number
  professional_tax: number
  tds: number
  loan_deduction: number
  advance_deduction: number
  other_deductions: number
  total_deductions: number

  // Net pay
  net_salary: number

  // Attendance
  working_days: number
  present_days: number
  lop_days: number
  lop_amount: number

  // Metadata
  generated_date: string
  pdf_url: string | null
  email_sent: boolean
  email_sent_at: string | null
  download_count: number

  created_at: string
  updated_at: string
}

/**
 * Tax Declaration
 */
export interface TaxDeclaration {
  id: string
  user_id: string
  financial_year: string

  // Section 80C
  section_80c: number

  // Health Insurance (80D)
  section_80d: number

  // Education Loan Interest (80E)
  section_80e: number

  // Donations (80G)
  section_80g: number

  // Savings Account Interest (80TTA)
  section_80tta: number

  // HRA Exemption
  hra_exemption: number

  // Other exemptions
  other_exemptions: number

  // Status
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null

  // Metadata
  created_at: string
  updated_at: string
}

/**
 * Investment Proof
 */
export interface InvestmentProof {
  id: string
  tax_declaration_id: string
  user_id: string

  // Details
  section: '80C' | '80D' | '80E' | '80G' | '80TTA' | 'HRA' | 'OTHER'
  investment_type: string
  amount: number
  proof_url: string
  description: string | null

  // Verification
  verification_status: 'pending' | 'verified' | 'rejected'
  verified_by: string | null
  verified_at: string | null
  verification_notes: string | null

  created_at: string
  updated_at: string
}

/**
 * Employee Loan
 */
export interface EmployeeLoan {
  id: string
  employee_id: string

  loan_type: 'PERSONAL' | 'EMERGENCY' | 'VEHICLE' | 'EDUCATION' | 'HOME'
  loan_amount: number
  interest_rate: number
  tenure_months: number
  emi_amount: number

  // Status
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null
  approved_at: string | null

  // Repayment
  repayment_status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED'
  total_paid: number
  total_outstanding: number
  emis_paid: number
  emis_remaining: number

  // Details
  requested_reason: string
  supporting_documents: string[]

  created_at: string
  updated_at: string
}

/**
 * Salary Advance
 */
export interface SalaryAdvance {
  id: string
  employee_id: string

  advance_amount: number
  requested_reason: string
  urgency_level: 'NORMAL' | 'HIGH' | 'EMERGENCY'

  // Approval
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: string | null
  approved_at: string | null

  // Disbursement
  disbursement_status: 'PENDING' | 'PROCESSED' | 'FAILED'
  disbursed_amount: number
  disbursed_at: string | null

  // Recovery
  recovery_status: 'PENDING' | 'RECOVERED' | 'PARTIAL'
  recovery_month: string | null
  recovered_amount: number

  created_at: string
  updated_at: string
}

/**
 * Reimbursement Claim
 */
export interface Reimbursement {
  id: string
  employee_id: string
  category_id: string

  claim_amount: number
  claim_description: string
  receipt_urls: string[]
  claim_date: string

  // Approval workflow
  approval_status: 'PENDING' | 'MANAGER_APPROVED' | 'FINANCE_APPROVED' | 'APPROVED' | 'REJECTED'
  manager_approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  finance_approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'

  approved_amount: number
  approval_notes: string | null

  // Payment
  payment_status: 'PENDING' | 'PROCESSED' | 'FAILED'
  payment_date: string | null
  payment_reference: string | null

  created_at: string
  updated_at: string

  // Relations
  category?: ReimbursementCategory
}

/**
 * Reimbursement Category
 */
export interface ReimbursementCategory {
  id: string
  category_name: string
  category_code: string
  max_claim_amount: number
  requires_manager_approval: boolean
  requires_finance_approval: boolean
  is_active: boolean
}

/**
 * Payroll Run (for HR)
 */
export interface PayrollRun {
  id: string
  month: number
  year: number
  period_start_date: string
  period_end_date: string

  status: 'draft' | 'processing' | 'processed' | 'approved' | 'paid' | 'cancelled'

  // Statistics
  total_employees: number
  total_gross_salary: number
  total_deductions: number
  total_net_salary: number
  total_employer_contribution: number
  total_ctc: number

  // Processing
  processed_by: string | null
  processed_at: string | null
  approved_by: string | null
  approved_at: string | null
  payment_date: string | null

  notes: string | null

  created_at: string
  updated_at: string
}

/**
 * Payroll Summary (API Response)
 */
export interface PayrollSummary {
  month: string
  salary: {
    basic: number
    hra: number
    special_allowance: number
    gross: number
    net: number
  }
  deductions: {
    loans: number
    epf: number
    esi: number
    pt: number
    total: number
  }
  summary: {
    total_loans: number
    total_loan_outstanding: number
    monthly_emi: number
    pending_advances: number
    pending_reimbursements: number
  }
  statutory: {
    epf_contribution: number
    esi_contribution: number
    pt_deduction: number
  }
  recent_activity: {
    loans: EmployeeLoan[]
    advances: SalaryAdvance[]
    reimbursements: Reimbursement[]
  }
}

/**
 * API Response Wrapper
 */
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Pagination
 */
export interface PaginationParams {
  page: number
  limit: number
  total?: number
  totalPages?: number
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

/**
 * Employee Profile (minimal for payroll)
 */
export interface EmployeeProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  employee_id: string
  designation: string
  department: string
  email: string
  phone: string
  date_of_joining: string
  pan_number: string | null
  aadhaar_number: string | null
  uan_number: string | null
}

/**
 * Payroll Stats (for dashboard)
 */
export interface PayrollStats {
  ytdGross: number
  ytdDeductions: number
  ytdNetPay: number
  lastPayslipAmount: number
}

/**
 * Form State
 */
export interface FormState<T = any> {
  values: T
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
  isValid: boolean
}

/**
 * Loading States
 */
export interface LoadingStates {
  salary: boolean
  payslips: boolean
  taxDeclaration: boolean
  loans: boolean
  advances: boolean
  reimbursements: boolean
}
