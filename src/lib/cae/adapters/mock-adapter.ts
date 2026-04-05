/**
 * Mock CAE Provider Adapter
 * Simulates credit appraisal for testing and development
 * Uses deterministic logic based on input data
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

export class MockCAEAdapter extends BaseCAEAdapter {
  provider: CAEProviderType = 'MOCK'
  name = 'Mock Credit Appraisal Engine'

  constructor(config?: CAEProviderConfig) {
    super(
      config || {
        id: 'mock-provider',
        name: 'Mock Provider',
        provider_type: 'MOCK',
        is_active: true,
        priority: 999,
        timeout_ms: 5000,
        retry_count: 0,
      }
    )
  }

  async processAppraisal(request: CAERequest): Promise<CAEResponse> {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    this.logRequest(request, requestId)

    try {
      // Simulate processing delay (500-2000ms)
      await this.simulateDelay(500, 2000)

      // Generate mock result based on input data
      const result = this.generateMockResult(request)

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
      return this.createErrorResponse(
        requestId,
        error instanceof Error ? error.message : 'Mock processing failed',
        'MOCK_ERROR'
      )
    }
  }

  async getStatus(requestId: string): Promise<CAEResponse> {
    // Mock adapter always returns completed status
    return {
      success: true,
      provider: this.provider,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      processing_time_ms: 0,
    }
  }

  private generateMockResult(request: CAERequest): CAEResult {
    // Calculate credit score based on income and loan amount
    const creditScore = this.calculateMockCreditScore(request)
    const riskGrade = this.calculateRiskGrade(creditScore)
    const riskScore = this.calculateRiskScore(creditScore)

    // Calculate loan eligibility
    const eligibleAmount = this.calculateEligibleAmount(request)
    const maxAmount = eligibleAmount * 1.2

    // Calculate EMI capacity
    const existingEmis = request.existing_emis || 0
    const emiCapacity = Math.max(0, request.monthly_income * 0.5 - existingEmis)

    // Calculate FOIR and DTI
    const foir = existingEmis / request.monthly_income
    const dti = (existingEmis + this.calculateEstimatedEmi(request.loan_amount, 120)) / request.monthly_income

    // Generate flags and alerts
    const flags = this.generateFlags(request, creditScore, foir)
    const alerts = this.generateAlerts(request, creditScore)

    // Determine recommendation
    const { recommendation, notes, conditions } = this.determineRecommendation(
      creditScore,
      riskGrade,
      foir,
      request
    )

    return {
      credit_score: creditScore,
      credit_score_range: { min: 300, max: 900 },
      risk_grade: riskGrade,
      risk_score: riskScore,

      eligible_loan_amount: eligibleAmount,
      max_loan_amount: maxAmount,
      recommended_tenure_months: this.recommendTenure(request.loan_type),
      recommended_interest_rate: this.recommendInterestRate(creditScore, riskGrade),

      emi_capacity: emiCapacity,
      foir: Math.round(foir * 100) / 100,
      ltv: request.loan_type.includes('Property') ? 0.75 : undefined,
      dti: Math.round(dti * 100) / 100,

      bureau_data: this.generateMockBureauData(creditScore),
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
    }
  }

  private calculateMockCreditScore(request: CAERequest): number {
    // Base score starts at 650
    let score = 650

    // Income factor (+/- 100)
    if (request.monthly_income > 100000) score += 100
    else if (request.monthly_income > 50000) score += 50
    else if (request.monthly_income < 25000) score -= 50

    // Employment factor (+/- 50)
    if (request.employment_type === 'SALARIED') score += 30
    else if (request.employment_type === 'SELF_EMPLOYED_PROFESSIONAL') score += 20
    else if (request.employment_type === 'SELF_EMPLOYED_BUSINESS') score += 10

    // Years of employment factor
    if (request.years_of_employment) {
      if (request.years_of_employment > 5) score += 30
      else if (request.years_of_employment > 2) score += 15
    }

    // Loan to income ratio factor
    const loanToIncomeRatio = request.loan_amount / (request.monthly_income * 12)
    if (loanToIncomeRatio > 10) score -= 50
    else if (loanToIncomeRatio > 5) score -= 25

    // Existing EMI factor
    if (request.existing_emis) {
      const emiToIncomeRatio = request.existing_emis / request.monthly_income
      if (emiToIncomeRatio > 0.5) score -= 50
      else if (emiToIncomeRatio > 0.3) score -= 25
    }

    // PAN/Aadhar verification bonus
    if (request.customer_pan) score += 20
    if (request.customer_aadhar) score += 10

    // Add some randomness for variety (-30 to +30)
    const randomFactor = Math.floor(Math.random() * 61) - 30
    score += randomFactor

    // Clamp to valid range
    return Math.max(300, Math.min(900, score))
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
    // Risk score is inverse of credit score (0-100, where 0 is lowest risk)
    return Math.round(100 - ((creditScore - 300) / 600) * 100)
  }

  private calculateEligibleAmount(request: CAERequest): number {
    // Base multiplier on annual income
    const annualIncome = request.monthly_income * 12
    let multiplier = 5 // Default 5x annual income

    // Adjust based on employment type
    if (request.employment_type === 'SALARIED') multiplier = 6
    else if (request.employment_type === 'SELF_EMPLOYED_PROFESSIONAL') multiplier = 5
    else if (request.employment_type === 'SELF_EMPLOYED_BUSINESS') multiplier = 4

    // Adjust based on existing EMIs
    if (request.existing_emis) {
      const existingEmiRatio = request.existing_emis / request.monthly_income
      multiplier = multiplier * (1 - existingEmiRatio)
    }

    const eligibleAmount = annualIncome * multiplier

    // Round to nearest lakh
    return Math.round(eligibleAmount / 100000) * 100000
  }

  private calculateEstimatedEmi(loanAmount: number, tenureMonths: number): number {
    const rate = 0.10 / 12 // 10% annual rate
    const emi = (loanAmount * rate * Math.pow(1 + rate, tenureMonths)) / (Math.pow(1 + rate, tenureMonths) - 1)
    return Math.round(emi)
  }

  private recommendTenure(loanType: string): number {
    if (loanType.includes('Home')) return 240 // 20 years
    if (loanType.includes('Vehicle') || loanType.includes('Car')) return 84 // 7 years
    if (loanType.includes('Personal')) return 60 // 5 years
    if (loanType.includes('Business')) return 84 // 7 years
    return 120 // Default 10 years
  }

  private recommendInterestRate(creditScore: number, riskGrade: RiskGrade): number {
    const baseRate = 9.0

    // Add premium based on risk grade
    const premiums: Record<RiskGrade, number> = {
      A: 0,
      B: 0.5,
      C: 1.0,
      D: 1.5,
      E: 2.5,
      F: 4.0,
      UNGRADED: 3.0,
    }

    return Math.round((baseRate + premiums[riskGrade]) * 100) / 100
  }

  private calculateStabilityScore(request: CAERequest): number {
    let score = 50 // Base score

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
    } else if (employmentType === 'SELF_EMPLOYED_BUSINESS') {
      return [...common, 'ITR (3 years)', 'Bank Statements (12 months)', 'GST Returns', 'Business Proof']
    }

    return common
  }

  private generateMockBureauData(creditScore: number) {
    // Generate realistic bureau data based on credit score
    const isGoodScore = creditScore >= 700

    return {
      total_accounts: isGoodScore ? Math.floor(Math.random() * 8) + 3 : Math.floor(Math.random() * 5) + 1,
      active_accounts: isGoodScore ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3) + 1,
      overdue_accounts: isGoodScore ? 0 : Math.floor(Math.random() * 2),
      written_off_accounts: creditScore < 600 ? Math.floor(Math.random() * 2) : 0,
      enquiries_last_6_months: Math.floor(Math.random() * 4),
      enquiries_last_12_months: Math.floor(Math.random() * 8),
      dpd_30_plus_count: isGoodScore ? 0 : Math.floor(Math.random() * 3),
      dpd_60_plus_count: creditScore < 650 ? Math.floor(Math.random() * 2) : 0,
      dpd_90_plus_count: creditScore < 600 ? Math.floor(Math.random() * 2) : 0,
      oldest_account_age_months: Math.floor(Math.random() * 120) + 12,
      total_outstanding: Math.floor(Math.random() * 1000000),
      total_emis: Math.floor(Math.random() * 50000),
    }
  }

  private generateFlags(request: CAERequest, creditScore: number, foir: number): CAEFlag[] {
    const flags: CAEFlag[] = []

    if (creditScore < 600) {
      flags.push({
        code: 'LOW_CREDIT_SCORE',
        severity: 'HIGH',
        message: 'Credit score below acceptable threshold',
        source: 'BUREAU',
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

    if (!request.customer_pan) {
      flags.push({
        code: 'MISSING_PAN',
        severity: 'LOW',
        message: 'PAN not provided for verification',
        source: 'KYC',
      })
    }

    if (request.loan_amount > request.monthly_income * 60) {
      flags.push({
        code: 'HIGH_LOAN_TO_INCOME',
        severity: 'MEDIUM',
        message: 'Loan amount exceeds 5x annual income',
        source: 'CALCULATION',
      })
    }

    return flags
  }

  private generateAlerts(request: CAERequest, creditScore: number): CAEAlert[] {
    const alerts: CAEAlert[] = []

    if (creditScore < 550) {
      alerts.push({
        type: 'RISK',
        code: 'HIGH_RISK_APPLICANT',
        message: 'Applicant falls in high-risk category',
        action_required: 'Manual review recommended',
      })
    }

    return alerts
  }

  private determineRecommendation(
    creditScore: number,
    riskGrade: RiskGrade,
    foir: number,
    request: CAERequest
  ): {
    recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REFER' | 'DECLINE'
    notes: string[]
    conditions?: string[]
  } {
    const notes: string[] = []
    const conditions: string[] = []

    // Decline cases
    if (creditScore < 550) {
      notes.push('Credit score below minimum threshold (550)')
      return { recommendation: 'DECLINE', notes }
    }

    if (foir > 0.7) {
      notes.push('FOIR exceeds maximum limit (70%)')
      return { recommendation: 'DECLINE', notes }
    }

    // Refer cases
    if (creditScore < 650 || riskGrade === 'E') {
      notes.push('Credit profile requires manual review')
      notes.push('Additional income verification recommended')
      return { recommendation: 'REFER', notes }
    }

    // Approve with conditions
    if (creditScore < 700 || foir > 0.5) {
      notes.push('Approved subject to conditions')

      if (foir > 0.5) {
        conditions.push('Close at least one existing loan')
      }
      if (creditScore < 700) {
        conditions.push('Provide additional income proof')
      }
      if (!request.customer_pan) {
        conditions.push('Submit PAN card for verification')
      }

      return { recommendation: 'APPROVE_WITH_CONDITIONS', notes, conditions }
    }

    // Clean approval
    notes.push('Strong credit profile')
    notes.push('Recommended for expedited processing')

    return { recommendation: 'APPROVE', notes }
  }

  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}
