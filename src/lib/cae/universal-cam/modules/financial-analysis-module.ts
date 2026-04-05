/**
 * Financial Analysis Module
 * Analyzes bank statements to build comprehensive financial profile
 */

import type { FinancialAnalysis } from '../types'

interface BankStatementData {
  bank_name?: string
  account_number?: string
  account_type?: 'SAVINGS' | 'CURRENT' | 'SALARY'
  account_opening_date?: string

  // Statement period
  from_date: string
  to_date: string

  // Transactions
  transactions?: BankTransaction[]

  // Pre-computed summaries (if available from API)
  summary?: BankStatementSummary
}

interface BankTransaction {
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  balance: number
  category?: string
  mode?: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CHEQUE' | 'CASH' | 'ATM' | 'AUTO_DEBIT' | 'OTHER'
}

interface BankStatementSummary {
  opening_balance?: number
  closing_balance?: number
  total_credits?: number
  total_debits?: number
  credit_count?: number
  debit_count?: number
  average_balance?: number
  minimum_balance?: number
  maximum_balance?: number
}

// Transaction category patterns
const SALARY_PATTERNS = [
  /salary/i, /payroll/i, /sal\s*cr/i, /monthly.*pay/i, /wage/i, /stipend/i,
  /neft.*employer/i, /rtgs.*employer/i, /salary.*credit/i
]

const EMI_PATTERNS = [
  /emi/i, /loan.*debit/i, /nach/i, /acs.*mandate/i, /auto.*debit/i,
  /home.*loan/i, /car.*loan/i, /personal.*loan/i, /hdfc.*loan/i, /sbi.*loan/i,
  /icici.*loan/i, /axis.*loan/i, /bajaj.*emi/i
]

const BOUNCE_PATTERNS = [
  /bounce/i, /dishon/i, /returned/i, /unpaid/i, /insufficient/i,
  /charges.*bounce/i, /penalty.*cheque/i, /ecs.*return/i, /nach.*return/i
]

const CASH_PATTERNS = [
  /cash.*withdraw/i, /atm/i, /cwd/i, /cash.*dep/i, /self/i
]

