/**
 * Universal CAM Generator
 * Main orchestrator that ties all CAM modules together
 * This is the primary entry point for CAM generation
 */

import type {
  UniversalCAM,
  CAMGenerationInput,
  CAMGenerationResult,
  ApplicantProfile,
  EmploymentIncome,
  CreditAnalysis,
  FinancialAnalysis,
  RiskAssessment,
  EligibilityCalculation,
  LenderRecommendation,
  DocumentStatus,
  FinalAssessment,
  PendingAction,
} from '../types'

import { applicantProfileModule } from './applicant-profile-module'
import { employmentIncomeModule } from './employment-income-module'
import { creditAnalysisModule } from './credit-analysis-module'
import { financialAnalysisModule } from './financial-analysis-module'
import { riskAssessmentModule } from './risk-assessment-module'
import { eligibilityCalculatorModule } from './eligibility-calculator-module'
import { lenderMatcherModule } from './lender-matcher-module'

interface GeneratorDependencies {
  // Database queries
  fetchLenders: () => Promise<any[]>
  fetchLenderRules: (loanType: string) => Promise<any[]>
  fetchDocuments: (leadId: string) => Promise<any[]>
  fetchLeadDetails: (leadId: string) => Promise<unknown>

  // Optional: BDE assignment
  findBestBDE?: (loanType: string, amount: number, location?: string) => Promise<{
    bde_id: string
    bde_name: string
    reason: string
  } | null>
}

export class UniversalCAMGenerator {
  private deps: GeneratorDependencies

  constructor(dependencies: GeneratorDependencies) {
    this.deps = dependencies
  }

