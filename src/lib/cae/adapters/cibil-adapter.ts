/**
 * CIBIL Credit Bureau Adapter
 * Integrates with TransUnion CIBIL API for credit bureau data
 * Supports both sandbox and production environments
 */

import { BaseCAEAdapter } from './base-adapter'
import {
  CAEProviderType,
  CAERequest,
  CAEResponse,
  CAEResult,
  CAEFlag,
  CAEAlert,
  RiskGrade,
  CAEProviderConfig,
} from '../types'

interface CIBILConfig extends CAEProviderConfig {
  config?: {
    member_id?: string
    password?: string
    product_type?: string
    environment?: 'sandbox' | 'production'
  }
}

interface CIBILEnquiry {
  ConsumerName: string
  DateOfBirth: string
  Gender: string
  InquiryPurpose: string
  InquiryAmount: number
  TelephoneNumber: string
  EmailAddress?: string
  PAN?: string
  Passport?: string
  VoterID?: string
  UID?: string
  Address: {
    AddressLine1: string
    City: string
    State: string
    PinCode: string
  }
}

interface CIBILResponse {
  CIBILBureauResponse?: {
    BureauResponseRaw?: string
    SecondaryReportData?: {
      CreditScore?: {
        Score?: string
        ScoreType?: string
      }
    }
    Response?: {
      CreditReport?: {
        Header?: {
          ReportDate?: string
          ReportNumber?: string
        }
        NameSegment?: {
          ConsumerName1?: string
          DateOfBirth?: string
          Gender?: string
        }
        ScoreSegment?: Array<{
          Score?: string
          ScoreName?: string
          ScoringFactors?: string[]
        }>
        AccountSegment?: Array<{
          AccountNumber?: string
          AccountType?: string
          OwnershipIndicator?: string
          DateOpened?: string
          DateOfLastPayment?: string
          CurrentBalance?: string
          HighCredit?: string
          PaymentHistory?: string
          AccountStatus?: string
          SuitFiledStatus?: string
          WrittenOffAmount?: string
          PaymentFrequency?: string
          ActualPaymentAmount?: string
        }>
        EnquirySegment?: Array<{
          DateOfEnquiry?: string
          EnquiryPurpose?: string
          EnquiryAmount?: string
          MemberName?: string
        }>
      }
    }
  }
  Error?: {
    ErrorCode?: string
    ErrorMessage?: string
  }
}

export class CIBILAdapter extends BaseCAEAdapter {
  provider: CAEProviderType = 'CIBIL'
  name = 'TransUnion CIBIL'

  private readonly SANDBOX_URL = 'https://cir.cibil.com/sandbox/v1'
  private readonly PRODUCTION_URL = 'https://cir.cibil.com/v1'

  constructor(config: CIBILConfig) {
    super(config)
  }

  async processAppraisal(request: CAERequest): Promise<CAEResponse> {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    this.logRequest(request, requestId)

    try {
      // Validate required fields
      const validation = this.validateRequest(request)
      if (!validation.valid) {
        return this.createErrorResponse(requestId, validation.error!, 'VALIDATION_ERROR')
      }

      // Build CIBIL enquiry request
      const enquiry = this.buildEnquiry(request)

      // Make API call
      const cibilResponse = await this.callCIBILAPI(enquiry)

      if (cibilResponse.Error) {
        return this.createErrorResponse(
          requestId,
          cibilResponse.Error.ErrorMessage || 'CIBIL API error',
          cibilResponse.Error.ErrorCode
        )
      }

      // Parse response and generate result
      const result = this.parseCIBILResponse(cibilResponse, request)

      const response: CAEResponse = {
        success: true,
        provider: this.provider,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
        data: result,
      }

      this.logResponse(response)
      return response
    } catch (error) {
      console.error('[CIBIL] Processing error:', error)
      return this.createErrorResponse(
        requestId,
        error instanceof Error ? error.message : 'CIBIL processing failed',
        'PROCESSING_ERROR'
      )
    }
  }

