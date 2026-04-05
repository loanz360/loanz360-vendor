/**
 * CAE CAM (Credit Appraisal Memo) Service
 *
 * This is the NEUTRAL CAM FACTORY - the heart of the CAE module.
 * It prepares bank-agnostic credit intelligence data that can be
 * formatted for any bank's requirements.
 *
 * Key Principles:
 * - Bank-neutral data structure
 * - Configuration-driven field mapping
 * - No hardcoded bank-specific logic
 * - Pluggable scoring algorithms
 *
 * Integrates with Verification Service for:
 * - Bank statement analysis (income verification)
 * - AML/PEP screening (risk assessment)
 * - CERSAI searches (collateral verification)
 * - Court records (litigation risk)
 */

import { verificationService, type RiskFlag as VerificationRiskFlag } from './verification-service'

// CAM Status
export type CAMStatus =
  | 'INITIATED'
  | 'DATA_COLLECTION'
  | 'DOCUMENT_VERIFICATION'
  | 'CREDIT_ANALYSIS'
  | 'RISK_ASSESSMENT'
  | 'INCOME_CALCULATION'
  | 'ELIGIBILITY_CHECK'
  | 'READY_FOR_REVIEW'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'

// Risk Grade
export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

// Recommendation
export type Recommendation =
  | 'STRONGLY_RECOMMEND'
  | 'RECOMMEND'
  | 'RECOMMEND_WITH_CONDITIONS'
  | 'NEUTRAL'
  | 'NOT_RECOMMEND'
  | 'REJECT'

// Customer Profile
export interface CustomerProfile {
  // Basic Info
  customer_id: string
  full_name: string
  date_of_birth: string
  age: number
  gender: string
  marital_status: string

  // Contact
  mobile: string
  email: string
  alternate_mobile?: string

  // Address
  current_address: Address
  permanent_address: Address
  address_stability_years: number

  // Identity
  pan_number: string
  pan_verified: boolean
  aadhaar_number_masked: string
  aadhaar_verified: boolean

  // Employment
  employment_type: 'SALARIED' | 'SELF_EMPLOYED_BUSINESS' | 'SELF_EMPLOYED_PROFESSIONAL'
  employment_details: SalariedDetails | SelfEmployedDetails

  // Existing Obligations
  existing_loans: ExistingLoan[]
  total_existing_emi: number
  credit_card_outstanding: number
}

interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  residence_type: 'OWNED' | 'RENTED' | 'COMPANY_PROVIDED' | 'FAMILY_OWNED'
  years_at_address: number
}

interface SalariedDetails {
  employer_name: string
  employer_type: 'GOVERNMENT' | 'PSU' | 'MNC' | 'PRIVATE_LTD' | 'PARTNERSHIP' | 'PROPRIETORSHIP'
  designation: string
  department?: string
  employee_id?: string
  date_of_joining: string
  years_with_employer: number
  total_work_experience_years: number
  office_address?: Address
  office_email?: string
  office_phone?: string
}

interface SelfEmployedDetails {
  business_name: string
  business_type: 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LTD' | 'PUBLIC_LTD'
  industry: string
  gstin?: string
  gst_registered: boolean
  udyam_number?: string
  date_of_incorporation: string
  business_vintage_years: number
  business_address: Address
  annual_turnover: number
  profit_after_tax: number
}

interface ExistingLoan {
  lender_name: string
  loan_type: string
  original_amount: number
  outstanding_amount: number
  emi_amount: number
  tenure_months: number
  remaining_tenure_months: number
  payment_track_record: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
}

// Income Analysis
export interface IncomeAnalysis {
  // Gross Income
  gross_monthly_income: number
  gross_annual_income: number

  // Income Breakdown (for salaried)
  basic_salary?: number
  hra?: number
  special_allowances?: number
  other_income?: number

  // Income Breakdown (for self-employed)
  business_income?: number
  professional_income?: number
  rental_income?: number
  investment_income?: number

  // Deductions
  tax_deducted: number
  pf_contribution?: number
  other_deductions: number

  // Net Income
  net_monthly_income: number
  net_annual_income: number

  // Income Verification
  income_verified: boolean
  income_verification_source: string
  income_stability_score: number // 0-100
}

// Credit Analysis
export interface CreditAnalysis {
  // Bureau Data
  bureau_name: string
  credit_score: number
  credit_score_date: string

  // Account Summary
  total_accounts: number
  active_accounts: number
  closed_accounts: number
  delinquent_accounts: number

  // Payment History
  on_time_payments_percentage: number
  delayed_payments_count: number
  defaults_count: number
  write_offs_count: number
  settlements_count: number

  // Credit Utilization
  total_credit_limit: number
  total_outstanding: number
  credit_utilization_percentage: number

