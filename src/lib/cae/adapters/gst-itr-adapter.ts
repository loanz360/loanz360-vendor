/**
 * GST & ITR Verification Adapter
 * Integrates with GST Portal and Income Tax Department APIs
 * For verification of business income and tax compliance
 */

import { CAEProviderConfig } from '../types'

export interface GSTITRConfig extends CAEProviderConfig {
  config?: {
    gst_api_key?: string
    gst_secret?: string
    itr_api_key?: string
    itr_secret?: string
    environment?: 'sandbox' | 'production'
  }
}

// GST Types
export interface GSTVerificationRequest {
  gstin: string
  pan?: string
  financialYear?: string
}

export interface GSTVerificationResult {
  success: boolean
  gstin: string
  verified: boolean
  verificationTime: string
  data?: {
    legalName: string
    tradeName: string
    registrationDate: string
    status: 'Active' | 'Inactive' | 'Cancelled' | 'Suspended'
    businessType: string
    constitutionOfBusiness: string
    principalPlaceOfBusiness: {
      address: string
      city: string
      state: string
      pincode: string
    }
    lastFiledReturn?: {
      returnType: string
      taxPeriod: string
      filingDate: string
      arn: string
    }
    filingStatus: {
      gstr1Filed: boolean
      gstr3bFiled: boolean
      monthsDefaulted: number
    }
    annualTurnover?: {
      fy: string
      declared: number
      aggregate: number
    }[]
  }
  error?: {
    code: string
    message: string
  }
}

// ITR Types
export interface ITRVerificationRequest {
  pan: string
  assessmentYear?: string
  dateOfBirth?: string
  name?: string
}

export interface ITRVerificationResult {
  success: boolean
  pan: string
  verified: boolean
  verificationTime: string
  data?: {
    name: string
    assessmentYear: string
    filingStatus: 'Filed' | 'Not Filed' | 'Pending'
    filingDate?: string
    itrForm: string
    acknowledgementNumber?: string
    grossTotalIncome?: number
    totalIncome?: number
    totalTaxPaid?: number
    refundAmount?: number
    incomeFromSalary?: number
    incomeFromBusiness?: number
    incomeFromCapitalGains?: number
    incomeFromOtherSources?: number
    deductions?: {
      section80C?: number
      section80D?: number
      others?: number
    }
    verificationStatus: 'Verified' | 'Pending Verification' | 'Defective'
  }
  error?: {
    code: string
    message: string
  }
}

export interface ITRHistoryResult {
  success: boolean
  pan: string
  history: Array<{
    assessmentYear: string
    filingStatus: 'Filed' | 'Not Filed' | 'Pending'
    filingDate?: string
    grossTotalIncome?: number
    totalIncome?: number
    itrForm?: string
  }>
  averageIncome?: number
  incomeGrowth?: number // YoY growth percentage
  error?: {
    code: string
    message: string
  }
}

export class GSTITRAdapter {
  private config: GSTITRConfig

  private readonly GST_SANDBOX_URL = 'https://sandbox.gst.gov.in/api/v1'
  private readonly GST_PRODUCTION_URL = 'https://api.gst.gov.in/v1'
  private readonly ITR_SANDBOX_URL = 'https://sandbox.incometax.gov.in/api/v1'
  private readonly ITR_PRODUCTION_URL = 'https://api.incometax.gov.in/v1'

  constructor(config: GSTITRConfig) {
    this.config = config
  }