export class FinancialAnalysisModule {
  /**
   * Build financial analysis from bank statement data
   */
  build(bankStatementData?: BankStatementData): FinancialAnalysis {
    if (!bankStatementData) {
      return this.buildEmptyAnalysis()
    }

    const transactions = bankStatementData.transactions || []
    const summary = bankStatementData.summary

    // Calculate analysis period
    const fromDate = new Date(bankStatementData.from_date)
    const toDate = new Date(bankStatementData.to_date)
    const analysisMonths = Math.max(1, this.monthsBetween(fromDate, toDate))

    // Calculate account vintage
    const accountVintageMonths = bankStatementData.account_opening_date
      ? this.monthsBetween(new Date(bankStatementData.account_opening_date), new Date())
      : 0

    // Categorize and analyze transactions
    const credits = transactions.filter(t => t.type === 'CREDIT')
    const debits = transactions.filter(t => t.type === 'DEBIT')

    const totalCredits = summary?.total_credits || credits.reduce((sum, t) => sum + t.amount, 0)
    const totalDebits = summary?.total_debits || debits.reduce((sum, t) => sum + t.amount, 0)

    // Balance analysis
    const balanceAnalysis = this.analyzeBalances(transactions, summary, analysisMonths)

    // Salary analysis
    const salaryAnalysis = this.analyzeSalaryCredits(credits, analysisMonths)

    // EMI/Loan outflows
    const emiAnalysis = this.analyzeEMIOutflows(debits, analysisMonths)

    // Bounce analysis
    const bounceAnalysis = this.analyzeBounces(transactions, analysisMonths)

    // Cash withdrawal analysis
    const cashAnalysis = this.analyzeCashWithdrawals(debits, totalDebits)

    // High value transactions
    const highValueCount = transactions.filter(t => t.amount >= 100000).length
    const suspiciousCount = this.countSuspiciousTransactions(transactions)

    // Calculate scores
    const bankingHabitsScore = this.calculateBankingHabitsScore(
      balanceAnalysis,
      salaryAnalysis,
      bounceAnalysis,
      cashAnalysis
    )

    const cashFlowScore = this.calculateCashFlowScore(
      totalCredits,
      totalDebits,
      balanceAnalysis,
      analysisMonths
    )

    return {
      bank_name: bankStatementData.bank_name || 'Unknown',
      account_number_masked: this.maskAccountNumber(bankStatementData.account_number),
      account_type: bankStatementData.account_type || 'SAVINGS',
      account_vintage_months: accountVintageMonths,

      analysis_period_from: bankStatementData.from_date,
      analysis_period_to: bankStatementData.to_date,
      analysis_months: analysisMonths,

      average_monthly_balance: balanceAnalysis.averageMonthlyBalance,
      minimum_balance: balanceAnalysis.minimumBalance,
      maximum_balance: balanceAnalysis.maximumBalance,
      month_end_balances: balanceAnalysis.monthEndBalances,

      total_credits: totalCredits,
      total_debits: totalDebits,
      average_monthly_inflows: totalCredits / analysisMonths,
      average_monthly_outflows: totalDebits / analysisMonths,
      net_monthly_surplus: (totalCredits - totalDebits) / analysisMonths,

      salary_credits_detected: salaryAnalysis.creditsDetected,
      salary_regularity_score: salaryAnalysis.regularityScore,
      salary_employer_name: salaryAnalysis.employerName,
      average_salary_credit: salaryAnalysis.averageSalary,

      emi_outflows_detected: emiAnalysis.count,
      total_emi_outflow: emiAnalysis.totalAmount,

      cheque_bounces: bounceAnalysis.chequeBounces,
      emi_bounces: bounceAnalysis.emiBounces,
      nach_bounces: bounceAnalysis.nachBounces,
      total_bounces: bounceAnalysis.total,
      bounce_ratio: bounceAnalysis.ratio,

      cash_withdrawals: cashAnalysis.count,
      cash_withdrawal_ratio: cashAnalysis.ratio,
      high_value_transactions: highValueCount,
      suspicious_transactions: suspiciousCount,

      banking_habits_score: bankingHabitsScore,
      cash_flow_score: cashFlowScore,
    }
  }

  private buildEmptyAnalysis(): FinancialAnalysis {
    const today = new Date()
    const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)

