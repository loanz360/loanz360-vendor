/**
 * Bank Statement Analysis Adapter
 * Integrates with Perfios/FinBox for automated bank statement analysis
 * Supports cash flow analysis, income verification, and financial health assessment
 */

import { CAEProviderConfig } from '../types'

export interface BankStatementConfig extends CAEProviderConfig {
  config?: {
    client_id?: string
    client_secret?: string
    webhook_url?: string
    environment?: 'sandbox' | 'production'
  }
}

export interface BankStatementUploadRequest {
  statement_file_url?: string
  statement_file_base64?: string
  file_password?: string
  bank_name?: string
  account_number?: string
  account_holder_name?: string
  statement_period_months?: number // Default 6
}

export interface TransactionCategory {
  category: string
  total_credit: number
  total_debit: number
  transaction_count: number
}

export interface SalaryCredit {
  date: string
  amount: number
  employer_name?: string
  reference?: string
}

export interface BounceTransaction {
  date: string
  amount: number
  type: 'CHEQUE_BOUNCE' | 'EMI_BOUNCE' | 'NACH_BOUNCE' | 'OTHER'
  reference?: string
}

export interface BankStatementAnalysisResult {
  success: boolean
  request_id: string
  processing_time_ms: number
  data?: {
    // Account Details
    account_holder_name: string
    account_number_masked: string
    bank_name: string
    account_type: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'NRE' | 'NRO'
    ifsc_code?: string

    // Analysis Period
    analysis_period: {
      from_date: string
      to_date: string
      months_analyzed: number
    }

    // Balance Summary
    balance_summary: {
      opening_balance: number
      closing_balance: number
      average_monthly_balance: number
      minimum_balance: number
      maximum_balance: number
      average_eod_balance: number // End of Day
    }

    // Transaction Summary
    transaction_summary: {
      total_credits: number
      total_debits: number
      total_credit_count: number
      total_debit_count: number
      average_monthly_credits: number
      average_monthly_debits: number
      net_monthly_flow: number
    }

    // Income Analysis
    income_analysis: {
      salary_credits: SalaryCredit[]
      average_monthly_salary: number
      salary_regularity_score: number // 0-100
      other_regular_credits: number
      irregular_credits: number
      estimated_monthly_income: number
    }

    // Expense Analysis
    expense_analysis: {
      emi_payments: number
      utility_payments: number
      rent_payments: number
      insurance_payments: number
      investment_debits: number
      cash_withdrawals: number
      other_expenses: number
    }

    // EMI & Obligations
    obligations: {
      existing_emi_count: number
      total_emi_amount: number
      emi_details: Array<{
        lender_name?: string
        emi_amount: number
        emi_date?: number // Day of month
        loan_type?: string
      }>
      nach_mandates_active: number
    }

    // Risk Indicators
    risk_indicators: {
      bounce_count: number
      bounce_details: BounceTransaction[]
      inward_return_count: number
      negative_balance_days: number
      low_balance_alerts: number // Days below minimum balance
      high_value_cash_deposits: number
      suspicious_transactions: number
    }

    // Category Breakdown
    category_breakdown: TransactionCategory[]

    // Financial Health Score
    financial_health: {
      score: number // 0-100
      grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'VERY_POOR'
      factors: {
        balance_stability: number
        income_regularity: number
        expense_discipline: number
        savings_ratio: number
        debt_service_ratio: number
      }
    }

    // Fraud Indicators
    fraud_indicators: {
      circular_transactions: boolean
      round_figure_deposits: number
      same_day_credit_debit: number
      account_dormancy_periods: number
    }
  }
  error?: {
    code: string
    message: string
  }
}

export class BankStatementAdapter {
  private config: BankStatementConfig
  private readonly PERFIOS_SANDBOX_URL = 'https://sandbox.perfios.com/api/v3'
  private readonly PERFIOS_PRODUCTION_URL = 'https://api.perfios.com/v3'
  private readonly FINBOX_SANDBOX_URL = 'https://sandbox.finbox.in/api/v1'
  private readonly FINBOX_PRODUCTION_URL = 'https://api.finbox.in/v1'

  constructor(config: BankStatementConfig) {
    this.config = config
  }

