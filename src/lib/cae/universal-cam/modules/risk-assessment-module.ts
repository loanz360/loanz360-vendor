/**
 * Risk Assessment Module
 * Combines risk indicators from all sources to build comprehensive risk profile
 */

import type {
  RiskAssessment,
  RiskComponent,
  RiskFlag,
  ApplicantProfile,
  EmploymentIncome,
  CreditAnalysis,
  FinancialAnalysis,
} from '../types'

interface AMLScreeningResult {
  status: 'CLEAR' | 'MATCH_FOUND' | 'PENDING' | 'NOT_CHECKED'
  pep_match?: boolean
  sanctions_match?: boolean
  adverse_media?: boolean
  details?: string
}

interface CourtRecordsResult {
  status: 'CLEAR' | 'CASES_FOUND' | 'PENDING' | 'NOT_CHECKED'
  civil_cases?: number
  criminal_cases?: number
  pending_cases?: number
  details?: string
}

interface CERSAIResult {
  status: 'CLEAR' | 'ENCUMBERED' | 'PENDING' | 'NOT_CHECKED' | 'NOT_APPLICABLE'
  encumbrances?: string[]
  details?: string
}

interface RiskAssessmentInput {
  applicant: ApplicantProfile
  employment: EmploymentIncome
  credit: CreditAnalysis
  financial: FinancialAnalysis
  loan_type: string
  requested_amount: number
  collateral_value?: number
  aml_screening?: AMLScreeningResult
  court_records?: CourtRecordsResult
  cersai_result?: CERSAIResult
}

