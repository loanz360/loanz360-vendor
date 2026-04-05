/**
 * Penny Drop / Bank Account Verification Adapter
 * Integrates with Razorpay/Decentro/Cashfree for bank account validation
 * Verifies account ownership by transferring ₹1 and validating account holder name
 */

import { CAEProviderConfig } from '../types'

export interface PennyDropConfig extends CAEProviderConfig {
  config?: {
    key_id?: string
    key_secret?: string
    webhook_url?: string
    environment?: 'sandbox' | 'production'
    provider?: 'razorpay' | 'decentro' | 'cashfree'
  }
}

export interface BankAccountVerificationRequest {
  account_number: string
  ifsc_code: string
  account_holder_name?: string // For name matching
  mobile_number?: string
  reference_id?: string
}

export interface BankAccountVerificationResult {
  success: boolean
  reference_id: string
  verified: boolean
  verification_time: string
  data?: {
    account_number_masked: string
    ifsc_code: string
    bank_name: string
    branch_name?: string
    account_holder_name: string
    account_type?: 'SAVINGS' | 'CURRENT' | 'NRE' | 'NRO' | 'UNKNOWN'
    account_status: 'ACTIVE' | 'INACTIVE' | 'FROZEN' | 'CLOSED' | 'UNKNOWN'
    name_match_score?: number // 0-100 if reference name provided
    name_match_result?: 'EXACT_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH' | 'NOT_CHECKED'
    utr?: string // Unique Transaction Reference
  }
  error?: {
    code: string
    message: string
    bank_response?: string
  }
}

export interface BulkVerificationRequest {
  accounts: BankAccountVerificationRequest[]
  batch_reference_id?: string
}

export interface BulkVerificationResult {
  success: boolean
  batch_reference_id: string
  total_count: number
  verified_count: number
  failed_count: number
  pending_count: number
  results: BankAccountVerificationResult[]
}

export class PennyDropAdapter {
  private config: PennyDropConfig
  private readonly RAZORPAY_SANDBOX_URL = 'https://api.razorpay.com/v1'
  private readonly RAZORPAY_PRODUCTION_URL = 'https://api.razorpay.com/v1'
  private readonly DECENTRO_SANDBOX_URL = 'https://in.staging.decentro.tech/v2'
  private readonly DECENTRO_PRODUCTION_URL = 'https://in.decentro.tech/v2'
  private readonly CASHFREE_SANDBOX_URL = 'https://sandbox.cashfree.com/verification'
  private readonly CASHFREE_PRODUCTION_URL = 'https://api.cashfree.com/verification'

  constructor(config: PennyDropConfig) {
    this.config = config
  }

