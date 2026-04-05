// =====================================================
// PAYROLL VALIDATION SCHEMAS
// Zod schemas for type-safe API validation
// =====================================================

import { z } from 'zod'

// =====================================================
// EMPLOYEE SALARY SCHEMAS
// =====================================================

export const employeeSalarySchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),

  // Earnings
  basic_salary: z.number()
    .positive('Basic salary must be positive')
    .max(10000000, 'Basic salary cannot exceed ₹1 crore'),

  hra: z.number()
    .nonnegative('HRA cannot be negative')
    .max(5000000, 'HRA cannot exceed ₹50 lakh')
    .optional()
    .default(0),

  da: z.number()
    .nonnegative('DA cannot be negative')
    .optional()
    .default(0),

  special_allowance: z.number().nonnegative().optional().default(0),
  medical_allowance: z.number().nonnegative().optional().default(0),
  conveyance_allowance: z.number().nonnegative().optional().default(0),
  education_allowance: z.number().nonnegative().optional().default(0),
  performance_bonus: z.number().nonnegative().optional().default(0),
  other_allowances: z.number().nonnegative().optional().default(0),

  // Deductions
  pf_employee: z.number().nonnegative().optional().default(0),
  pf_employer: z.number().nonnegative().optional().default(0),
  esi_employee: z.number().nonnegative().optional().default(0),
  esi_employer: z.number().nonnegative().optional().default(0),
  professional_tax: z.number().nonnegative().optional().default(0),
  tds: z.number().nonnegative().optional().default(0),
  loan_deduction: z.number().nonnegative().optional().default(0),
  advance_deduction: z.number().nonnegative().optional().default(0),
  other_deductions: z.number().nonnegative().optional().default(0),

  // Validity
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),

  // Payment details
  salary_grade: z.string().max(50).nullable().optional(),
  payment_mode: z.enum(['bank_transfer', 'cash', 'cheque']).default('bank_transfer'),
  bank_account_number: z.string().max(50).nullable().optional(),
  bank_name: z.string().max(100).nullable().optional(),
  bank_ifsc: z.string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code')
    .nullable()
    .optional()
}).refine(
  (data) => {
    // Validate that effective_to is after effective_from if provided
    if (data.effective_to) {
      return new Date(data.effective_to) > new Date(data.effective_from)
    }
    return true
  },
  {
    message: 'Effective to date must be after effective from date',
    path: ['effective_to']
  }
)

export const updateEmployeeSalarySchema = employeeSalarySchema.partial().extend({
  id: z.string().uuid('Invalid salary ID')
})

// =====================================================
// PAYROLL RUN SCHEMAS
// =====================================================

export const payrollRunSchema = z.object({
  month: z.number()
    .int('Month must be an integer')
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12'),

  year: z.number()
    .int('Year must be an integer')
    .min(2020, 'Year must be 2020 or later')
    .max(2050, 'Year must be 2050 or earlier')
})

export const approvePayrollSchema = z.object({
  payroll_run_id: z.string().uuid('Invalid payroll run ID'),
  approval_remarks: z.string().max(500).optional()
})

