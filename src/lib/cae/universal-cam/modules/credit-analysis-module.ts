/**
 * Credit Analysis Module
 * Analyzes credit bureau data to build comprehensive credit profile
 */

import type { CreditAnalysis, ExistingLoan } from '../types'

interface CreditBureauData {
  score?: number
  source?: 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF'
  score_date?: string

  // Account summary
  accounts?: CreditAccount[]

  // Enquiries
  enquiries?: CreditEnquiry[]

  // Payment history
  payment_history?: PaymentHistoryRecord[]

  // Remarks
  remarks?: string[]
}

interface CreditAccount {
  account_number?: string
  account_type: string
  lender_name: string
  ownership: 'INDIVIDUAL' | 'JOINT' | 'GUARANTOR'
  status: 'ACTIVE' | 'CLOSED' | 'WRITTEN_OFF' | 'SETTLED' | 'OVERDUE'
  sanctioned_amount: number
  current_balance: number
  emi_amount?: number
  tenure_months?: number
  remaining_tenure_months?: number
  disbursement_date?: string
  closure_date?: string
  credit_limit?: number // For credit cards
  highest_balance?: number
  overdue_amount?: number
  dpd?: number // Days Past Due
  payment_status?: 'REGULAR' | 'IRREGULAR' | 'DEFAULT'
  write_off_amount?: number
  settlement_amount?: number
}

interface CreditEnquiry {
  date: string
  enquiry_type: string
  lender_name: string
  amount?: number
}

interface PaymentHistoryRecord {
  month: string
  dpd: number // Days Past Due (0 = on time)
  status: 'STANDARD' | 'SUB_STANDARD' | 'DOUBTFUL' | 'LOSS' | 'WRITTEN_OFF'
}

export class CreditAnalysisModule {
  /**
   * Build credit analysis from credit bureau data
   */
  build(creditBureauData?: CreditBureauData): CreditAnalysis {
    if (!creditBureauData) {
      return this.buildEmptyAnalysis()
    }

    const accounts = creditBureauData.accounts || []

    // Categorize accounts
    const activeAccounts = accounts.filter(a => a.status === 'ACTIVE')
    const closedAccounts = accounts.filter(a => a.status === 'CLOSED')
    const writtenOffAccounts = accounts.filter(a => a.status === 'WRITTEN_OFF')
    const settledAccounts = accounts.filter(a => a.status === 'SETTLED')
    const overdueAccounts = accounts.filter(a => a.status === 'OVERDUE' || (a.dpd && a.dpd > 0))

    // Build existing loans list
    const existingLoans = this.buildExistingLoans(accounts)

    // Calculate totals
    const totalOutstanding = activeAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)
    const totalMonthlyEMI = activeAccounts.reduce((sum, a) => sum + (a.emi_amount || 0), 0)

    // Analyze payment history
    const paymentAnalysis = this.analyzePaymentHistory(creditBureauData.payment_history)

    // Credit card analysis
    const creditCardAnalysis = this.analyzeCreditCards(accounts)

    // Enquiry analysis
    const enquiryAnalysis = this.analyzeEnquiries(creditBureauData.enquiries)

    // Analyze remarks
    const negativeRemarks = this.extractNegativeRemarks(creditBureauData.remarks, accounts)

    // Determine credit grade
    const creditGrade = this.determineCreditGrade(creditBureauData.score)