    return {
      bank_name: 'Not Available',
      account_number_masked: 'XXXX-XXXX',
      account_type: 'SAVINGS',
      account_vintage_months: 0,

      analysis_period_from: threeMonthsAgo.toISOString().split('T')[0],
      analysis_period_to: today.toISOString().split('T')[0],
      analysis_months: 0,

      average_monthly_balance: 0,
      minimum_balance: 0,
      maximum_balance: 0,
      month_end_balances: [],

      total_credits: 0,
      total_debits: 0,
      average_monthly_inflows: 0,
      average_monthly_outflows: 0,
      net_monthly_surplus: 0,

      salary_credits_detected: 0,
      salary_regularity_score: 0,
      salary_employer_name: null,
      average_salary_credit: 0,

      emi_outflows_detected: 0,
      total_emi_outflow: 0,

      cheque_bounces: 0,
      emi_bounces: 0,
      nach_bounces: 0,
      total_bounces: 0,
      bounce_ratio: 0,

      cash_withdrawals: 0,
      cash_withdrawal_ratio: 0,
      high_value_transactions: 0,
      suspicious_transactions: 0,

      banking_habits_score: 0,
      cash_flow_score: 0,
    }
  }

  private monthsBetween(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30))
  }

  private maskAccountNumber(accountNumber?: string): string {
    if (!accountNumber) return 'XXXX-XXXX'
    const last4 = accountNumber.slice(-4)
    return `XXXX-${last4}`
  }

  private analyzeBalances(
    transactions: BankTransaction[],
    summary?: BankStatementSummary,
    analysisMonths?: number
  ): {
    averageMonthlyBalance: number
    minimumBalance: number
    maximumBalance: number
    monthEndBalances: number[]
  } {
    if (summary?.average_balance !== undefined) {
      return {
        averageMonthlyBalance: summary.average_balance,
        minimumBalance: summary.minimum_balance || 0,
        maximumBalance: summary.maximum_balance || 0,
        monthEndBalances: [],
      }
    }

    if (transactions.length === 0) {
      return {
        averageMonthlyBalance: 0,
        minimumBalance: 0,
        maximumBalance: 0,
        monthEndBalances: [],
      }
    }

    const balances = transactions.map(t => t.balance)
    const averageBalance = balances.reduce((a, b) => a + b, 0) / balances.length
    const minBalance = Math.min(...balances)
    const maxBalance = Math.max(...balances)

    // Calculate month-end balances
    const monthEndBalances: number[] = []
    const sortedTxns = [...transactions].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const months = analysisMonths || 6
    for (let i = 0; i < months; i++) {
      const targetDate = new Date()
      targetDate.setMonth(targetDate.getMonth() - i)
      targetDate.setDate(1) // Start of month

      const monthTxns = sortedTxns.filter(t => {
        const txnDate = new Date(t.date)
        return txnDate.getMonth() === targetDate.getMonth() &&
               txnDate.getFullYear() === targetDate.getFullYear()
      })

      if (monthTxns.length > 0) {
        monthEndBalances.push(monthTxns[0].balance)
      }
    }

    return {
      averageMonthlyBalance: averageBalance,
      minimumBalance: minBalance,
      maximumBalance: maxBalance,
      monthEndBalances,
    }
  }

  private analyzeSalaryCredits(
    credits: BankTransaction[],
    analysisMonths: number
  ): {
    creditsDetected: number
    regularityScore: number
    employerName: string | null
    averageSalary: number
  } {
    // Find salary credits
    const salaryCredits = credits.filter(t =>
      SALARY_PATTERNS.some(p => p.test(t.description))
    )

    if (salaryCredits.length === 0) {
      // Try to identify regular monthly credits as potential salary
      const regularCredits = this.findRegularMonthlyCredits(credits, analysisMonths)
      if (regularCredits.length > 0) {
        const avgAmount = regularCredits.reduce((s, t) => s + t.amount, 0) / regularCredits.length
        return {
          creditsDetected: regularCredits.length,
          regularityScore: Math.min(100, (regularCredits.length / analysisMonths) * 100),
          employerName: null,
          averageSalary: avgAmount,
        }
      }

      return {
        creditsDetected: 0,
        regularityScore: 0,
        employerName: null,
        averageSalary: 0,
      }
    }

    const avgSalary = salaryCredits.reduce((s, t) => s + t.amount, 0) / salaryCredits.length

    // Extract employer name from description
    const employerName = this.extractEmployerName(salaryCredits[0].description)

    // Calculate regularity (expected monthly, so compare against analysis months)
    const regularityScore = Math.min(100, (salaryCredits.length / analysisMonths) * 100)

    return {
      creditsDetected: salaryCredits.length,
      regularityScore,
      employerName,
      averageSalary: avgSalary,
    }
  }

  private findRegularMonthlyCredits(credits: BankTransaction[], analysisMonths: number): BankTransaction[] {
    // Group credits by approximate amount (within 20% variance)
    const amountGroups: Map<number, BankTransaction[]> = new Map()

    credits.forEach(t => {
      let matched = false
      for (const [baseAmount, txns] of amountGroups) {
        if (Math.abs(t.amount - baseAmount) / baseAmount <= 0.2) {
          txns.push(t)
          matched = true
          break
        }
      }
      if (!matched) {
        amountGroups.set(t.amount, [t])
      }
    })

    // Find groups that appear monthly
    for (const [, txns] of amountGroups) {
      if (txns.length >= analysisMonths * 0.8) { // At least 80% of months
        return txns
      }
    }

    return []
  }

  private extractEmployerName(description: string): string | null {
    // Common patterns for employer names in bank statements
    const patterns = [
      /NEFT[\/\-\s]+([A-Z\s]+?)(?:\s+SAL|\s+SALARY|$)/i,
      /RTGS[\/\-\s]+([A-Z\s]+?)(?:\s+SAL|\s+SALARY|$)/i,
      /IMPS[\/\-\s]+([A-Z\s]+?)(?:\s+SAL|\s+SALARY|$)/i,
      /SAL(?:ARY)?[\/\-\s]+([A-Z\s]+)/i,
      /FROM\s+([A-Z\s]+?)(?:\s+SAL|\s+PAY|$)/i,
    ]

    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match && match[1]) {
        const employer = match[1].trim()
        if (employer.length >= 3) {
          return employer
        }
      }
    }

    return null
  }

  private analyzeEMIOutflows(debits: BankTransaction[], analysisMonths: number): {
    count: number
    totalAmount: number
  } {
    const emiDebits = debits.filter(t =>
      EMI_PATTERNS.some(p => p.test(t.description))
    )

    return {
      count: emiDebits.length,
      totalAmount: emiDebits.reduce((sum, t) => sum + t.amount, 0),
    }
  }

  private analyzeBounces(transactions: BankTransaction[], analysisMonths: number): {
    chequeBounces: number
    emiBounces: number
    nachBounces: number
    total: number
    ratio: number
  } {
    const bounces = transactions.filter(t =>
      BOUNCE_PATTERNS.some(p => p.test(t.description))
    )

    const chequeBounces = bounces.filter(t =>
      /cheque|chq/i.test(t.description)
    ).length

    const emiBounces = bounces.filter(t =>
      /emi|loan/i.test(t.description)
    ).length

    const nachBounces = bounces.filter(t =>
      /nach|ecs|acs|mandate/i.test(t.description)
    ).length

    const totalDebits = transactions.filter(t => t.type === 'DEBIT').length

    return {
      chequeBounces,
      emiBounces,
      nachBounces,
      total: bounces.length,
      ratio: totalDebits > 0 ? (bounces.length / totalDebits) * 100 : 0,
    }
  }

  private analyzeCashWithdrawals(debits: BankTransaction[], totalDebits: number): {
    count: number
    ratio: number
  } {
    const cashWithdrawals = debits.filter(t =>
      CASH_PATTERNS.some(p => p.test(t.description)) || t.mode === 'ATM' || t.mode === 'CASH'
    )

    const cashTotal = cashWithdrawals.reduce((sum, t) => sum + t.amount, 0)

    return {
      count: cashWithdrawals.length,
      ratio: totalDebits > 0 ? (cashTotal / totalDebits) * 100 : 0,
    }
  }

  private countSuspiciousTransactions(transactions: BankTransaction[]): number {
    // Suspicious patterns:
    // 1. Round figures > 1 lakh (potential cash deposits)
    // 2. Multiple same-day high-value transactions
    // 3. Transactions with suspicious descriptions

    let count = 0

    // Round figure cash deposits
    const roundFigureDeposits = transactions.filter(t =>
      t.type === 'CREDIT' &&
      t.amount >= 100000 &&
      t.amount % 10000 === 0 &&
      (t.mode === 'CASH' || /cash/i.test(t.description))
    )
    count += roundFigureDeposits.length

    // Multiple high-value same-day transactions
    const txnsByDate: Map<string, BankTransaction[]> = new Map()
    transactions.forEach(t => {
      const date = t.date.split('T')[0]
      if (!txnsByDate.has(date)) txnsByDate.set(date, [])
      txnsByDate.get(date)!.push(t)
    })

    for (const [, dateTxns] of txnsByDate) {
      const highValueTxns = dateTxns.filter(t => t.amount >= 200000)
      if (highValueTxns.length >= 3) count++
    }

    return count
  }

  private calculateBankingHabitsScore(
    balanceAnalysis: { averageMonthlyBalance: number; minimumBalance: number },
    salaryAnalysis: { regularityScore: number },
    bounceAnalysis: { total: number; ratio: number },
    cashAnalysis: { ratio: number }
  ): number {
    let score = 50 // Base score

    // Average balance contribution (+20 max)
    if (balanceAnalysis.averageMonthlyBalance >= 100000) score += 20
    else if (balanceAnalysis.averageMonthlyBalance >= 50000) score += 15
    else if (balanceAnalysis.averageMonthlyBalance >= 25000) score += 10
    else if (balanceAnalysis.averageMonthlyBalance >= 10000) score += 5

    // Minimum balance (no negative balances) (+10 max)
    if (balanceAnalysis.minimumBalance > 0) score += 10
    else score -= 10

    // Salary regularity (+15 max)
    score += Math.floor(salaryAnalysis.regularityScore / 100 * 15)

    // Bounce penalty (-20 max)
    if (bounceAnalysis.total > 0) {
      score -= Math.min(20, bounceAnalysis.total * 5)
    }

    // Cash withdrawal ratio penalty (-10 max)
    if (cashAnalysis.ratio > 50) score -= 10
    else if (cashAnalysis.ratio > 30) score -= 5

    return Math.min(100, Math.max(0, score))
  }

  private calculateCashFlowScore(
    totalCredits: number,
    totalDebits: number,
    balanceAnalysis: { averageMonthlyBalance: number },
    analysisMonths: number
  ): number {
    let score = 50 // Base score

    // Net surplus
    const netSurplus = totalCredits - totalDebits
    const monthlySurplus = netSurplus / Math.max(1, analysisMonths)

    if (monthlySurplus > 50000) score += 25
    else if (monthlySurplus > 25000) score += 20
    else if (monthlySurplus > 10000) score += 15
    else if (monthlySurplus > 0) score += 10
    else if (monthlySurplus > -10000) score -= 5
    else score -= 15

    // Healthy ratio (credits should be more than debits)
    const ratio = totalDebits > 0 ? totalCredits / totalDebits : 2
    if (ratio >= 1.3) score += 15
    else if (ratio >= 1.1) score += 10
    else if (ratio >= 1.0) score += 5
    else score -= 10

    // Good average balance
    if (balanceAnalysis.averageMonthlyBalance >= 50000) score += 10
    else if (balanceAnalysis.averageMonthlyBalance >= 25000) score += 5

    return Math.min(100, Math.max(0, score))
  }

  /**
   * Calculate income risk indicators from financial analysis
   */
  calculateIncomeRiskIndicators(analysis: FinancialAnalysis): {
    score: number
    level: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    factors: string[]
  } {
    let riskScore = 50 // Base score
    const factors: string[] = []

    // Salary regularity
    if (analysis.salary_regularity_score >= 90) {
      riskScore -= 15
      factors.push('Highly regular salary credits')
    } else if (analysis.salary_regularity_score >= 70) {
      riskScore -= 5
      factors.push('Regular salary credits')
    } else if (analysis.salary_regularity_score < 50) {
      riskScore += 15
      factors.push('Irregular salary credits')
    }

    // Bounce impact
    if (analysis.total_bounces >= 5) {
      riskScore += 25
      factors.push('Multiple bounces detected')
    } else if (analysis.total_bounces >= 2) {
      riskScore += 15
      factors.push('Some bounces detected')
    } else if (analysis.total_bounces === 0) {
      riskScore -= 10
      factors.push('No bounces')
    }

    // Cash flow
    if (analysis.net_monthly_surplus > 25000) {
      riskScore -= 10
      factors.push('Healthy monthly surplus')
    } else if (analysis.net_monthly_surplus < 0) {
      riskScore += 15
      factors.push('Negative cash flow')
    }

    // Cash withdrawal ratio
    if (analysis.cash_withdrawal_ratio > 50) {
      riskScore += 15
      factors.push('High cash withdrawals')
    }

    // Suspicious transactions
    if (analysis.suspicious_transactions > 0) {
      riskScore += 10
      factors.push('Suspicious transactions detected')
    }

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

export const financialAnalysisModule = new FinancialAnalysisModule()