  async getStatus(requestId: string): Promise<CAEResponse> {
    // CIBIL is synchronous - no async status check needed
    return {
      success: true,
      provider: this.provider,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      processing_time_ms: 0,
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    const start = Date.now()
    try {
      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      })

      return {
        healthy: response.ok,
        latency_ms: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      }
    } catch (error) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : 'Health check failed',
      }
    }
  }

  private validateRequest(request: CAERequest): { valid: boolean; error?: string } {
    if (!request.customer_name) {
      return { valid: false, error: 'Customer name is required' }
    }
    if (!request.customer_mobile) {
      return { valid: false, error: 'Customer mobile is required' }
    }
    if (!request.customer_dob) {
      return { valid: false, error: 'Date of birth is required for CIBIL' }
    }
    // CIBIL requires at least one ID
    if (!request.customer_pan && !request.customer_aadhar) {
      return { valid: false, error: 'PAN or Aadhar is required for CIBIL check' }
    }
    return { valid: true }
  }

  private buildEnquiry(request: CAERequest): CIBILEnquiry {
    return {
      ConsumerName: request.customer_name,
      DateOfBirth: this.formatDate(request.customer_dob!),
      Gender: 'M', // Default to M, should be from request
      InquiryPurpose: this.mapLoanTypeToPurpose(request.loan_type),
      InquiryAmount: request.loan_amount,
      TelephoneNumber: request.customer_mobile,
      EmailAddress: request.customer_email,
      PAN: request.customer_pan,
      UID: request.customer_aadhar,
      Address: {
        AddressLine1: request.customer_address || '',
        City: request.customer_city || '',
        State: request.customer_state || '',
        PinCode: request.customer_pincode || '',
      },
    }
  }

  private async callCIBILAPI(enquiry: CIBILEnquiry): Promise<CIBILResponse> {
    const baseUrl = this.getBaseUrl()
    const environment = this.config.config?.environment || 'sandbox'

    // In sandbox mode, return mock data
    if (environment === 'sandbox') {
      return this.getMockCIBILResponse(enquiry)
    }

    const response = await fetch(`${baseUrl}/consumer-credit-report`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        RequestData: {
          InquiryRequestInfo: enquiry,
        },
      }),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
    })

    if (!response.ok) {
      throw new Error(`CIBIL API returned ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  private getBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    return environment === 'production' ? this.PRODUCTION_URL : this.SANDBOX_URL
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${this.config.config?.member_id || ''}:${this.config.config?.password || ''}`
      ).toString('base64')}`,
    }
  }

  private getMockCIBILResponse(enquiry: CIBILEnquiry): CIBILResponse {
    // Generate realistic mock response for sandbox testing
    const baseScore = 650 + Math.floor(Math.random() * 200)
    const accountCount = Math.floor(Math.random() * 8) + 1

    return {
      CIBILBureauResponse: {
        Response: {
          CreditReport: {
            Header: {
              ReportDate: new Date().toISOString().split('T')[0],
              ReportNumber: `CR${Date.now()}`,
            },
            NameSegment: {
              ConsumerName1: enquiry.ConsumerName,
              DateOfBirth: enquiry.DateOfBirth,
              Gender: enquiry.Gender,
            },
            ScoreSegment: [
              {
                Score: baseScore.toString(),
                ScoreName: 'CIBIL Score',
                ScoringFactors: this.generateScoringFactors(baseScore),
              },
            ],
            AccountSegment: this.generateMockAccounts(accountCount, baseScore),
            EnquirySegment: this.generateMockEnquiries(),
          },
        },
      },
    }
  }

  private generateScoringFactors(score: number): string[] {
    const factors: string[] = []
    if (score < 700) {
      factors.push('High credit utilization')
      factors.push('Recent late payments')
    }
    if (score < 650) {
      factors.push('Multiple recent enquiries')
    }
    if (score >= 750) {
      factors.push('Long credit history')
      factors.push('Low credit utilization')
    }
    return factors
  }

  private generateMockAccounts(count: number, score: number): CIBILResponse['CIBILBureauResponse']['Response']['CreditReport']['AccountSegment'] {
    const accounts = []
    const isGoodScore = score >= 700

    for (let i = 0; i < count; i++) {
      accounts.push({
        AccountNumber: `XXXX${Math.floor(Math.random() * 10000)}`,
        AccountType: ['Personal Loan', 'Credit Card', 'Home Loan', 'Auto Loan'][Math.floor(Math.random() * 4)],
        OwnershipIndicator: 'Individual',
        DateOpened: this.randomPastDate(60).toISOString().split('T')[0],
        DateOfLastPayment: this.randomPastDate(3).toISOString().split('T')[0],
        CurrentBalance: Math.floor(Math.random() * 500000).toString(),
        HighCredit: Math.floor(Math.random() * 1000000).toString(),
        PaymentHistory: isGoodScore ? '000000000000' : '00000X000000',
        AccountStatus: isGoodScore || Math.random() > 0.2 ? 'Current' : 'Overdue',
        SuitFiledStatus: 'No',
        WrittenOffAmount: isGoodScore ? '0' : (Math.random() > 0.9 ? Math.floor(Math.random() * 50000).toString() : '0'),
      })
    }

    return accounts
  }

  private generateMockEnquiries(): CIBILResponse['CIBILBureauResponse']['Response']['CreditReport']['EnquirySegment'] {
    const enquiries = []
    const count = Math.floor(Math.random() * 5)

    for (let i = 0; i < count; i++) {
      enquiries.push({
        DateOfEnquiry: this.randomPastDate(12).toISOString().split('T')[0],
        EnquiryPurpose: ['Personal Loan', 'Credit Card', 'Home Loan'][Math.floor(Math.random() * 3)],
        EnquiryAmount: Math.floor(Math.random() * 1000000).toString(),
        MemberName: ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank'][Math.floor(Math.random() * 4)],
      })
    }

    return enquiries
  }

  private randomPastDate(maxMonths: number): Date {
    const now = new Date()
    const months = Math.floor(Math.random() * maxMonths)
    now.setMonth(now.getMonth() - months)
    return now
  }

  private parseCIBILResponse(cibilResponse: CIBILResponse, request: CAERequest): CAEResult {
    const creditReport = cibilResponse.CIBILBureauResponse?.Response?.CreditReport
    const scoreSegment = creditReport?.ScoreSegment?.[0]
    const accounts = creditReport?.AccountSegment || []
    const enquiries = creditReport?.EnquirySegment || []

    const creditScore = parseInt(scoreSegment?.Score || '650', 10)
    const riskGrade = this.calculateRiskGrade(creditScore)
    const riskScore = this.calculateRiskScore(creditScore)

    // Parse account data
    const activeAccounts = accounts.filter((a) => a.AccountStatus === 'Current').length
    const overdueAccounts = accounts.filter((a) => a.AccountStatus === 'Overdue').length
    const writtenOffAccounts = accounts.filter((a) => parseInt(a.WrittenOffAmount || '0', 10) > 0).length
    const totalOutstanding = accounts.reduce((sum, a) => sum + parseInt(a.CurrentBalance || '0', 10), 0)
    const totalEmis = this.estimateMonthlyEmis(accounts)

    // Calculate eligibility
    const existingEmis = request.existing_emis || totalEmis
    const eligibleAmount = this.calculateEligibleAmount(request, creditScore, existingEmis)
    const emiCapacity = Math.max(0, request.monthly_income * 0.5 - existingEmis)
    const foir = existingEmis / request.monthly_income
    const dti = (existingEmis + this.calculateEstimatedEmi(request.loan_amount, 120)) / request.monthly_income

    // Generate flags and alerts
    const flags = this.generateFlags(creditScore, foir, accounts, enquiries)
    const alerts = this.generateAlerts(creditScore, overdueAccounts, writtenOffAccounts)

    // Determine recommendation
    const { recommendation, notes, conditions } = this.determineRecommendation(
      creditScore,
      riskGrade,
      foir,
      overdueAccounts,
      writtenOffAccounts
    )

    return {
      credit_score: creditScore,
      credit_score_range: { min: 300, max: 900 },
      risk_grade: riskGrade,
      risk_score: riskScore,

      eligible_loan_amount: eligibleAmount,
      max_loan_amount: eligibleAmount * 1.2,
      recommended_tenure_months: this.recommendTenure(request.loan_type),
      recommended_interest_rate: this.recommendInterestRate(creditScore, riskGrade),

      emi_capacity: emiCapacity,
      foir: Math.round(foir * 100) / 100,
      ltv: request.loan_type.toLowerCase().includes('home') ? 0.75 : undefined,
      dti: Math.round(dti * 100) / 100,

      bureau_data: {
        total_accounts: accounts.length,
        active_accounts: activeAccounts,
        overdue_accounts: overdueAccounts,
        written_off_accounts: writtenOffAccounts,
        enquiries_last_6_months: this.countRecentEnquiries(enquiries, 6),
        enquiries_last_12_months: enquiries.length,
        dpd_30_plus_count: this.countDPD(accounts, 30),
        dpd_60_plus_count: this.countDPD(accounts, 60),
        dpd_90_plus_count: this.countDPD(accounts, 90),
        oldest_account_age_months: this.getOldestAccountAge(accounts),
        total_outstanding: totalOutstanding,
        total_emis: totalEmis,
      },

      income_assessment: {
        declared_income: request.monthly_income,
        income_source: request.employment_type,
        stability_score: this.calculateStabilityScore(request),
        income_documents_required: this.getRequiredDocuments(request.employment_type),
      },

      flags,
      alerts,
      recommendation,
      recommendation_notes: notes,
      conditions,

      raw_response: cibilResponse,
    }
  }

  private calculateRiskGrade(creditScore: number): RiskGrade {
    if (creditScore >= 800) return 'A'
    if (creditScore >= 750) return 'B'
    if (creditScore >= 700) return 'C'
    if (creditScore >= 650) return 'D'
    if (creditScore >= 550) return 'E'
    return 'F'
  }

  private calculateRiskScore(creditScore: number): number {
    return Math.round(100 - ((creditScore - 300) / 600) * 100)
  }

  private calculateEligibleAmount(request: CAERequest, creditScore: number, existingEmis: number): number {
    const annualIncome = request.monthly_income * 12
    let multiplier = 5

    if (request.employment_type === 'SALARIED') multiplier = 6
    else if (request.employment_type === 'SELF_EMPLOYED_PROFESSIONAL') multiplier = 5
    else multiplier = 4

    // Adjust for credit score
    if (creditScore >= 800) multiplier *= 1.2
    else if (creditScore >= 750) multiplier *= 1.1
    else if (creditScore < 650) multiplier *= 0.8
    else if (creditScore < 600) multiplier *= 0.6

    // Adjust for existing EMIs
    const emiRatio = existingEmis / request.monthly_income
    multiplier = multiplier * (1 - Math.min(emiRatio, 0.5))

    return Math.round((annualIncome * multiplier) / 100000) * 100000
  }

  private estimateMonthlyEmis(accounts: any[]): number {
    return accounts
      .filter((a) => a.AccountStatus === 'Current')
      .reduce((sum, a) => {
        const balance = parseInt(a.CurrentBalance || '0', 10)
        // Estimate EMI as ~2% of balance for active loans
        return sum + Math.round(balance * 0.02)
      }, 0)
  }

  private calculateEstimatedEmi(loanAmount: number, tenureMonths: number): number {
    const rate = 0.10 / 12
    return Math.round((loanAmount * rate * Math.pow(1 + rate, tenureMonths)) / (Math.pow(1 + rate, tenureMonths) - 1))
  }

  private recommendTenure(loanType: string): number {
    const lt = loanType.toLowerCase()
    if (lt.includes('home')) return 240
    if (lt.includes('vehicle') || lt.includes('car') || lt.includes('auto')) return 84
    if (lt.includes('personal')) return 60
    if (lt.includes('business')) return 84
    return 120
  }

  private recommendInterestRate(creditScore: number, riskGrade: RiskGrade): number {
    const baseRate = 9.0
    const premiums: Record<RiskGrade, number> = {
      A: 0, B: 0.5, C: 1.0, D: 1.5, E: 2.5, F: 4.0, UNGRADED: 3.0,
    }
    return Math.round((baseRate + premiums[riskGrade]) * 100) / 100
  }

  private calculateStabilityScore(request: CAERequest): number {
    let score = 50
    if (request.employment_type === 'SALARIED') score += 30
    else if (request.employment_type === 'SELF_EMPLOYED_PROFESSIONAL') score += 20
    else score += 10

    if (request.years_of_employment) {
      if (request.years_of_employment > 5) score += 20
      else if (request.years_of_employment > 2) score += 10
    }

    return Math.min(100, score)
  }

  private getRequiredDocuments(employmentType: string): string[] {
    const common = ['PAN Card', 'Aadhar Card', 'Address Proof']
    if (employmentType === 'SALARIED') {
      return [...common, 'Salary Slips (3 months)', 'Bank Statements (6 months)', 'Form 16']
    } else if (employmentType === 'SELF_EMPLOYED_PROFESSIONAL') {
      return [...common, 'ITR (2 years)', 'Bank Statements (12 months)', 'Professional Certificate']
    } else {
      return [...common, 'ITR (3 years)', 'Bank Statements (12 months)', 'GST Returns', 'Business Proof']
    }
  }

  private countRecentEnquiries(enquiries: any[], months: number): number {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return enquiries.filter((e) => new Date(e.DateOfEnquiry) >= cutoff).length
  }

  private countDPD(accounts: any[], days: number): number {
    return accounts.filter((a) => {
      const history = a.PaymentHistory || ''
      // X indicates missed payment, count consecutive Xs
      const pattern = new RegExp(`X{${Math.ceil(days / 30)},}`)
      return pattern.test(history)
    }).length
  }

  private getOldestAccountAge(accounts: any[]): number {
    if (accounts.length === 0) return 0
    const oldest = accounts.reduce((min, a) => {
      const opened = new Date(a.DateOpened)
      return opened < min ? opened : min
    }, new Date())
    const months = (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30)
    return Math.floor(months)
  }

  private generateFlags(creditScore: number, foir: number, accounts: any[], enquiries: any[]): CAEFlag[] {
    const flags: CAEFlag[] = []

    if (creditScore < 600) {
      flags.push({
        code: 'LOW_CIBIL_SCORE',
        severity: 'HIGH',
        message: `CIBIL score ${creditScore} is below acceptable threshold (600)`,
        source: 'CIBIL',
      })
    }

    if (foir > 0.5) {
      flags.push({
        code: 'HIGH_FOIR',
        severity: 'MEDIUM',
        message: 'Fixed obligations exceed 50% of income',
        source: 'CALCULATION',
      })
    }

    const overdueCount = accounts.filter((a) => a.AccountStatus === 'Overdue').length
    if (overdueCount > 0) {
      flags.push({
        code: 'ACTIVE_OVERDUE_ACCOUNTS',
        severity: overdueCount > 2 ? 'HIGH' : 'MEDIUM',
        message: `${overdueCount} account(s) currently overdue`,
        source: 'CIBIL',
      })
    }

    const recentEnquiries = this.countRecentEnquiries(enquiries, 3)
    if (recentEnquiries > 3) {
      flags.push({
        code: 'MULTIPLE_RECENT_ENQUIRIES',
        severity: 'MEDIUM',
        message: `${recentEnquiries} credit enquiries in last 3 months`,
        source: 'CIBIL',
      })
    }

    return flags
  }

  private generateAlerts(creditScore: number, overdueAccounts: number, writtenOffAccounts: number): CAEAlert[] {
    const alerts: CAEAlert[] = []

    if (creditScore < 550) {
      alerts.push({
        type: 'RISK',
        code: 'HIGH_RISK_CIBIL',
        message: 'Applicant CIBIL score indicates high credit risk',
        action_required: 'Manual review by credit committee required',
      })
    }

    if (writtenOffAccounts > 0) {
      alerts.push({
        type: 'RISK',
        code: 'WRITTEN_OFF_HISTORY',
        message: `${writtenOffAccounts} written-off account(s) in credit history`,
        action_required: 'Verify settlement status and obtain NOC',
      })
    }

    if (overdueAccounts > 2) {
      alerts.push({
        type: 'COMPLIANCE',
        code: 'MULTIPLE_OVERDUES',
        message: 'Multiple overdue accounts require additional scrutiny',
        action_required: 'Obtain explanation letter from applicant',
      })
    }

    return alerts
  }

  private determineRecommendation(
    creditScore: number,
    riskGrade: RiskGrade,
    foir: number,
    overdueAccounts: number,
    writtenOffAccounts: number
  ): { recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REFER' | 'DECLINE'; notes: string[]; conditions?: string[] } {
    const notes: string[] = []
    const conditions: string[] = []

    // Hard decline cases
    if (creditScore < 500) {
      notes.push('CIBIL score below absolute minimum threshold (500)')
      return { recommendation: 'DECLINE', notes }
    }

    if (writtenOffAccounts > 2) {
      notes.push('Excessive written-off accounts in credit history')
      return { recommendation: 'DECLINE', notes }
    }

    if (foir > 0.75) {
      notes.push('FOIR exceeds maximum limit (75%)')
      return { recommendation: 'DECLINE', notes }
    }

    // Refer cases
    if (creditScore < 600 || riskGrade === 'F') {
      notes.push('Credit profile requires credit committee review')
      return { recommendation: 'REFER', notes }
    }

    if (writtenOffAccounts > 0 || overdueAccounts > 1) {
      notes.push('Adverse credit history requires manual evaluation')
      return { recommendation: 'REFER', notes }
    }

    // Approve with conditions
    if (creditScore < 700 || riskGrade === 'D' || riskGrade === 'E' || foir > 0.5) {
      notes.push('Approved subject to conditions')

      if (foir > 0.5) {
        conditions.push('Consider debt consolidation or foreclosure of existing obligations')
      }
      if (creditScore < 700) {
        conditions.push('Obtain additional income documentation')
        conditions.push('Consider processing fee increase of 0.5%')
      }
      if (overdueAccounts === 1) {
        conditions.push('Obtain clearance letter for overdue account')
      }

      return { recommendation: 'APPROVE_WITH_CONDITIONS', notes, conditions }
    }

    // Clean approval
    notes.push('Strong credit profile with CIBIL score ' + creditScore)
    notes.push('Recommended for expedited processing')
    if (creditScore >= 800) {
      notes.push('Eligible for preferential interest rates')
    }

    return { recommendation: 'APPROVE', notes }
  }

  private formatDate(dateStr: string): string {
    // Convert YYYY-MM-DD to DD-MM-YYYY for CIBIL
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-')
      return `${day}-${month}-${year}`
    }
    return dateStr
  }

  private mapLoanTypeToPurpose(loanType: string): string {
    const lt = loanType.toLowerCase()
    if (lt.includes('home') || lt.includes('housing')) return '03' // Housing Loan
    if (lt.includes('personal')) return '01' // Personal Loan
    if (lt.includes('auto') || lt.includes('car') || lt.includes('vehicle')) return '07' // Auto Loan
    if (lt.includes('business') || lt.includes('working capital')) return '05' // Business Loan
    if (lt.includes('education')) return '06' // Education Loan
    if (lt.includes('gold')) return '10' // Gold Loan
    return '01' // Default to Personal Loan
  }
}