// Risk flag definitions
const RISK_FLAG_DEFINITIONS: Array<{
  id: string
  check: (input: RiskAssessmentInput) => boolean
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  title: string
  description: string
  recommendation: string
}> = [
  // Credit Risk Flags
  {
    id: 'CREDIT_WRITE_OFF',
    check: (i) => i.credit.has_write_offs,
    severity: 'CRITICAL',
    category: 'CREDIT',
    title: 'Written Off Accounts',
    description: 'Customer has one or more written off accounts in credit history',
    recommendation: 'Requires senior credit approval or rejection',
  },
  {
    id: 'CREDIT_SETTLEMENT',
    check: (i) => i.credit.has_settlements,
    severity: 'HIGH',
    category: 'CREDIT',
    title: 'Settled Accounts',
    description: 'Customer has settled accounts (not fully paid)',
    recommendation: 'Verify settlement closure and obtain NOC',
  },
  {
    id: 'CREDIT_DPD_90_PLUS',
    check: (i) => i.credit.max_dpd_24_months >= 90,
    severity: 'CRITICAL',
    category: 'CREDIT',
    title: 'Severe Delinquency',
    description: 'Customer has 90+ DPD in last 24 months',
    recommendation: 'High risk - consider rejection or enhanced collateral',
  },
  {
    id: 'CREDIT_DPD_60',
    check: (i) => i.credit.max_dpd_24_months >= 60 && i.credit.max_dpd_24_months < 90,
    severity: 'HIGH',
    category: 'CREDIT',
    title: 'Delinquency Observed',
    description: 'Customer has 60-89 DPD in last 24 months',
    recommendation: 'Review reason and recent payment behavior',
  },
  {
    id: 'CREDIT_LOW_SCORE',
    check: (i) => (i.credit.credit_score || 0) < 600 && i.credit.credit_score !== null,
    severity: 'HIGH',
    category: 'CREDIT',
    title: 'Low Credit Score',
    description: 'Credit score below 600',
    recommendation: 'Limit exposure or seek co-applicant with better score',
  },
  {
    id: 'CREDIT_NTC',
    check: (i) => i.credit.credit_score === null || i.credit.total_accounts === 0,
    severity: 'MEDIUM',
    category: 'CREDIT',
    title: 'New To Credit (NTC)',
    description: 'No credit history found',
    recommendation: 'Verify alternate data sources, consider reduced loan amount',
  },
  {
    id: 'CREDIT_HIGH_UTILIZATION',
    check: (i) => i.credit.credit_utilization_percent > 80,
    severity: 'MEDIUM',
    category: 'CREDIT',
    title: 'High Credit Utilization',
    description: 'Credit card utilization above 80%',
    recommendation: 'Check debt stress level and repayment capacity',
  },
  {
    id: 'CREDIT_MULTIPLE_ENQUIRIES',
    check: (i) => i.credit.enquiries_last_30_days >= 5,
    severity: 'MEDIUM',
    category: 'CREDIT',
    title: 'Multiple Recent Enquiries',
    description: '5 or more credit enquiries in last 30 days',
    recommendation: 'Verify reason for multiple applications',
  },

  // Income Risk Flags
  {
    id: 'INCOME_NOT_VERIFIED',
    check: (i) => !i.employment.income_verified,
    severity: 'HIGH',
    category: 'INCOME',
    title: 'Income Not Verified',
    description: 'Income is self-declared and not verified through documents',
    recommendation: 'Request salary slips, ITR, or bank statements',
  },
  {
    id: 'INCOME_LOW_STABILITY',
    check: (i) => i.employment.income_stability_score < 50,
    severity: 'MEDIUM',
    category: 'INCOME',
    title: 'Low Income Stability',
    description: 'Income stability score below 50',
    recommendation: 'Verify employment continuity and income regularity',
  },
  {
    id: 'INCOME_NO_ITR',
    check: (i) => !i.employment.itr_filed && ['SELF_EMPLOYED', 'BUSINESS'].includes(i.employment.employment_type),
    severity: 'HIGH',
    category: 'INCOME',
    title: 'ITR Not Filed (Self-Employed)',
    description: 'Self-employed applicant has not filed ITR',
    recommendation: 'Request ITR filing or consider GST-based income',
  },
  {
    id: 'INCOME_CASH_BASED',
    check: (i) => i.financial.cash_withdrawal_ratio > 50,
    severity: 'MEDIUM',
    category: 'INCOME',
    title: 'High Cash Transactions',
    description: 'More than 50% withdrawals are in cash',
    recommendation: 'Verify nature of business and income sources',
  },

  // Employment Risk Flags
  {
    id: 'EMPLOYMENT_LOW_TENURE',
    check: (i) => i.employment.salaried_details?.current_job_months !== undefined &&
                  i.employment.salaried_details.current_job_months < 6,
    severity: 'MEDIUM',
    category: 'EMPLOYMENT',
    title: 'Low Job Tenure',
    description: 'Less than 6 months in current job',
    recommendation: 'Verify previous employment and stability',
  },
  {
    id: 'EMPLOYMENT_LOW_BUSINESS_VINTAGE',
    check: (i) => i.employment.business_details?.business_vintage_months !== undefined &&
                  i.employment.business_details.business_vintage_months < 24,
    severity: 'MEDIUM',
    category: 'EMPLOYMENT',
    title: 'Low Business Vintage',
    description: 'Business is less than 2 years old',
    recommendation: 'Request additional collateral or guarantor',
  },
  {
    id: 'EMPLOYMENT_GST_IRREGULAR',
    check: (i) => i.employment.business_details?.gst_filing_status === 'IRREGULAR',
    severity: 'MEDIUM',
    category: 'EMPLOYMENT',
    title: 'Irregular GST Filing',
    description: 'Business has irregular GST filing history',
    recommendation: 'Verify business operations and compliance',
  },

  // Fraud Risk Flags
  {
    id: 'FRAUD_KYC_INCOMPLETE',
    check: (i) => i.applicant.kyc_status !== 'COMPLETE',
    severity: 'MEDIUM',
    category: 'FRAUD',
    title: 'Incomplete KYC',
    description: 'KYC verification is not complete',
    recommendation: 'Complete Aadhaar and PAN verification',
  },
  {
    id: 'FRAUD_NAME_MISMATCH',
    check: (i) => i.applicant.identity_verification.name_match_score < 70,
    severity: 'HIGH',
    category: 'FRAUD',
    title: 'Name Mismatch',
    description: 'Name does not match across identity documents',
    recommendation: 'Verify identity thoroughly, check for fraud',
  },
  {
    id: 'FRAUD_SUSPICIOUS_TRANSACTIONS',
    check: (i) => i.financial.suspicious_transactions > 0,
    severity: 'HIGH',
    category: 'FRAUD',
    title: 'Suspicious Transactions',
    description: 'Suspicious transaction patterns detected in bank statement',
    recommendation: 'Investigate transaction sources and verify income',
  },
  {
    id: 'FRAUD_BOUNCES_DETECTED',
    check: (i) => i.financial.total_bounces >= 3,
    severity: 'HIGH',
    category: 'FRAUD',
    title: 'Multiple Bounces',
    description: '3 or more bounces detected in bank statement',
    recommendation: 'Review payment discipline and capacity',
  },

  // Regulatory Risk Flags
  {
    id: 'REGULATORY_AML_MATCH',
    check: (i) => i.aml_screening?.status === 'MATCH_FOUND',
    severity: 'CRITICAL',
    category: 'REGULATORY',
    title: 'AML/PEP Match',
    description: 'Customer flagged in AML/PEP screening',
    recommendation: 'Escalate to compliance team immediately',
  },
  {
    id: 'REGULATORY_COURT_CASES',
    check: (i) => i.court_records?.status === 'CASES_FOUND',
    severity: 'HIGH',
    category: 'REGULATORY',
    title: 'Court Cases Found',
    description: 'Active or historical court cases found',
    recommendation: 'Review case details and assess impact',
  },

  // Collateral Risk Flags (for secured loans)
  {
    id: 'COLLATERAL_ENCUMBERED',
    check: (i) => i.cersai_result?.status === 'ENCUMBERED',
    severity: 'CRITICAL',
    category: 'COLLATERAL',
    title: 'Property Already Encumbered',
    description: 'Property is already mortgaged to another lender',
    recommendation: 'Cannot proceed without clear title',
  },
  {
    id: 'COLLATERAL_HIGH_LTV',
    check: (i) => i.collateral_value !== undefined &&
                  (i.requested_amount / i.collateral_value) > 0.8,
    severity: 'HIGH',
    category: 'COLLATERAL',
    title: 'High LTV Ratio',
    description: 'Loan to Value ratio exceeds 80%',
    recommendation: 'Reduce loan amount or increase collateral',
  },
]

