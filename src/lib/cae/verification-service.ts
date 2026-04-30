/**
 * Unified Verification Orchestration Service
 * Orchestrates all verification checks for loan applications
 *
 * Integrates:
 * - Identity Verification (DigiLocker, PAN, Aadhaar)
 * - Credit Bureau checks (CIBIL, Experian, Equifax)
 * - Income Verification (GST/ITR, Bank Statements, Account Aggregator)
 * - Bank Account Verification (Penny Drop)
 * - Business Verification (MCA, Udyam)
 * - AML/PEP Screening
 * - Collateral Verification (CERSAI)
 * - Litigation Check (Court Records)
 */

import { createClient } from '@/lib/supabase/server'
import {
  DigiLockerAdapter,
  createDigiLockerAdapter,
  GSTITRAdapter,
  createGSTITRAdapter,
  BankStatementAdapter,
  createBankStatementAdapter,
  AccountAggregatorAdapter,
  createAccountAggregatorAdapter,
  PennyDropAdapter,
  createPennyDropAdapter,
  MCAAdapter,
  createMCAAdapter,
  AMLScreeningAdapter,
  createAMLScreeningAdapter,
  CERSAIAdapter,
  createCERSAIAdapter,
  CourtRecordsAdapter,
  createCourtRecordsAdapter,
} from './adapters'

// ============================================================================
// Types
// ============================================================================

export type VerificationType =
  | 'IDENTITY_PAN'
  | 'IDENTITY_AADHAAR'
  | 'IDENTITY_DIGILOCKER'
  | 'CREDIT_BUREAU'
  | 'INCOME_ITR'
  | 'INCOME_GST'
  | 'INCOME_BANK_STATEMENT'
  | 'INCOME_ACCOUNT_AGGREGATOR'
  | 'BANK_ACCOUNT_PENNY_DROP'
  | 'BUSINESS_MCA'
  | 'BUSINESS_UDYAM'
  | 'AML_SCREENING'
  | 'COLLATERAL_CERSAI'
  | 'LITIGATION_CHECK'
  | 'VIDEO_KYC'

export type VerificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'REQUIRES_REVIEW'
  | 'SKIPPED'

export interface VerificationRequest {
  lead_id: string
  verification_types: VerificationType[]
  applicant_details: ApplicantDetails
  loan_details?: LoanDetails
  co_applicants?: ApplicantDetails[]
  options?: VerificationOptions
}

export interface ApplicantDetails {
  name: string
  pan?: string
  aadhaar?: string
  mobile: string
  email?: string
  dob?: string
  father_name?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  // For business applicants
  entity_type?: 'INDIVIDUAL' | 'COMPANY' | 'PARTNERSHIP' | 'LLP' | 'PROPRIETORSHIP'
  cin?: string
  din?: string
  gstin?: string
  udyam_number?: string
}

export interface LoanDetails {
  loan_type: string
  loan_amount: number
  tenure_months?: number
  // For secured loans
  collateral_type?: string
  collateral_details?: {
    property_type?: string
    vehicle_registration?: string
    city?: string
    state?: string
  }
}

export interface VerificationOptions {
  parallel?: boolean
  skip_on_failure?: boolean
  timeout_ms?: number
  priority_order?: VerificationType[]
  environment?: 'sandbox' | 'production'
}

export interface VerificationResult {
  verification_type: VerificationType
  status: VerificationStatus
  result?: unknown; error?: {
    code: string
    message: string
  }
  started_at: string
  completed_at?: string
  duration_ms?: number
  provider?: string
  reference_id?: string
}

export interface ComprehensiveVerificationResult {
  lead_id: string
  overall_status: 'PASSED' | 'FAILED' | 'PARTIAL' | 'REQUIRES_REVIEW'
  started_at: string
  completed_at: string
  total_duration_ms: number
  verifications: VerificationResult[]
  summary: {
    total: number
    completed: number
    failed: number
    skipped: number
    requires_review: number
  }
  risk_flags: RiskFlag[]
  recommendation?: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' | 'CONDITIONAL_APPROVE'
}

