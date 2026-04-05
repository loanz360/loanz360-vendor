/**
 * Account Aggregator Adapter
 * Integrates with RBI-approved Account Aggregators (Setu, Finvu, OneMoney)
 * Enables consent-based financial data sharing as per RBI guidelines
 */

import { CAEProviderConfig } from '../types'

export interface AccountAggregatorConfig extends CAEProviderConfig {
  config?: {
    client_id?: string
    client_secret?: string
    fiu_id?: string // Financial Information User ID
    aa_id?: string // Account Aggregator ID (e.g., 'setu-aa', 'finvu-aa')
    redirect_url?: string
    webhook_url?: string
    environment?: 'sandbox' | 'production'
  }
}

export type ConsentPurpose =
  | 'LOAN_UNDERWRITING'
  | 'WEALTH_MANAGEMENT'
  | 'INSURANCE_UNDERWRITING'
  | 'ACCOUNT_VERIFICATION'
  | 'TAX_FILING'

export type FIType =
  | 'DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'TERM_DEPOSIT'
  | 'SIP'
  | 'MUTUAL_FUNDS'
  | 'INSURANCE_POLICIES'
  | 'EQUITIES'
  | 'BONDS'
  | 'DEBENTURES'
  | 'ETF'
  | 'NPS'
  | 'PPF'
  | 'EPF'
  | 'CREDIT_CARD'

export interface ConsentRequest {
  customer_id: string
  customer_mobile: string
  customer_name?: string
  purpose: ConsentPurpose
  fi_types: FIType[]
  data_range: {
    from: string // YYYY-MM-DD
    to: string
  }
  consent_duration_days?: number // How long consent is valid
  frequency?: {
    unit: 'HOUR' | 'DAY' | 'MONTH' | 'YEAR'
    value: number
  }
  data_life?: {
    unit: 'HOUR' | 'DAY' | 'MONTH' | 'YEAR'
    value: number
  }
}

export interface ConsentResponse {
  success: boolean
  consent_handle?: string
  consent_id?: string
  redirect_url?: string // URL for customer to approve consent
  status?: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED' | 'REJECTED'
  expires_at?: string
  error?: {
    code: string
    message: string
  }
}

export interface DataFetchRequest {
  consent_id: string
  session_id?: string
  fi_types?: FIType[]
  from_date?: string
  to_date?: string
}

export interface FinancialAccount {
  fi_type: FIType
  fip_id: string // Financial Information Provider ID (bank/institution)
  fip_name: string
  account_ref_number: string
  masked_account_number: string
  type: string // SAVINGS, CURRENT, etc.
  holder_name: string
  nominee?: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface DepositAccountData {
  account_type: 'SAVINGS' | 'CURRENT' | 'SALARY'
  current_balance: number
  available_balance: number
  currency: string
  facility?: string
  ifsc_code?: string
  branch?: string
  transactions: Array<{
    txn_id: string
    type: 'CREDIT' | 'DEBIT'
    mode: string
    amount: number
    balance: number
    transaction_date: string
    value_date: string
    narration: string
    reference?: string
  }>
  summary?: {
    opening_balance: number
    closing_balance: number
    total_credits: number
    total_debits: number
    credit_count: number
    debit_count: number
  }
}

export interface MutualFundData {
  folio_number: string
  amc: string
  scheme_name: string
  scheme_type: string
  isin?: string
  units: number
  nav: number
  current_value: number
  cost_value: number
  holdings: Array<{
    units: number
    nav: number
    cost: number
    holding_date: string
  }>
  transactions: Array<{
    txn_id: string
    type: 'PURCHASE' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT' | 'DIVIDEND'
    units: number
    nav: number
    amount: number
    transaction_date: string
  }>
}

export interface InsurancePolicyData {
  policy_number: string
  insurer: string
  policy_type: string
  policy_name: string
  sum_assured: number
  premium_amount: number
  premium_frequency: string
  policy_start_date: string
  policy_end_date: string
  maturity_date?: string
  surrender_value?: number
  loan_on_policy?: number
  nominees: Array<{
    name: string
    relationship: string
    share_percentage: number
  }>
}

export interface DataFetchResponse {
  success: boolean
  session_id?: string
  accounts?: FinancialAccount[]
  deposit_data?: DepositAccountData[]
  mutual_fund_data?: MutualFundData[]
  insurance_data?: InsurancePolicyData[]
  aggregated_summary?: {
    total_deposit_balance: number
    total_mutual_fund_value: number
    total_insurance_coverage: number
    total_epf_balance: number
    total_ppf_balance: number
    estimated_net_worth: number
  }
  error?: {
    code: string
    message: string
  }
}

export class AccountAggregatorAdapter {
  private config: AccountAggregatorConfig
  private readonly SETU_SANDBOX_URL = 'https://fiu-sandbox.setu.co/v2'
  private readonly SETU_PRODUCTION_URL = 'https://fiu.setu.co/v2'
  private readonly FINVU_SANDBOX_URL = 'https://sandbox.finvu.in/api/v1'
  private readonly FINVU_PRODUCTION_URL = 'https://api.finvu.in/v1'