export class RiskAssessmentModule {
  /**
   * Build comprehensive risk assessment
   */
  build(input: RiskAssessmentInput): RiskAssessment {
    // Generate risk flags
    const riskFlags = this.generateRiskFlags(input)

    // Count flags by severity
    const criticalFlags = riskFlags.filter(f => f.severity === 'CRITICAL').length
    const highFlags = riskFlags.filter(f => f.severity === 'HIGH').length
    const mediumFlags = riskFlags.filter(f => f.severity === 'MEDIUM').length
    const lowFlags = riskFlags.filter(f => f.severity === 'LOW').length

    // Calculate component scores
    const creditRisk = this.calculateCreditRisk(input.credit)
    const incomeRisk = this.calculateIncomeRisk(input.employment, input.financial)
    const employmentRisk = this.calculateEmploymentRisk(input.employment)
    const fraudRisk = this.calculateFraudRisk(input.applicant, input.financial)
    const regulatoryRisk = this.calculateRegulatoryRisk(input.aml_screening, input.court_records)
    const collateralRisk = this.calculateCollateralRisk(input.cersai_result, input.collateral_value, input.requested_amount)

    // Calculate overall risk score (weighted average)
    const weights = {
      credit: 0.30,
      income: 0.20,
      employment: 0.15,
      fraud: 0.15,
      regulatory: 0.10,
      collateral: 0.10,
    }

    const overallRiskScore = Math.round(
      creditRisk.score * weights.credit +
      incomeRisk.score * weights.income +
      employmentRisk.score * weights.employment +
      fraudRisk.score * weights.fraud +
      regulatoryRisk.score * weights.regulatory +
      (collateralRisk?.score || 50) * weights.collateral
    )

    // Determine risk grade
    const riskGrade = this.determineRiskGrade(overallRiskScore, criticalFlags)

    return {
      overall_risk_score: overallRiskScore,
      risk_grade: riskGrade,

      risk_components: {
        credit_risk: creditRisk,
        income_risk: incomeRisk,
        employment_risk: employmentRisk,
        fraud_risk: fraudRisk,
        regulatory_risk: regulatoryRisk,
        collateral_risk: collateralRisk,
      },

      risk_flags: riskFlags,
      critical_flags_count: criticalFlags,
      high_flags_count: highFlags,
      medium_flags_count: mediumFlags,
      low_flags_count: lowFlags,

      aml_pep_status: input.aml_screening?.status || 'NOT_CHECKED',
      aml_pep_details: input.aml_screening?.details || null,
      court_records_status: input.court_records?.status || 'NOT_CHECKED',
      court_records_details: input.court_records?.details || null,
      cersai_check_status: input.cersai_result?.status || 'NOT_CHECKED',
    }
  }