  /**
   * Verify GST registration and compliance
   */
  async verifyGST(request: GSTVerificationRequest): Promise<GSTVerificationResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockGSTResult(request)
      }

      const response = await fetch(`${this.getGSTBaseUrl()}/gstin/verify`, {
        method: 'POST',
        headers: this.getGSTHeaders(),
        body: JSON.stringify({
          gstin: request.gstin,
          pan: request.pan,
          fy: request.financialYear,
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
      })

      if (!response.ok) {
        throw new Error(`GST API returned ${response.status}`)
      }

      return this.parseGSTResponse(await response.json(), request.gstin)
    } catch (error) {
      return {
        success: false,
        gstin: request.gstin,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: 'GST_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'GST verification failed',
        },
      }
    }
  }

  /**
   * Verify ITR filing and income details
   */
  async verifyITR(request: ITRVerificationRequest): Promise<ITRVerificationResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockITRResult(request)
      }

      const response = await fetch(`${this.getITRBaseUrl()}/itr/verify`, {
        method: 'POST',
        headers: this.getITRHeaders(),
        body: JSON.stringify({
          pan: request.pan,
          assessmentYear: request.assessmentYear,
          dateOfBirth: request.dateOfBirth,
          name: request.name,
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
      })

      if (!response.ok) {
        throw new Error(`ITR API returned ${response.status}`)
      }

      return this.parseITRResponse(await response.json(), request.pan)
    } catch (error) {
      return {
        success: false,
        pan: request.pan,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: 'ITR_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'ITR verification failed',
        },
      }
    }
  }

  /**
   * Get ITR filing history for multiple years
   */
  async getITRHistory(pan: string, years: number = 3): Promise<ITRHistoryResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockITRHistory(pan, years)
      }

      const response = await fetch(`${this.getITRBaseUrl()}/itr/history`, {
        method: 'POST',
        headers: this.getITRHeaders(),
        body: JSON.stringify({ pan, years }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
      })

      if (!response.ok) {
        throw new Error(`ITR History API returned ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        pan,
        history: [],
        error: {
          code: 'ITR_HISTORY_FAILED',
          message: error instanceof Error ? error.message : 'ITR history fetch failed',
        },
      }
    }
  }

  /**
   * Calculate income consistency score based on ITR history
   */
  calculateIncomeConsistency(history: ITRHistoryResult): {
    score: number
    trend: 'increasing' | 'stable' | 'decreasing' | 'irregular'
    avgIncome: number
    filingCompliance: number
  } {
    if (!history.success || history.history.length === 0) {
      return { score: 0, trend: 'irregular', avgIncome: 0, filingCompliance: 0 }
    }

    const filedYears = history.history.filter((h) => h.filingStatus === 'Filed')
    const filingCompliance = (filedYears.length / history.history.length) * 100

    const incomes = filedYears
      .filter((h) => h.totalIncome !== undefined)
      .map((h) => h.totalIncome!)
      .sort((a, b) => a - b)

    if (incomes.length === 0) {
      return { score: filingCompliance * 0.5, trend: 'irregular', avgIncome: 0, filingCompliance }
    }

    const avgIncome = incomes.reduce((a, b) => a + b, 0) / incomes.length

    // Calculate variance
    const variance = incomes.reduce((sum, inc) => sum + Math.pow(inc - avgIncome, 2), 0) / incomes.length
    const stdDev = Math.sqrt(variance)
    const coeffOfVar = (stdDev / avgIncome) * 100

    // Determine trend
    let trend: 'increasing' | 'stable' | 'decreasing' | 'irregular' = 'stable'
    if (incomes.length >= 2) {
      const firstHalf = incomes.slice(0, Math.floor(incomes.length / 2))
      const secondHalf = incomes.slice(Math.floor(incomes.length / 2))
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      const change = ((secondAvg - firstAvg) / firstAvg) * 100
      if (change > 15) trend = 'increasing'
      else if (change < -15) trend = 'decreasing'
      else if (coeffOfVar > 30) trend = 'irregular'
    }

    // Calculate consistency score
    let score = filingCompliance
    if (coeffOfVar < 10) score = Math.min(100, score + 20)
    else if (coeffOfVar < 20) score = Math.min(100, score + 10)
    else if (coeffOfVar > 40) score = Math.max(0, score - 20)

    if (trend === 'increasing') score = Math.min(100, score + 10)
    else if (trend === 'decreasing') score = Math.max(0, score - 10)
    else if (trend === 'irregular') score = Math.max(0, score - 15)

    return {
      score: Math.round(score),
      trend,
      avgIncome: Math.round(avgIncome),
      filingCompliance: Math.round(filingCompliance),
    }
  }

  /**
   * Health check for GST and ITR APIs
   */
  async healthCheck(): Promise<{ gst: { healthy: boolean; latency_ms: number }; itr: { healthy: boolean; latency_ms: number } }> {
    const [gstHealth, itrHealth] = await Promise.all([
      this.checkGSTHealth(),
      this.checkITRHealth(),
    ])

    return { gst: gstHealth, itr: itrHealth }
  }

  private async checkGSTHealth(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now()
    try {
      const response = await fetch(`${this.getGSTBaseUrl()}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return { healthy: response.ok, latency_ms: Date.now() - start }
    } catch {
      return { healthy: false, latency_ms: Date.now() - start }
    }
  }

  private async checkITRHealth(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now()
    try {
      const response = await fetch(`${this.getITRBaseUrl()}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return { healthy: response.ok, latency_ms: Date.now() - start }
    } catch {
      return { healthy: false, latency_ms: Date.now() - start }
    }
  }

  private getGSTBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    return environment === 'production' ? this.GST_PRODUCTION_URL : this.GST_SANDBOX_URL
  }

  private getITRBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    return environment === 'production' ? this.ITR_PRODUCTION_URL : this.ITR_SANDBOX_URL
  }

  private getGSTHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': this.config.config?.gst_api_key || '',
      'X-API-Secret': this.config.config?.gst_secret || '',
    }
  }

  private getITRHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': this.config.config?.itr_api_key || '',
      'X-API-Secret': this.config.config?.itr_secret || '',
    }
  }

  private getMockGSTResult(request: GSTVerificationRequest): GSTVerificationResult {
    const isValid = request.gstin.length === 15 && Math.random() > 0.1

    if (!isValid) {
      return {
        success: false,
        gstin: request.gstin,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: 'INVALID_GSTIN',
          message: 'GSTIN not found or invalid format',
        },
      }
    }

    const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat']
    const businessTypes = ['Regular', 'Composition', 'Casual Taxable Person', 'SEZ Developer']
    const constitutions = ['Proprietorship', 'Partnership', 'Private Limited Company', 'LLP', 'Public Limited Company']

    const currentFY = this.getCurrentFY()
    const baseTurnover = Math.floor(Math.random() * 50000000) + 1000000 // 10L to 5Cr

    return {
      success: true,
      gstin: request.gstin,
      verified: true,
      verificationTime: new Date().toISOString(),
      data: {
        legalName: 'Test Business Pvt Ltd',
        tradeName: 'Test Business',
        registrationDate: '2018-07-01',
        status: Math.random() > 0.05 ? 'Active' : 'Cancelled',
        businessType: businessTypes[Math.floor(Math.random() * businessTypes.length)],
        constitutionOfBusiness: constitutions[Math.floor(Math.random() * constitutions.length)],
        principalPlaceOfBusiness: {
          address: '123 Business Park, Test Area',
          city: 'Mumbai',
          state: states[Math.floor(Math.random() * states.length)],
          pincode: '400001',
        },
        lastFiledReturn: {
          returnType: 'GSTR-3B',
          taxPeriod: this.getPreviousMonth(),
          filingDate: this.getRandomRecentDate(30),
          arn: `ARN${Date.now()}`,
        },
        filingStatus: {
          gstr1Filed: Math.random() > 0.1,
          gstr3bFiled: Math.random() > 0.1,
          monthsDefaulted: Math.floor(Math.random() * 3),
        },
        annualTurnover: [
          { fy: currentFY, declared: baseTurnover, aggregate: baseTurnover * 1.1 },
          { fy: this.getPreviousFY(currentFY), declared: baseTurnover * 0.9, aggregate: baseTurnover },
          { fy: this.getPreviousFY(this.getPreviousFY(currentFY)), declared: baseTurnover * 0.8, aggregate: baseTurnover * 0.85 },
        ],
      },
    }
  }

  private getMockITRResult(request: ITRVerificationRequest): ITRVerificationResult {
    const isValid = request.pan.length === 10 && Math.random() > 0.05

    if (!isValid) {
      return {
        success: false,
        pan: request.pan,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: 'PAN_NOT_FOUND',
          message: 'PAN not found or ITR not filed',
        },
      }
    }

    const baseIncome = Math.floor(Math.random() * 2000000) + 500000 // 5L to 25L
    const itrForms = ['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4']

    return {
      success: true,
      pan: request.pan,
      verified: true,
      verificationTime: new Date().toISOString(),
      data: {
        name: request.name || 'Test User',
        assessmentYear: request.assessmentYear || this.getCurrentAY(),
        filingStatus: 'Filed',
        filingDate: this.getRandomRecentDate(180),
        itrForm: itrForms[Math.floor(Math.random() * itrForms.length)],
        acknowledgementNumber: `ACK${Date.now()}`,
        grossTotalIncome: baseIncome * 1.2,
        totalIncome: baseIncome,
        totalTaxPaid: Math.round(baseIncome * 0.15),
        refundAmount: Math.random() > 0.7 ? Math.floor(Math.random() * 50000) : 0,
        incomeFromSalary: Math.round(baseIncome * 0.8),
        incomeFromBusiness: Math.round(baseIncome * 0.1),
        incomeFromCapitalGains: Math.round(baseIncome * 0.05),
        incomeFromOtherSources: Math.round(baseIncome * 0.05),
        deductions: {
          section80C: 150000,
          section80D: 25000,
          others: 50000,
        },
        verificationStatus: 'Verified',
      },
    }
  }

  private getMockITRHistory(pan: string, years: number): ITRHistoryResult {
    const history = []
    const baseIncome = Math.floor(Math.random() * 1500000) + 500000
    let currentAY = this.getCurrentAY()

    for (let i = 0; i < years; i++) {
      const filed = Math.random() > 0.1
      const income = filed ? Math.round(baseIncome * (1 + (years - i - 1) * 0.1)) : undefined

      history.push({
        assessmentYear: currentAY,
        filingStatus: filed ? 'Filed' as const : 'Not Filed' as const,
        filingDate: filed ? this.getRandomRecentDate(365 * (i + 1)) : undefined,
        grossTotalIncome: income ? Math.round(income * 1.2) : undefined,
        totalIncome: income,
        itrForm: filed ? ['ITR-1', 'ITR-2', 'ITR-3'][Math.floor(Math.random() * 3)] : undefined,
      })

      currentAY = this.getPreviousAY(currentAY)
    }

    const filedHistory = history.filter((h) => h.filingStatus === 'Filed' && h.totalIncome)
    const avgIncome = filedHistory.length > 0
      ? filedHistory.reduce((sum, h) => sum + (h.totalIncome || 0), 0) / filedHistory.length
      : 0

    let incomeGrowth = 0
    if (filedHistory.length >= 2) {
      const recent = filedHistory[0]?.totalIncome || 0
      const oldest = filedHistory[filedHistory.length - 1]?.totalIncome || 0
      if (oldest > 0) {
        incomeGrowth = ((recent - oldest) / oldest) * 100
      }
    }

    return {
      success: true,
      pan,
      history,
      averageIncome: Math.round(avgIncome),
      incomeGrowth: Math.round(incomeGrowth * 10) / 10,
    }
  }

  private parseGSTResponse(response: unknown, gstin: string): GSTVerificationResult {
    if (response.error) {
      return {
        success: false,
        gstin,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'GST verification failed',
        },
      }
    }

    return {
      success: true,
      gstin,
      verified: true,
      verificationTime: new Date().toISOString(),
      data: response.data,
    }
  }

  private parseITRResponse(response: unknown, pan: string): ITRVerificationResult {
    if (response.error) {
      return {
        success: false,
        pan,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'ITR verification failed',
        },
      }
    }

    return {
      success: true,
      pan,
      verified: true,
      verificationTime: new Date().toISOString(),
      data: response.data,
    }
  }

  private getCurrentFY(): string {
    const now = new Date()
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    return `${year}-${(year + 1).toString().slice(-2)}`
  }

  private getPreviousFY(fy: string): string {
    const [start] = fy.split('-').map(Number)
    return `${start - 1}-${start.toString().slice(-2)}`
  }

  private getCurrentAY(): string {
    const now = new Date()
    const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear()
    return `${year}-${(year + 1).toString().slice(-2)}`
  }

  private getPreviousAY(ay: string): string {
    const [start] = ay.split('-').map(Number)
    return `${start - 1}-${start.toString().slice(-2)}`
  }

  private getPreviousMonth(): string {
    const now = new Date()
    now.setMonth(now.getMonth() - 1)
    return `${now.toLocaleString('en-US', { month: 'short' })}-${now.getFullYear()}`
  }

  private getRandomRecentDate(maxDaysAgo: number): string {
    const now = new Date()
    const daysAgo = Math.floor(Math.random() * maxDaysAgo)
    now.setDate(now.getDate() - daysAgo)
    return now.toISOString().split('T')[0]
  }
}

/**
 * Factory function to create GST/ITR adapter
 */
export function createGSTITRAdapter(config: GSTITRConfig): GSTITRAdapter {
  return new GSTITRAdapter(config)
}