export const processPaymentSchema = z.object({
  payroll_run_id: z.string().uuid('Invalid payroll run ID'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_reference: z.string().max(100).optional()
})

// =====================================================
// TAX DECLARATION SCHEMAS
// =====================================================

export const taxDeclarationSchema = z.object({
  user_id: z.string().uuid().optional(), // Optional for employee self-submission
  financial_year: z.string()
    .regex(/^\d{4}-\d{2}$/, 'Financial year must be in format YYYY-YY (e.g., 2024-25)'),

  // Tax regime
  tax_regime: z.enum(['old', 'new']).default('old'),

  // Section 80C (Max ₹1,50,000)
  ppf_amount: z.number().nonnegative().max(150000).optional().default(0),
  epf_amount: z.number().nonnegative().max(150000).optional().default(0),
  life_insurance_amount: z.number().nonnegative().max(150000).optional().default(0),
  tuition_fees: z.number().nonnegative().max(150000).optional().default(0),
  home_loan_principal: z.number().nonnegative().max(150000).optional().default(0),
  nsc_amount: z.number().nonnegative().max(150000).optional().default(0),
  elss_amount: z.number().nonnegative().max(150000).optional().default(0),
  other_80c: z.number().nonnegative().max(150000).optional().default(0),

  // Section 80D (Medical Insurance)
  // Self: ₹25,000 (₹50,000 for senior citizens) - max set to 50K to cover both
  medical_insurance_self: z.number().nonnegative().max(50000).optional().default(0),
  medical_insurance_parents: z.number().nonnegative().max(50000).optional().default(0),
  preventive_health_checkup: z.number().nonnegative().max(5000).optional().default(0),

  // Section 80CCD(1B) - NPS (Max ₹50,000)
  section_80ccd_1b: z.number().nonnegative().max(50000).optional().default(0),

  // Other sections
  section_80e_education_loan: z.number().nonnegative().optional().default(0),
  section_80g_donations: z.number().nonnegative().optional().default(0),
  section_80tta_savings_interest: z.number().nonnegative().max(10000).optional().default(0),
  home_loan_interest: z.number().nonnegative().max(200000).optional().default(0),

  // HRA
  hra_rent_paid: z.number().nonnegative().optional().default(0),
  hra_metro_city: z.boolean().optional().default(false)
}).refine(
  (data) => {
    // For new tax regime, no deductions are allowed (except standard deduction & NPS employer 80CCD(2))
    if (data.tax_regime === 'new') {
      const total80C = (data.ppf_amount || 0) + (data.epf_amount || 0) +
                       (data.life_insurance_amount || 0) + (data.tuition_fees || 0) +
                       (data.home_loan_principal || 0) + (data.nsc_amount || 0) +
                       (data.elss_amount || 0) + (data.other_80c || 0)
      const total80D = (data.medical_insurance_self || 0) + (data.medical_insurance_parents || 0) +
                       (data.preventive_health_checkup || 0)
      const totalOther = (data.section_80ccd_1b || 0) + (data.section_80e_education_loan || 0) +
                         (data.section_80g_donations || 0) + (data.section_80tta_savings_interest || 0) +
                         (data.home_loan_interest || 0) + (data.hra_rent_paid || 0)

      if (total80C > 0 || total80D > 0 || totalOther > 0) {
        return false
      }
    }
    return true
  },
  {
    message: 'Deductions are not allowed in new tax regime',
    path: ['tax_regime']
  }
).refine(
  (data) => {
    // Total 80C cannot exceed ₹1,50,000
    const total80C = (data.ppf_amount || 0) + (data.epf_amount || 0) +
                     (data.life_insurance_amount || 0) + (data.tuition_fees || 0) +
                     (data.home_loan_principal || 0) + (data.nsc_amount || 0) +
                     (data.elss_amount || 0) + (data.other_80c || 0)

    return total80C <= 150000
  },
  {
    message: 'Total Section 80C deductions cannot exceed ₹1,50,000',
    path: ['other_80c']
  }
)

export const updateTaxDeclarationSchema = taxDeclarationSchema.partial().extend({
  id: z.string().uuid('Invalid tax declaration ID')
})

export const approveTaxDeclarationSchema = z.object({
  id: z.string().uuid('Invalid tax declaration ID'),
  status: z.enum(['approved', 'rejected']),
  remarks: z.string().max(500).optional()
})

// =====================================================
// INVESTMENT PROOF SCHEMAS
// =====================================================

export const investmentProofSchema = z.object({
  tax_declaration_id: z.string().uuid('Invalid tax declaration ID'),
  document_type: z.string()
    .max(50)
    .refine(
      (val) => ['PPF', 'LIC', 'ELSS', 'NSC', 'Tuition Fee', 'Home Loan', 'Health Insurance', 'Rent Receipt', 'NPS', 'Education Loan', 'Donation'].includes(val),
      'Invalid document type'
    ),
  document_name: z.string().max(255),
  file_url: z.string().url('Invalid file URL'),
  file_size: z.number().int().positive().max(10485760, 'File size cannot exceed 10MB').optional(),
  file_type: z.string().max(50).optional(),
  declared_amount: z.number().positive('Amount must be positive').max(10000000, 'Amount too large')
})

export const verifyInvestmentProofSchema = z.object({
  id: z.string().uuid('Invalid investment proof ID'),
  is_verified: z.boolean(),
  verification_remarks: z.string().max(500).optional()
})

// =====================================================
// LOAN SCHEMAS
// =====================================================

export const employeeLoanSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID').optional(), // Auto-filled from auth
  loan_type: z.enum(['PERSONAL', 'EMERGENCY', 'VEHICLE', 'EDUCATION', 'HOME']),
  loan_amount: z.number()
    .positive('Loan amount must be positive')
    .max(10000000, 'Loan amount cannot exceed ₹1 crore'),
  interest_rate: z.number()
    .nonnegative('Interest rate cannot be negative')
    .max(36, 'Interest rate cannot exceed 36% per annum'),
  tenure_months: z.number()
    .int('Tenure must be in whole months')
    .positive('Tenure must be positive')
    .max(240, 'Tenure cannot exceed 240 months (20 years)'),
  requested_reason: z.string()
    .min(10, 'Please provide detailed reason (minimum 10 characters)')
    .max(1000, 'Reason too long'),
  supporting_documents: z.array(z.string().url()).optional().default([])
})