    return {
      credit_score: creditBureauData.score || null,
      credit_score_source: creditBureauData.source || null,
      credit_score_date: creditBureauData.score_date || null,
      credit_grade: creditGrade,

      total_accounts: accounts.length,
      active_accounts: activeAccounts.length,
      closed_accounts: closedAccounts.length,
      written_off_accounts: writtenOffAccounts.length,
      settled_accounts: settledAccounts.length,
      overdue_accounts: overdueAccounts.length,

      existing_loans: existingLoans,
      total_outstanding: totalOutstanding,
      total_monthly_emi: totalMonthlyEMI,

      on_time_payment_percent: paymentAnalysis.onTimePercent,
      max_dpd_12_months: paymentAnalysis.maxDPD12,
      max_dpd_24_months: paymentAnalysis.maxDPD24,
      delinquency_count: paymentAnalysis.delinquencyCount,

      total_credit_limit: creditCardAnalysis.totalLimit,
      total_credit_used: creditCardAnalysis.totalUsed,
      credit_utilization_percent: creditCardAnalysis.utilizationPercent,

      enquiries_last_30_days: enquiryAnalysis.last30Days,
      enquiries_last_90_days: enquiryAnalysis.last90Days,
      enquiries_last_6_months: enquiryAnalysis.last6Months,
      enquiries_last_12_months: enquiryAnalysis.last12Months,

      negative_remarks: negativeRemarks,
      has_defaults: writtenOffAccounts.length > 0 || paymentAnalysis.maxDPD24 >= 90,
      has_settlements: settledAccounts.length > 0,
      has_write_offs: writtenOffAccounts.length > 0,
    }
  }

  private buildEmptyAnalysis(): CreditAnalysis {
    return {
      credit_score: null,
      credit_score_source: null,
      credit_score_date: null,
      credit_grade: 'NTC', // New To Credit

      total_accounts: 0,
      active_accounts: 0,
      closed_accounts: 0,
      written_off_accounts: 0,
      settled_accounts: 0,
      overdue_accounts: 0,

      existing_loans: [],
      total_outstanding: 0,
      total_monthly_emi: 0,

      on_time_payment_percent: 100,
      max_dpd_12_months: 0,
      max_dpd_24_months: 0,
      delinquency_count: 0,

      total_credit_limit: 0,
      total_credit_used: 0,
      credit_utilization_percent: 0,

      enquiries_last_30_days: 0,
      enquiries_last_90_days: 0,
      enquiries_last_6_months: 0,
      enquiries_last_12_months: 0,

      negative_remarks: [],
      has_defaults: false,
      has_settlements: false,
      has_write_offs: false,
    }
  }

  private buildExistingLoans(accounts: CreditAccount[]): ExistingLoan[] {
    // Filter for loan accounts (not credit cards)
    const loanTypes = ['HOME_LOAN', 'PERSONAL_LOAN', 'AUTO_LOAN', 'CAR_LOAN', 'TWO_WHEELER', 'GOLD_LOAN',
      'EDUCATION_LOAN', 'BUSINESS_LOAN', 'LOAN_AGAINST_PROPERTY', 'CONSUMER_DURABLE', 'OVERDRAFT']

    return accounts
      .filter(a => {
        const accountType = a.account_type.toUpperCase().replace(/[\s-]+/g, '_')
        return loanTypes.some(lt => accountType.includes(lt) ||
          accountType.includes('LOAN') ||
          accountType.includes('CREDIT_FACILITY') ||
          accountType.includes('OVERDRAFT'))
      })
      .map(a => this.mapToExistingLoan(a))
  }

  private mapToExistingLoan(account: CreditAccount): ExistingLoan {
    return {
      loan_type: this.normalizeLoanType(account.account_type),
      lender_name: account.lender_name,
      sanctioned_amount: account.sanctioned_amount,
      outstanding_amount: account.current_balance,
      emi_amount: account.emi_amount || 0,
      tenure_months: account.tenure_months || 0,
      remaining_tenure: account.remaining_tenure_months || 0,
      disbursement_date: account.disbursement_date || null,
      status: this.mapAccountStatus(account.status),
      payment_status: account.payment_status || 'REGULAR',
    }
  }

  private normalizeLoanType(type: string): string {
    const normalized = type.toUpperCase().replace(/[\s-]+/g, '_')

    if (normalized.includes('HOME')) return 'Home Loan'
    if (normalized.includes('PERSONAL')) return 'Personal Loan'
    if (normalized.includes('AUTO') || normalized.includes('CAR') || normalized.includes('VEHICLE')) return 'Auto Loan'
    if (normalized.includes('TWO_WHEELER') || normalized.includes('BIKE')) return 'Two Wheeler Loan'
    if (normalized.includes('GOLD')) return 'Gold Loan'
    if (normalized.includes('EDUCATION') || normalized.includes('STUDENT')) return 'Education Loan'
    if (normalized.includes('BUSINESS') || normalized.includes('SME')) return 'Business Loan'
    if (normalized.includes('LAP') || normalized.includes('PROPERTY')) return 'Loan Against Property'
    if (normalized.includes('CONSUMER') || normalized.includes('DURABLE')) return 'Consumer Durable Loan'
    if (normalized.includes('OVERDRAFT') || normalized.includes('OD')) return 'Overdraft'
    if (normalized.includes('CREDIT_CARD') || normalized.includes('CC')) return 'Credit Card'

    return 'Other Loan'
  }

  private mapAccountStatus(status: CreditAccount['status']): ExistingLoan['status'] {
    switch (status) {
      case 'ACTIVE': return 'ACTIVE'
      case 'CLOSED': return 'CLOSED'
      case 'WRITTEN_OFF': return 'WRITTEN_OFF'
      case 'SETTLED': return 'SETTLED'
      case 'OVERDUE': return 'OVERDUE'
      default: return 'ACTIVE'
    }
  }

  private analyzePaymentHistory(history?: PaymentHistoryRecord[]): {
    onTimePercent: number
    maxDPD12: number
    maxDPD24: number
    delinquencyCount: number
  } {
    if (!history || history.length === 0) {
      return {
        onTimePercent: 100,
        maxDPD12: 0,
        maxDPD24: 0,
        delinquencyCount: 0,
      }
    }

    const sortedHistory = [...history].sort((a, b) =>
      new Date(b.month).getTime() - new Date(a.month).getTime()
    )

    const last12Months = sortedHistory.slice(0, 12)
    const last24Months = sortedHistory.slice(0, 24)

    const onTimePayments = last24Months.filter(p => p.dpd === 0 || p.status === 'STANDARD').length
    const onTimePercent = last24Months.length > 0
      ? Math.round((onTimePayments / last24Months.length) * 100)
      : 100

    const maxDPD12 = last12Months.reduce((max, p) => Math.max(max, p.dpd || 0), 0)
    const maxDPD24 = last24Months.reduce((max, p) => Math.max(max, p.dpd || 0), 0)

    const delinquencyCount = last24Months.filter(p => p.dpd > 30).length

    return {
      onTimePercent,
      maxDPD12,
      maxDPD24,
      delinquencyCount,
    }
  }

  private analyzeCreditCards(accounts: CreditAccount[]): {
    totalLimit: number
    totalUsed: number
    utilizationPercent: number
  } {
    const creditCards = accounts.filter(a => {
      const type = a.account_type.toUpperCase()
      return type.includes('CREDIT_CARD') || type.includes('CARD') || type.includes('REVOLVING')
    })

    if (creditCards.length === 0) {
      return { totalLimit: 0, totalUsed: 0, utilizationPercent: 0 }
    }

    const totalLimit = creditCards.reduce((sum, c) => sum + (c.credit_limit || c.sanctioned_amount || 0), 0)
    const totalUsed = creditCards.reduce((sum, c) => sum + (c.current_balance || 0), 0)
    const utilizationPercent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0

    return { totalLimit, totalUsed, utilizationPercent }
  }

  private analyzeEnquiries(enquiries?: CreditEnquiry[]): {
    last30Days: number
    last90Days: number
    last6Months: number
    last12Months: number
  } {
    if (!enquiries || enquiries.length === 0) {
      return { last30Days: 0, last90Days: 0, last6Months: 0, last12Months: 0 }
    }

    const now = new Date()
    const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const day90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const month6Ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
    const month12Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    return {
      last30Days: enquiries.filter(e => new Date(e.date) >= day30Ago).length,
      last90Days: enquiries.filter(e => new Date(e.date) >= day90Ago).length,
      last6Months: enquiries.filter(e => new Date(e.date) >= month6Ago).length,
      last12Months: enquiries.filter(e => new Date(e.date) >= month12Ago).length,
    }
  }

  private extractNegativeRemarks(remarks?: string[], accounts?: CreditAccount[]): string[] {
    const negativeRemarks: string[] = []

    // Check explicit remarks
    if (remarks) {
      const negativeKeywords = ['written off', 'settled', 'default', 'overdue', 'npa', 'wilful',
        'suit filed', 'legal', 'fraud', 'dishonour', 'bounce']

      remarks.forEach(remark => {
        const lower = remark.toLowerCase()
        if (negativeKeywords.some(k => lower.includes(k))) {
          negativeRemarks.push(remark)
        }
      })
    }

    // Check accounts for negative patterns
    if (accounts) {
      const writtenOff = accounts.filter(a => a.status === 'WRITTEN_OFF').length
      const settled = accounts.filter(a => a.status === 'SETTLED').length
      const overdue90Plus = accounts.filter(a => a.dpd && a.dpd >= 90).length

      if (writtenOff > 0) {
        negativeRemarks.push(`${writtenOff} account(s) written off`)
      }
      if (settled > 0) {
        negativeRemarks.push(`${settled} account(s) settled`)
      }
      if (overdue90Plus > 0) {
        negativeRemarks.push(`${overdue90Plus} account(s) with 90+ DPD`)
      }
    }

    return negativeRemarks
  }

  private determineCreditGrade(score?: number): CreditAnalysis['credit_grade'] {
    if (!score) return 'NTC' // New To Credit

    if (score >= 750) return 'A'
    if (score >= 700) return 'B'
    if (score >= 650) return 'C'
    if (score >= 550) return 'D'
    return 'E'
  }

  /**
   * Calculate risk indicators from credit analysis
   */
  calculateCreditRiskIndicators(analysis: CreditAnalysis): {
    score: number
    level: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    factors: string[]
  } {
    let riskScore = 50 // Base score
    const factors: string[] = []

    // Credit score impact
    if (analysis.credit_score) {
      if (analysis.credit_score >= 750) { riskScore -= 20; factors.push('Excellent credit score') }
      else if (analysis.credit_score >= 700) { riskScore -= 10; factors.push('Good credit score') }
      else if (analysis.credit_score >= 650) { riskScore += 0; factors.push('Fair credit score') }
      else if (analysis.credit_score >= 550) { riskScore += 15; factors.push('Below average credit score') }
      else { riskScore += 30; factors.push('Poor credit score') }
    } else {
      riskScore += 20
      factors.push('No credit history (NTC)')
    }

    // Delinquency impact
    if (analysis.max_dpd_24_months >= 90) { riskScore += 30; factors.push('Severe delinquency (90+ DPD)') }
    else if (analysis.max_dpd_24_months >= 60) { riskScore += 20; factors.push('Delinquency (60-89 DPD)') }
    else if (analysis.max_dpd_24_months >= 30) { riskScore += 10; factors.push('Minor delinquency (30-59 DPD)') }

    // Write-offs and settlements
    if (analysis.has_write_offs) { riskScore += 25; factors.push('Written off accounts') }
    if (analysis.has_settlements) { riskScore += 15; factors.push('Settled accounts') }

    // Credit utilization (for credit cards)
    if (analysis.credit_utilization_percent > 80) { riskScore += 15; factors.push('High credit utilization (>80%)') }
    else if (analysis.credit_utilization_percent > 50) { riskScore += 5; factors.push('Moderate credit utilization') }

    // Enquiry patterns
    if (analysis.enquiries_last_30_days >= 5) { riskScore += 15; factors.push('Multiple recent enquiries') }
    else if (analysis.enquiries_last_90_days >= 8) { riskScore += 10; factors.push('Multiple enquiries in last 3 months') }

    // Payment history
    if (analysis.on_time_payment_percent >= 95) { riskScore -= 10; factors.push('Excellent payment history') }
    else if (analysis.on_time_payment_percent < 80) { riskScore += 15; factors.push('Poor payment history') }

    // Normalize score
    riskScore = Math.min(100, Math.max(0, riskScore))

    // Determine level
    let level: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    if (riskScore <= 20) level = 'VERY_LOW'
    else if (riskScore <= 40) level = 'LOW'
    else if (riskScore <= 60) level = 'MEDIUM'
    else if (riskScore <= 80) level = 'HIGH'
    else level = 'VERY_HIGH'

    return { score: riskScore, level, factors }
  }
}

export const creditAnalysisModule = new CreditAnalysisModule()