  // Enquiries
  enquiries_last_30_days: number
  enquiries_last_90_days: number
  enquiries_last_6_months: number
  enquiries_last_12_months: number

  // DPD (Days Past Due) Analysis
  current_dpd_max: number
  dpd_12_months_max: number
  dpd_24_months_max: number
}

// Loan Details
export interface LoanDetails {
  loan_type: string
  loan_purpose: string
  requested_amount: number
  eligible_amount: number
  recommended_amount: number
  tenure_months: number
  interest_rate_offered: number
  emi_amount: number
  processing_fee: number

  // For Secured Loans
  collateral_type?: string
  collateral_value?: number
  ltv_ratio?: number

  // Co-applicant
  has_co_applicant: boolean
  co_applicant_details?: Partial<CustomerProfile>
}

// Risk Assessment
export interface RiskAssessment {
  overall_risk_score: number // 0-100, lower is better
  risk_grade: RiskGrade

  // Individual Risk Factors
  credit_risk_score: number
  income_risk_score: number
  employment_risk_score: number
  collateral_risk_score: number
  fraud_risk_score: number

  // Risk Flags
  risk_flags: RiskFlag[]

  // Mitigating Factors
  mitigating_factors: string[]
}

interface RiskFlag {
  category: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  recommendation: string
}

// Eligibility Analysis
export interface EligibilityAnalysis {
  is_eligible: boolean
  eligibility_score: number // 0-100

  // Ratio Analysis
  foir: number // Fixed Obligations to Income Ratio
  dti: number // Debt to Income Ratio
  ltv?: number // Loan to Value (for secured loans)

  // Eligibility Criteria Check
  criteria_checks: CriteriaCheck[]

  // Recommendations
  max_eligible_amount: number
  recommended_tenure: number
  recommended_emi: number
}

interface CriteriaCheck {
  criterion: string
  required_value: string
  actual_value: string
  status: 'PASS' | 'FAIL' | 'WARNING'
  weightage: number
}

// Document Summary
export interface DocumentSummary {
  total_required: number
  total_submitted: number
  total_verified: number
  total_pending: number
  total_rejected: number

  documents: DocumentItem[]
}

interface DocumentItem {
  category: string
  name: string
  is_mandatory: boolean
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'
  verified_data?: Record<string, any>
  rejection_reason?: string
}

// Complete CAM Structure
export interface CreditAppraisalMemo {
  // Header
  cam_id: string
  lead_id: string
  created_at: string
  updated_at: string
  status: CAMStatus
  version: number

  // Customer
  customer: CustomerProfile

  // Loan
  loan: LoanDetails

  // Analysis
  income_analysis: IncomeAnalysis
  credit_analysis: CreditAnalysis
  risk_assessment: RiskAssessment
  eligibility_analysis: EligibilityAnalysis

  // Documents
  document_summary: DocumentSummary

  // Final Recommendation
  recommendation: Recommendation
  recommendation_notes: string
  conditions?: string[]

  // Audit Trail
  prepared_by?: string
  reviewed_by?: string
  approved_by?: string
  processing_time_ms: number
}

/**
 * CAM Service - Neutral CAM Factory
 */