  /**
   * Verify single bank account
   */
  async verifyAccount(request: BankAccountVerificationRequest): Promise<BankAccountVerificationResult> {
    const referenceId = request.reference_id || `PENNY_${Date.now()}_${Math.random().toString(36).substring(7)}`

    try {
      const environment = this.config.config?.environment || 'sandbox'
      const provider = this.config.config?.provider || 'razorpay'

      if (environment === 'sandbox') {
        return this.getMockVerificationResult(request, referenceId)
      }

      // Route to appropriate provider
      switch (provider) {
        case 'razorpay':
          return await this.verifyWithRazorpay(request, referenceId)
        case 'decentro':
          return await this.verifyWithDecentro(request, referenceId)
        case 'cashfree':
          return await this.verifyWithCashfree(request, referenceId)
        default:
          return await this.verifyWithRazorpay(request, referenceId)
      }
    } catch (error) {
      return {
        success: false,
        reference_id: referenceId,
        verified: false,
        verification_time: new Date().toISOString(),
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Bank account verification failed'
        }
      }
    }
  }

  /**
   * Verify multiple accounts in batch
   */
  async verifyBulk(request: BulkVerificationRequest): Promise<BulkVerificationResult> {
    const batchReferenceId = request.batch_reference_id || `BATCH_${Date.now()}`
    const results: BankAccountVerificationResult[] = []

    // Process accounts (in sandbox, do sequentially; in production, could be parallel)
    for (const account of request.accounts) {
      const result = await this.verifyAccount(account)
      results.push(result)
    }

    const verifiedCount = results.filter(r => r.verified).length
    const failedCount = results.filter(r => !r.success).length
    const pendingCount = results.filter(r => r.success && !r.verified).length

    return {
      success: true,
      batch_reference_id: batchReferenceId,
      total_count: request.accounts.length,
      verified_count: verifiedCount,
      failed_count: failedCount,
      pending_count: pendingCount,
      results
    }
  }

  /**
   * IFSC code validation and bank details lookup
   */
  async lookupIFSC(ifscCode: string): Promise<{
    success: boolean
    data?: {
      ifsc: string
      bank_name: string
      branch_name: string
      address?: string
      city?: string
      state?: string
      contact?: string
      micr_code?: string
      rtgs_enabled: boolean
      neft_enabled: boolean
      imps_enabled: boolean
      upi_enabled: boolean
    }
    error?: { code: string; message: string }
  }> {
    try {
      // Validate IFSC format
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
        return {
          success: false,
          error: {
            code: 'INVALID_IFSC',
            message: 'Invalid IFSC code format'
          }
        }
      }

      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockIFSCLookup(ifscCode)
      }

      // Use Razorpay's IFSC API (free, no auth required)
      const response = await fetch(`https://ifsc.razorpay.com/${ifscCode.toUpperCase()}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        throw new Error('IFSC not found')
      }

      const data = await response.json()

      return {
        success: true,
        data: {
          ifsc: data.IFSC,
          bank_name: data.BANK,
          branch_name: data.BRANCH,
          address: data.ADDRESS,
          city: data.CITY,
          state: data.STATE,
          contact: data.CONTACT,
          micr_code: data.MICR,
          rtgs_enabled: data.RTGS === true,
          neft_enabled: data.NEFT === true,
          imps_enabled: data.IMPS === true,
          upi_enabled: data.UPI === true
        }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'IFSC_LOOKUP_FAILED',
          message: error instanceof Error ? error.message : 'IFSC lookup failed'
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
      // Test with IFSC lookup (no auth required)
      const response = await fetch('https://ifsc.razorpay.com/HDFC0001234', {
        method: 'GET',
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

  private async verifyWithRazorpay(
    request: BankAccountVerificationRequest,
    referenceId: string
  ): Promise<BankAccountVerificationResult> {
    const response = await fetch(`${this.RAZORPAY_PRODUCTION_URL}/fund_accounts/validations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.config.config?.key_id}:${this.config.config?.key_secret}`).toString('base64')}`
      },
      body: JSON.stringify({
        account_number: request.account_number,
        ifsc: request.ifsc_code,
        notes: {
          reference_id: referenceId
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
    })

    if (!response.ok) {
      throw new Error(`Razorpay API returned ${response.status}`)
    }

    const result = await response.json()
    return this.parseRazorpayResponse(result, request, referenceId)
  }

  private async verifyWithDecentro(
    request: BankAccountVerificationRequest,
    referenceId: string
  ): Promise<BankAccountVerificationResult> {
    const response = await fetch(`${this.DECENTRO_PRODUCTION_URL}/banking/account/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client_id': this.config.config?.key_id || '',
        'client_secret': this.config.config?.key_secret || ''
      },
      body: JSON.stringify({
        reference_id: referenceId,
        consent: true,
        purpose: 'Account Verification for Loan Processing',
        account_number: request.account_number,
        ifsc: request.ifsc_code
      }),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
    })

    if (!response.ok) {
      throw new Error(`Decentro API returned ${response.status}`)
    }

    const result = await response.json()
    return this.parseDecentroResponse(result, request, referenceId)
  }

  private async verifyWithCashfree(
    request: BankAccountVerificationRequest,
    referenceId: string
  ): Promise<BankAccountVerificationResult> {
    const response = await fetch(`${this.CASHFREE_PRODUCTION_URL}/bank-account/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.config.config?.key_id || '',
        'x-client-secret': this.config.config?.key_secret || ''
      },
      body: JSON.stringify({
        bank_account: request.account_number,
        ifsc: request.ifsc_code,
        name: request.account_holder_name,
        phone: request.mobile_number
      }),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
    })

    if (!response.ok) {
      throw new Error(`Cashfree API returned ${response.status}`)
    }

    const result = await response.json()
    return this.parseCashfreeResponse(result, request, referenceId)
  }

  private getMockVerificationResult(
    request: BankAccountVerificationRequest,
    referenceId: string
  ): BankAccountVerificationResult {
    // Simulate verification with 95% success rate
    const verified = Math.random() > 0.05

    if (!verified) {
      return {
        success: false,
        reference_id: referenceId,
        verified: false,
        verification_time: new Date().toISOString(),
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Bank account not found or inactive',
          bank_response: 'INVALID_ACCOUNT'
        }
      }
    }

    // Extract bank name from IFSC
    const bankCodes: Record<string, string> = {
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'SBIN': 'State Bank of India',
      'AXIS': 'Axis Bank',
      'KKBK': 'Kotak Mahindra Bank',
      'YESB': 'Yes Bank',
      'UTIB': 'Axis Bank',
      'IDFB': 'IDFC First Bank',
      'PUNB': 'Punjab National Bank',
      'BARB': 'Bank of Baroda'
    }

    const bankCode = request.ifsc_code.substring(0, 4).toUpperCase()
    const bankName = bankCodes[bankCode] || 'Unknown Bank'

    // Generate mock account holder name
    const mockNames = ['RAHUL SHARMA', 'PRIYA PATEL', 'AMIT KUMAR', 'SNEHA GUPTA', 'VIKRAM SINGH']
    const holderName = mockNames[Math.floor(Math.random() * mockNames.length)]

    // Calculate name match if reference provided
    let nameMatchScore: number | undefined
    let nameMatchResult: 'EXACT_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH' | 'NOT_CHECKED' = 'NOT_CHECKED'

    if (request.account_holder_name) {
      const refName = request.account_holder_name.toUpperCase().trim()
      if (refName === holderName) {
        nameMatchScore = 100
        nameMatchResult = 'EXACT_MATCH'
      } else if (holderName.includes(refName.split(' ')[0])) {
        nameMatchScore = 70 + Math.floor(Math.random() * 20)
        nameMatchResult = 'PARTIAL_MATCH'
      } else {
        nameMatchScore = Math.floor(Math.random() * 40)
        nameMatchResult = 'NO_MATCH'
      }
    }

    return {
      success: true,
      reference_id: referenceId,
      verified: true,
      verification_time: new Date().toISOString(),
      data: {
        account_number_masked: `XXXX${request.account_number.slice(-4)}`,
        ifsc_code: request.ifsc_code.toUpperCase(),
        bank_name: bankName,
        branch_name: 'Main Branch',
        account_holder_name: holderName,
        account_type: 'SAVINGS',
        account_status: 'ACTIVE',
        name_match_score: nameMatchScore,
        name_match_result: nameMatchResult,
        utr: `UTR${Date.now()}`
      }
    }
  }

  private getMockIFSCLookup(ifscCode: string): {
    success: boolean
    data?: {
      ifsc: string
      bank_name: string
      branch_name: string
      address?: string
      city?: string
      state?: string
      contact?: string
      micr_code?: string
      rtgs_enabled: boolean
      neft_enabled: boolean
      imps_enabled: boolean
      upi_enabled: boolean
    }
    error?: { code: string; message: string }
  } {
    const bankCodes: Record<string, { name: string; city: string }> = {
      'HDFC': { name: 'HDFC Bank', city: 'Mumbai' },
      'ICIC': { name: 'ICICI Bank', city: 'Mumbai' },
      'SBIN': { name: 'State Bank of India', city: 'Delhi' },
      'AXIS': { name: 'Axis Bank', city: 'Mumbai' },
      'KKBK': { name: 'Kotak Mahindra Bank', city: 'Mumbai' }
    }

    const bankCode = ifscCode.substring(0, 4).toUpperCase()
    const bankInfo = bankCodes[bankCode]

    if (!bankInfo) {
      return {
        success: false,
        error: {
          code: 'IFSC_NOT_FOUND',
          message: 'IFSC code not found in database'
        }
      }
    }

    return {
      success: true,
      data: {
        ifsc: ifscCode.toUpperCase(),
        bank_name: bankInfo.name,
        branch_name: 'Main Branch',
        address: `${bankInfo.city} Main Branch`,
        city: bankInfo.city,
        state: 'Maharashtra',
        micr_code: `${ifscCode.substring(4)}000`,
        rtgs_enabled: true,
        neft_enabled: true,
        imps_enabled: true,
        upi_enabled: true
      }
    }
  }

  private parseRazorpayResponse(
    response: any,
    request: BankAccountVerificationRequest,
    referenceId: string
  ): BankAccountVerificationResult {
    if (response.status === 'completed' && response.results?.account_status === 'active') {
      return {
        success: true,
        reference_id: referenceId,
        verified: true,
        verification_time: new Date().toISOString(),
        data: {
          account_number_masked: `XXXX${request.account_number.slice(-4)}`,
          ifsc_code: request.ifsc_code,
          bank_name: response.results?.bank_name || 'Unknown',
          account_holder_name: response.results?.registered_name || 'Unknown',
          account_status: 'ACTIVE',
          utr: response.utr
        }
      }
    }

    return {
      success: false,
      reference_id: referenceId,
      verified: false,
      verification_time: new Date().toISOString(),
      error: {
        code: response.results?.account_status || 'UNKNOWN',
        message: response.results?.remarks || 'Verification failed'
      }
    }
  }

  private parseDecentroResponse(
    response: any,
    request: BankAccountVerificationRequest,
    referenceId: string
  ): BankAccountVerificationResult {
    if (response.status === 'SUCCESS') {
      return {
        success: true,
        reference_id: referenceId,
        verified: true,
        verification_time: new Date().toISOString(),
        data: {
          account_number_masked: `XXXX${request.account_number.slice(-4)}`,
          ifsc_code: request.ifsc_code,
          bank_name: response.data?.bankName || 'Unknown',
          account_holder_name: response.data?.beneficiaryName || 'Unknown',
          account_status: 'ACTIVE',
          utr: response.data?.utr
        }
      }
    }

    return {
      success: false,
      reference_id: referenceId,
      verified: false,
      verification_time: new Date().toISOString(),
      error: {
        code: response.responseCode || 'UNKNOWN',
        message: response.message || 'Verification failed'
      }
    }
  }

  private parseCashfreeResponse(
    response: any,
    request: BankAccountVerificationRequest,
    referenceId: string
  ): BankAccountVerificationResult {
    if (response.account_status === 'VALID') {
      return {
        success: true,
        reference_id: referenceId,
        verified: true,
        verification_time: new Date().toISOString(),
        data: {
          account_number_masked: `XXXX${request.account_number.slice(-4)}`,
          ifsc_code: request.ifsc_code,
          bank_name: 'Unknown',
          account_holder_name: response.name_at_bank || 'Unknown',
          account_status: 'ACTIVE',
          name_match_score: response.name_match_score,
          name_match_result: response.name_match_result,
          utr: response.utr
        }
      }
    }

    return {
      success: false,
      reference_id: referenceId,
      verified: false,
      verification_time: new Date().toISOString(),
      error: {
        code: response.account_status || 'UNKNOWN',
        message: response.account_status_message || 'Verification failed'
      }
    }
  }
}

/**
 * Factory function to create Penny Drop adapter
 */
export function createPennyDropAdapter(config: PennyDropConfig): PennyDropAdapter {
  return new PennyDropAdapter(config)
}
