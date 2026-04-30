/**
 * Court Records / Litigation Check Adapter
 * Integrates with Gridlines/Karza for court case and litigation history verification
 * Checks for pending cases, judgments, and legal disputes
 */

import { CAEProviderConfig } from '../types'

export interface CourtRecordsConfig extends CAEProviderConfig {
  config?: {
    api_key?: string
    client_id?: string
    environment?: 'sandbox' | 'production'
    provider?: 'gridlines' | 'karza' | 'legistify'
  }
}

export type CaseType =
  | 'CIVIL'
  | 'CRIMINAL'
  | 'CONSUMER'
  | 'LABOUR'
  | 'TAX'
  | 'ARBITRATION'
  | 'COMPANY'
  | 'BANKRUPTCY'
  | 'CHEQUE_BOUNCE'
  | 'OTHER'

export type CaseStatus =
  | 'PENDING'
  | 'DISPOSED'
  | 'TRANSFERRED'
  | 'WITHDRAWN'
  | 'SETTLED'
  | 'DISMISSED'
  | 'DECREED'
  | 'UNKNOWN'

export type PartyRole = 'PETITIONER' | 'RESPONDENT' | 'PLAINTIFF' | 'DEFENDANT' | 'APPELLANT' | 'ACCUSED' | 'COMPLAINANT' | 'WITNESS' | 'OTHER'

export interface CourtSearchRequest {
  // Search by name
  name?: string
  father_name?: string

  // Search by identifiers
  pan?: string
  cin?: string
  din?: string

  // Search options
  case_types?: CaseType[]
  states?: string[] // Indian states to search
  include_disposed?: boolean
  date_range?: {
    from_date?: string
    to_date?: string
  }

  // Fuzzy matching
  fuzzy_match?: boolean
  match_threshold?: number // 0-100
}

export interface CourtCase {
  case_id: string
  case_number: string
  case_type: CaseType
  case_status: CaseStatus

  // Court Details
  court: {
    name: string
    type: 'SUPREME_COURT' | 'HIGH_COURT' | 'DISTRICT_COURT' | 'TRIBUNAL' | 'CONSUMER_FORUM' | 'OTHER'
    state?: string
    district?: string
    bench?: string
  }

  // Case Details
  case_title: string
  filing_date: string
  registration_date?: string
  first_hearing_date?: string
  next_hearing_date?: string
  last_hearing_date?: string
  disposal_date?: string

  // Parties
  petitioner: {
    name: string
    advocate?: string
  }
  respondent: {
    name: string
    advocate?: string
  }

  // Match Details (when searching)
  matched_party?: {
    role: PartyRole
    name: string
    match_score: number
  }

  // Case Summary
  subject?: string
  acts_sections?: string[]
  relief_sought?: string
  case_summary?: string

  // Judgment (if disposed)
  judgment?: {
    date: string
    result: 'IN_FAVOR' | 'AGAINST' | 'PARTIAL' | 'DISMISSED' | 'SETTLED' | 'OTHER'
    summary?: string
    amount_awarded?: number
    appeal_filed?: boolean
  }

  // Risk Assessment
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  risk_factors?: string[]
}

export interface CourtSearchResult {
  success: boolean
  search_id: string
  search_time: string
  total_records: number
  pending_cases: number
  disposed_cases: number

  cases?: CourtCase[]

  // Summary
  summary?: {
    by_type: Record<CaseType, number>
    by_status: Record<CaseStatus, number>
    by_court_type: Record<string, number>
    as_petitioner: number
    as_respondent: number
    oldest_case_date?: string
    newest_case_date?: string
  }

  // Overall Risk
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'
  risk_factors?: string[]

  error?: {
    code: string
    message: string
  }
}

export interface CaseDetailResult {
  success: boolean
  case?: CourtCase & {
    hearing_history?: Array<{
      date: string
      purpose: string
      outcome?: string
      next_date?: string
    }>
    orders?: Array<{
      date: string
      type: string
      summary: string
      pdf_url?: string
    }>
    connected_cases?: Array<{
      case_number: string
      court: string
      relationship: string
    }>
  }
  error?: {
    code: string
    message: string
  }
}