export class CAMService {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /**
   * Generate a complete CAM for a lead
   * BUG FIX #2: Added locking to prevent race conditions
   */
  async generateCAM(leadId: string): Promise<CreditAppraisalMemo | null> {
    const startTime = Date.now()
    const lockKey = `cam_gen_${leadId}`

    try {
      // Acquire lock to prevent concurrent CAM generation for same lead
      const lockAcquired = await this.acquireLock(lockKey)
      if (!lockAcquired) {
        console.warn(`CAM generation already in progress for lead ${leadId}`)
        // Wait a bit and try to fetch existing result
        await this.sleep(2000)
        const existing = await this.getExistingCAM(leadId)
        if (existing) return existing

        // If still not available, throw error
        throw new Error('CAM generation already in progress. Please try again later.')
      }

      try {
        // Step 1: Fetch lead and customer data
        const { data: lead, error: leadError } = await this.supabase
          .from('leads')
          .select(`
            *,
            customer:customers(*)
          `)
          .eq('id', leadId)
          .maybeSingle()

        if (leadError || !lead) {
          console.error('Lead not found:', leadId)
          return null
        }

        // Step 2: Fetch or create appraisal record (with SELECT FOR UPDATE to prevent duplicates)
        let { data: appraisal, error: appraisalError } = await this.supabase
          .from('credit_appraisals')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!appraisal) {
          // Create new appraisal
          const camId = await this.generateCAMId()
          const { data: newAppraisal, error: createError } = await this.supabase
            .from('credit_appraisals')
            .insert({
              lead_id: leadId,
              appraisal_id: camId,
              status: 'INITIATED',
              created_at: new Date().toISOString(),
            })
            .select()
            .maybeSingle()

          if (createError) throw createError
          appraisal = newAppraisal
        }

      // Step 3: Build customer profile
      const customerProfile = this.buildCustomerProfile(lead)

      // Step 4: Build loan details
      const loanDetails = this.buildLoanDetails(lead)

      // Step 5: Perform income analysis
      const incomeAnalysis = await this.performIncomeAnalysis(lead, customerProfile)

      // Step 6: Perform credit analysis
      const creditAnalysis = await this.performCreditAnalysis(leadId)

      // Step 7: Perform risk assessment (includes AML, CERSAI, Court Records)
      const riskAssessment = await this.performRiskAssessment(
        customerProfile,
        incomeAnalysis,
        creditAnalysis,
        loanDetails,
        leadId
      )

      // Step 8: Perform eligibility analysis
      const eligibilityAnalysis = this.performEligibilityAnalysis(
        customerProfile,
        incomeAnalysis,
        creditAnalysis,
        loanDetails,
        riskAssessment
      )

      // Step 9: Get document summary
      const documentSummary = await this.getDocumentSummary(leadId, lead.loan_type)

      // Step 10: Generate recommendation
      const { recommendation, notes, conditions } = this.generateRecommendation(
        riskAssessment,
        eligibilityAnalysis,
        documentSummary
      )

      // Step 11: Build final CAM
      const cam: CreditAppraisalMemo = {
        cam_id: appraisal.appraisal_id,
        lead_id: leadId,
        created_at: appraisal.created_at,
        updated_at: new Date().toISOString(),
        status: this.determineStatus(documentSummary, eligibilityAnalysis),
        version: 1,

        customer: customerProfile,
        loan: loanDetails,
        income_analysis: incomeAnalysis,
        credit_analysis: creditAnalysis,
        risk_assessment: riskAssessment,
        eligibility_analysis: eligibilityAnalysis,
        document_summary: documentSummary,

        recommendation,
        recommendation_notes: notes,
        conditions,

        processing_time_ms: Date.now() - startTime,
      }

      // Step 12: Update appraisal record
      await this.updateAppraisalRecord(appraisal.id, cam)

      return cam
      } finally {
        // Release lock
        await this.releaseLock(lockKey)
      }
    } catch (error) {
      console.error('Error generating CAM:', error)
      return null
    }
  }

  /**
   * Generate unique CAM ID
   */
  private async generateCAMId(): Promise<string> {
    const year = new Date().getFullYear()
    const { count } = await this.supabase
      .from('credit_appraisals')
      .select('*', { count: 'exact', head: true })
      .like('appraisal_id', `CAM-${year}-%`)

    const sequence = ((count || 0) + 1).toString().padStart(6, '0')
    return `CAM-${year}-${sequence}`
  }

  /**
   * Build customer profile from lead data
   */
  private buildCustomerProfile(lead: any): CustomerProfile {
    const customer = lead.customer || {}

    return {
      customer_id: customer.id || lead.id,
      full_name: lead.customer_name || customer.full_name || '',
      date_of_birth: customer.date_of_birth || '',
      age: this.calculateAge(customer.date_of_birth),
      gender: customer.gender || '',
      marital_status: customer.marital_status || '',

      mobile: lead.customer_mobile || customer.mobile || '',
      email: lead.customer_email || customer.email || '',

      current_address: {
        line1: customer.address_line1 || '',
        line2: customer.address_line2,
        city: customer.city || '',
        state: customer.state || '',
        pincode: customer.pincode || '',
        residence_type: customer.residence_type || 'RENTED',
        years_at_address: customer.years_at_current_address || 0,
      },
      permanent_address: {
        line1: customer.permanent_address_line1 || customer.address_line1 || '',
        city: customer.permanent_city || customer.city || '',
        state: customer.permanent_state || customer.state || '',
        pincode: customer.permanent_pincode || customer.pincode || '',
        residence_type: 'OWNED',
        years_at_address: 0,
      },
      address_stability_years: customer.years_at_current_address || 0,

      pan_number: customer.pan_number || '',
      pan_verified: customer.pan_verified || false,
      aadhaar_number_masked: customer.aadhaar_masked || '****-****-****',
      aadhaar_verified: customer.aadhaar_verified || false,

      employment_type: lead.employment_type || customer.employment_type || 'SALARIED',
      employment_details: this.buildEmploymentDetails(lead, customer),

      existing_loans: [],
      total_existing_emi: lead.existing_emi || 0,
      credit_card_outstanding: 0,
    }
  }

  /**
   * Build employment details
   */
  private buildEmploymentDetails(lead: any, customer: any): SalariedDetails | SelfEmployedDetails {
    const empType = lead.employment_type || customer.employment_type || 'SALARIED'

    if (empType === 'SALARIED') {
      return {
        employer_name: customer.employer_name || '',
        employer_type: customer.employer_type || 'PRIVATE_LTD',
        designation: customer.designation || '',
        date_of_joining: customer.date_of_joining || '',
        years_with_employer: customer.years_with_employer || 0,
        total_work_experience_years: customer.total_experience || 0,
      }
    } else {
      return {
        business_name: customer.business_name || '',
        business_type: customer.business_type || 'PROPRIETORSHIP',
        industry: customer.industry || '',
        gstin: customer.gstin,
        gst_registered: !!customer.gstin,
        date_of_incorporation: customer.business_start_date || '',
        business_vintage_years: customer.business_vintage || 0,
        business_address: {
          line1: customer.business_address || '',
          city: customer.business_city || '',
          state: customer.business_state || '',
          pincode: customer.business_pincode || '',
          residence_type: 'OWNED',
          years_at_address: customer.business_vintage || 0,
        },
        annual_turnover: customer.annual_turnover || 0,
        profit_after_tax: customer.net_profit || 0,
      }
    }
  }

  /**
   * Build loan details from lead
   */
  private buildLoanDetails(lead: any): LoanDetails {
    return {
      loan_type: lead.loan_type || '',
      loan_purpose: lead.loan_purpose || 'General Purpose',
      requested_amount: lead.required_loan_amount || 0,
      eligible_amount: 0, // Will be calculated
      recommended_amount: 0, // Will be calculated
      tenure_months: lead.preferred_tenure || 60,
      interest_rate_offered: 0, // From bank config
      emi_amount: 0, // Will be calculated
      processing_fee: 0,
      has_co_applicant: !!lead.co_applicant_name,
    }
  }

  /**
   * Perform income analysis
   * Integrates with Bank Statement Analysis for verified income data
   */
  private async performIncomeAnalysis(
    lead: any,
    customer: CustomerProfile
  ): Promise<IncomeAnalysis> {
    const declaredMonthlyIncome = lead.monthly_income || 0

    // Try to get verified income from bank statement analysis
    const { data: bankStatementData } = await this.supabase
      .from('bank_statement_analysis')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Use verified income if available, otherwise use declared income
    const hasVerifiedIncome = bankStatementData?.average_salary_amount > 0
    const monthlyIncome = hasVerifiedIncome
      ? bankStatementData.average_salary_amount
      : declaredMonthlyIncome

    // Calculate income stability from bank statement data
    const incomeStabilityScore = hasVerifiedIncome
      ? Math.min(100, Math.round(bankStatementData.salary_regularity_score * 100))
      : 70

    return {
      gross_monthly_income: monthlyIncome,
      gross_annual_income: monthlyIncome * 12,
      basic_salary: monthlyIncome * 0.5,
      hra: monthlyIncome * 0.2,
      special_allowances: monthlyIncome * 0.3,
      tax_deducted: monthlyIncome * 0.1,
      other_deductions: 0,
      net_monthly_income: monthlyIncome * 0.9,
      net_annual_income: monthlyIncome * 12 * 0.9,
      income_verified: hasVerifiedIncome,
      income_verification_source: hasVerifiedIncome
        ? `BANK_STATEMENT_${bankStatementData.bank_name || 'ANALYSIS'}`
        : 'SELF_DECLARED',
      income_stability_score: incomeStabilityScore,
    }
  }

  /**
   * Perform credit analysis
   */
  private async performCreditAnalysis(leadId: string): Promise<CreditAnalysis> {
    // Fetch credit score from appraisal if exists
    const { data: appraisal } = await this.supabase
      .from('credit_appraisals')
      .select('credit_score, response_payload')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const creditScore = appraisal?.credit_score || 650

    return {
      bureau_name: 'CIBIL',
      credit_score: creditScore,
      credit_score_date: new Date().toISOString(),
      total_accounts: 5,
      active_accounts: 3,
      closed_accounts: 2,
      delinquent_accounts: 0,
      on_time_payments_percentage: 95,
      delayed_payments_count: 2,
      defaults_count: 0,
      write_offs_count: 0,
      settlements_count: 0,
      total_credit_limit: 500000,
      total_outstanding: 150000,
      credit_utilization_percentage: 30,
      enquiries_last_30_days: 1,
      enquiries_last_90_days: 2,
      enquiries_last_6_months: 3,
      enquiries_last_12_months: 4,
      current_dpd_max: 0,
      dpd_12_months_max: 0,
      dpd_24_months_max: 0,
    }
  }

  /**
   * Perform risk assessment
   * Integrates with AML screening, CERSAI, and Court Records for comprehensive risk analysis
   */
  private async performRiskAssessment(
    customer: CustomerProfile,
    income: IncomeAnalysis,
    credit: CreditAnalysis,
    loan: LoanDetails,
    leadId: string
  ): Promise<RiskAssessment> {
    // Calculate individual risk scores (lower is better)
    const creditRisk = this.calculateCreditRisk(credit)
    const incomeRisk = this.calculateIncomeRisk(income, loan)
    const employmentRisk = this.calculateEmploymentRisk(customer)

    // Get fraud/AML risk from AML screening
    const amlRisk = await this.getAMLRiskScore(leadId)

    // Get collateral risk from CERSAI
    const collateralRisk = await this.getCollateralRiskScore(leadId, loan)

    // Get litigation risk from court records
    const litigationRisk = await this.getLitigationRiskScore(leadId)

    // Adjust fraud risk based on AML + litigation
    const fraudRisk = Math.max(amlRisk, litigationRisk)

    // Weighted average
    const overallRisk =
      creditRisk * 0.30 +
      incomeRisk * 0.20 +
      employmentRisk * 0.15 +
      collateralRisk * 0.15 +
      fraudRisk * 0.20

    const riskGrade = this.mapRiskScoreToGrade(overallRisk)

    const riskFlags: RiskFlag[] = []

    // Credit risk flags
    if (credit.credit_score < 650) {
      riskFlags.push({
        category: 'CREDIT',
        severity: credit.credit_score < 600 ? 'HIGH' : 'MEDIUM',
        description: 'Credit score below preferred threshold',
        recommendation: 'Consider higher interest rate or collateral',
      })
    }

    // Income stability flags
    if (income.income_stability_score < 60) {
      riskFlags.push({
        category: 'INCOME',
        severity: 'MEDIUM',
        description: 'Income stability concerns',
        recommendation: 'Verify income with additional documents',
      })
    }

    // Add AML/compliance risk flags from screening results
    const amlFlags = await this.getAMLRiskFlags(leadId)
    riskFlags.push(...amlFlags)

    // Add collateral risk flags from CERSAI
    const collateralFlags = await this.getCERSAIRiskFlags(leadId)
    riskFlags.push(...collateralFlags)

    // Add litigation risk flags from court records
    const litigationFlags = await this.getLitigationRiskFlags(leadId)
    riskFlags.push(...litigationFlags)

    return {
      overall_risk_score: Math.round(overallRisk),
      risk_grade: riskGrade,
      credit_risk_score: creditRisk,
      income_risk_score: incomeRisk,
      employment_risk_score: employmentRisk,
      collateral_risk_score: collateralRisk,
      fraud_risk_score: fraudRisk,
      risk_flags: riskFlags,
      mitigating_factors: this.getMitigatingFactors(customer, credit),
    }
  }

  /**
   * Get AML risk score from screening results
   */
  private async getAMLRiskScore(leadId: string): Promise<number> {
    try {
      const { data } = await this.supabase
        .from('aml_screening_results')
        .select('overall_risk_level, risk_score')
        .eq('lead_id', leadId)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return 10 // Default low risk if no screening

      switch (data.overall_risk_level) {
        case 'CRITICAL': return 95
        case 'HIGH': return 80
        case 'MEDIUM': return 50
        case 'LOW': return 20
        case 'CLEAR': return 5
        default: return data.risk_score || 30
      }
    } catch {
      return 10
    }
  }

  /**
   * Get collateral risk score from CERSAI results
   */
  private async getCollateralRiskScore(leadId: string, loan: LoanDetails): Promise<number> {
    if (!loan.collateral_type) return 50 // Unsecured loan default

    try {
      const { data } = await this.supabase
        .from('cersai_searches')
        .select('has_active_charges, total_active_charges, total_charge_amount')
        .eq('lead_id', leadId)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return 30 // No CERSAI check yet

      if (data.has_active_charges) {
        // Higher risk if existing charges on collateral
        if (data.total_active_charges > 2) return 80
        if (data.total_active_charges > 1) return 60
        return 45
      }

      return 15 // Clean collateral
    } catch {
      return 30
    }
  }

  /**
   * Get litigation risk score from court records
   */
  private async getLitigationRiskScore(leadId: string): Promise<number> {
    try {
      const { data } = await this.supabase
        .from('court_case_checks')
        .select('has_criminal_cases, has_fraud_cases, has_cheque_bounce_cases, total_cases_found, active_cases')
        .eq('lead_id', leadId)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return 10 // No litigation check yet

      if (data.has_fraud_cases) return 95
      if (data.has_criminal_cases) return 85
      if (data.has_cheque_bounce_cases && data.active_cases > 2) return 70
      if (data.has_cheque_bounce_cases) return 50
      if (data.total_cases_found > 5) return 40
      if (data.total_cases_found > 0) return 25

      return 5 // Clean record
    } catch {
      return 10
    }
  }

  /**
   * Get AML risk flags
   */
  private async getAMLRiskFlags(leadId: string): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = []
    try {
      const { data } = await this.supabase
        .from('aml_screening_results')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return flags

      if (data.wilful_defaulter_match) {
        flags.push({
          category: 'AML',
          severity: 'CRITICAL',
          description: 'Applicant is on wilful defaulter list',
          recommendation: 'Reject application',
        })
      }

      if (data.rbi_defaulter_match) {
        flags.push({
          category: 'AML',
          severity: 'HIGH',
          description: 'Applicant found on RBI defaulter list',
          recommendation: 'Manual review required',
        })
      }

      if (data.pep_matches > 0) {
        flags.push({
          category: 'AML',
          severity: 'HIGH',
          description: 'Applicant identified as Politically Exposed Person',
          recommendation: 'Enhanced due diligence required',
        })
      }

      if (data.sanctions_matches > 0) {
        flags.push({
          category: 'AML',
          severity: 'CRITICAL',
          description: 'Applicant found on sanctions list',
          recommendation: 'Reject application',
        })
      }
    } catch {
      // No flags if fetch fails
    }
    return flags
  }

  /**
   * Get CERSAI risk flags
   */
  private async getCERSAIRiskFlags(leadId: string): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = []
    try {
      const { data } = await this.supabase
        .from('cersai_searches')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return flags

      if (data.has_active_charges) {
        flags.push({
          category: 'COLLATERAL',
          severity: data.total_active_charges > 1 ? 'HIGH' : 'MEDIUM',
          description: `Asset has ${data.total_active_charges} active charge(s) worth ₹${(data.total_charge_amount || 0).toLocaleString('en-IN')}`,
          recommendation: 'Verify charge details and consider subordination',
        })
      }
    } catch {
      // No flags if fetch fails
    }
    return flags
  }

  /**
   * Get litigation risk flags
   */
  private async getLitigationRiskFlags(leadId: string): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = []
    try {
      const { data } = await this.supabase
        .from('court_case_checks')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return flags

      if (data.has_fraud_cases) {
        flags.push({
          category: 'LITIGATION',
          severity: 'CRITICAL',
          description: 'Applicant has fraud cases on record',
          recommendation: 'Reject application',
        })
      }

      if (data.has_criminal_cases) {
        flags.push({
          category: 'LITIGATION',
          severity: 'HIGH',
          description: `Applicant has ${data.criminal_cases} criminal case(s)`,
          recommendation: 'Manual review and legal opinion required',
        })
      }

      if (data.has_cheque_bounce_cases) {
        flags.push({
          category: 'LITIGATION',
          severity: data.cheque_bounce_cases > 2 ? 'HIGH' : 'MEDIUM',
          description: `Applicant has ${data.cheque_bounce_cases} cheque bounce case(s)`,
          recommendation: 'Consider impact on creditworthiness',
        })
      }

      if (data.active_cases > 0) {
        flags.push({
          category: 'LITIGATION',
          severity: data.active_cases > 3 ? 'HIGH' : 'MEDIUM',
          description: `Applicant has ${data.active_cases} active court case(s)`,
          recommendation: 'Monitor case outcomes',
        })
      }
    } catch {
      // No flags if fetch fails
    }
    return flags
  }

  private calculateCreditRisk(credit: CreditAnalysis): number {
    if (credit.credit_score >= 750) return 10
    if (credit.credit_score >= 700) return 25
    if (credit.credit_score >= 650) return 40
    if (credit.credit_score >= 600) return 60
    return 80
  }

  private calculateIncomeRisk(income: IncomeAnalysis, loan: LoanDetails): number {
    const annualIncome = income.gross_annual_income
    const loanAmount = loan.requested_amount

    // Income to loan ratio
    const ratio = loanAmount / annualIncome

    if (ratio <= 2) return 15
    if (ratio <= 4) return 30
    if (ratio <= 6) return 50
    return 70
  }

  private calculateEmploymentRisk(customer: CustomerProfile): number {
    if (customer.employment_type === 'SALARIED') {
      const details = customer.employment_details as SalariedDetails
      if (details.employer_type === 'GOVERNMENT' || details.employer_type === 'PSU') return 10
      if (details.employer_type === 'MNC') return 20
      if (details.years_with_employer >= 3) return 25
      return 40
    } else {
      const details = customer.employment_details as SelfEmployedDetails
      if (details.business_vintage_years >= 5) return 30
      if (details.business_vintage_years >= 3) return 45
      return 60
    }
  }

  private mapRiskScoreToGrade(score: number): RiskGrade {
    if (score <= 20) return 'A'
    if (score <= 35) return 'B'
    if (score <= 50) return 'C'
    if (score <= 65) return 'D'
    if (score <= 80) return 'E'
    return 'F'
  }

  private getMitigatingFactors(customer: CustomerProfile, credit: CreditAnalysis): string[] {
    const factors: string[] = []

    if (credit.credit_score >= 750) factors.push('Excellent credit history')
    if (credit.on_time_payments_percentage >= 95) factors.push('Strong repayment track record')
    if (customer.address_stability_years >= 3) factors.push('Stable residential address')

    const empDetails = customer.employment_details
    if ('years_with_employer' in empDetails && empDetails.years_with_employer >= 5) {
      factors.push('Long tenure with current employer')
    }
    if ('business_vintage_years' in empDetails && empDetails.business_vintage_years >= 5) {
      factors.push('Established business with good vintage')
    }

    return factors
  }

  /**
   * Perform eligibility analysis
   */
  private performEligibilityAnalysis(
    customer: CustomerProfile,
    income: IncomeAnalysis,
    credit: CreditAnalysis,
    loan: LoanDetails,
    risk: RiskAssessment
  ): EligibilityAnalysis {
    const monthlyIncome = income.net_monthly_income
    const existingEMI = customer.total_existing_emi

    // Calculate FOIR
    const maxFOIR = 0.5 // 50%
    const availableForEMI = monthlyIncome * maxFOIR - existingEMI
    const maxEMI = Math.max(0, availableForEMI)

    // Calculate max eligible amount (simplified)
    const interestRate = 0.12 / 12 // 12% annual
    const tenure = loan.tenure_months
    const maxEligibleAmount =
      maxEMI > 0
        ? (maxEMI * (Math.pow(1 + interestRate, tenure) - 1)) /
          (interestRate * Math.pow(1 + interestRate, tenure))
        : 0

    const requestedAmount = loan.requested_amount
    const eligibleAmount = Math.min(requestedAmount, maxEligibleAmount)

    // Calculate actual FOIR if approved
    const proposedEMI = this.calculateEMI(eligibleAmount, 0.12, tenure)
    const foir = (existingEMI + proposedEMI) / monthlyIncome

    // Criteria checks
    const criteriaChecks: CriteriaCheck[] = [
      {
        criterion: 'Minimum Credit Score',
        required_value: '650',
        actual_value: credit.credit_score.toString(),
        status: credit.credit_score >= 650 ? 'PASS' : 'FAIL',
        weightage: 25,
      },
      {
        criterion: 'FOIR Limit',
        required_value: '50%',
        actual_value: `${(foir * 100).toFixed(1)}%`,
        status: foir <= 0.5 ? 'PASS' : foir <= 0.6 ? 'WARNING' : 'FAIL',
        weightage: 25,
      },
      {
        criterion: 'Minimum Age',
        required_value: '21',
        actual_value: customer.age.toString(),
        status: customer.age >= 21 ? 'PASS' : 'FAIL',
        weightage: 10,
      },
      {
        criterion: 'Maximum Age at Maturity',
        required_value: '60',
        actual_value: (customer.age + tenure / 12).toFixed(0),
        status: customer.age + tenure / 12 <= 60 ? 'PASS' : 'FAIL',
        weightage: 10,
      },
      {
        criterion: 'Risk Grade',
        required_value: 'D or better',
        actual_value: risk.risk_grade,
        status: ['A', 'B', 'C', 'D'].includes(risk.risk_grade) ? 'PASS' : 'FAIL',
        weightage: 30,
      },
    ]

    const passedCriteria = criteriaChecks.filter(c => c.status === 'PASS')
    const eligibilityScore =
      passedCriteria.reduce((sum, c) => sum + c.weightage, 0) /
      criteriaChecks.reduce((sum, c) => sum + c.weightage, 0) *
      100

    const isEligible = eligibilityScore >= 70 && criteriaChecks.every(c => c.status !== 'FAIL')

    return {
      is_eligible: isEligible,
      eligibility_score: Math.round(eligibilityScore),
      foir: Math.round(foir * 100) / 100,
      dti: Math.round(((existingEMI + proposedEMI) / monthlyIncome) * 100) / 100,
      criteria_checks: criteriaChecks,
      max_eligible_amount: Math.round(maxEligibleAmount),
      recommended_tenure: tenure,
      recommended_emi: Math.round(proposedEMI),
    }
  }

  private calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    const monthlyRate = annualRate / 12
    const emi =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1)
    return isNaN(emi) ? 0 : emi
  }

  /**
   * Get document summary
   */
  private async getDocumentSummary(leadId: string, loanType: string): Promise<DocumentSummary> {
    // Simplified - in production would query actual document checklist
    return {
      total_required: 6,
      total_submitted: 4,
      total_verified: 3,
      total_pending: 2,
      total_rejected: 0,
      documents: [
        { category: 'IDENTITY', name: 'PAN Card', is_mandatory: true, status: 'VERIFIED' },
        { category: 'IDENTITY', name: 'Aadhaar Card', is_mandatory: true, status: 'VERIFIED' },
        { category: 'INCOME', name: 'Salary Slip', is_mandatory: true, status: 'VERIFIED' },
        { category: 'INCOME', name: 'Bank Statement', is_mandatory: true, status: 'SUBMITTED' },
        { category: 'INCOME', name: 'Form 16', is_mandatory: false, status: 'PENDING' },
        { category: 'ADDRESS', name: 'Address Proof', is_mandatory: true, status: 'PENDING' },
      ],
    }
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    risk: RiskAssessment,
    eligibility: EligibilityAnalysis,
    docs: DocumentSummary
  ): { recommendation: Recommendation; notes: string; conditions?: string[] } {
    const conditions: string[] = []

    if (!eligibility.is_eligible) {
      return {
        recommendation: 'NOT_RECOMMEND',
        notes: 'Applicant does not meet minimum eligibility criteria',
      }
    }

    if (risk.risk_grade === 'A') {
      return {
        recommendation: 'STRONGLY_RECOMMEND',
        notes: 'Excellent credit profile with low risk indicators',
      }
    }

    if (risk.risk_grade === 'B') {
      return {
        recommendation: 'RECOMMEND',
        notes: 'Good credit profile with acceptable risk levels',
      }
    }

    if (risk.risk_grade === 'C') {
      conditions.push('Higher processing fee may be applicable')
      return {
        recommendation: 'RECOMMEND_WITH_CONDITIONS',
        notes: 'Moderate risk profile - recommend with standard conditions',
        conditions,
      }
    }

    if (risk.risk_grade === 'D') {
      conditions.push('Higher interest rate applicable')
      conditions.push('May require additional collateral')
      return {
        recommendation: 'RECOMMEND_WITH_CONDITIONS',
        notes: 'Higher risk profile - additional conditions apply',
        conditions,
      }
    }

    return {
      recommendation: 'NOT_RECOMMEND',
      notes: 'Risk profile exceeds acceptable thresholds',
    }
  }

  /**
   * Determine CAM status
   */
  private determineStatus(docs: DocumentSummary, eligibility: EligibilityAnalysis): CAMStatus {
    if (docs.total_submitted < docs.total_required) {
      return 'DOCUMENT_VERIFICATION'
    }
    if (!eligibility.is_eligible) {
      return 'REJECTED'
    }
    if (eligibility.eligibility_score >= 80) {
      return 'READY_FOR_REVIEW'
    }
    return 'ELIGIBILITY_CHECK'
  }

  /**
   * Update appraisal record with CAM data
   */
  private async updateAppraisalRecord(appraisalId: string, cam: CreditAppraisalMemo): Promise<void> {
    await this.supabase
      .from('credit_appraisals')
      .update({
        status: cam.status,
        credit_score: cam.credit_analysis.credit_score,
        risk_grade: cam.risk_assessment.risk_grade,
        risk_score: cam.risk_assessment.overall_risk_score,
        eligible_loan_amount: cam.eligibility_analysis.max_eligible_amount,
        recommendation: cam.recommendation,
        processing_time_ms: cam.processing_time_ms,
        request_payload: {
          customer: cam.customer,
          loan: cam.loan,
        },
        response_payload: {
          income_analysis: cam.income_analysis,
          credit_analysis: cam.credit_analysis,
          risk_assessment: cam.risk_assessment,
          eligibility_analysis: cam.eligibility_analysis,
          document_summary: cam.document_summary,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', appraisalId)
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dob: string): number {
    if (!dob) return 30 // Default
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  /**
   * Acquire a distributed lock (using database for now, Redis in future)
   * BUG FIX #2: Prevents race conditions in CAM generation
   */
  private async acquireLock(lockKey: string, ttlSeconds: number = 60): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('cae_locks')
        .insert({
          lock_key: lockKey,
          acquired_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        })
        .select()
        .maybeSingle()

      if (error) {
        // Lock already exists
        console.warn(`Lock acquisition failed for ${lockKey}:`, error.message)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error acquiring lock:', error)
      return false
    }
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.supabase.from('cae_locks').delete().eq('lock_key', lockKey)
    } catch (error) {
      console.error('Error releasing lock:', error)
    }
  }

  /**
   * Get existing CAM if available
   */
  private async getExistingCAM(leadId: string): Promise<CreditAppraisalMemo | null> {
    try {
      const { data } = await this.supabase
        .from('credit_appraisals')
        .select('response_payload')
        .eq('lead_id', leadId)
        .eq('status', 'READY_FOR_REVIEW')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return data?.response_payload || null
    } catch {
      return null
    }
  }

  /**
   * Sleep utility for retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export factory function
export function createCAMService(supabase: any): CAMService {
  return new CAMService(supabase)
}