  /**
   * Upload and analyze bank statement
   */
  async analyzeStatement(request: BankStatementUploadRequest): Promise<BankStatementAnalysisResult> {
    const startTime = Date.now()
    const requestId = `BSA_${Date.now()}_${Math.random().toString(36).substring(7)}`

    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockAnalysisResult(request, requestId, startTime)
      }

      // Production: Call Perfios API
      const response = await fetch(`${this.getBaseUrl()}/statement/upload`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          file_url: request.statement_file_url,
          file_base64: request.statement_file_base64,
          password: request.file_password,
          bank_name: request.bank_name,
          account_number: request.account_number,
          period_months: request.statement_period_months || 6
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 60000)
      })

      if (!response.ok) {
        throw new Error(`Bank Statement API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseAnalysisResponse(result, requestId, startTime)
    } catch (error) {
      return {
        success: false,
        request_id: requestId,
        processing_time_ms: Date.now() - startTime,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Bank statement analysis failed'
        }
      }
    }
  }

  /**
   * Get analysis status for async processing
   */
  async getAnalysisStatus(requestId: string): Promise<BankStatementAnalysisResult> {
    const startTime = Date.now()

    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockAnalysisResult({}, requestId, startTime)
      }

      const response = await fetch(`${this.getBaseUrl()}/statement/status/${requestId}`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        request_id: requestId,
        processing_time_ms: Date.now() - startTime,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get analysis status'
        }
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    const start = Date.now()
    try {
      const response = await fetch(`${this.getBaseUrl()}/health`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(5000)
      })

      return {
        healthy: response.ok,
        latency_ms: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`
      }
    } catch (error) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  }

  private getBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    // Default to Perfios, can be switched to FinBox based on config
    return environment === 'production' ? this.PERFIOS_PRODUCTION_URL : this.PERFIOS_SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.api_key || ''}`,
      'X-Client-Id': this.config.config?.client_id || ''
    }
  }

  private getMockAnalysisResult(
    request: BankStatementUploadRequest,
    requestId: string,
    startTime: number
  ): BankStatementAnalysisResult {
    // Generate realistic mock data
    const avgMonthlyIncome = 50000 + Math.floor(Math.random() * 100000)
    const avgMonthlyExpense = avgMonthlyIncome * (0.6 + Math.random() * 0.25)
    const existingEMI = Math.floor(Math.random() * 3)
    const totalEMI = existingEMI * (5000 + Math.floor(Math.random() * 15000))
    const bounceCount = Math.floor(Math.random() * 3)

    // Calculate financial health score
    const savingsRatio = (avgMonthlyIncome - avgMonthlyExpense) / avgMonthlyIncome
    const debtRatio = totalEMI / avgMonthlyIncome
    const healthScore = Math.min(100, Math.max(0,
      70 + (savingsRatio * 20) - (debtRatio * 30) - (bounceCount * 10)
    ))

    const getGrade = (score: number): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'VERY_POOR' => {
      if (score >= 80) return 'EXCELLENT'
      if (score >= 65) return 'GOOD'
      if (score >= 50) return 'FAIR'
      if (score >= 35) return 'POOR'
      return 'VERY_POOR'
    }

    return {
      success: true,
      request_id: requestId,
      processing_time_ms: Date.now() - startTime,
      data: {
        account_holder_name: request.account_holder_name || 'TEST USER',
        account_number_masked: 'XXXX' + (request.account_number?.slice(-4) || '1234'),
        bank_name: request.bank_name || 'HDFC Bank',
        account_type: 'SAVINGS',
        ifsc_code: 'HDFC0001234',

        analysis_period: {
          from_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to_date: new Date().toISOString().split('T')[0],
          months_analyzed: request.statement_period_months || 6
        },

        balance_summary: {
          opening_balance: avgMonthlyIncome * 0.5,
          closing_balance: avgMonthlyIncome * 0.8,
          average_monthly_balance: avgMonthlyIncome * 0.6,
          minimum_balance: avgMonthlyIncome * 0.1,
          maximum_balance: avgMonthlyIncome * 1.5,
          average_eod_balance: avgMonthlyIncome * 0.55
        },

        transaction_summary: {
          total_credits: avgMonthlyIncome * 6,
          total_debits: avgMonthlyExpense * 6,
          total_credit_count: 15 + Math.floor(Math.random() * 30),
          total_debit_count: 40 + Math.floor(Math.random() * 60),
          average_monthly_credits: avgMonthlyIncome,
          average_monthly_debits: avgMonthlyExpense,
          net_monthly_flow: avgMonthlyIncome - avgMonthlyExpense
        },

        income_analysis: {
          salary_credits: [
            { date: '2026-01-01', amount: avgMonthlyIncome, employer_name: 'EMPLOYER PVT LTD' },
            { date: '2025-12-01', amount: avgMonthlyIncome * 0.98, employer_name: 'EMPLOYER PVT LTD' },
            { date: '2025-11-01', amount: avgMonthlyIncome * 1.02, employer_name: 'EMPLOYER PVT LTD' }
          ],
          average_monthly_salary: avgMonthlyIncome,
          salary_regularity_score: 85 + Math.floor(Math.random() * 15),
          other_regular_credits: avgMonthlyIncome * 0.1,
          irregular_credits: avgMonthlyIncome * 0.05,
          estimated_monthly_income: avgMonthlyIncome * 1.1
        },

        expense_analysis: {
          emi_payments: totalEMI,
          utility_payments: 3000 + Math.floor(Math.random() * 5000),
          rent_payments: avgMonthlyIncome * 0.2,
          insurance_payments: 2000 + Math.floor(Math.random() * 3000),
          investment_debits: avgMonthlyIncome * 0.1,
          cash_withdrawals: avgMonthlyIncome * 0.15,
          other_expenses: avgMonthlyExpense * 0.3
        },

        obligations: {
          existing_emi_count: existingEMI,
          total_emi_amount: totalEMI,
          emi_details: existingEMI > 0 ? [
            { lender_name: 'HDFC Bank', emi_amount: totalEMI / existingEMI, emi_date: 5, loan_type: 'Personal Loan' }
          ] : [],
          nach_mandates_active: existingEMI
        },

        risk_indicators: {
          bounce_count: bounceCount,
          bounce_details: bounceCount > 0 ? [
            { date: '2025-12-15', amount: 5000, type: 'CHEQUE_BOUNCE' as const }
          ] : [],
          inward_return_count: Math.floor(Math.random() * 2),
          negative_balance_days: Math.floor(Math.random() * 5),
          low_balance_alerts: Math.floor(Math.random() * 10),
          high_value_cash_deposits: Math.floor(Math.random() * 2),
          suspicious_transactions: 0
        },

        category_breakdown: [
          { category: 'SALARY', total_credit: avgMonthlyIncome * 6, total_debit: 0, transaction_count: 6 },
          { category: 'UTILITIES', total_credit: 0, total_debit: 20000, transaction_count: 18 },
          { category: 'EMI', total_credit: 0, total_debit: totalEMI * 6, transaction_count: existingEMI * 6 },
          { category: 'SHOPPING', total_credit: 0, total_debit: avgMonthlyExpense * 2, transaction_count: 30 },
          { category: 'TRANSFER', total_credit: avgMonthlyIncome * 0.5, total_debit: avgMonthlyIncome * 0.3, transaction_count: 20 }
        ],

        financial_health: {
          score: Math.round(healthScore),
          grade: getGrade(healthScore),
          factors: {
            balance_stability: 70 + Math.floor(Math.random() * 25),
            income_regularity: 80 + Math.floor(Math.random() * 20),
            expense_discipline: 60 + Math.floor(Math.random() * 30),
            savings_ratio: Math.round(savingsRatio * 100),
            debt_service_ratio: Math.round(debtRatio * 100)
          }
        },

        fraud_indicators: {
          circular_transactions: false,
          round_figure_deposits: Math.floor(Math.random() * 3),
          same_day_credit_debit: Math.floor(Math.random() * 5),
          account_dormancy_periods: 0
        }
      }
    }
  }

  private parseAnalysisResponse(
    response: any,
    requestId: string,
    startTime: number
  ): BankStatementAnalysisResult {
    if (response.error) {
      return {
        success: false,
        request_id: requestId,
        processing_time_ms: Date.now() - startTime,
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Analysis failed'
        }
      }
    }

    return {
      success: true,
      request_id: requestId,
      processing_time_ms: Date.now() - startTime,
      data: response.data
    }
  }
}

/**
 * Factory function to create Bank Statement adapter
 */
export function createBankStatementAdapter(config: BankStatementConfig): BankStatementAdapter {
  return new BankStatementAdapter(config)
}