  constructor(config: AccountAggregatorConfig) {
    this.config = config
  }

  /**
   * Create consent request for customer
   */
  async createConsent(request: ConsentRequest): Promise<ConsentResponse> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockConsentResponse(request)
      }

      const response = await fetch(`${this.getBaseUrl()}/consents`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          ver: '2.0.0',
          timestamp: new Date().toISOString(),
          txnid: `TXN_${Date.now()}`,
          ConsentDetail: {
            consentStart: new Date().toISOString(),
            consentExpiry: new Date(Date.now() + (request.consent_duration_days || 365) * 24 * 60 * 60 * 1000).toISOString(),
            consentMode: 'VIEW',
            fetchType: 'PERIODIC',
            consentTypes: ['PROFILE', 'SUMMARY', 'TRANSACTIONS'],
            fiTypes: request.fi_types,
            DataConsumer: {
              id: this.config.config?.fiu_id || ''
            },
            Customer: {
              id: `${request.customer_mobile}@${this.config.config?.aa_id || 'setu-aa'}`
            },
            Purpose: {
              code: this.mapPurposeCode(request.purpose),
              refUri: 'https://api.rebit.org.in/aa/purpose/101.xml',
              text: request.purpose,
              Category: {
                type: 'string'
              }
            },
            FIDataRange: {
              from: request.data_range.from + 'T00:00:00.000Z',
              to: request.data_range.to + 'T23:59:59.999Z'
            },
            DataLife: {
              unit: request.data_life?.unit || 'MONTH',
              value: request.data_life?.value || 6
            },
            Frequency: {
              unit: request.frequency?.unit || 'MONTH',
              value: request.frequency?.value || 1
            }
          }
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`AA API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseConsentResponse(result)
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONSENT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create consent'
        }
      }
    }
  }

  /**
   * Check consent status
   */
  async getConsentStatus(consentHandle: string): Promise<ConsentResponse> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return {
          success: true,
          consent_handle: consentHandle,
          consent_id: `CONSENT_${consentHandle}`,
          status: 'ACTIVE',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      }

      const response = await fetch(`${this.getBaseUrl()}/consents/${consentHandle}`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }

      return this.parseConsentResponse(await response.json())
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to check consent status'
        }
      }
    }
  }

  /**
   * Fetch financial data using active consent
   */
  async fetchData(request: DataFetchRequest): Promise<DataFetchResponse> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockDataFetchResponse(request)
      }

      // Step 1: Create data session
      const sessionResponse = await fetch(`${this.getBaseUrl()}/sessions`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          ver: '2.0.0',
          timestamp: new Date().toISOString(),
          txnid: `TXN_${Date.now()}`,
          consentId: request.consent_id,
          DataRange: {
            from: request.from_date || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
            to: request.to_date || new Date().toISOString()
          }
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!sessionResponse.ok) {
        throw new Error(`Session creation failed: ${sessionResponse.status}`)
      }

      const sessionResult = await sessionResponse.json()
      const sessionId = sessionResult.sessionId

      // Step 2: Fetch data using session
      const dataResponse = await fetch(`${this.getBaseUrl()}/sessions/${sessionId}/data`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 60000)
      })

      if (!dataResponse.ok) {
        throw new Error(`Data fetch failed: ${dataResponse.status}`)
      }

      return this.parseDataResponse(await dataResponse.json(), sessionId)
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATA_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch financial data'
        }
      }
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(consentId: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return { success: true }
      }

      const response = await fetch(`${this.getBaseUrl()}/consents/${consentId}/revoke`, {
        method: 'POST',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      return { success: response.ok }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REVOKE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to revoke consent'
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
    const aaId = this.config.config?.aa_id || 'setu'

    if (aaId.includes('finvu')) {
      return environment === 'production' ? this.FINVU_PRODUCTION_URL : this.FINVU_SANDBOX_URL
    }
    return environment === 'production' ? this.SETU_PRODUCTION_URL : this.SETU_SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.api_key || ''}`,
      'x-client-id': this.config.config?.client_id || '',
      'x-client-secret': this.config.config?.client_secret || ''
    }
  }

  private mapPurposeCode(purpose: ConsentPurpose): string {
    const codes: Record<ConsentPurpose, string> = {
      'LOAN_UNDERWRITING': '101',
      'WEALTH_MANAGEMENT': '102',
      'INSURANCE_UNDERWRITING': '103',
      'ACCOUNT_VERIFICATION': '104',
      'TAX_FILING': '105'
    }
    return codes[purpose] || '101'
  }

  private getMockConsentResponse(request: ConsentRequest): ConsentResponse {
    const consentHandle = `HANDLE_${Date.now()}_${Math.random().toString(36).substring(7)}`

    return {
      success: true,
      consent_handle: consentHandle,
      consent_id: `CONSENT_${consentHandle}`,
      redirect_url: `https://sandbox.setu.co/consent/${consentHandle}`,
      status: 'PENDING',
      expires_at: new Date(Date.now() + (request.consent_duration_days || 365) * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  private getMockDataFetchResponse(request: DataFetchRequest): DataFetchResponse {
    const avgBalance = 50000 + Math.random() * 200000
    const mfValue = 100000 + Math.random() * 500000

    return {
      success: true,
      session_id: `SESSION_${Date.now()}`,
      accounts: [
        {
          fi_type: 'DEPOSIT',
          fip_id: 'HDFC0001234',
          fip_name: 'HDFC Bank',
          account_ref_number: 'REF123456',
          masked_account_number: 'XXXX1234',
          type: 'SAVINGS',
          holder_name: 'TEST USER',
          status: 'ACTIVE'
        },
        {
          fi_type: 'MUTUAL_FUNDS',
          fip_id: 'CAMSMF',
          fip_name: 'CAMS',
          account_ref_number: 'FOLIO123',
          masked_account_number: 'FOLIO123',
          type: 'MUTUAL_FUND',
          holder_name: 'TEST USER',
          status: 'ACTIVE'
        }
      ],
      deposit_data: [
        {
          account_type: 'SAVINGS',
          current_balance: avgBalance,
          available_balance: avgBalance - 5000,
          currency: 'INR',
          ifsc_code: 'HDFC0001234',
          branch: 'Mumbai Main',
          transactions: [
            {
              txn_id: 'TXN001',
              type: 'CREDIT',
              mode: 'NEFT',
              amount: 50000,
              balance: avgBalance,
              transaction_date: new Date().toISOString(),
              value_date: new Date().toISOString(),
              narration: 'SALARY CREDIT'
            }
          ],
          summary: {
            opening_balance: avgBalance * 0.8,
            closing_balance: avgBalance,
            total_credits: avgBalance * 6,
            total_debits: avgBalance * 5,
            credit_count: 12,
            debit_count: 45
          }
        }
      ],
      mutual_fund_data: [
        {
          folio_number: 'FOLIO123456',
          amc: 'HDFC AMC',
          scheme_name: 'HDFC Mid-Cap Opportunities Fund',
          scheme_type: 'EQUITY',
          units: 500,
          nav: mfValue / 500,
          current_value: mfValue,
          cost_value: mfValue * 0.85,
          holdings: [],
          transactions: []
        }
      ],
      aggregated_summary: {
        total_deposit_balance: avgBalance,
        total_mutual_fund_value: mfValue,
        total_insurance_coverage: 1000000,
        total_epf_balance: 200000,
        total_ppf_balance: 50000,
        estimated_net_worth: avgBalance + mfValue + 1250000
      }
    }
  }

  private parseConsentResponse(response: any): ConsentResponse {
    if (response.error) {
      return {
        success: false,
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Consent operation failed'
        }
      }
    }

    return {
      success: true,
      consent_handle: response.ConsentHandle || response.consentHandle,
      consent_id: response.consentId,
      redirect_url: response.redirectUrl,
      status: response.status || response.ConsentStatus?.status,
      expires_at: response.expiresAt
    }
  }

  private parseDataResponse(response: any, sessionId: string): DataFetchResponse {
    if (response.error) {
      return {
        success: false,
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Data fetch failed'
        }
      }
    }

    return {
      success: true,
      session_id: sessionId,
      accounts: response.accounts,
      deposit_data: response.depositData,
      mutual_fund_data: response.mutualFundData,
      insurance_data: response.insuranceData,
      aggregated_summary: response.summary
    }
  }
}

/**
 * Factory function to create Account Aggregator adapter
 */
export function createAccountAggregatorAdapter(config: AccountAggregatorConfig): AccountAggregatorAdapter {
  return new AccountAggregatorAdapter(config)
}
