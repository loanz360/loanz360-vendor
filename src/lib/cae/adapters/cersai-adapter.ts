/**
 * CERSAI (Central Registry of Securitisation Asset Reconstruction and Security Interest) Adapter
 * Integrates with CERSAI/Signzy for collateral verification and charge registration check
 * Required for secured loans to verify existing charges on assets
 */

import { CAEProviderConfig } from '../types'

export interface CERSAIConfig extends CAEProviderConfig {
  config?: {
    user_id?: string
    password?: string
    entity_code?: string
    environment?: 'sandbox' | 'production'
    provider?: 'cersai_direct' | 'signzy' | 'karza'
  }
}

export type AssetType =
  | 'IMMOVABLE_PROPERTY'
  | 'MOVABLE_PROPERTY'
  | 'INTANGIBLE_ASSETS'
  | 'RECEIVABLES'
  | 'VEHICLE'
  | 'PLANT_MACHINERY'
  | 'INVENTORY'
  | 'SECURITIES'
  | 'OTHER'

export type ChargeType =
  | 'MORTGAGE'
  | 'HYPOTHECATION'
  | 'PLEDGE'
  | 'ASSIGNMENT'
  | 'SECURITISATION'
  | 'FACTORING'
  | 'OTHER'

export interface AssetSearchRequest {
  // For property search
  property_details?: {
    type: 'LAND' | 'BUILDING' | 'FLAT' | 'PLOT' | 'OTHER'
    survey_number?: string
    plot_number?: string
    khasra_number?: string
    flat_number?: string
    building_name?: string
    locality?: string
    city: string
    district: string
    state: string
    pincode?: string
    area_sqft?: number
  }

  // For vehicle search
  vehicle_details?: {
    registration_number: string
    chassis_number?: string
    engine_number?: string
  }

  // For borrower-based search
  borrower_details?: {
    pan?: string
    cin?: string
    din?: string
    name?: string
    date_of_birth?: string
  }

  // Search options
  asset_type: AssetType
  include_satisfied?: boolean
}

export interface RegisteredCharge {
  charge_id: string
  cersai_id: string
  charge_type: ChargeType
  asset_type: AssetType

  // Secured Creditor Details
  secured_creditor: {
    name: string
    type: 'BANK' | 'NBFC' | 'HFC' | 'ARF' | 'OTHER'
    registration_number?: string
    address?: string
  }

  // Borrower Details
  borrower: {
    name: string
    type: 'INDIVIDUAL' | 'COMPANY' | 'PARTNERSHIP' | 'LLP' | 'OTHER'
    pan?: string
    cin?: string
    address?: string
  }

  // Asset Description
  asset_description: {
    description: string
    location?: string
    identification_number?: string
    value?: number
  }

  // Charge Details
  charge_amount: number
  currency: string
  date_of_creation: string
  date_of_registration: string
  date_of_modification?: string
  date_of_satisfaction?: string
  status: 'ACTIVE' | 'SATISFIED' | 'MODIFIED' | 'UNDER_MODIFICATION'

  // Document Details
  document_details?: {
    document_type: string
    document_number?: string
    document_date?: string
  }
}

export interface CERSAISearchResult {
  success: boolean
  search_id: string
  search_time: string
  total_records: number
  charges?: RegisteredCharge[]
  has_active_charges: boolean
  total_charge_amount?: number
  summary?: {
    active_charges: number
    satisfied_charges: number
    total_secured_creditors: number
    oldest_charge_date?: string
    latest_charge_date?: string
  }
  error?: {
    code: string
    message: string
  }
}

export interface ChargeRegistrationRequest {
  charge_type: ChargeType
  asset_type: AssetType

  // Asset Details
  asset_details: {
    description: string
    identification_number?: string
    location?: string
    value: number
  }

  // Borrower Details
  borrower: {
    name: string
    type: 'INDIVIDUAL' | 'COMPANY'
    pan?: string
    cin?: string
    address: string
    state: string
    pincode: string
  }

  // Charge Details
  charge_amount: number
  date_of_creation: string

  // Document Details
  document: {
    type: string
    number: string
    date: string
  }
}

export interface ChargeRegistrationResult {
  success: boolean
  cersai_id?: string
  charge_id?: string
  registration_date?: string
  status?: 'REGISTERED' | 'PENDING' | 'REJECTED'
  rejection_reason?: string
  error?: {
    code: string
    message: string
  }
}