  private generateRiskFlags(input: RiskAssessmentInput): RiskFlag[] {
    return RISK_FLAG_DEFINITIONS
      .filter(def => def.check(input))
      .map(def => ({
        id: def.id,
        category: def.category,
        severity: def.severity,
        title: def.title,
        description: def.description,
        recommendation: def.recommendation,
        auto_generated: true,
      }))
  }

  private calculateCreditRisk(credit: CreditAnalysis): RiskComponent {
    let score = 50 // Base score
    const factors: string[] = []

    // Credit score impact
    if (credit.credit_score === null) {
      score += 20
      factors.push('No credit history (NTC)')
    } else if (credit.credit_score >= 750) {
      score -= 20
      factors.push('Excellent credit score')
    } else if (credit.credit_score >= 700) {
      score -= 10
      factors.push('Good credit score')
    } else if (credit.credit_score >= 650) {
      factors.push('Fair credit score')
    } else if (credit.credit_score >= 550) {
      score += 15
      factors.push('Below average credit score')
    } else {
      score += 30
      factors.push('Poor credit score')
    }

    // Delinquency
    if (credit.has_write_offs) {
      score += 30
      factors.push('Written off accounts')
    }
    if (credit.has_settlements) {
      score += 20
      factors.push('Settled accounts')
    }
    if (credit.max_dpd_24_months >= 90) {
      score += 25
      factors.push('Severe delinquency (90+ DPD)')
    } else if (credit.max_dpd_24_months >= 30) {
      score += 10
      factors.push('Minor delinquency')
    }

    // Payment history
    if (credit.on_time_payment_percent >= 95) {
      score -= 10
      factors.push('Excellent payment history')
    } else if (credit.on_time_payment_percent < 80) {
      score += 15
      factors.push('Poor payment history')
    }

    score = Math.min(100, Math.max(0, score))
    return { score, level: this.scoreToLevel(score), factors }
  }