export const approveLoanSchema = z.object({
  id: z.string().uuid('Invalid loan ID'),
  approval_status: z.enum(['APPROVED', 'REJECTED']),
  approval_comments: z.string().max(500).optional(),
  disbursement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  disbursement_method: z.enum(['BANK_TRANSFER', 'CHEQUE']).optional()
})

// =====================================================
// SALARY ADVANCE SCHEMAS
// =====================================================

export const salaryAdvanceSchema = z.object({
  employee_id: z.string().uuid().optional(),
  advance_amount: z.number()
    .positive('Advance amount must be positive')
    .max(100000, 'Advance amount cannot exceed ₹1 lakh'),
  requested_reason: z.string()
    .min(10, 'Please provide detailed reason')
    .max(500),
  urgency_level: z.enum(['NORMAL', 'HIGH', 'EMERGENCY']).default('NORMAL')
})

export const approveAdvanceSchema = z.object({
  id: z.string().uuid(),
  approval_status: z.enum(['APPROVED', 'REJECTED']),
  approval_comments: z.string().max(500).optional()
})

// =====================================================
// REIMBURSEMENT SCHEMAS
// =====================================================

export const reimbursementSchema = z.object({
  employee_id: z.string().uuid().optional(),
  category_id: z.string().uuid('Invalid category ID'),
  claim_amount: z.number()
    .positive('Claim amount must be positive')
    .max(1000000, 'Claim amount cannot exceed ₹10 lakh'),
  claim_description: z.string()
    .min(10, 'Please provide detailed description')
    .max(1000),
  receipt_urls: z.array(z.string().url())
    .min(1, 'At least one receipt is required')
    .max(10, 'Maximum 10 receipts allowed'),
  claim_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

export const approveReimbursementSchema = z.object({
  id: z.string().uuid(),
  approval_level: z.enum(['manager', 'finance']),
  approval_status: z.enum(['APPROVED', 'REJECTED']),
  approved_amount: z.number().positive().optional(),
  adjustment_reason: z.string().max(500).optional(),
  approval_notes: z.string().max(500).optional()
})

// =====================================================
// SALARY REVISION SCHEMAS
// =====================================================

export const salaryRevisionSchema = z.object({
  user_id: z.string().uuid(),
  new_basic_salary: z.number().positive().max(10000000),
  salary_components: z.record(z.number()),
  revision_type: z.enum(['annual_increment', 'promotion', 'market_adjustment', 'correction']),
  revision_reason: z.string().min(20, 'Please provide detailed reason').max(1000),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().max(500).optional()
})

// =====================================================
// BULK OPERATIONS SCHEMAS
// =====================================================

export const bulkSalaryUploadSchema = z.object({
  salaries: z.array(employeeSalarySchema)
    .min(1, 'At least one salary record required')
    .max(1000, 'Maximum 1000 records allowed per upload')
})

export const bulkPayslipDownloadSchema = z.object({
  payroll_run_id: z.string().uuid(),
  employee_ids: z.array(z.string().uuid()).optional(), // If empty, download all
  format: z.enum(['pdf', 'zip']).default('zip')
})

// =====================================================
// PAYROLL REPORT SCHEMAS
// =====================================================

export const payrollReportSchema = z.object({
  report_type: z.enum([
    'summary',
    'employee_wise',
    'department_wise',
    'statutory_compliance',
    'variance_analysis'
  ]),
  from_month: z.string().regex(/^\d{4}-\d{2}$/),
  to_month: z.string().regex(/^\d{4}-\d{2}$/),
  department: z.string().optional(),
  employee_id: z.string().uuid().optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json')
}).refine(
  (data) => {
    // Validate that to_month is after from_month
    return data.to_month >= data.from_month
  },
  {
    message: 'To month must be after or equal to from month',
    path: ['to_month']
  }
)

// =====================================================
// TYPE EXPORTS
// =====================================================

export type EmployeeSalaryInput = z.infer<typeof employeeSalarySchema>
export type UpdateEmployeeSalaryInput = z.infer<typeof updateEmployeeSalarySchema>
export type PayrollRunInput = z.infer<typeof payrollRunSchema>
export type TaxDeclarationInput = z.infer<typeof taxDeclarationSchema>
export type InvestmentProofInput = z.infer<typeof investmentProofSchema>
export type EmployeeLoanInput = z.infer<typeof employeeLoanSchema>
export type SalaryAdvanceInput = z.infer<typeof salaryAdvanceSchema>
export type ReimbursementInput = z.infer<typeof reimbursementSchema>
export type SalaryRevisionInput = z.infer<typeof salaryRevisionSchema>
export type PayrollReportInput = z.infer<typeof payrollReportSchema>
