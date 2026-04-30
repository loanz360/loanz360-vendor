/**
 * AML (Anti-Money Laundering) & PEP Screening Adapter
 * Integrates with ComplyAdvantage/Bureau/Dow Jones for compliance screening
 * Supports PEP, Sanctions, Adverse Media, and Watchlist screening
 */

import { CAEProviderConfig } from '../types'

export interface AMLScreeningConfig extends CAEProviderConfig {
  config?: {
    api_key?: string
    client_id?: string
    environment?: 'sandbox' | 'production'
    provider?: 'comply_advantage' | 'bureau' | 'dow_jones' | 'world_check'
  }
}

export type ScreeningType =
  | 'PEP' // Politically Exposed Person
  | 'SANCTIONS' // OFAC, UN, EU sanctions lists
  | 'ADVERSE_MEDIA' // Negative news screening
  | 'WATCHLIST' // Other watchlists (FBI, Interpol, etc.)
  | 'FULL' // All of the above

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'

export interface ScreeningRequest {
  // Person details
  full_name: string
  date_of_birth?: string
  nationality?: string
  country_of_residence?: string

  // Entity details (for business screening)
  entity_name?: string
  entity_type?: string
  registration_country?: string

  // Identifiers
  pan?: string
  passport_number?: string

  // Screening options
  screening_types?: ScreeningType[]
  fuzziness_level?: number // 0-100, higher = more fuzzy matching
  include_aliases?: boolean
  include_associates?: boolean
}

export interface MatchedEntity {
  entity_id: string
  match_score: number // 0-100
  matched_name: string
  entity_type: 'PERSON' | 'ENTITY' | 'VESSEL' | 'AIRCRAFT'

  // Source information
  source: string
  source_url?: string
  last_updated: string

  // Classification
  categories: string[]
  subcategories?: string[]

  // Details
  details: {
    full_name?: string
    aliases?: string[]
    date_of_birth?: string
    nationality?: string[]
    country?: string[]
    address?: string[]
    identification?: Array<{
      type: string
      number: string
      country?: string
    }>
    position?: string // For PEP
    political_party?: string
    associates?: Array<{
      name: string
      relationship: string
    }>
  }

  // Sanctions specific
  sanctions_info?: {
    list_name: string
    listed_date?: string
    programs?: string[]
    reasons?: string[]
  }

  // PEP specific
  pep_info?: {
    pep_type: 'DIRECT' | 'FAMILY' | 'ASSOCIATE'
    position: string
    country: string
    start_date?: string
    end_date?: string
    is_current: boolean
  }

  // Adverse media specific
  adverse_media_info?: {
    article_count: number
    categories: string[]
    latest_article_date?: string
    sources?: Array<{
      name: string
      url: string
      date: string
      snippet: string
    }>
  }
}

export interface ScreeningResult {
  success: boolean
  screening_id: string
  screening_time: string
  risk_level: RiskLevel
  total_matches: number

  // Summary counts
  summary: {
    pep_matches: number
    sanctions_matches: number
    adverse_media_matches: number
    watchlist_matches: number
  }

  // Detailed matches
  matches?: MatchedEntity[]

  // Recommendation
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT' | 'ENHANCED_DUE_DILIGENCE'
  recommendation_reason?: string

  error?: {
    code: string
    message: string
  }
}

export interface OngoingMonitoringConfig {
  screening_id: string
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  webhook_url?: string
  notification_email?: string
  auto_resolve_low_risk?: boolean
}

export interface MonitoringAlert {
  alert_id: string
  screening_id: string
  alert_type: 'NEW_MATCH' | 'UPDATED_MATCH' | 'REMOVED_MATCH' | 'RISK_CHANGE'
  entity: MatchedEntity
  previous_risk_level?: RiskLevel
  new_risk_level: RiskLevel
  created_at: string
}

export class AMLScreeningAdapter {
  private config: AMLScreeningConfig
  private readonly COMPLY_ADVANTAGE_SANDBOX_URL = 'https://api.sandbox.complyadvantage.com/searches'
  private readonly COMPLY_ADVANTAGE_PRODUCTION_URL = 'https://api.complyadvantage.com/searches'
  private readonly BUREAU_SANDBOX_URL = 'https://sandbox.bureau.id/v1/aml'
  private readonly BUREAU_PRODUCTION_URL = 'https://api.bureau.id/v1/aml'