export interface RiskFlag {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  verification_type: VerificationType
  details?: unknown}

// ============================================================================
// Verification Service
// ============================================================================

export class VerificationService {
  private digiLockerAdapter: DigiLockerAdapter
  private gstItrAdapter: GSTITRAdapter
  private bankStatementAdapter: BankStatementAdapter
  private accountAggregatorAdapter: AccountAggregatorAdapter
  private pennyDropAdapter: PennyDropAdapter
  private mcaAdapter: MCAAdapter
  private amlScreeningAdapter: AMLScreeningAdapter
  private cersaiAdapter: CERSAIAdapter
  private courtRecordsAdapter: CourtRecordsAdapter

  private defaultEnvironment: 'sandbox' | 'production' = 'sandbox'

  constructor(environment?: 'sandbox' | 'production') {
    this.defaultEnvironment = environment || 'sandbox'
    this.initializeAdapters()
  }

  private initializeAdapters(): void {
    const env = this.defaultEnvironment

    this.digiLockerAdapter = createDigiLockerAdapter({
      id: 'digilocker-default',
      name: 'DigiLocker',
      provider_type: 'DIGILOCKER',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env },
    })

    this.gstItrAdapter = createGSTITRAdapter({
      id: 'gst-itr-default',
      name: 'GST-ITR',
      provider_type: 'GST_ITR',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env },
    })

    this.bankStatementAdapter = createBankStatementAdapter({
      id: 'bank-statement-default',
      name: 'Bank Statement',
      provider_type: 'BANK_STATEMENT',
      is_active: true,
      priority: 1,
      timeout_ms: 60000,
      retry_count: 2,
      config: { environment: env, provider: 'perfios' },
    })

    this.accountAggregatorAdapter = createAccountAggregatorAdapter({
      id: 'account-aggregator-default',
      name: 'Account Aggregator',
      provider_type: 'ACCOUNT_AGGREGATOR',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env, provider: 'setu' },
    })

    this.pennyDropAdapter = createPennyDropAdapter({
      id: 'penny-drop-default',
      name: 'Penny Drop',
      provider_type: 'PENNY_DROP',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env, provider: 'razorpay' },
    })

    this.mcaAdapter = createMCAAdapter({
      id: 'mca-default',
      name: 'MCA',
      provider_type: 'MCA',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env, provider: 'karza' },
    })

    this.amlScreeningAdapter = createAMLScreeningAdapter({
      id: 'aml-default',
      name: 'AML Screening',
      provider_type: 'AML',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env, provider: 'comply_advantage' },
    })

    this.cersaiAdapter = createCERSAIAdapter({
      id: 'cersai-default',
      name: 'CERSAI',
      provider_type: 'CERSAI',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: env, provider: 'signzy' },
    })

    this.courtRecordsAdapter = createCourtRecordsAdapter({
      id: 'court-records-default',
      name: 'Court Records',
      provider_type: 'COURT_RECORDS',
      is_active: true,
      priority: 1,
      timeout_ms: 60000,
      retry_count: 2,
      config: { environment: env, provider: 'gridlines' },
    })
  }

  /**
   * Run comprehensive verification for a loan application
   */
  async runComprehensiveVerification(
    request: VerificationRequest
  ): Promise<ComprehensiveVerificationResult> {
    const startTime = Date.now()
    const results: VerificationResult[] = []
    const riskFlags: RiskFlag[] = []

    const verificationOrder = request.options?.priority_order || request.verification_types

    // Run verifications
    if (request.options?.parallel) {
      // Run all in parallel
      const promises = verificationOrder.map((type) =>
        this.runSingleVerification(type, request).catch((error) => ({
          verification_type: type,
          status: 'FAILED' as VerificationStatus,
          error: { code: 'EXECUTION_ERROR', message: error.message },
          started_at: new Date().toISOString(),
        }))
      )
      const parallelResults = await Promise.all(promises)
      results.push(...parallelResults)
    } else {
      // Run sequentially
      for (const type of verificationOrder) {
        try {
          const result = await this.runSingleVerification(type, request)
          results.push(result)

          // Check if we should stop on failure
          if (result.status === 'FAILED' && !request.options?.skip_on_failure) {
            // Mark remaining as skipped
            const remaining = verificationOrder.slice(verificationOrder.indexOf(type) + 1)
            for (const remainingType of remaining) {
              results.push({
                verification_type: remainingType,
                status: 'SKIPPED',
                started_at: new Date().toISOString(),
              })
            }
            break
          }
        } catch (error) {
          results.push({
            verification_type: type,
            status: 'FAILED',
            error: {
              code: 'EXECUTION_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            started_at: new Date().toISOString(),
          })
        }
      }
    }

    // Extract risk flags from results
    for (const result of results) {
      const flags = this.extractRiskFlags(result)
      riskFlags.push(...flags)
    }

    // Calculate summary
    const summary = {
      total: results.length,
      completed: results.filter((r) => r.status === 'COMPLETED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      skipped: results.filter((r) => r.status === 'SKIPPED').length,
      requires_review: results.filter((r) => r.status === 'REQUIRES_REVIEW').length,
    }

    // Determine overall status and recommendation
    const overallStatus = this.determineOverallStatus(summary, riskFlags)
    const recommendation = this.determineRecommendation(results, riskFlags)

    const completedAt = new Date().toISOString()

    // Save to database
    await this.saveVerificationResults(request.lead_id, results, riskFlags)

    return {
      lead_id: request.lead_id,
      overall_status: overallStatus,
      started_at: new Date(startTime).toISOString(),
      completed_at: completedAt,
      total_duration_ms: Date.now() - startTime,
      verifications: results,
      summary,
      risk_flags: riskFlags,
      recommendation,
    }
  }

  /**
   * Run a single verification
   */
  async runSingleVerification(
    type: VerificationType,
    request: VerificationRequest
  ): Promise<VerificationResult> {
    const startTime = Date.now()
    const startedAt = new Date().toISOString()

    try {
      let result: unknown; let provider: string = ''
      let referenceId: string = ''

      switch (type) {
        case 'IDENTITY_PAN':
          result = await this.verifyPAN(request.applicant_details)
          provider = 'digilocker'
          referenceId = result.verification_id
          break

        case 'IDENTITY_AADHAAR':
          result = await this.verifyAadhaar(request.applicant_details)
          provider = 'digilocker'
          referenceId = result.verification_id
          break

        case 'INCOME_ITR':
          result = await this.verifyITR(request.applicant_details)
          provider = 'karza'
          referenceId = result.request_id
          break

        case 'INCOME_GST':
          result = await this.verifyGST(request.applicant_details)
          provider = 'karza'
          referenceId = result.request_id
          break

        case 'INCOME_BANK_STATEMENT':
          result = await this.initiateBankStatementAnalysis(request.applicant_details, request.lead_id)
          provider = 'perfios'
          referenceId = result.request_id
          break

        case 'INCOME_ACCOUNT_AGGREGATOR':
          result = await this.initiateAccountAggregator(request.applicant_details, request.lead_id)
          provider = 'setu'
          referenceId = result.consent_handle
          break

        case 'BANK_ACCOUNT_PENNY_DROP':
          result = await this.verifyBankAccount(request.applicant_details)
          provider = 'razorpay'
          referenceId = result.reference_id
          break

        case 'BUSINESS_MCA':
          result = await this.verifyMCA(request.applicant_details)
          provider = 'karza'
          referenceId = result.reference_id
          break

        case 'BUSINESS_UDYAM':
          result = await this.verifyUdyam(request.applicant_details)
          provider = 'karza'
          referenceId = result.reference_id
          break

        case 'AML_SCREENING':
          result = await this.screenAML(request.applicant_details)
          provider = 'comply_advantage'
          referenceId = result.screening_id
          break

        case 'COLLATERAL_CERSAI':
          result = await this.searchCERSAI(request.applicant_details, request.loan_details)
          provider = 'signzy'
          referenceId = result.search_id
          break

        case 'LITIGATION_CHECK':
          result = await this.checkLitigation(request.applicant_details)
          provider = 'gridlines'
          referenceId = result.search_id
          break

        default:
          throw new Error(`Unknown verification type: ${type}`)
      }

      const status = this.determineVerificationStatus(type, result)

      return {
        verification_type: type,
        status,
        result,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        provider,
        reference_id: referenceId,
      }
    } catch (error) {
      return {
        verification_type: type,
        status: 'FAILED',
        error: {
          code: 'VERIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Verification failed',
        },
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      }
    }
  }

  // ============================================================================
  // Individual Verification Methods
  // ============================================================================

  private async verifyPAN(applicant: ApplicantDetails): Promise<unknown> {
    if (!applicant.pan) {
      throw new Error('PAN number is required for PAN verification')
    }

    return this.digiLockerAdapter.verifyPAN({
      pan_number: applicant.pan,
      name: applicant.name,
      dob: applicant.dob,
    })
  }

  private async verifyAadhaar(applicant: ApplicantDetails): Promise<unknown> {
    if (!applicant.aadhaar) {
      throw new Error('Aadhaar number is required for Aadhaar verification')
    }

    return this.digiLockerAdapter.verifyAadhaar({
      aadhaar_number: applicant.aadhaar,
      name: applicant.name,
    })
  }

  private async verifyITR(applicant: ApplicantDetails): Promise<unknown> {
    if (!applicant.pan) {
      throw new Error('PAN number is required for ITR verification')
    }

    return this.gstItrAdapter.verifyITR({
      pan: applicant.pan,
      assessment_years: ['2023-24', '2022-23', '2021-22'],
    })
  }

  private async verifyGST(applicant: ApplicantDetails): Promise<unknown> {
    if (!applicant.gstin) {
      throw new Error('GSTIN is required for GST verification')
    }

    return this.gstItrAdapter.verifyGST({
      gstin: applicant.gstin,
      include_filing_history: true,
    })
  }

  private async initiateBankStatementAnalysis(
    applicant: ApplicantDetails,
    leadId: string
  ): Promise<unknown> {
    return this.bankStatementAdapter.analyzeStatement({
      customer_id: leadId,
      customer_name: applicant.name,
      customer_mobile: applicant.mobile,
      account_number: '', // Will be provided via upload
      ifsc_code: '',
      statement_period_months: 6,
    })
  }

  private async initiateAccountAggregator(
    applicant: ApplicantDetails,
    leadId: string
  ): Promise<unknown> {
    return this.accountAggregatorAdapter.createConsent({
      customer_mobile: applicant.mobile,
      customer_name: applicant.name,
      purpose: 'LOAN',
      fi_types: ['DEPOSIT', 'RECURRING_DEPOSIT', 'TERM_DEPOSIT'],
      consent_duration_days: 30,
      data_range_months: 12,
    })
  }

  private async verifyBankAccount(applicant: ApplicantDetails): Promise<unknown> {
    // Bank account details would typically come from the application form
    return this.pennyDropAdapter.verifyAccount({
      account_number: '', // Required from form
      ifsc_code: '', // Required from form
      account_holder_name: applicant.name,
      mobile: applicant.mobile,
    })
  }

  private async verifyMCA(applicant: ApplicantDetails): Promise<unknown> {
    if (applicant.cin) {
      return this.mcaAdapter.verifyCompany({ cin: applicant.cin })
    } else if (applicant.din) {
      return this.mcaAdapter.verifyDirector({ din: applicant.din })
    } else {
      throw new Error('CIN or DIN is required for MCA verification')
    }
  }

  private async verifyUdyam(applicant: ApplicantDetails): Promise<unknown> {
    if (!applicant.udyam_number) {
      throw new Error('Udyam number is required for MSME verification')
    }

    return this.mcaAdapter.verifyUdyam(applicant.udyam_number)
  }

  private async screenAML(applicant: ApplicantDetails): Promise<unknown> {
    return this.amlScreeningAdapter.screen({
      name: applicant.name,
      entity_type: applicant.entity_type === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY',
      pan: applicant.pan,
      cin: applicant.cin,
      dob: applicant.dob,
      country: 'India',
      screening_types: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA', 'INDIA_DEFAULTERS'],
    })
  }

  private async searchCERSAI(
    applicant: ApplicantDetails,
    loanDetails?: LoanDetails
  ): Promise<unknown> {
    // Search by borrower PAN first
    if (applicant.pan) {
      return this.cersaiAdapter.searchByBorrower(applicant.pan, 'PAN')
    }

    // For vehicle loans, search by vehicle registration
    if (loanDetails?.collateral_details?.vehicle_registration) {
      return this.cersaiAdapter.searchVehicleCharges(
        loanDetails.collateral_details.vehicle_registration
      )
    }

    // For property loans, search by property details
    if (loanDetails?.collateral_type === 'PROPERTY' && loanDetails.collateral_details) {
      return this.cersaiAdapter.searchPropertyCharges({
        type: loanDetails.collateral_details.property_type as unknown,
        city: loanDetails.collateral_details.city || '',
        district: loanDetails.collateral_details.city || '',
        state: loanDetails.collateral_details.state || '',
      })
    }

    throw new Error('Insufficient details for CERSAI search')
  }

  private async checkLitigation(applicant: ApplicantDetails): Promise<unknown> {
    return this.courtRecordsAdapter.search({
      name: applicant.name,
      entity_type: applicant.entity_type === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY',
      pan: applicant.pan,
      cin: applicant.cin,
      father_name: applicant.father_name,
      address: applicant.address,
      search_types: ['COMPREHENSIVE'],
    })
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private determineVerificationStatus(type: VerificationType, result: unknown): VerificationStatus {
    if (!result) return 'FAILED'
    if (result.error) return 'FAILED'
    if (result.requires_manual_review || result.requires_review) return 'REQUIRES_REVIEW'
    if (result.success === false) return 'FAILED'
    return 'COMPLETED'
  }

  private extractRiskFlags(result: VerificationResult): RiskFlag[] {
    const flags: RiskFlag[] = []

    if (result.status !== 'COMPLETED' || !result.result) return flags

    switch (result.verification_type) {
      case 'AML_SCREENING':
        if (result.result.has_pep_match) {
          flags.push({
            type: 'PEP_MATCH',
            severity: 'HIGH',
            description: 'Applicant identified as Politically Exposed Person',
            verification_type: result.verification_type,
            details: result.result.matched_entities,
          })
        }
        if (result.result.has_sanctions_match) {
          flags.push({
            type: 'SANCTIONS_MATCH',
            severity: 'CRITICAL',
            description: 'Applicant found in sanctions list',
            verification_type: result.verification_type,
            details: result.result.matched_entities,
          })
        }
        if (result.result.wilful_defaulter_match) {
          flags.push({
            type: 'WILFUL_DEFAULTER',
            severity: 'CRITICAL',
            description: 'Applicant is a wilful defaulter',
            verification_type: result.verification_type,
          })
        }
        break

      case 'COLLATERAL_CERSAI':
        if (result.result.has_active_charges) {
          flags.push({
            type: 'EXISTING_CHARGE',
            severity: 'HIGH',
            description: `Asset has ${result.result.total_active_charges} active charges`,
            verification_type: result.verification_type,
            details: result.result.charges,
          })
        }
        break

      case 'LITIGATION_CHECK':
        if (result.result.has_criminal_cases) {
          flags.push({
            type: 'CRIMINAL_CASE',
            severity: 'CRITICAL',
            description: 'Applicant has criminal cases',
            verification_type: result.verification_type,
            details: result.result.cases,
          })
        }
        if (result.result.has_cheque_bounce_cases) {
          flags.push({
            type: 'CHEQUE_BOUNCE',
            severity: 'MEDIUM',
            description: 'Applicant has cheque bounce cases',
            verification_type: result.verification_type,
          })
        }
        break

      case 'INCOME_BANK_STATEMENT':
        if (result.result.bounce_ratio > 0.1) {
          flags.push({
            type: 'HIGH_BOUNCE_RATIO',
            severity: 'MEDIUM',
            description: `High bounce ratio: ${(result.result.bounce_ratio * 100).toFixed(1)}%`,
            verification_type: result.verification_type,
          })
        }
        break

      case 'BUSINESS_MCA':
        if (result.result.company_status === 'STRUCK_OFF' || result.result.company_status === 'DISSOLVED') {
          flags.push({
            type: 'COMPANY_INACTIVE',
            severity: 'CRITICAL',
            description: `Company status: ${result.result.company_status}`,
            verification_type: result.verification_type,
          })
        }
        if (result.result.has_active_charges) {
          flags.push({
            type: 'MCA_CHARGES',
            severity: 'MEDIUM',
            description: 'Company has existing charges registered with MCA',
            verification_type: result.verification_type,
          })
        }
        break
    }

    return flags
  }

  private determineOverallStatus(
    summary: { completed: number; failed: number; requires_review: number; total: number },
    riskFlags: RiskFlag[]
  ): 'PASSED' | 'FAILED' | 'PARTIAL' | 'REQUIRES_REVIEW' {
    // Critical flags mean automatic review
    const hasCriticalFlags = riskFlags.some((f) => f.severity === 'CRITICAL')
    if (hasCriticalFlags) return 'REQUIRES_REVIEW'

    // If all completed successfully
    if (summary.completed === summary.total) return 'PASSED'

    // If any require review
    if (summary.requires_review > 0) return 'REQUIRES_REVIEW'

    // If some failed
    if (summary.failed > 0) {
      // If more than half failed, overall failed
      if (summary.failed > summary.total / 2) return 'FAILED'
      return 'PARTIAL'
    }

    return 'PASSED'
  }

  private determineRecommendation(
    results: VerificationResult[],
    riskFlags: RiskFlag[]
  ): 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' | 'CONDITIONAL_APPROVE' {
    // Critical flags = reject or manual review
    const criticalFlags = riskFlags.filter((f) => f.severity === 'CRITICAL')
    if (criticalFlags.length > 0) {
      // Sanctions match = reject
      if (criticalFlags.some((f) => f.type === 'SANCTIONS_MATCH' || f.type === 'WILFUL_DEFAULTER')) {
        return 'REJECT'
      }
      return 'MANUAL_REVIEW'
    }

    // High severity flags = manual review
    const highFlags = riskFlags.filter((f) => f.severity === 'HIGH')
    if (highFlags.length > 0) return 'MANUAL_REVIEW'

    // Medium flags = conditional approve
    const mediumFlags = riskFlags.filter((f) => f.severity === 'MEDIUM')
    if (mediumFlags.length > 0) return 'CONDITIONAL_APPROVE'

    // Check if critical verifications passed
    const criticalVerifications: VerificationType[] = [
      'IDENTITY_PAN',
      'AML_SCREENING',
      'CREDIT_BUREAU',
    ]

    const criticalResults = results.filter((r) => criticalVerifications.includes(r.verification_type))
    const criticalFailed = criticalResults.some((r) => r.status === 'FAILED')

    if (criticalFailed) return 'MANUAL_REVIEW'

    return 'APPROVE'
  }

  private async saveVerificationResults(
    leadId: string,
    results: VerificationResult[],
    riskFlags: RiskFlag[]
  ): Promise<void> {
    const supabase = await createClient()

    try {
      // Save summary to leads table
      await supabase
        .from('leads')
        .update({
          verification_status: results.every((r) => r.status === 'COMPLETED') ? 'COMPLETED' : 'PARTIAL',
          verification_completed_at: new Date().toISOString(),
          risk_flags: riskFlags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      // Log to verification audit
      await supabase.from('verification_audit_log').insert({
        lead_id: leadId,
        verification_type: 'COMPREHENSIVE',
        verification_id: leadId,
        action: 'COMPLETED',
        status: 'SUCCESS',
        performed_by_type: 'SYSTEM',
        new_values: {
          results_count: results.length,
          risk_flags_count: riskFlags.length,
          verifications: results.map((r) => ({
            type: r.verification_type,
            status: r.status,
            reference_id: r.reference_id,
          })),
        },
      })
    } catch (error) {
      console.error('Failed to save verification results:', error)
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get verification requirements based on loan type
   */
  getVerificationRequirements(loanType: string, entityType: string): VerificationType[] {
    const baseVerifications: VerificationType[] = [
      'IDENTITY_PAN',
      'AML_SCREENING',
      'LITIGATION_CHECK',
    ]

    const incomeVerifications: VerificationType[] = [
      'INCOME_ITR',
      'INCOME_BANK_STATEMENT',
    ]

    const businessVerifications: VerificationType[] = [
      'BUSINESS_MCA',
      'INCOME_GST',
    ]

    const collateralVerifications: VerificationType[] = [
      'COLLATERAL_CERSAI',
    ]

    let required = [...baseVerifications]

    // Add based on entity type
    if (entityType === 'INDIVIDUAL') {
      required.push('IDENTITY_AADHAAR')
      required.push(...incomeVerifications)
    } else {
      required.push(...businessVerifications)
    }

    // Add based on loan type
    const securedLoans = ['HOME_LOAN', 'LAP', 'VEHICLE_LOAN', 'GOLD_LOAN', 'MACHINERY_LOAN']
    if (securedLoans.includes(loanType)) {
      required.push(...collateralVerifications)
    }

    // MSME loans need Udyam
    if (loanType === 'MSME_LOAN' || loanType === 'BUSINESS_LOAN') {
      required.push('BUSINESS_UDYAM')
    }

    return [...new Set(required)] // Remove duplicates
  }

  /**
   * Check health of all verification providers
   */
  async checkProvidersHealth(): Promise<Record<string, { healthy: boolean; latency_ms: number }>> {
    const healthChecks = await Promise.all([
      this.gstItrAdapter.healthCheck().then((r) => ({ provider: 'gst_itr', ...r })),
      this.bankStatementAdapter.healthCheck().then((r) => ({ provider: 'bank_statement', ...r })),
      this.pennyDropAdapter.healthCheck().then((r) => ({ provider: 'penny_drop', ...r })),
      this.mcaAdapter.healthCheck().then((r) => ({ provider: 'mca', ...r })),
      this.amlScreeningAdapter.healthCheck().then((r) => ({ provider: 'aml', ...r })),
      this.cersaiAdapter.healthCheck().then((r) => ({ provider: 'cersai', ...r })),
      this.courtRecordsAdapter.healthCheck().then((r) => ({ provider: 'court_records', ...r })),
    ])

    const result: Record<string, { healthy: boolean; latency_ms: number }> = {}
    for (const check of healthChecks) {
      result[check.provider] = { healthy: check.healthy, latency_ms: check.latency_ms }
    }

    return result
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

export function createVerificationService(
  environment?: 'sandbox' | 'production'
): VerificationService {
  return new VerificationService(environment)
}

// Export singleton for default usage
export const verificationService = new VerificationService()
