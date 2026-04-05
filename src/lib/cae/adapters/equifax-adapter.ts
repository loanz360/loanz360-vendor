/**
 * Equifax Credit Bureau Adapter
 * Integrates with Equifax India API for credit bureau data
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

interface EquifaxConfig extends CAEProviderConfig {
  config?: {
    customer_id?: string
    api_key?: string
    client_id?: string
    environment?: 'sandbox' | 'production'
  }
}

interface EquifaxEnquiry {
  ConsumerName: string
  DateOfBirth: string
  Gender: string
  PurposeOfEnquiry: string
  AmountFinanced: number
  PhoneNumber: string
  Email?: string
  PAN?: string
  AadhaarNumber?: string
  Address: {
    Line1: string
    City: string
    State: string
    PostalCode: string
  }
}

interface EquifaxResponse {
  ConsumerCreditReport?: {
    Header?: {
      ReportGeneratedDate?: string
      ReportOrderNumber?: string
    }
    ConsumerDetails?: {
      Name?: string
      DateOfBirth?: string
      Gender?: string
      PAN?: string
    }
    Score?: {
      Type?: string
      Value?: number
      Version?: string
      ScoreFactors?: Array<{
        Code: string
        Description: string
      }>
    }
    Accounts?: Array<{
      AccountNumber?: string
      AccountType?: string
      AccountHolder?: string
      DateOpened?: string
      LastPaymentDate?: string
      Balance?: number
      CreditLimit?: number
      PaymentStatus?: string
      AccountStatus?: string
      WriteOffAmount?: number
      EMIAmount?: number
      DaysOverdue?: number
    }>
    Enquiries?: Array<{
      EnquiryDate?: string
      EnquiryPurpose?: string
      EnquiryAmount?: number
      MemberName?: string
    }>
    Summary?: {
      TotalAccounts?: number
      ActiveAccounts?: number
      OverdueAccounts?: number
      WrittenOffAccounts?: number
      TotalOutstanding?: number
      TotalHighCredit?: number
    }
  }
  Error?: {
    Code?: string
    Message?: string
  }
}

export class EquifaxAdapter extends BaseCAEAdapter {
  provider: CAEProviderType = 'EQUIFAX'
  name = 'Equifax India'

  private readonly SANDBOX_URL = 'https://sandbox.equifax.co.in/api/v1'
  private readonly PRODUCTION_URL = 'https://api.equifax.co.in/v1'

  constructor(config: EquifaxConfig) {
    super(config)
  }

  async processAppraisal(request: CAERequest): Promise<CAEResponse> {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    this.logRequest(request, requestId)

    try {
      const validation = this.validateRequest(request)
      if (!validation.valid) {
        return this.createErrorResponse(requestId, validation.error!, 'VALIDATION_ERROR')
      }

      const enquiry = this.buildEnquiry(request)
      const equifaxResponse = await this.callEquifaxAPI(enquiry)

      if (equifaxResponse.Error) {
        return this.createErrorResponse(
          requestId,
          equifaxResponse.Error.Message || 'Equifax API error',
          equifaxResponse.Error.Code
        )
      }

      const result = this.parseEquifaxResponse(equifaxResponse, request)

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
      console.error('[EQUIFAX] Processing error:', error)
      return this.createErrorResponse(
        requestId,
        error instanceof Error ? error.message : 'Equifax processing failed',
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
      return { valid: false, error: 'Date of birth is required for Equifax' }
    }
    if (!request.customer_pan && !request.customer_aadhar) {
      return { valid: false, error: 'PAN or Aadhar is required for Equifax check' }
    }
    return { valid: true }
  }

  private buildEnquiry(request: CAERequest): EquifaxEnquiry {
    return {
      ConsumerName: request.customer_name,
      DateOfBirth: request.customer_dob!,
      Gender: 'M',
      PurposeOfEnquiry: this.mapLoanTypeToPurpose(request.loan_type),
      AmountFinanced: request.loan_amount,
      PhoneNumber: request.customer_mobile,
      Email: request.customer_email,
      PAN: request.customer_pan,
      AadhaarNumber: request.customer_aadhar,
      Address: {
        Line1: request.customer_address || '',
        City: request.customer_city || '',
        State: request.customer_state || '',
        PostalCode: request.customer_pincode || '',
      },
    }
  }

  private async callEquifaxAPI(enquiry: EquifaxEnquiry): Promise<EquifaxResponse> {
    const environment = this.config.config?.environment || 'sandbox'

    if (environment === 'sandbox') {
      return this.getMockEquifaxResponse(enquiry)
    }

    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}/consumer-credit-report`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ enquiryDetails: enquiry }),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
    })

    if (!response.ok) {
      throw new Error(`Equifax API returned ${response.status}: ${response.statusText}`)
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
      'X-Customer-ID': this.config.config?.customer_id || '',
      'X-API-Key': this.config.config?.api_key || '',
      'X-Client-ID': this.config.config?.client_id || '',
    }
  }

  private getMockEquifaxResponse(enquiry: EquifaxEnquiry): EquifaxResponse {
    const baseScore = 640 + Math.floor(Math.random() * 210)
    const accountCount = Math.floor(Math.random() * 10) + 1
    const isGoodScore = baseScore >= 700

    const accounts = this.generateMockAccounts(accountCount, isGoodScore)
    const summary = this.generateSummary(accounts)

    return {
      ConsumerCreditReport: {
        Header: {
          ReportGeneratedDate: new Date().toISOString(),
          ReportOrderNumber: `EQ${Date.now()}`,
        },
        ConsumerDetails: {
          Name: enquiry.ConsumerName,
          DateOfBirth: enquiry.DateOfBirth,
          Gender: enquiry.Gender,
          PAN: enquiry.PAN,
        },
        Score: {
          Type: 'Equifax Risk Score',
          Value: baseScore,
          Version: 'ERS 3.0',
          ScoreFactors: this.generateScoreFactors(baseScore),
        },
        Accounts: accounts,
        Enquiries: this.generateMockEnquiries(),
        Summary: summary,
      },
    }
  }

  private generateScoreFactors(score: number): Array<{ Code: string; Description: string }> {
    const factors: Array<{ Code: string; Description: string }> = []

    if (score < 700) {
      factors.push({ Code: 'SF01', Description: 'High credit utilization on revolving accounts' })
      factors.push({ Code: 'SF02', Description: 'Recent delinquency on accounts' })
    }
    if (score < 650) {
      factors.push({ Code: 'SF03', Description: 'Too many recent credit enquiries' })
      factors.push({ Code: 'SF04', Description: 'Short credit history' })
    }
    if (score >= 750) {
      factors.push({ Code: 'SF10', Description: 'Well-established credit history' })
      factors.push({ Code: 'SF11', Description: 'Low utilization on credit lines' })
      factors.push({ Code: 'SF12', Description: 'Consistent payment history' })
    }

    return factors
  }

  private generateMockAccounts(count: number, isGoodScore: boolean): EquifaxResponse['ConsumerCreditReport']['Accounts'] {
    const accounts = []
    const accountTypes = ['Personal Loan', 'Credit Card', 'Home Loan', 'Auto Loan', 'Two Wheeler Loan', 'Consumer Durable']

    for (let i = 0; i < count; i++) {
      const balance = Math.floor(Math.random() * 500000)
      const creditLimit = balance + Math.floor(Math.random() * 200000)
      const isOverdue = !isGoodScore && Math.random() > 0.7

      accounts.push({
        AccountNumber: `XXXX${Math.floor(1000 + Math.random() * 9000)}`,
        AccountType: accountTypes[Math.floor(Math.random() * accountTypes.length)],
        AccountHolder: 'Single',
        DateOpened: this.randomPastDate(72).toISOString().split('T')[0],
        LastPaymentDate: this.randomPastDate(2).toISOString().split('T')[0],
        Balance: balance,
        CreditLimit: creditLimit,
        PaymentStatus: isOverdue ? 'Overdue' : 'Current',
        AccountStatus: Math.random() > 0.15 ? 'Active' : 'Closed',
        WriteOffAmount: !isGoodScore && Math.random() > 0.9 ? Math.floor(Math.random() * 30000) : 0,
        EMIAmount: Math.floor(balance * 0.02),
        DaysOverdue: isOverdue ? Math.floor(Math.random() * 90) + 30 : 0,
      })
    }

    return accounts
  }

  private generateMockEnquiries(): EquifaxResponse['ConsumerCreditReport']['Enquiries'] {
    const enquiries = []
    const count = Math.floor(Math.random() * 6)
    const purposes = ['Personal Loan', 'Credit Card', 'Home Loan', 'Auto Loan', 'Consumer Durable']
    const members = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Bank', 'Bajaj Finserv']

    for (let i = 0; i < count; i++) {
      enquiries.push({
        EnquiryDate: this.randomPastDate(12).toISOString().split('T')[0],
        EnquiryPurpose: purposes[Math.floor(Math.random() * purposes.length)],
        EnquiryAmount: Math.floor(Math.random() * 1000000) + 50000,
        MemberName: members[Math.floor(Math.random() * members.length)],
      })
    }

    return enquiries
  }

  private generateSummary(accounts: any[]): EquifaxResponse['ConsumerCreditReport']['Summary'] {
    const activeAccounts = accounts.filter(a => a.AccountStatus === 'Active').length
    const overdueAccounts = accounts.filter(a => a.PaymentStatus === 'Overdue').length
    const writtenOffAccounts = accounts.filter(a => (a.WriteOffAmount || 0) > 0).length
    const totalOutstanding = accounts.reduce((sum, a) => sum + (a.Balance || 0), 0)
    const totalHighCredit = accounts.reduce((sum, a) => sum + (a.CreditLimit || 0), 0)

    return {
      TotalAccounts: accounts.length,
      ActiveAccounts: activeAccounts,
      OverdueAccounts: overdueAccounts,
      WrittenOffAccounts: writtenOffAccounts,
      TotalOutstanding: totalOutstanding,
      TotalHighCredit: totalHighCredit,
    }
  }

  private randomPastDate(maxMonths: number): Date {
    const now = new Date()
    const months = Math.floor(Math.random() * maxMonths)
    now.setMonth(now.getMonth() - months)
    return now
  }

  private parseEquifaxResponse(equifaxResponse: EquifaxResponse, request: CAERequest): CAEResult {
    const report = equifaxResponse.ConsumerCreditReport
    const accounts = report?.Accounts || []
    const enquiries = report?.Enquiries || []
    const summary = report?.Summary

    const creditScore = report?.Score?.Value || 650
    const riskGrade = this.calculateRiskGrade(creditScore)
    const riskScore = this.calculateRiskScore(creditScore)

    const activeAccounts = summary?.ActiveAccounts || 0
    const overdueAccounts = summary?.OverdueAccounts || 0
    const writtenOffAccounts = summary?.WrittenOffAccounts || 0
    const totalOutstanding = summary?.TotalOutstanding || 0

    const totalEmis = accounts.reduce((sum, a) => sum + (a.EMIAmount || 0), 0)
    const existingEmis = request.existing_emis || totalEmis

    const eligibleAmount = this.calculateEligibleAmount(request, creditScore, existingEmis)
    const emiCapacity = Math.max(0, request.monthly_income * 0.5 - existingEmis)
    const foir = existingEmis / request.monthly_income
    const dti = (existingEmis + this.calculateEstimatedEmi(request.loan_amount, 120)) / request.monthly_income

    const flags = this.generateFlags(creditScore, foir, accounts, enquiries)
    const alerts = this.generateAlerts(creditScore, overdueAccounts, writtenOffAccounts)

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
        total_accounts: summary?.TotalAccounts || accounts.length,
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

      raw_response: equifaxResponse,
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
    } else {
      return [...common, 'ITR (3 years)', 'Bank Statements (12 months)', 'GST Returns', 'Business Proof']
    }
  }

  private countRecentEnquiries(enquiries: any[], months: number): number {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return enquiries.filter(e => new Date(e.EnquiryDate) >= cutoff).length
  }

  private countDPD(accounts: any[], days: number): number {
    return accounts.filter(a => (a.DaysOverdue || 0) >= days).length
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
        code: 'LOW_EQUIFAX_SCORE',
        severity: 'HIGH',
        message: `Equifax score ${creditScore} is below acceptable threshold (600)`,
        source: 'EQUIFAX',
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

    const overdueCount = accounts.filter(a => a.PaymentStatus === 'Overdue').length
    if (overdueCount > 0) {
      flags.push({
        code: 'ACTIVE_OVERDUE_ACCOUNTS',
        severity: overdueCount > 2 ? 'HIGH' : 'MEDIUM',
        message: `${overdueCount} account(s) currently overdue`,
        source: 'EQUIFAX',
      })
    }

    const recentEnquiries = this.countRecentEnquiries(enquiries, 3)
    if (recentEnquiries > 3) {
      flags.push({
        code: 'MULTIPLE_RECENT_ENQUIRIES',
        severity: 'MEDIUM',
        message: `${recentEnquiries} credit enquiries in last 3 months`,
        source: 'EQUIFAX',
      })
    }

    return flags
  }

  private generateAlerts(creditScore: number, overdueAccounts: number, writtenOffAccounts: number): CAEAlert[] {
    const alerts: CAEAlert[] = []

    if (creditScore < 550) {
      alerts.push({
        type: 'RISK',
        code: 'HIGH_RISK_EQUIFAX',
        message: 'Applicant Equifax score indicates high credit risk',
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

    if (creditScore < 500) {
      notes.push('Equifax score below absolute minimum threshold (500)')
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

    if (creditScore < 600 || riskGrade === 'F') {
      notes.push('Credit profile requires credit committee review')
      return { recommendation: 'REFER', notes }
    }

    if (writtenOffAccounts > 0 || overdueAccounts > 1) {
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
      if (overdueAccounts === 1) {
        conditions.push('Obtain clearance letter for overdue account')
      }

      return { recommendation: 'APPROVE_WITH_CONDITIONS', notes, conditions }
    }

    notes.push('Strong credit profile with Equifax score ' + creditScore)
    notes.push('Recommended for expedited processing')
    if (creditScore >= 800) {
      notes.push('Eligible for preferential interest rates')
    }

    return { recommendation: 'APPROVE', notes }
  }

  private mapLoanTypeToPurpose(loanType: string): string {
    const lt = loanType.toLowerCase()
    if (lt.includes('home') || lt.includes('housing')) return 'HOUSING_LOAN'
    if (lt.includes('personal')) return 'PERSONAL_LOAN'
    if (lt.includes('auto') || lt.includes('car') || lt.includes('vehicle')) return 'AUTO_LOAN'
    if (lt.includes('business') || lt.includes('working capital')) return 'BUSINESS_LOAN'
    if (lt.includes('education')) return 'EDUCATION_LOAN'
    if (lt.includes('gold')) return 'GOLD_LOAN'
    return 'PERSONAL_LOAN'
  }
}