  /**
   * Generate a complete Universal CAM
   */
  async generate(input: CAMGenerationInput): Promise<CAMGenerationResult> {
    const warnings: string[] = []
    const startTime = Date.now()

    try {
      // Generate unique CAM ID
      const camId = this.generateCAMId()

      // Fetch lead details for context
      const leadDetails = await this.deps.fetchLeadDetails(input.lead_id)
      if (!leadDetails) {
        return {
          success: false,
          error: `Lead not found: ${input.lead_id}`,
        }
      }

      // ========================================
      // Section 1: Applicant Profile
      // ========================================
      const applicantProfile = applicantProfileModule.build(
        {
          name: input.customer_data.profile.name || leadDetails.customer_name || '',
          mobile: input.customer_data.profile.mobile || leadDetails.mobile || '',
          email: input.customer_data.profile.email || leadDetails.email,
          dob: input.customer_data.profile.dob,
          gender: input.customer_data.profile.gender,
          marital_status: input.customer_data.profile.marital_status,
          pan: input.customer_data.profile.pan,
          alternate_mobile: input.customer_data.profile.alternate_mobile,
          address: input.customer_data.profile.current_address,
        },
        input.verification_results?.identity
      )

      if (applicantProfile.kyc_status !== 'COMPLETE') {
        warnings.push('KYC verification is incomplete')
      }

      // ========================================
      // Section 2: Employment & Income
      // ========================================
      const employmentIncome = employmentIncomeModule.build(
        {
          employment_type: input.customer_data.employment?.employment_type,
          employer_name: input.customer_data.employment?.salaried_details?.employer_name,
          employer_type: input.customer_data.employment?.salaried_details?.employer_type,
          designation: input.customer_data.employment?.salaried_details?.designation,
          industry: input.customer_data.employment?.salaried_details?.industry,
          gross_salary: input.customer_data.employment?.gross_monthly_income,
          net_salary: input.customer_data.employment?.net_monthly_income,
          total_experience_years: input.customer_data.employment?.salaried_details?.total_experience_months
            ? input.customer_data.employment.salaried_details.total_experience_months / 12
            : undefined,
          current_job_years: input.customer_data.employment?.salaried_details?.current_job_months
            ? input.customer_data.employment.salaried_details.current_job_months / 12
            : undefined,
          business_name: input.customer_data.employment?.business_details?.business_name,
          business_type: input.customer_data.employment?.business_details?.business_type,
          annual_turnover: input.customer_data.employment?.business_details?.annual_turnover,
          monthly_profit: input.customer_data.employment?.business_details?.average_monthly_profit,
          other_income: input.customer_data.employment?.other_income,
          other_income_source: input.customer_data.employment?.other_income_source,
          co_applicant_income: input.customer_data.employment?.co_applicant_income,
        },
        input.verification_results?.income, // GST verification
        input.verification_results?.income, // ITR verification
        input.verification_results?.bank_statement
      )

      if (!employmentIncome.income_verified) {
        warnings.push('Income is not verified - based on self-declaration')
      }

      // ========================================
      // Section 3: Credit Analysis
      // ========================================
      const creditAnalysis = creditAnalysisModule.build(input.verification_results?.credit_bureau)

      if (creditAnalysis.credit_grade === 'E') {
        warnings.push('Credit grade E - very high risk profile')
      }
      if (creditAnalysis.has_write_offs) {
        warnings.push('Written off accounts found in credit history')
      }

      // ========================================
      // Section 4: Financial Analysis
      // ========================================
      const financialAnalysis = financialAnalysisModule.build(input.verification_results?.bank_statement)

      if (financialAnalysis.total_bounces > 0) {
        warnings.push(`${financialAnalysis.total_bounces} bounces detected in bank statement`)
      }

      // ========================================
      // Section 5: Risk Assessment
      // ========================================
      const riskAssessment = riskAssessmentModule.build({
        applicant: applicantProfile,
        employment: employmentIncome,
        credit: creditAnalysis,
        financial: financialAnalysis,
        loan_type: input.loan_type,
        requested_amount: input.requested_amount,
        aml_screening: input.verification_results?.aml_screening,
      })

      // ========================================
      // Section 6: Eligibility Calculation
      // ========================================
      const eligibility = eligibilityCalculatorModule.calculate({
        requested_amount: input.requested_amount,
        requested_tenure_months: input.requested_tenure_months,
        loan_type: input.loan_type,
        employment: employmentIncome,
        credit: creditAnalysis,
      })

      if (!eligibility.is_eligible) {
        warnings.push('Customer may not be eligible based on current criteria')
      }

      // ========================================
      // Section 7: Lender Recommendations
      // ========================================
      let lenderRecommendations: LenderRecommendation[] = []

      if (!input.options?.skip_lender_matching) {
        const [lenders, rules] = await Promise.all([
          this.deps.fetchLenders(),
          this.deps.fetchLenderRules(input.loan_type),
        ])

        lenderRecommendations = await lenderMatcherModule.findMatches(
          {
            applicant: applicantProfile,
            employment: employmentIncome,
            credit: creditAnalysis,
            risk: riskAssessment,
            loan_type: input.loan_type,
            requested_amount: input.requested_amount,
            requested_tenure_months: input.requested_tenure_months,
            preferred_lenders: input.options?.preferred_lenders,
            location: applicantProfile.current_address ? {
              state: applicantProfile.current_address.state,
              city: applicantProfile.current_address.city,
            } : undefined,
          },
          lenders,
          rules,
          input.options?.max_lenders || 10
        )
      }

      // ========================================
      // Section 8: Document Status
      // ========================================
      const documents = await this.deps.fetchDocuments(input.lead_id)
      const documentStatus = this.buildDocumentStatus(documents, input.loan_type)

      if (!documentStatus.mandatory_complete) {
        warnings.push('Mandatory documents are incomplete')
      }

      // ========================================
      // Section 9: Final Assessment
      // ========================================
      const finalAssessment = await this.buildFinalAssessment(
        applicantProfile,
        employmentIncome,
        creditAnalysis,
        financialAnalysis,
        riskAssessment,
        eligibility,
        lenderRecommendations,
        documentStatus,
        input
      )

      // ========================================
      // Build Complete CAM
      // ========================================
      const cam: UniversalCAM = {
        cam_id: camId,
        lead_id: input.lead_id,
        lead_number: leadDetails.lead_id || input.lead_id,
        version: 1,
        generated_at: new Date().toISOString(),

        loan_type: input.loan_type,
        requested_amount: input.requested_amount,
        requested_tenure_months: input.requested_tenure_months || null,

        lead_source: leadDetails.lead_source || 'CUSTOMER',
        source_reference_id: leadDetails.source_reference_id || null,
        source_reference_name: leadDetails.source_reference_name || null,

        applicant_profile: applicantProfile,
        employment_income: employmentIncome,
        credit_analysis: creditAnalysis,
        financial_analysis: financialAnalysis,
        risk_assessment: riskAssessment,
        eligibility,
        lender_recommendations: lenderRecommendations,
        document_status: documentStatus,
        final_assessment: finalAssessment,

        is_latest: true,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const processingTime = Date.now() - startTime

      return {
        success: true,
        cam,
        cam_id: camId,
        warnings: warnings.length > 0 ? warnings : undefined,
      }

    } catch (error) {
      console.error('CAM generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during CAM generation',
      }
    }
  }

  private generateCAMId(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `CAM-${timestamp}-${random}`
  }

  private buildDocumentStatus(documents: unknown[], loanType: string): DocumentStatus {
    // Define mandatory documents by loan type
    const mandatoryDocsByType: Record<string, string[]> = {
      'HOME_LOAN': ['PAN', 'AADHAAR', 'INCOME_PROOF', 'BANK_STATEMENT', 'PROPERTY_DOCUMENTS', 'EMPLOYMENT_PROOF'],
      'PERSONAL_LOAN': ['PAN', 'AADHAAR', 'INCOME_PROOF', 'BANK_STATEMENT'],
      'BUSINESS_LOAN': ['PAN', 'AADHAAR', 'GST_CERTIFICATE', 'BANK_STATEMENT', 'ITR', 'BUSINESS_PROOF'],
      'LAP': ['PAN', 'AADHAAR', 'INCOME_PROOF', 'BANK_STATEMENT', 'PROPERTY_DOCUMENTS'],
      'CAR_LOAN': ['PAN', 'AADHAAR', 'INCOME_PROOF', 'BANK_STATEMENT'],
      'GOLD_LOAN': ['PAN', 'AADHAAR'],
      'EDUCATION_LOAN': ['PAN', 'AADHAAR', 'ADMISSION_LETTER', 'INCOME_PROOF'],
    }

    const mandatoryDocNames = mandatoryDocsByType[loanType.toUpperCase()] || ['PAN', 'AADHAAR', 'INCOME_PROOF']

    const mandatoryDocs = mandatoryDocNames.map(name => {
      const doc = documents.find(d =>
        d.category === name || d.name?.toUpperCase().includes(name)
      )

      return {
        id: doc?.id || `pending-${name}`,
        name,
        category: this.getDocCategory(name),
        is_mandatory: true,
        status: doc ? this.mapDocStatus(doc.status) : 'NOT_UPLOADED',
        uploaded_at: doc?.uploaded_at || null,
        verified_at: doc?.verified_at || null,
        rejection_reason: doc?.rejection_reason || null,
        file_url: doc?.file_url || null,
        file_type: doc?.file_type || null,
      }
    })

    const additionalDocs = documents
      .filter(d => !mandatoryDocNames.includes(d.category) && !mandatoryDocNames.includes(d.name))
      .map(d => ({
        id: d.id,
        name: d.name || d.category,
        category: this.getDocCategory(d.category),
        is_mandatory: false,
        status: this.mapDocStatus(d.status),
        uploaded_at: d.uploaded_at || null,
        verified_at: d.verified_at || null,
        rejection_reason: d.rejection_reason || null,
        file_url: d.file_url || null,
        file_type: d.file_type || null,
      }))

    const mandatoryUploaded = mandatoryDocs.filter(d => d.status !== 'NOT_UPLOADED').length
    const totalDocs = mandatoryDocs.length + additionalDocs.length
    const allDocs = [...mandatoryDocs, ...additionalDocs]
    const uploaded = allDocs.filter(d => d.status !== 'NOT_UPLOADED').length
    const verified = allDocs.filter(d => d.status === 'VERIFIED').length
    const rejected = allDocs.filter(d => d.status === 'REJECTED').length
    const pending = allDocs.filter(d => d.status === 'UPLOADED').length

    return {
      mandatory_documents: mandatoryDocs,
      mandatory_complete: mandatoryUploaded === mandatoryDocs.length,
      mandatory_count: mandatoryDocs.length,
      mandatory_uploaded: mandatoryUploaded,

      additional_documents: additionalDocs,

      total_documents: totalDocs,
      uploaded_documents: uploaded,
      verified_documents: verified,
      rejected_documents: rejected,
      pending_documents: pending,

      completion_percent: totalDocs > 0 ? Math.round((uploaded / totalDocs) * 100) : 0,
    }
  }

  private getDocCategory(name: string): DocumentStatus['mandatory_documents'][0]['category'] {
    const upper = name.toUpperCase()
    if (upper.includes('PAN') || upper.includes('AADHAAR') || upper.includes('PASSPORT')) return 'IDENTITY'
    if (upper.includes('ADDRESS') || upper.includes('UTILITY')) return 'ADDRESS'
    if (upper.includes('SALARY') || upper.includes('ITR') || upper.includes('INCOME')) return 'INCOME'
    if (upper.includes('EMPLOY') || upper.includes('OFFER') || upper.includes('APPOINT')) return 'EMPLOYMENT'
    if (upper.includes('PROPERTY') || upper.includes('TITLE') || upper.includes('AGREEMENT')) return 'PROPERTY'
    if (upper.includes('GST') || upper.includes('UDYAM') || upper.includes('BUSINESS')) return 'BUSINESS'
    return 'OTHER'
  }

  private mapDocStatus(status: string): DocumentStatus['mandatory_documents'][0]['status'] {
    const upper = status?.toUpperCase() || ''
    if (upper.includes('VERIFIED') || upper.includes('APPROVED')) return 'VERIFIED'
    if (upper.includes('REJECT')) return 'REJECTED'
    if (upper.includes('EXPIRED')) return 'EXPIRED'
    if (upper.includes('UPLOAD') || upper.includes('PENDING')) return 'UPLOADED'
    return 'NOT_UPLOADED'
  }

  private async buildFinalAssessment(
    applicant: ApplicantProfile,
    employment: EmploymentIncome,
    credit: CreditAnalysis,
    financial: FinancialAnalysis,
    risk: RiskAssessment,
    eligibility: EligibilityCalculation,
    recommendations: LenderRecommendation[],
    documents: DocumentStatus,
    input: CAMGenerationInput
  ): Promise<FinalAssessment> {
    // Calculate profile strength
    const profileStrength = this.calculateProfileStrength(
      applicant, employment, credit, financial, risk, eligibility, documents
    )

    // Identify strengths
    const strengths = this.identifyStrengths(applicant, employment, credit, financial, risk, eligibility)

    // Identify concerns
    const concerns = this.identifyConcerns(applicant, employment, credit, financial, risk, eligibility, documents)

    // Build pending actions
    const pendingActions = this.buildPendingActions(applicant, employment, credit, documents, risk)

    // Determine profile status
    const { status, reason } = this.determineProfileStatus(
      profileStrength, risk, eligibility, documents, recommendations
    )

    // Try to assign BDE
    let assignedBde: { bde_id: string; bde_name: string; reason: string } | null = null
    if (this.deps.findBestBDE && status === 'READY_TO_PROCESS') {
      assignedBde = await this.deps.findBestBDE(
        input.loan_type,
        input.requested_amount,
        applicant.current_address?.state
      )
    }

    // Get recommended lender
    const bestLender = recommendations.find(r => r.is_best_match)

    return {
      profile_strength_score: profileStrength.score,
      profile_strength_label: profileStrength.label,

      profile_status: status,
      status_reason: reason,

      strengths,
      concerns,
      pending_actions: pendingActions,

      assigned_to_bde_id: assignedBde?.bde_id || null,
      assigned_to_bde_name: assignedBde?.bde_name || null,
      assigned_at: assignedBde ? new Date().toISOString() : null,
      assignment_reason: assignedBde?.reason || null,

      recommended_lender_id: bestLender?.lender_id || null,
      recommended_lender_name: bestLender?.lender_name || null,
    }
  }

  private calculateProfileStrength(
    applicant: ApplicantProfile,
    employment: EmploymentIncome,
    credit: CreditAnalysis,
    financial: FinancialAnalysis,
    risk: RiskAssessment,
    eligibility: EligibilityCalculation,
    documents: DocumentStatus
  ): { score: number; label: FinalAssessment['profile_strength_label'] } {
    let score = 0

    // KYC (max 15)
    if (applicant.kyc_status === 'COMPLETE') score += 15
    else if (applicant.kyc_status === 'PARTIAL') score += 8

    // Income verification (max 15)
    if (employment.income_verified) {
      if (employment.income_verification_source === 'ITR') score += 15
      else if (employment.income_verification_source === 'BANK_STATEMENT') score += 12
      else score += 8
    }

    // Credit score (max 20)
    if (credit.credit_score !== null) {
      if (credit.credit_score >= 750) score += 20
      else if (credit.credit_score >= 700) score += 15
      else if (credit.credit_score >= 650) score += 10
      else score += 5
    }

    // Risk grade (max 20)
    switch (risk.risk_grade) {
      case 'A': score += 20; break
      case 'B': score += 15; break
      case 'C': score += 10; break
      case 'D': score += 5; break
    }

    // Banking habits (max 10)
    if (financial.banking_habits_score >= 70) score += 10
    else if (financial.banking_habits_score >= 50) score += 5

    // Document completeness (max 10)
    if (documents.mandatory_complete) score += 10
    else score += Math.floor(documents.completion_percent / 10)

    // Eligibility (max 10)
    if (eligibility.is_eligible) score += 10
    else if (eligibility.max_eligible_amount > 0) score += 5

    // Determine label
    let label: FinalAssessment['profile_strength_label']
    if (score >= 85) label = 'EXCELLENT'
    else if (score >= 70) label = 'STRONG'
    else if (score >= 50) label = 'MODERATE'
    else if (score >= 30) label = 'WEAK'
    else label = 'VERY_WEAK'

    return { score, label }
  }

  private identifyStrengths(
    applicant: ApplicantProfile,
    employment: EmploymentIncome,
    credit: CreditAnalysis,
    financial: FinancialAnalysis,
    risk: RiskAssessment,
    eligibility: EligibilityCalculation
  ): string[] {
    const strengths: string[] = []

    // KYC
    if (applicant.kyc_status === 'COMPLETE') {
      strengths.push('Complete KYC verification')
    }
    if (applicant.identity_verification.name_match_score >= 90) {
      strengths.push('High identity confidence')
    }

    // Credit
    if (credit.credit_score !== null && credit.credit_score >= 750) {
      strengths.push(`Excellent credit score (${credit.credit_score})`)
    } else if (credit.credit_score !== null && credit.credit_score >= 700) {
      strengths.push(`Good credit score (${credit.credit_score})`)
    }
    if (credit.on_time_payment_percent >= 95) {
      strengths.push('Excellent payment history')
    }

    // Employment
    if (employment.employment_type === 'SALARIED' && employment.salaried_details) {
      if (employment.salaried_details.employer_category === 'CAT_A') {
        strengths.push(`Category A employer (${employment.salaried_details.employer_name})`)
      }
      if (employment.salaried_details.current_job_months >= 36) {
        strengths.push(`${Math.floor(employment.salaried_details.current_job_months / 12)}+ years job tenure`)
      }
    }
    if (employment.income_stability_score >= 80) {
      strengths.push('High income stability')
    }
    if (employment.itr_filed && employment.itr_years >= 2) {
      strengths.push(`${employment.itr_years} years ITR filed`)
    }

    // Financial
    if (financial.banking_habits_score >= 80) {
      strengths.push('Excellent banking habits')
    }
    if (financial.total_bounces === 0) {
      strengths.push('No bounces in bank statement')
    }
    if (financial.salary_regularity_score >= 90) {
      strengths.push('Regular salary credits')
    }

    // Risk
    if (risk.risk_grade === 'A') {
      strengths.push('Very low risk profile')
    }

    // Eligibility
    if (eligibility.foir_status === 'WITHIN_LIMIT' && eligibility.foir < 40) {
      strengths.push(`Low FOIR (${eligibility.foir}%)`)
    }

    return strengths.slice(0, 8) // Max 8 strengths
  }

  private identifyConcerns(
    applicant: ApplicantProfile,
    employment: EmploymentIncome,
    credit: CreditAnalysis,
    financial: FinancialAnalysis,
    risk: RiskAssessment,
    eligibility: EligibilityCalculation,
    documents: DocumentStatus
  ): string[] {
    const concerns: string[] = []

    // KYC
    if (applicant.kyc_status !== 'COMPLETE') {
      concerns.push('Incomplete KYC verification')
    }
    if (applicant.identity_verification.name_match_score < 80) {
      concerns.push('Name mismatch across documents')
    }

    // Credit
    if (credit.credit_score !== null && credit.credit_score < 650) {
      concerns.push(`Low credit score (${credit.credit_score})`)
    }
    if (credit.has_write_offs) {
      concerns.push('Written off accounts in history')
    }
    if (credit.has_settlements) {
      concerns.push('Settled accounts in history')
    }
    if (credit.max_dpd_24_months >= 60) {
      concerns.push(`Delinquency (${credit.max_dpd_24_months} DPD) in last 24 months`)
    }
    if (credit.enquiries_last_30_days >= 5) {
      concerns.push(`Multiple enquiries (${credit.enquiries_last_30_days}) in last 30 days`)
    }

    // Employment
    if (!employment.income_verified) {
      concerns.push('Income not verified')
    }
    if (employment.income_stability_score < 50) {
      concerns.push('Low income stability')
    }
    if (employment.salaried_details?.current_job_months !== undefined &&
        employment.salaried_details.current_job_months < 12) {
      concerns.push('Less than 1 year in current job')
    }

    // Financial
    if (financial.total_bounces >= 3) {
      concerns.push(`${financial.total_bounces} bounces in bank statement`)
    }
    if (financial.cash_withdrawal_ratio > 50) {
      concerns.push('High cash withdrawal ratio')
    }
    if (financial.suspicious_transactions > 0) {
      concerns.push('Suspicious transactions detected')
    }

    // Eligibility
    if (eligibility.foir_status === 'EXCEEDED') {
      concerns.push(`FOIR (${eligibility.foir}%) exceeds limit`)
    }
    if (!eligibility.is_eligible) {
      concerns.push('Does not meet eligibility criteria')
    }

    // Documents
    if (!documents.mandatory_complete) {
      concerns.push(`${documents.mandatory_count - documents.mandatory_uploaded} mandatory documents missing`)
    }
    if (documents.rejected_documents > 0) {
      concerns.push(`${documents.rejected_documents} documents rejected`)
    }

    // Risk
    risk.risk_flags.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      .forEach(f => concerns.push(f.title))

    return concerns.slice(0, 10) // Max 10 concerns
  }

  private buildPendingActions(
    applicant: ApplicantProfile,
    employment: EmploymentIncome,
    credit: CreditAnalysis,
    documents: DocumentStatus,
    risk: RiskAssessment
  ): PendingAction[] {
    const actions: PendingAction[] = []

    // Document actions
    if (!documents.mandatory_complete) {
      const missingDocs = documents.mandatory_documents
        .filter(d => d.status === 'NOT_UPLOADED')
        .map(d => d.name)
        .join(', ')

      actions.push({
        id: 'ACTION_UPLOAD_DOCS',
        action: `Upload missing documents: ${missingDocs}`,
        priority: 'HIGH',
        due_by: null,
        assigned_to: null,
      })
    }

    // KYC actions
    if (applicant.kyc_status !== 'COMPLETE') {
      if (!applicant.pan_verified) {
        actions.push({
          id: 'ACTION_VERIFY_PAN',
          action: 'Complete PAN verification',
          priority: 'HIGH',
          due_by: null,
          assigned_to: null,
        })
      }
      if (!applicant.aadhaar_verified) {
        actions.push({
          id: 'ACTION_VERIFY_AADHAAR',
          action: 'Complete Aadhaar verification',
          priority: 'HIGH',
          due_by: null,
          assigned_to: null,
        })
      }
    }

    // Income verification
    if (!employment.income_verified) {
      actions.push({
        id: 'ACTION_VERIFY_INCOME',
        action: 'Verify income through ITR, salary slips, or bank statement',
        priority: 'HIGH',
        due_by: null,
        assigned_to: null,
      })
    }

    // Credit improvement
    if (credit.credit_score !== null && credit.credit_score < 650) {
      actions.push({
        id: 'ACTION_CREDIT_REVIEW',
        action: 'Review credit report for disputes or errors',
        priority: 'MEDIUM',
        due_by: null,
        assigned_to: null,
      })
    }

    // Risk flag actions
    risk.risk_flags
      .filter(f => f.severity === 'CRITICAL')
      .forEach(f => {
        actions.push({
          id: `ACTION_RISK_${f.id}`,
          action: f.recommendation,
          priority: 'HIGH',
          due_by: null,
          assigned_to: null,
        })
      })

    return actions.slice(0, 10) // Max 10 actions
  }

  private determineProfileStatus(
    profileStrength: { score: number },
    risk: RiskAssessment,
    eligibility: EligibilityCalculation,
    documents: DocumentStatus,
    recommendations: LenderRecommendation[]
  ): { status: FinalAssessment['profile_status']; reason: string } {
    // Critical risk flags block processing
    if (risk.critical_flags_count > 0) {
      return {
        status: 'NOT_RECOMMENDED',
        reason: `${risk.critical_flags_count} critical risk flag(s) - requires review`,
      }
    }

    // No eligible lenders
    if (recommendations.length === 0 || !eligibility.is_eligible) {
      if (eligibility.max_eligible_amount === 0) {
        return {
          status: 'NOT_RECOMMENDED',
          reason: 'No eligibility based on current income and obligations',
        }
      }
      return {
        status: 'REQUIRES_REVIEW',
        reason: 'No suitable lenders found - manual review required',
      }
    }

    // Missing mandatory documents
    if (!documents.mandatory_complete) {
      return {
        status: 'NEEDS_ATTENTION',
        reason: 'Mandatory documents missing',
      }
    }

    // High risk needs review
    if (risk.risk_grade === 'D' || risk.high_flags_count >= 3) {
      return {
        status: 'REQUIRES_REVIEW',
        reason: `High risk grade (${risk.risk_grade}) - senior review required`,
      }
    }

    // Profile strength check
    if (profileStrength.score < 40) {
      return {
        status: 'NEEDS_ATTENTION',
        reason: 'Weak profile - additional verification recommended',
      }
    }

    // Ready to process
    return {
      status: 'READY_TO_PROCESS',
      reason: 'Profile complete and ready for processing',
    }
  }
}

export function createUniversalCAMGenerator(dependencies: GeneratorDependencies): UniversalCAMGenerator {
  return new UniversalCAMGenerator(dependencies)
}
