/**
 * Experian Credit Bureau Adapter
 * Integrates with Experian India API for credit bureau data
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

interface ExperianConfig extends CAEProviderConfig {
  config?: {
    client_id?: string
    client_secret?: string
    member_number?: string
    environment?: 'sandbox' | 'production'
  }
}

interface ExperianRequest {
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  mobileNumber: string
  email?: string
  pan?: string
  aadhar?: string
  addressLine1?: string
  city?: string
  state?: string
  pincode?: string
  loanPurpose: string
  loanAmount: number
}

interface ExperianResponse {
  creditReport?: {
    header?: {
      reportNumber: string
      reportDate: string
      reportTime: string
    }
    score?: {
      value: number
      type: string
      version: string
      factors?: string[]
    }
    personalInfo?: {
      name: string
      dateOfBirth: string
      gender: string
      pan?: string
      phone?: string
      email?: string
    }
    accountSummary?: {
      totalAccounts: number
      activeAccounts: number
      closedAccounts: number
      defaultAccounts: number
      totalCurrentBalance: number
      totalSanctionedAmount: number
      totalMonthlyEMI: number
      oldestAccountDate?: string
    }
    accounts?: Array<{
      accountNumber: string
      accountType: string
      ownershipType: string
      bankName: string
      sanctionedAmount: number
      currentBalance: number
      emiAmount?: number
      openDate: string
      lastPaymentDate?: string
      paymentStatus: string
      dpd?: number
      writeOffAmount?: number
    }>
    enquiries?: Array<{
      enquiryDate: string
      purpose: string
      amount: number
      memberName: string
    }>
  }
  error?: {
    code: string
    message: string
  }
}

export class ExperianAdapter extends BaseCAEAdapter {
  provider: CAEProviderType = 'EXPERIAN'
  name = 'Experian India'

  private readonly SANDBOX_URL = 'https://sandbox.experian.in/api/v1'
  private readonly PRODUCTION_URL = 'https://api.experian.in/v1'

  constructor(config: ExperianConfig) {
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

      // Build Experian request
      const experianRequest = this.buildRequest(request)

      // Make API call
      const experianResponse = await this.callExperianAPI(experianRequest)

      if (experianResponse.error) {
        return this.createErrorResponse(
          requestId,
          experianResponse.error.message || 'Experian API error',
          experianResponse.error.code
        )
      }

      // Parse response and generate result
      const result = this.parseExperianResponse(experianResponse, request)

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
      console.error('[EXPERIAN] Processing error:', error)
      return this.createErrorResponse(
        requestId,
        error instanceof Error ? error.message : 'Experian processing failed',
        'PROCESSING_ERROR'
      )
    }
  }

  async getStatus(requestId: string): Promise<CAEResponse> {
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
        headers: await this.getHeaders(),
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
      return { valid: false, error: 'Date of birth is required for Experian' }
    }
    return { valid: true }
  }

  private buildRequest(request: CAERequest): ExperianRequest {
    const nameParts = request.customer_name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || firstName

    return {
      firstName,
      lastName,
      dateOfBirth: request.customer_dob!,
      gender: 'M', // Default, should come from request
      mobileNumber: request.customer_mobile,
      email: request.customer_email,
      pan: request.customer_pan,
      aadhar: request.customer_aadhar,
      addressLine1: request.customer_address,
      city: request.customer_city,
      state: request.customer_state,
      pincode: request.customer_pincode,
      loanPurpose: this.mapLoanTypeToPurpose(request.loan_type),
      loanAmount: request.loan_amount,
    }
  }

  private async callExperianAPI(experianRequest: ExperianRequest): Promise<ExperianResponse> {
    const environment = this.config.config?.environment || 'sandbox'

    if (environment === 'sandbox') {
      return this.getMockExperianResponse(experianRequest)
    }

    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}/credit-report/consumer`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(experianRequest),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
    })

    if (!response.ok) {
      throw new Error(`Experian API returned ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  private getBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    return environment === 'production' ? this.PRODUCTION_URL : this.SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken()
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Member-Number': this.config.config?.member_number || '',
    }
  }

  private async getAccessToken(): Promise<string> {
    // In production, implement OAuth token fetch
    // For now, return a placeholder
    return this.config.api_key || 'sandbox-token'
  }

  private getMockExperianResponse(request: ExperianRequest): ExperianResponse {
    const baseScore = 650 + Math.floor(Math.random() * 200)
    const accountCount = Math.floor(Math.random() * 10) + 2

    const accounts = this.generateMockAccounts(accountCount, baseScore)
    const summary = this.generateAccountSummary(accounts)

    return {
      creditReport: {
        header: {
          reportNumber: `EXP${Date.now()}`,
          reportDate: new Date().toISOString().split('T')[0],
          reportTime: new Date().toISOString().split('T')[1].split('.')[0],
        },
        score: {
          value: baseScore,
          type: 'Experian Score',
          version: 'v4.0',
          factors: this.generateScoreFactors(baseScore),
        },
        personalInfo: {
          name: `${request.firstName} ${request.lastName}`,
          dateOfBirth: request.dateOfBirth,
          gender: request.gender,
          pan: request.pan,
          phone: request.mobileNumber,
          email: request.email,
        },
        accountSummary: summary,
        accounts,
        enquiries: this.generateMockEnquiries(),
      },
    }
  }

  private generateMockAccounts(count: number, score: number): ExperianResponse['creditReport']['accounts'] {
    const accounts = []
    const isGoodScore = score >= 700
    const accountTypes = ['Personal Loan', 'Credit Card', 'Home Loan', 'Auto Loan', 'Two Wheeler Loan', 'Consumer Durable']
    const banks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra', 'Yes Bank']

    for (let i = 0; i < count; i++) {
      const sanctioned = Math.floor(Math.random() * 1000000) + 50000
      const balance = Math.floor(sanctioned * Math.random() * 0.8)
      const dpd = isGoodScore ? 0 : Math.random() > 0.7 ? Math.floor(Math.random() * 90) : 0

      accounts.push({
        accountNumber: `XXXX${Math.floor(Math.random() * 10000)}`,
        accountType: accountTypes[Math.floor(Math.random() * accountTypes.length)],
        ownershipType: 'Individual',
        bankName: banks[Math.floor(Math.random() * banks.length)],
        sanctionedAmount: sanctioned,
        currentBalance: balance,
        emiAmount: Math.round(balance * 0.02),
        openDate: this.randomPastDate(60).toISOString().split('T')[0],
        lastPaymentDate: this.randomPastDate(2).toISOString().split('T')[0],
        paymentStatus: dpd === 0 ? 'Current' : dpd < 30 ? 'Late' : 'Overdue',
        dpd,
        writeOffAmount: !isGoodScore && Math.random() > 0.9 ? Math.floor(Math.random() * 50000) : 0,
      })
    }

    return accounts
  }

  private generateAccountSummary(accounts: ExperianResponse['creditReport']['accounts']): ExperianResponse['creditReport']['accountSummary'] {
    if (!accounts) return undefined

    const active = accounts.filter((a) => a.currentBalance > 0).length
    const defaults = accounts.filter((a) => a.dpd && a.dpd >= 90).length
    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0)
    const totalSanctioned = accounts.reduce((sum, a) => sum + a.sanctionedAmount, 0)
    const totalEMI = accounts.reduce((sum, a) => sum + (a.emiAmount || 0), 0)

    const oldest = accounts.reduce((min, a) => {
      const date = new Date(a.openDate)
      return date < min ? date : min
    }, new Date())

    return {
      totalAccounts: accounts.length,
      activeAccounts: active,
      closedAccounts: accounts.length - active,
      defaultAccounts: defaults,
      totalCurrentBalance: totalBalance,
      totalSanctionedAmount: totalSanctioned,
      totalMonthlyEMI: totalEMI,
      oldestAccountDate: oldest.toISOString().split('T')[0],
    }
  }

  private generateMockEnquiries(): ExperianResponse['creditReport']['enquiries'] {
    const enquiries = []
    const count = Math.floor(Math.random() * 6)
    const purposes = ['Personal Loan', 'Credit Card', 'Home Loan', 'Auto Loan']
    const members = ['HDFC Bank', 'ICICI Bank', 'Bajaj Finance', 'Tata Capital']

    for (let i = 0; i < count; i++) {
      enquiries.push({
        enquiryDate: this.randomPastDate(12).toISOString().split('T')[0],
        purpose: purposes[Math.floor(Math.random() * purposes.length)],
        amount: Math.floor(Math.random() * 1000000) + 50000,
        memberName: members[Math.floor(Math.random() * members.length)],
      })
    }

    return enquiries
  }

  private generateScoreFactors(score: number): string[] {
    const factors: string[] = []
    if (score < 700) {
      factors.push('Recent payment delays affecting score')
      factors.push('High credit card utilization')
    }
    if (score < 650) {
      factors.push('Short credit history')
      factors.push('Multiple recent credit enquiries')
    }
    if (score >= 750) {
      factors.push('Consistent on-time payments')
      factors.push('Healthy credit mix')
      factors.push('Low credit utilization')
    }
    return factors
  }

  private randomPastDate(maxMonths: number): Date {
    const now = new Date()
    const months = Math.floor(Math.random() * maxMonths)
    now.setMonth(now.getMonth() - months)
    return now
  }

  private parseExperianResponse(response: ExperianResponse, request: CAERequest): CAEResult {
    const report = response.creditReport!
    const creditScore = report.score?.value || 650
    const riskGrade = this.calculateRiskGrade(creditScore)
    const riskScore = this.calculateRiskScore(creditScore)

    const summary = report.accountSummary || {
      totalAccounts: 0,
      activeAccounts: 0,
      closedAccounts: 0,
      defaultAccounts: 0,
      totalCurrentBalance: 0,
      totalSanctionedAmount: 0,
      totalMonthlyEMI: 0,
    }

    const accounts = report.accounts || []
    const enquiries = report.enquiries || []

    // Calculate eligibility
    const existingEmis = request.existing_emis || summary.totalMonthlyEMI
    const eligibleAmount = this.calculateEligibleAmount(request, creditScore, existingEmis)
    const emiCapacity = Math.max(0, request.monthly_income * 0.5 - existingEmis)
    const foir = existingEmis / request.monthly_income
    const dti = (existingEmis + this.calculateEstimatedEmi(request.loan_amount, 120)) / request.monthly_income

    // Count DPDs
    const dpd30 = accounts.filter((a) => a.dpd && a.dpd >= 30).length
    const dpd60 = accounts.filter((a) => a.dpd && a.dpd >= 60).length
    const dpd90 = accounts.filter((a) => a.dpd && a.dpd >= 90).length
    const writtenOff = accounts.filter((a) => a.writeOffAmount && a.writeOffAmount > 0).length

    // Generate flags and alerts
    const flags = this.generateFlags(creditScore, foir, dpd30, enquiries)
    const alerts = this.generateAlerts(creditScore, summary.defaultAccounts, writtenOff)

    const { recommendation, notes, conditions } = this.determineRecommendation(
      creditScore,
      riskGrade,
      foir,
      summary.defaultAccounts,
      writtenOff
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
        total_accounts: summary.totalAccounts,
        active_accounts: summary.activeAccounts,
        overdue_accounts: summary.defaultAccounts,
        written_off_accounts: writtenOff,
        enquiries_last_6_months: this.countRecentEnquiries(enquiries, 6),
        enquiries_last_12_months: enquiries.length,
        dpd_30_plus_count: dpd30,
        dpd_60_plus_count: dpd60,
        dpd_90_plus_count: dpd90,
        oldest_account_age_months: this.getOldestAccountAge(summary.oldestAccountDate),
        total_outstanding: summary.totalCurrentBalance,
        total_emis: summary.totalMonthlyEMI,
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

      raw_response: response,
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

    if (creditScore >= 800) multiplier *= 1.2
    else if (creditScore >= 750) multiplier *= 1.1
    else if (creditScore < 650) multiplier *= 0.8
    else if (creditScore < 600) multiplier *= 0.6

    const emiRatio = existingEmis / request.monthly_income
    multiplier = multiplier * (1 - Math.min(emiRatio, 0.5))

    return Math.round((annualIncome * multiplier) / 100000) * 100000
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
    }
    return [...common, 'ITR (3 years)', 'Bank Statements (12 months)', 'GST Returns', 'Business Proof']
  }

  private countRecentEnquiries(enquiries: ExperianResponse['creditReport']['enquiries'], months: number): number {
    if (!enquiries) return 0
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return enquiries.filter((e) => new Date(e.enquiryDate) >= cutoff).length
  }

  private getOldestAccountAge(oldestDate?: string): number {
    if (!oldestDate) return 0
    const months = (Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    return Math.floor(months)
  }

  private generateFlags(creditScore: number, foir: number, dpd30: number, enquiries: ExperianResponse['creditReport']['enquiries']): CAEFlag[] {
    const flags: CAEFlag[] = []

    if (creditScore < 600) {
      flags.push({
        code: 'LOW_EXPERIAN_SCORE',
        severity: 'HIGH',
        message: `Experian score ${creditScore} is below acceptable threshold (600)`,
        source: 'EXPERIAN',
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

    if (dpd30 > 0) {
      flags.push({
        code: 'PAYMENT_DELAYS',
        severity: dpd30 > 2 ? 'HIGH' : 'MEDIUM',
        message: `${dpd30} account(s) with payment delays (30+ DPD)`,
        source: 'EXPERIAN',
      })
    }

    const recentEnquiries = this.countRecentEnquiries(enquiries, 3)
    if (recentEnquiries > 3) {
      flags.push({
        code: 'MULTIPLE_RECENT_ENQUIRIES',
        severity: 'MEDIUM',
        message: `${recentEnquiries} credit enquiries in last 3 months`,
        source: 'EXPERIAN',
      })
    }

    return flags
  }

  private generateAlerts(creditScore: number, defaultAccounts: number, writtenOff: number): CAEAlert[] {
    const alerts: CAEAlert[] = []

    if (creditScore < 550) {
      alerts.push({
        type: 'RISK',
        code: 'HIGH_RISK_EXPERIAN',
        message: 'Experian score indicates high credit risk',
        action_required: 'Manual review by credit committee required',
      })
    }

    if (writtenOff > 0) {
      alerts.push({
        type: 'RISK',
        code: 'WRITTEN_OFF_HISTORY',
        message: `${writtenOff} written-off account(s) in credit history`,
        action_required: 'Verify settlement status and obtain NOC',
      })
    }

    if (defaultAccounts > 1) {
      alerts.push({
        type: 'COMPLIANCE',
        code: 'MULTIPLE_DEFAULTS',
        message: 'Multiple default accounts require additional scrutiny',
        action_required: 'Obtain explanation letter from applicant',
      })
    }

    return alerts
  }

  private determineRecommendation(
    creditScore: number,
    riskGrade: RiskGrade,
    foir: number,
    defaultAccounts: number,
    writtenOff: number
  ): { recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REFER' | 'DECLINE'; notes: string[]; conditions?: string[] } {
    const notes: string[] = []
    const conditions: string[] = []

    if (creditScore < 500) {
      notes.push('Experian score below absolute minimum threshold (500)')
      return { recommendation: 'DECLINE', notes }
    }

    if (writtenOff > 2) {
      notes.push('Excessive written-off accounts in credit history')
      return { recommendation: 'DECLINE', notes }
    }

    if (foir > 0.75) {
      notes.push('FOIR exceeds maximum limit (75%)')
      return { recommendation: 'DECLINE', notes }
    }

    if (creditScore < 600 || riskGrade === 'F') {
      notes.push('Credit profile requires credit committee review')
      return { recommendation: 'REFER', notes }
    }

    if (writtenOff > 0 || defaultAccounts > 1) {
      notes.push('Adverse credit history requires manual evaluation')
      return { recommendation: 'REFER', notes }
    }

    if (creditScore < 700 || riskGrade === 'D' || riskGrade === 'E' || foir > 0.5) {
      notes.push('Approved subject to conditions')

      if (foir > 0.5) {
        conditions.push('Consider debt consolidation or foreclosure of existing obligations')
      }
      if (creditScore < 700) {
        conditions.push('Obtain additional income documentation')
        conditions.push('Consider processing fee increase of 0.5%')
      }

      return { recommendation: 'APPROVE_WITH_CONDITIONS', notes, conditions }
    }

    notes.push('Strong credit profile with Experian score ' + creditScore)
    notes.push('Recommended for expedited processing')
    if (creditScore >= 800) {
      notes.push('Eligible for preferential interest rates')
    }

    return { recommendation: 'APPROVE', notes }
  }

  private mapLoanTypeToPurpose(loanType: string): string {
    const lt = loanType.toLowerCase()
    if (lt.includes('home') || lt.includes('housing')) return 'HOME_LOAN'
    if (lt.includes('personal')) return 'PERSONAL_LOAN'
    if (lt.includes('auto') || lt.includes('car') || lt.includes('vehicle')) return 'AUTO_LOAN'
    if (lt.includes('business')) return 'BUSINESS_LOAN'
    if (lt.includes('education')) return 'EDUCATION_LOAN'
    if (lt.includes('gold')) return 'GOLD_LOAN'
    return 'PERSONAL_LOAN'
  }
}