export class CourtRecordsAdapter {
  private config: CourtRecordsConfig
  private readonly GRIDLINES_SANDBOX_URL = 'https://sandbox.gridlines.io/v1/court'
  private readonly GRIDLINES_PRODUCTION_URL = 'https://api.gridlines.io/v1/court'
  private readonly KARZA_SANDBOX_URL = 'https://sandbox.karza.in/v3/court'
  private readonly KARZA_PRODUCTION_URL = 'https://api.karza.in/v3/court'

  constructor(config: CourtRecordsConfig) {
    this.config = config
  }

  /**
   * Search court records
   */
  async search(request: CourtSearchRequest): Promise<CourtSearchResult> {
    const searchId = `COURT_${Date.now()}_${Math.random().toString(36).substring(7)}`

    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockSearchResult(request, searchId)
      }

      const response = await fetch(`${this.getBaseUrl()}/search`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          name: request.name,
          father_name: request.father_name,
          pan: request.pan,
          cin: request.cin,
          case_types: request.case_types,
          states: request.states,
          include_disposed: request.include_disposed ?? true,
          fuzzy_match: request.fuzzy_match ?? true,
          match_threshold: request.match_threshold || 70
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 60000)
      })

      if (!response.ok) {
        throw new Error(`Court Records API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseSearchResponse(result, searchId)
    } catch (error) {
      return {
        success: false,
        search_id: searchId,
        search_time: new Date().toISOString(),
        total_records: 0,
        pending_cases: 0,
        disposed_cases: 0,
        overall_risk: 'UNKNOWN',
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Court records search failed'
        }
      }
    }
  }

  /**
   * Search by PAN
   */
  async searchByPAN(pan: string, options?: Partial<CourtSearchRequest>): Promise<CourtSearchResult> {
    return this.search({
      pan,
      ...options
    })
  }

  /**
   * Search by CIN (for companies)
   */
  async searchByCIN(cin: string, options?: Partial<CourtSearchRequest>): Promise<CourtSearchResult> {
    return this.search({
      cin,
      ...options
    })
  }

  /**
   * Get case details by case number
   */
  async getCaseDetails(caseNumber: string, courtType?: string): Promise<CaseDetailResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockCaseDetails(caseNumber)
      }

      const response = await fetch(`${this.getBaseUrl()}/case/${encodeURIComponent(caseNumber)}`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Case details API returned ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch case details'
        }
      }
    }
  }

  /**
   * Check for criminal records specifically
   */
  async checkCriminalRecords(name: string, fatherName?: string): Promise<CourtSearchResult> {
    return this.search({
      name,
      father_name: fatherName,
      case_types: ['CRIMINAL'],
      include_disposed: true
    })
  }

  /**
   * Check for cheque bounce cases (Section 138 NI Act)
   */
  async checkChequeBounce(name: string): Promise<CourtSearchResult> {
    return this.search({
      name,
      case_types: ['CHEQUE_BOUNCE'],
      include_disposed: true
    })
  }

  /**
   * Check for bankruptcy/insolvency cases
   */
  async checkBankruptcy(name: string, cin?: string): Promise<CourtSearchResult> {
    return this.search({
      name,
      cin,
      case_types: ['BANKRUPTCY', 'COMPANY'],
      include_disposed: true
    })
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
    const provider = this.config.config?.provider || 'gridlines'

    if (provider === 'karza') {
      return environment === 'production' ? this.KARZA_PRODUCTION_URL : this.KARZA_SANDBOX_URL
    }
    return environment === 'production' ? this.GRIDLINES_PRODUCTION_URL : this.GRIDLINES_SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.api_key || ''}`,
      'X-Api-Key': this.config.config?.api_key || this.config.api_key || '',
      'X-Client-Id': this.config.config?.client_id || ''
    }
  }

  private getMockSearchResult(request: CourtSearchRequest, searchId: string): CourtSearchResult {
    // 15% chance of having court cases
    const hasCases = Math.random() < 0.15
    const caseCount = hasCases ? Math.floor(Math.random() * 3) + 1 : 0

    if (!hasCases) {
      return {
        success: true,
        search_id: searchId,
        search_time: new Date().toISOString(),
        total_records: 0,
        pending_cases: 0,
        disposed_cases: 0,
        overall_risk: 'LOW',
        summary: {
          by_type: {} as Record<CaseType, number>,
          by_status: {} as Record<CaseStatus, number>,
          by_court_type: {},
          as_petitioner: 0,
          as_respondent: 0
        }
      }
    }

    const cases: CourtCase[] = []
    const caseTypes: CaseType[] = ['CIVIL', 'CRIMINAL', 'CONSUMER', 'CHEQUE_BOUNCE', 'LABOUR']
    const courts = [
      { name: 'Delhi High Court', type: 'HIGH_COURT' as const, state: 'Delhi' },
      { name: 'Mumbai City Civil Court', type: 'DISTRICT_COURT' as const, state: 'Maharashtra' },
      { name: 'Consumer Forum - Delhi', type: 'CONSUMER_FORUM' as const, state: 'Delhi' }
    ]

    for (let i = 0; i < caseCount; i++) {
      const isPending = Math.random() < 0.6
      const caseType = caseTypes[Math.floor(Math.random() * caseTypes.length)]
      const court = courts[Math.floor(Math.random() * courts.length)]
      const isRespondent = Math.random() < 0.7

      cases.push({
        case_id: `CASE${Date.now()}${i}`,
        case_number: `CS/${Math.floor(Math.random() * 9000) + 1000}/2024`,
        case_type: caseType,
        case_status: isPending ? 'PENDING' : 'DISPOSED',
        court,
        case_title: `${request.name || 'Party'} vs ${isRespondent ? 'State/Petitioner' : 'Respondent'}`,
        filing_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 2).toISOString().split('T')[0],
        next_hearing_date: isPending ? new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
        disposal_date: !isPending ? new Date().toISOString().split('T')[0] : undefined,
        petitioner: {
          name: isRespondent ? 'COMPLAINANT' : (request.name || 'TEST PARTY'),
          advocate: 'Adv. Sample Lawyer'
        },
        respondent: {
          name: isRespondent ? (request.name || 'TEST PARTY') : 'RESPONDENT',
          advocate: 'Adv. Defense Lawyer'
        },
        matched_party: {
          role: isRespondent ? 'RESPONDENT' : 'PETITIONER',
          name: request.name || 'TEST PARTY',
          match_score: 85 + Math.floor(Math.random() * 15)
        },
        subject: caseType === 'CHEQUE_BOUNCE' ? 'Dishonour of Cheque u/s 138 NI Act' :
          caseType === 'CRIMINAL' ? 'Criminal Complaint' :
            caseType === 'CONSUMER' ? 'Consumer Complaint - Deficiency in Service' :
              'Civil Dispute',
        acts_sections: caseType === 'CHEQUE_BOUNCE' ? ['Section 138 NI Act'] :
          caseType === 'CRIMINAL' ? ['IPC Section 420', 'IPC Section 406'] : undefined,
        risk_level: caseType === 'CRIMINAL' ? 'HIGH' :
          caseType === 'CHEQUE_BOUNCE' ? 'MEDIUM' : 'LOW',
        risk_factors: caseType === 'CRIMINAL' ? ['Criminal case pending', 'Fraud allegations'] :
          caseType === 'CHEQUE_BOUNCE' ? ['Financial dispute', 'Potential liability'] : []
      })
    }

    const pendingCases = cases.filter(c => c.case_status === 'PENDING')
    const criminalCases = cases.filter(c => c.case_type === 'CRIMINAL')

    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
    const riskFactors: string[] = []

    if (criminalCases.length > 0 && criminalCases.some(c => c.case_status === 'PENDING')) {
      overallRisk = 'HIGH'
      riskFactors.push('Pending criminal case')
    } else if (pendingCases.length > 2) {
      overallRisk = 'MEDIUM'
      riskFactors.push('Multiple pending cases')
    } else if (pendingCases.length > 0) {
      overallRisk = 'MEDIUM'
      riskFactors.push('Has pending litigation')
    }

    return {
      success: true,
      search_id: searchId,
      search_time: new Date().toISOString(),
      total_records: cases.length,
      pending_cases: pendingCases.length,
      disposed_cases: cases.length - pendingCases.length,
      cases,
      summary: {
        by_type: cases.reduce((acc, c) => {
          acc[c.case_type] = (acc[c.case_type] || 0) + 1
          return acc
        }, {} as Record<CaseType, number>),
        by_status: cases.reduce((acc, c) => {
          acc[c.case_status] = (acc[c.case_status] || 0) + 1
          return acc
        }, {} as Record<CaseStatus, number>),
        by_court_type: cases.reduce((acc, c) => {
          acc[c.court.type] = (acc[c.court.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        as_petitioner: cases.filter(c => c.matched_party?.role === 'PETITIONER').length,
        as_respondent: cases.filter(c => c.matched_party?.role === 'RESPONDENT').length,
        oldest_case_date: cases[0]?.filing_date,
        newest_case_date: cases[cases.length - 1]?.filing_date
      },
      overall_risk: overallRisk,
      risk_factors
    }
  }

  private getMockCaseDetails(caseNumber: string): CaseDetailResult {
    return {
      success: true,
      case: {
        case_id: `CASE_${Date.now()}`,
        case_number: caseNumber,
        case_type: 'CIVIL',
        case_status: 'PENDING',
        court: {
          name: 'Delhi High Court',
          type: 'HIGH_COURT',
          state: 'Delhi'
        },
        case_title: 'Petitioner vs Respondent',
        filing_date: '2024-01-15',
        next_hearing_date: '2026-02-20',
        petitioner: {
          name: 'PETITIONER NAME',
          advocate: 'Adv. Sample Lawyer'
        },
        respondent: {
          name: 'RESPONDENT NAME',
          advocate: 'Adv. Defense Lawyer'
        },
        subject: 'Civil Suit for Recovery',
        hearing_history: [
          { date: '2024-03-15', purpose: 'First Hearing', outcome: 'Adjourned', next_date: '2024-04-20' },
          { date: '2024-04-20', purpose: 'Arguments', outcome: 'Part Heard', next_date: '2024-05-25' }
        ],
        orders: [
          { date: '2024-03-15', type: 'Interim Order', summary: 'Status quo maintained' }
        ],
        risk_level: 'MEDIUM'
      }
    }
  }

  private parseSearchResponse(response: unknown, searchId: string): CourtSearchResult {
    if (response.error) {
      return {
        success: false,
        search_id: searchId,
        search_time: new Date().toISOString(),
        total_records: 0,
        pending_cases: 0,
        disposed_cases: 0,
        overall_risk: 'UNKNOWN',
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Search failed'
        }
      }
    }

    const cases = response.cases || response.data || []
    const pendingCases = cases.filter((c: unknown) => c.case_status === 'PENDING' || c.status === 'PENDING')

    return {
      success: true,
      search_id: searchId,
      search_time: new Date().toISOString(),
      total_records: cases.length,
      pending_cases: pendingCases.length,
      disposed_cases: cases.length - pendingCases.length,
      cases,
      overall_risk: this.calculateOverallRisk(cases),
      risk_factors: this.extractRiskFactors(cases)
    }
  }

  private calculateOverallRisk(cases: unknown[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (!cases || cases.length === 0) return 'LOW'

    const hasCriminalPending = cases.some(c =>
      (c.case_type === 'CRIMINAL' || c.caseType === 'CRIMINAL') &&
      (c.case_status === 'PENDING' || c.status === 'PENDING')
    )

    if (hasCriminalPending) return 'HIGH'

    const pendingCount = cases.filter(c =>
      c.case_status === 'PENDING' || c.status === 'PENDING'
    ).length

    if (pendingCount > 3) return 'HIGH'
    if (pendingCount > 0) return 'MEDIUM'
    return 'LOW'
  }

  private extractRiskFactors(cases: unknown[]): string[] {
    const factors: string[] = []

    if (!cases || cases.length === 0) return factors

    const criminalCases = cases.filter(c => c.case_type === 'CRIMINAL' || c.caseType === 'CRIMINAL')
    const chequeBounce = cases.filter(c => c.case_type === 'CHEQUE_BOUNCE' || c.caseType === 'CHEQUE_BOUNCE')
    const pendingCases = cases.filter(c => c.case_status === 'PENDING' || c.status === 'PENDING')

    if (criminalCases.length > 0) factors.push(`${criminalCases.length} criminal case(s) found`)
    if (chequeBounce.length > 0) factors.push(`${chequeBounce.length} cheque bounce case(s) found`)
    if (pendingCases.length > 0) factors.push(`${pendingCases.length} pending case(s)`)

    return factors
  }
}

/**
 * Factory function to create Court Records adapter
 */
export function createCourtRecordsAdapter(config: CourtRecordsConfig): CourtRecordsAdapter {
  return new CourtRecordsAdapter(config)
}