  private calculateIncomeRisk(employment: EmploymentIncome, financial: FinancialAnalysis): RiskComponent {
    let score = 50
    const factors: string[] = []

    // Income verification
    if (!employment.income_verified) {
      score += 20
      factors.push('Income not verified')
    } else if (employment.income_verification_source === 'ITR') {
      score -= 15
      factors.push('ITR verified income')
    } else if (employment.income_verification_source === 'BANK_STATEMENT') {
      score -= 10
      factors.push('Bank statement verified')
    }

    // Income stability
    if (employment.income_stability_score >= 80) {
      score -= 10
      factors.push('High income stability')
    } else if (employment.income_stability_score < 50) {
      score += 15
      factors.push('Low income stability')
    }

    // Bank statement analysis
    if (financial.total_bounces >= 3) {
      score += 20
      factors.push('Multiple bounces')
    }
    if (financial.cash_withdrawal_ratio > 50) {
      score += 10
      factors.push('High cash withdrawals')
    }
    if (financial.net_monthly_surplus < 0) {
      score += 15
      factors.push('Negative cash flow')
    }

    score = Math.min(100, Math.max(0, score))
    return { score, level: this.scoreToLevel(score), factors }
  }

  private calculateEmploymentRisk(employment: EmploymentIncome): RiskComponent {
    let score = 50
    const factors: string[] = []

    if (employment.employment_type === 'SALARIED' && employment.salaried_details) {
      const details = employment.salaried_details

      // Job stability
      if (details.job_stability_score >= 80) {
        score -= 20
        factors.push('High job stability')
      } else if (details.job_stability_score < 50) {
        score += 15
        factors.push('Low job stability')
      }

      // Employer category
      if (details.employer_category === 'CAT_A') {
        score -= 15
        factors.push('Cat A employer')
      } else if (details.employer_category === 'CAT_D') {
        score += 10
        factors.push('Unclassified employer')
      }

      // Tenure
      if (details.current_job_months < 6) {
        score += 15
        factors.push('Low job tenure')
      } else if (details.current_job_months >= 36) {
        score -= 10
        factors.push('Good job tenure')
      }

    } else if (['SELF_EMPLOYED', 'BUSINESS'].includes(employment.employment_type) && employment.business_details) {
      const details = employment.business_details

      // Business vintage
      if (details.business_vintage_months >= 60) {
        score -= 15
        factors.push('Established business (5+ years)')
      } else if (details.business_vintage_months < 24) {
        score += 20
        factors.push('New business (<2 years)')
      }

      // GST compliance
      if (details.gst_filing_status === 'REGULAR') {
        score -= 10
        factors.push('Regular GST filing')
      } else if (details.gst_filing_status === 'IRREGULAR') {
        score += 15
        factors.push('Irregular GST filing')
      }

      // MSME registration
      if (details.udyam_registered) {
        score -= 5
        factors.push('MSME registered')
      }

    } else {
      score += 25
      factors.push('Non-standard employment type')
    }

    score = Math.min(100, Math.max(0, score))
    return { score, level: this.scoreToLevel(score), factors }
  }

  private calculateFraudRisk(applicant: ApplicantProfile, financial: FinancialAnalysis): RiskComponent {
    let score = 30 // Lower base for fraud
    const factors: string[] = []

    // KYC status
    if (applicant.kyc_status === 'COMPLETE') {
      score -= 10
      factors.push('Complete KYC')
    } else if (applicant.kyc_status === 'PENDING') {
      score += 20
      factors.push('Pending KYC')
    }

    // Identity verification
    if (applicant.identity_verification.name_match_score >= 90) {
      score -= 10
      factors.push('High name match')
    } else if (applicant.identity_verification.name_match_score < 70) {
      score += 25
      factors.push('Name mismatch detected')
    }

    // DOB verification
    if (applicant.identity_verification.dob_match) {
      score -= 5
      factors.push('DOB verified')
    }

    // Bank statement red flags
    if (financial.suspicious_transactions > 0) {
      score += 20
      factors.push('Suspicious transactions')
    }
    if (financial.total_bounces >= 3) {
      score += 10
      factors.push('Multiple bounces')
    }

    score = Math.min(100, Math.max(0, score))
    return { score, level: this.scoreToLevel(score), factors }
  }