export class CERSAIAdapter {
  private config: CERSAIConfig
  private readonly CERSAI_URL = 'https://www.cersai.org.in/CERSAI/services'
  private readonly SIGNZY_SANDBOX_URL = 'https://sandbox.signzy.com/api/v3/cersai'
  private readonly SIGNZY_PRODUCTION_URL = 'https://api.signzy.com/v3/cersai'

  constructor(config: CERSAIConfig) {
    this.config = config
  }

  /**
   * Search for existing charges on an asset
   */
  async searchCharges(request: AssetSearchRequest): Promise<CERSAISearchResult> {
    const searchId = `CERSAI_${Date.now()}_${Math.random().toString(36).substring(7)}`

    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockSearchResult(request, searchId)
      }

      const provider = this.config.config?.provider || 'signzy'

      if (provider === 'cersai_direct') {
        return await this.searchDirectCERSAI(request, searchId)
      } else {
        return await this.searchViaSignzy(request, searchId)
      }
    } catch (error) {
      return {
        success: false,
        search_id: searchId,
        search_time: new Date().toISOString(),
        total_records: 0,
        has_active_charges: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'CERSAI search failed'
        }
      }
    }
  }

  /**
   * Search charges by borrower PAN/CIN
   */
  async searchByBorrower(identifier: string, identifierType: 'PAN' | 'CIN'): Promise<CERSAISearchResult> {
    return this.searchCharges({
      asset_type: 'OTHER',
      borrower_details: {
        [identifierType.toLowerCase()]: identifier
      }
    })
  }

  /**
   * Search charges on vehicle
   */
  async searchVehicleCharges(registrationNumber: string, chassisNumber?: string): Promise<CERSAISearchResult> {
    return this.searchCharges({
      asset_type: 'VEHICLE',
      vehicle_details: {
        registration_number: registrationNumber,
        chassis_number: chassisNumber
      }
    })
  }

  /**
   * Search charges on property
   */
  async searchPropertyCharges(propertyDetails: AssetSearchRequest['property_details']): Promise<CERSAISearchResult> {
    if (!propertyDetails) {
      return {
        success: false,
        search_id: '',
        search_time: new Date().toISOString(),
        total_records: 0,
        has_active_charges: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Property details are required'
        }
      }
    }

    return this.searchCharges({
      asset_type: 'IMMOVABLE_PROPERTY',
      property_details: propertyDetails
    })
  }

  /**
   * Verify if a specific CERSAI charge ID is valid and get its status
   */
  async verifyCharge(cersaiId: string): Promise<{
    success: boolean
    charge?: RegisteredCharge
    error?: { code: string; message: string }
  }> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return {
          success: true,
          charge: {
            charge_id: cersaiId,
            cersai_id: cersaiId,
            charge_type: 'MORTGAGE',
            asset_type: 'IMMOVABLE_PROPERTY',
            secured_creditor: {
              name: 'HDFC Bank Ltd',
              type: 'BANK'
            },
            borrower: {
              name: 'TEST BORROWER',
              type: 'INDIVIDUAL'
            },
            asset_description: {
              description: 'Residential Property',
              location: 'Mumbai'
            },
            charge_amount: 5000000,
            currency: 'INR',
            date_of_creation: '2023-01-15',
            date_of_registration: '2023-01-20',
            status: 'ACTIVE'
          }
        }
      }

      const response = await fetch(`${this.getBaseUrl()}/verify/${cersaiId}`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Verify API returned ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VERIFY_FAILED',
          message: error instanceof Error ? error.message : 'Charge verification failed'
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

  private async searchDirectCERSAI(request: AssetSearchRequest, searchId: string): Promise<CERSAISearchResult> {
    // Direct CERSAI integration would require specific credentials and SOAP/REST calls
    // This is a placeholder for direct integration
    throw new Error('Direct CERSAI integration not implemented. Use Signzy provider.')
  }

  private async searchViaSignzy(request: AssetSearchRequest, searchId: string): Promise<CERSAISearchResult> {
    const response = await fetch(`${this.getBaseUrl()}/search`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        asset_type: request.asset_type,
        property_details: request.property_details,
        vehicle_details: request.vehicle_details,
        borrower_details: request.borrower_details,
        include_satisfied: request.include_satisfied || false
      }),
      signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
    })

    if (!response.ok) {
      throw new Error(`CERSAI search API returned ${response.status}`)
    }

    const result = await response.json()
    return this.parseSearchResponse(result, searchId)
  }

  private getBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    const provider = this.config.config?.provider || 'signzy'

    if (provider === 'cersai_direct') {
      return this.CERSAI_URL
    }
    return environment === 'production' ? this.SIGNZY_PRODUCTION_URL : this.SIGNZY_SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.config.api_key || ''}`,
      'x-entity-code': this.config.config?.entity_code || ''
    }
  }

  private getMockSearchResult(request: AssetSearchRequest, searchId: string): CERSAISearchResult {
    // 20% chance of having existing charges for testing
    const hasCharges = Math.random() < 0.20
    const chargeCount = hasCharges ? Math.floor(Math.random() * 2) + 1 : 0

    if (!hasCharges) {
      return {
        success: true,
        search_id: searchId,
        search_time: new Date().toISOString(),
        total_records: 0,
        has_active_charges: false,
        summary: {
          active_charges: 0,
          satisfied_charges: 0,
          total_secured_creditors: 0
        }
      }
    }

    const charges: RegisteredCharge[] = []

    for (let i = 0; i < chargeCount; i++) {
      const isSatisfied = Math.random() < 0.3
      const chargeAmount = (Math.floor(Math.random() * 50) + 10) * 100000

      charges.push({
        charge_id: `CHG${Date.now()}${i}`,
        cersai_id: `CERSAI${Date.now()}${i}`,
        charge_type: request.asset_type === 'VEHICLE' ? 'HYPOTHECATION' : 'MORTGAGE',
        asset_type: request.asset_type,
        secured_creditor: {
          name: ['HDFC Bank Ltd', 'ICICI Bank Ltd', 'SBI', 'Axis Bank'][Math.floor(Math.random() * 4)],
          type: 'BANK'
        },
        borrower: {
          name: request.borrower_details?.name || 'TEST BORROWER',
          type: 'INDIVIDUAL',
          pan: request.borrower_details?.pan
        },
        asset_description: {
          description: request.asset_type === 'VEHICLE'
            ? `Vehicle: ${request.vehicle_details?.registration_number || 'MH01AB1234'}`
            : `Property at ${request.property_details?.city || 'Mumbai'}`,
          location: request.property_details?.city || 'Mumbai',
          identification_number: request.vehicle_details?.registration_number ||
            request.property_details?.survey_number
        },
        charge_amount: chargeAmount,
        currency: 'INR',
        date_of_creation: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split('T')[0],
        date_of_registration: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split('T')[0],
        date_of_satisfaction: isSatisfied ? new Date().toISOString().split('T')[0] : undefined,
        status: isSatisfied ? 'SATISFIED' : 'ACTIVE'
      })
    }

    const activeCharges = charges.filter(c => c.status === 'ACTIVE')
    const totalChargeAmount = activeCharges.reduce((sum, c) => sum + c.charge_amount, 0)

    return {
      success: true,
      search_id: searchId,
      search_time: new Date().toISOString(),
      total_records: charges.length,
      charges,
      has_active_charges: activeCharges.length > 0,
      total_charge_amount: totalChargeAmount,
      summary: {
        active_charges: activeCharges.length,
        satisfied_charges: charges.length - activeCharges.length,
        total_secured_creditors: new Set(charges.map(c => c.secured_creditor.name)).size,
        oldest_charge_date: charges[0]?.date_of_creation,
        latest_charge_date: charges[charges.length - 1]?.date_of_creation
      }
    }
  }

  private parseSearchResponse(response: any, searchId: string): CERSAISearchResult {
    if (response.error) {
      return {
        success: false,
        search_id: searchId,
        search_time: new Date().toISOString(),
        total_records: 0,
        has_active_charges: false,
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Search failed'
        }
      }
    }

    const charges = response.charges || response.data || []
    const activeCharges = charges.filter((c: any) => c.status === 'ACTIVE')

    return {
      success: true,
      search_id: searchId,
      search_time: new Date().toISOString(),
      total_records: charges.length,
      charges,
      has_active_charges: activeCharges.length > 0,
      total_charge_amount: activeCharges.reduce((sum: number, c: any) => sum + (c.charge_amount || 0), 0),
      summary: {
        active_charges: activeCharges.length,
        satisfied_charges: charges.length - activeCharges.length,
        total_secured_creditors: new Set(charges.map((c: any) => c.secured_creditor?.name)).size
      }
    }
  }
}

/**
 * Factory function to create CERSAI adapter
 */
export function createCERSAIAdapter(config: CERSAIConfig): CERSAIAdapter {
  return new CERSAIAdapter(config)
}