  constructor(config: AMLScreeningConfig) {
    this.config = config
  }

  /**
   * Screen individual or entity
   */
  async screen(request: ScreeningRequest): Promise<ScreeningResult> {
    const screeningId = `AML_${Date.now()}_${Math.random().toString(36).substring(7)}`

    try {
      const environment = this.config.config?.environment || 'sandbox'
      const screeningTypes = request.screening_types || ['FULL']

      if (environment === 'sandbox') {
        return this.getMockScreeningResult(request, screeningId, screeningTypes)
      }

      const response = await fetch(`${this.getBaseUrl()}/screen`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          search_term: request.full_name || request.entity_name,
          client_ref: screeningId,
          fuzziness: request.fuzziness_level || 0.6,
          filters: {
            birth_year: request.date_of_birth?.substring(0, 4),
            country_codes: request.country_of_residence ? [request.country_of_residence] : [],
            types: this.mapScreeningTypes(screeningTypes)
          },
          share_url: false
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`AML Screening API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseScreeningResponse(result, screeningId)
    } catch (error) {
      return {
        success: false,
        screening_id: screeningId,
        screening_time: new Date().toISOString(),
        risk_level: 'UNKNOWN',
        total_matches: 0,
        summary: {
          pep_matches: 0,
          sanctions_matches: 0,
          adverse_media_matches: 0,
          watchlist_matches: 0
        },
        recommendation: 'REVIEW',
        error: {
          code: 'SCREENING_FAILED',
          message: error instanceof Error ? error.message : 'AML screening failed'
        }
      }
    }
  }

  /**
   * Get screening result by ID
   */
  async getScreeningResult(screeningId: string): Promise<ScreeningResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockScreeningResult({ full_name: 'TEST USER' }, screeningId, ['FULL'])
      }

      const response = await fetch(`${this.getBaseUrl()}/searches/${screeningId}`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Get screening failed: ${response.status}`)
      }

      return this.parseScreeningResponse(await response.json(), screeningId)
    } catch (error) {
      return {
        success: false,
        screening_id: screeningId,
        screening_time: new Date().toISOString(),
        risk_level: 'UNKNOWN',
        total_matches: 0,
        summary: {
          pep_matches: 0,
          sanctions_matches: 0,
          adverse_media_matches: 0,
          watchlist_matches: 0
        },
        recommendation: 'REVIEW',
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get screening result'
        }
      }
    }
  }

  /**
   * Set up ongoing monitoring for an entity
   */
  async setupMonitoring(config: OngoingMonitoringConfig): Promise<{ success: boolean; monitoring_id?: string; error?: { code: string; message: string } }> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return {
          success: true,
          monitoring_id: `MON_${Date.now()}`
        }
      }

      const response = await fetch(`${this.getBaseUrl()}/monitoring`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          search_id: config.screening_id,
          frequency: config.frequency,
          webhook_url: config.webhook_url
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Monitoring setup failed: ${response.status}`)
      }

      const result = await response.json()
      return {
        success: true,
        monitoring_id: result.monitoring_id || result.id
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MONITORING_SETUP_FAILED',
          message: error instanceof Error ? error.message : 'Failed to setup monitoring'
        }
      }
    }
  }

  /**
   * Check India-specific lists (Willful Defaulter, RBI Caution List)
   */
  async checkIndiaLists(pan: string): Promise<{
    success: boolean
    is_willful_defaulter: boolean
    is_on_rbi_caution_list: boolean
    details?: Array<{
      list_name: string
      bank_name?: string
      amount?: number
      date_listed?: string
    }>
    error?: { code: string; message: string }
  }> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        // 5% chance of being on a list for testing
        const isDefaulter = Math.random() < 0.05

        return {
          success: true,
          is_willful_defaulter: isDefaulter,
          is_on_rbi_caution_list: false,
          details: isDefaulter ? [
            {
              list_name: 'Willful Defaulter List',
              bank_name: 'Sample Bank',
              amount: 5000000,
              date_listed: '2023-01-15'
            }
          ] : []
        }
      }

      const response = await fetch(`${this.getBaseUrl()}/india/defaulter-check`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({ pan }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`India lists check failed: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        is_willful_defaulter: false,
        is_on_rbi_caution_list: false,
        error: {
          code: 'CHECK_FAILED',
          message: error instanceof Error ? error.message : 'India lists check failed'
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
    const provider = this.config.config?.provider || 'comply_advantage'

    if (provider === 'bureau') {
      return environment === 'production' ? this.BUREAU_PRODUCTION_URL : this.BUREAU_SANDBOX_URL
    }
    return environment === 'production' ? this.COMPLY_ADVANTAGE_PRODUCTION_URL : this.COMPLY_ADVANTAGE_SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Token ${this.config.api_key || this.config.config?.api_key || ''}`
    }
  }

  private mapScreeningTypes(types: ScreeningType[]): string[] {
    const mapping: Record<ScreeningType, string[]> = {
      'PEP': ['pep'],
      'SANCTIONS': ['sanction'],
      'ADVERSE_MEDIA': ['adverse-media'],
      'WATCHLIST': ['warning', 'fitness-probity'],
      'FULL': ['pep', 'sanction', 'adverse-media', 'warning', 'fitness-probity']
    }

    const result: string[] = []
    for (const type of types) {
      result.push(...(mapping[type] || []))
    }
    return [...new Set(result)]
  }

  private getMockScreeningResult(
    request: ScreeningRequest,
    screeningId: string,
    types: ScreeningType[]
  ): ScreeningResult {
    // 90% clean, 8% low-risk matches, 2% high-risk matches
    const random = Math.random()
    const hasMatches = random > 0.90
    const isHighRisk = random > 0.98

    if (!hasMatches) {
      return {
        success: true,
        screening_id: screeningId,
        screening_time: new Date().toISOString(),
        risk_level: 'LOW',
        total_matches: 0,
        summary: {
          pep_matches: 0,
          sanctions_matches: 0,
          adverse_media_matches: 0,
          watchlist_matches: 0
        },
        recommendation: 'APPROVE',
        recommendation_reason: 'No matches found in screening databases'
      }
    }

    const matches: MatchedEntity[] = []

    if (isHighRisk) {
      // Sanctions match
      matches.push({
        entity_id: `ENT_${Date.now()}`,
        match_score: 95,
        matched_name: request.full_name || 'SIMILAR NAME',
        entity_type: 'PERSON',
        source: 'OFAC SDN List',
        last_updated: new Date().toISOString(),
        categories: ['SANCTIONS'],
        details: {
          full_name: request.full_name,
          aliases: ['ALIAS ONE', 'ALIAS TWO'],
          nationality: ['India'],
          country: ['India']
        },
        sanctions_info: {
          list_name: 'OFAC SDN',
          listed_date: '2023-05-15',
          programs: ['SDGT'],
          reasons: ['Terrorism related']
        }
      })
    } else {
      // PEP match (lower risk)
      matches.push({
        entity_id: `ENT_${Date.now()}`,
        match_score: 75,
        matched_name: request.full_name || 'SIMILAR NAME',
        entity_type: 'PERSON',
        source: 'Global PEP Database',
        last_updated: new Date().toISOString(),
        categories: ['PEP'],
        details: {
          full_name: request.full_name,
          nationality: ['India'],
          position: 'Former State Minister'
        },
        pep_info: {
          pep_type: 'DIRECT',
          position: 'Former State Minister',
          country: 'India',
          start_date: '2015-01-01',
          end_date: '2020-12-31',
          is_current: false
        }
      })
    }

    return {
      success: true,
      screening_id: screeningId,
      screening_time: new Date().toISOString(),
      risk_level: isHighRisk ? 'CRITICAL' : 'MEDIUM',
      total_matches: matches.length,
      summary: {
        pep_matches: isHighRisk ? 0 : 1,
        sanctions_matches: isHighRisk ? 1 : 0,
        adverse_media_matches: 0,
        watchlist_matches: 0
      },
      matches,
      recommendation: isHighRisk ? 'REJECT' : 'ENHANCED_DUE_DILIGENCE',
      recommendation_reason: isHighRisk
        ? 'Match found on sanctions list - requires immediate review'
        : 'PEP match found - enhanced due diligence recommended'
    }
  }

  private parseScreeningResponse(response: unknown, screeningId: string): ScreeningResult {
    if (response.error) {
      return {
        success: false,
        screening_id: screeningId,
        screening_time: new Date().toISOString(),
        risk_level: 'UNKNOWN',
        total_matches: 0,
        summary: {
          pep_matches: 0,
          sanctions_matches: 0,
          adverse_media_matches: 0,
          watchlist_matches: 0
        },
        recommendation: 'REVIEW',
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Screening failed'
        }
      }
    }

    const matches = response.data?.hits || []
    const pepMatches = matches.filter((m: unknown) => m.types?.includes('pep')).length
    const sanctionsMatches = matches.filter((m: unknown) => m.types?.includes('sanction')).length
    const adverseMediaMatches = matches.filter((m: unknown) => m.types?.includes('adverse-media')).length
    const watchlistMatches = matches.filter((m: unknown) => m.types?.includes('warning')).length

    let riskLevel: RiskLevel = 'LOW'
    let recommendation: 'APPROVE' | 'REVIEW' | 'REJECT' | 'ENHANCED_DUE_DILIGENCE' = 'APPROVE'

    if (sanctionsMatches > 0) {
      riskLevel = 'CRITICAL'
      recommendation = 'REJECT'
    } else if (pepMatches > 0) {
      riskLevel = 'MEDIUM'
      recommendation = 'ENHANCED_DUE_DILIGENCE'
    } else if (adverseMediaMatches > 0 || watchlistMatches > 0) {
      riskLevel = 'MEDIUM'
      recommendation = 'REVIEW'
    }

    return {
      success: true,
      screening_id: screeningId,
      screening_time: new Date().toISOString(),
      risk_level: riskLevel,
      total_matches: matches.length,
      summary: {
        pep_matches: pepMatches,
        sanctions_matches: sanctionsMatches,
        adverse_media_matches: adverseMediaMatches,
        watchlist_matches: watchlistMatches
      },
      matches: this.parseMatches(matches),
      recommendation,
      recommendation_reason: this.getRecommendationReason(riskLevel, matches.length)
    }
  }

  private parseMatches(hits: unknown[]): MatchedEntity[] {
    return hits.map((hit: unknown) => ({
      entity_id: hit.id || hit.doc?.id,
      match_score: hit.match_score || hit.score || 0,
      matched_name: hit.doc?.name || hit.name,
      entity_type: hit.doc?.entity_type === 'company' ? 'ENTITY' : 'PERSON',
      source: hit.doc?.source || 'Unknown',
      source_url: hit.doc?.source_url,
      last_updated: hit.doc?.last_updated || new Date().toISOString(),
      categories: hit.doc?.types || [],
      details: {
        full_name: hit.doc?.name,
        aliases: hit.doc?.aka || [],
        date_of_birth: hit.doc?.fields?.date_of_birth?.[0]?.value,
        nationality: hit.doc?.fields?.nationality?.map((n: unknown) => n.value) || [],
        country: hit.doc?.fields?.country_codes || []
      }
    }))
  }

  private getRecommendationReason(riskLevel: RiskLevel, matchCount: number): string {
    if (matchCount === 0) {
      return 'No matches found in screening databases'
    }

    switch (riskLevel) {
      case 'CRITICAL':
        return 'Critical risk - sanctions match found, immediate review required'
      case 'HIGH':
        return 'High risk matches found - manual review required'
      case 'MEDIUM':
        return 'Medium risk matches found - enhanced due diligence recommended'
      default:
        return 'Low risk matches found - standard processing allowed'
    }
  }
}

/**
 * Factory function to create AML Screening adapter
 */
export function createAMLScreeningAdapter(config: AMLScreeningConfig): AMLScreeningAdapter {
  return new AMLScreeningAdapter(config)
}