  private calculateRegulatoryRisk(
    aml?: AMLScreeningResult,
    court?: CourtRecordsResult
  ): RiskComponent {
    let score = 20 // Low base for regulatory
    const factors: string[] = []

    // AML/PEP
    if (aml?.status === 'MATCH_FOUND') {
      score += 50
      factors.push('AML/PEP match found')
    } else if (aml?.status === 'CLEAR') {
      score -= 10
      factors.push('AML screening clear')
    } else if (aml?.status === 'NOT_CHECKED') {
      score += 10
      factors.push('AML check pending')
    }

    // Court records
    if (court?.status === 'CASES_FOUND') {
      score += 30
      factors.push('Court cases found')
    } else if (court?.status === 'CLEAR') {
      score -= 10
      factors.push('No court records')
    }

    score = Math.min(100, Math.max(0, score))
    return { score, level: this.scoreToLevel(score), factors }
  }

  private calculateCollateralRisk(
    cersai?: CERSAIResult,
    collateralValue?: number,
    requestedAmount?: number
  ): RiskComponent | null {
    if (!collateralValue) return null // Not applicable for unsecured loans

    let score = 40
    const factors: string[] = []

    // CERSAI check
    if (cersai?.status === 'ENCUMBERED') {
      score += 50
      factors.push('Property already encumbered')
    } else if (cersai?.status === 'CLEAR') {
      score -= 15
      factors.push('Clear title')
    }

    // LTV ratio
    if (requestedAmount && collateralValue) {
      const ltv = requestedAmount / collateralValue
      if (ltv <= 0.6) {
        score -= 15
        factors.push('Conservative LTV (<60%)')
      } else if (ltv <= 0.75) {
        factors.push('Standard LTV (60-75%)')
      } else if (ltv <= 0.85) {
        score += 10
        factors.push('High LTV (75-85%)')
      } else {
        score += 25
        factors.push('Very high LTV (>85%)')
      }
    }

    score = Math.min(100, Math.max(0, score))
    return { score, level: this.scoreToLevel(score), factors }
  }

  private scoreToLevel(score: number): RiskComponent['level'] {
    if (score <= 20) return 'VERY_LOW'
    if (score <= 40) return 'LOW'
    if (score <= 60) return 'MEDIUM'
    if (score <= 80) return 'HIGH'
    return 'VERY_HIGH'
  }

  private determineRiskGrade(score: number, criticalFlags: number): RiskAssessment['risk_grade'] {
    // Critical flags automatically worsen grade
    if (criticalFlags >= 2) return 'E'
    if (criticalFlags === 1 && score >= 60) return 'E'
    if (criticalFlags === 1) return 'D'

    if (score <= 25) return 'A'
    if (score <= 40) return 'B'
    if (score <= 55) return 'C'
    if (score <= 75) return 'D'
    return 'E'
  }

  /**
   * Check if risk level allows proceeding with loan
   */
  canProceed(assessment: RiskAssessment): {
    canProceed: boolean
    requiresApproval: boolean
    blockingReasons: string[]
  } {
    const blockingReasons: string[] = []

    // Critical flags block processing
    if (assessment.critical_flags_count > 0) {
      assessment.risk_flags
        .filter(f => f.severity === 'CRITICAL')
        .forEach(f => blockingReasons.push(f.title))
    }

    // AML match blocks
    if (assessment.aml_pep_status === 'MATCH_FOUND') {
      blockingReasons.push('AML/PEP match requires compliance review')
    }

    // Very high risk blocks
    if (assessment.risk_grade === 'E') {
      blockingReasons.push('Risk grade E requires senior approval')
    }

    return {
      canProceed: blockingReasons.length === 0,
      requiresApproval: assessment.risk_grade === 'D' || assessment.high_flags_count >= 3,
      blockingReasons,
    }
  }
}

export const riskAssessmentModule = new RiskAssessmentModule()
