/**
 * MCA (Ministry of Corporate Affairs) Verification Adapter
 * Integrates with Karza/Signzy for company, director, and business verification
 * Supports CIN, DIN, LLPIN validation and company details fetch
 */

import { CAEProviderConfig } from '../types'

export interface MCAConfig extends CAEProviderConfig {
  config?: {
    client_id?: string
    client_secret?: string
    environment?: 'sandbox' | 'production'
    provider?: 'karza' | 'signzy'
  }
}

export type CompanyType =
  | 'PRIVATE_LIMITED'
  | 'PUBLIC_LIMITED'
  | 'ONE_PERSON_COMPANY'
  | 'LLP'
  | 'SECTION_8'
  | 'PARTNERSHIP'
  | 'PROPRIETORSHIP'
  | 'FOREIGN'
  | 'OTHER'

export type CompanyStatus =
  | 'ACTIVE'
  | 'UNDER_LIQUIDATION'
  | 'STRUCK_OFF'
  | 'DORMANT'
  | 'AMALGAMATED'
  | 'CONVERTED_TO_LLP'
  | 'DISSOLVED'
  | 'UNKNOWN'

export interface CompanySearchRequest {
  company_name?: string
  cin?: string // Corporate Identification Number
  llpin?: string // LLP Identification Number
  pan?: string
  state?: string
}

export interface DirectorSearchRequest {
  din?: string // Director Identification Number
  pan?: string
  name?: string
}

export interface CompanyDetails {
  cin: string
  company_name: string
  company_type: CompanyType
  company_status: CompanyStatus
  registration_date: string
  registration_number?: string
  roc: string // Registrar of Companies

  // Address
  registered_address: {
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
    country: string
  }

  // Capital Structure
  authorized_capital: number
  paid_up_capital: number

  // Activity
  main_business_activity?: string
  industrial_class?: string
  sub_category?: string

  // Contact
  email?: string

  // Dates
  last_agm_date?: string
  last_balance_sheet_date?: string
  last_annual_return_date?: string

  // Compliance
  compliance_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNKNOWN'
  annual_filing_status?: string
  charges_count?: number

  // Directors
  directors: DirectorInfo[]
}

export interface DirectorInfo {
  din: string
  name: string
  designation: string
  appointment_date: string
  cessation_date?: string
  is_current: boolean
  dob?: string
  nationality?: string
  pan_masked?: string
  other_directorships?: Array<{
    cin: string
    company_name: string
    designation: string
    status: string
  }>
  disqualification_status?: 'NONE' | 'DISQUALIFIED' | 'STRUCK_OFF'
}

export interface ChargeDetails {
  charge_id: string
  charge_holder: string
  charge_amount?: number
  date_of_creation: string
  date_of_modification?: string
  date_of_satisfaction?: string
  status: 'OPEN' | 'SATISFIED' | 'MODIFIED'
  assets_under_charge?: string
}

export interface CompanyVerificationResult {
  success: boolean
  verification_time: string
  data?: CompanyDetails
  charges?: ChargeDetails[]
  flags?: Array<{
    type: 'WARNING' | 'CRITICAL' | 'INFO'
    code: string
    message: string
  }>
  error?: {
    code: string
    message: string
  }
}

export interface DirectorVerificationResult {
  success: boolean
  verification_time: string
  data?: DirectorInfo & {
    total_directorships: number
    active_directorships: number
    current_companies: Array<{
      cin: string
      company_name: string
      designation: string
      status: CompanyStatus
      appointment_date: string
    }>
    past_companies: Array<{
      cin: string
      company_name: string
      designation: string
      cessation_date: string
    }>
  }
  flags?: Array<{
    type: 'WARNING' | 'CRITICAL' | 'INFO'
    code: string
    message: string
  }>
  error?: {
    code: string
    message: string
  }
}

export interface UdyamVerificationResult {
  success: boolean
  verification_time: string
  data?: {
    udyam_number: string
    enterprise_name: string
    enterprise_type: 'MICRO' | 'SMALL' | 'MEDIUM'
    social_category?: string
    date_of_incorporation: string
    major_activity: string
    nic_2_digit: string
    nic_4_digit: string
    nic_5_digit: string
    owner_name: string
    gender?: string
    mobile?: string
    email?: string
    address: {
      flat: string
      building?: string
      street?: string
      city: string
      district: string
      state: string
      pincode: string
    }
    bank_details?: {
      bank_name: string
      ifsc: string
      account_number_masked: string
    }
    investment_in_plant_machinery?: number
    turnover?: number
    district_industry_center?: string
  }
  error?: {
    code: string
    message: string
  }
}

export class MCAAdapter {
  private config: MCAConfig
  private readonly KARZA_SANDBOX_URL = 'https://sandbox.karza.in/v3'
  private readonly KARZA_PRODUCTION_URL = 'https://api.karza.in/v3'
  private readonly SIGNZY_SANDBOX_URL = 'https://sandbox.signzy.com/api/v3'
  private readonly SIGNZY_PRODUCTION_URL = 'https://api.signzy.com/v3'

  constructor(config: MCAConfig) {
    this.config = config
  }

  /**
   * Search and verify company by CIN/Name
   */
  async verifyCompany(request: CompanySearchRequest): Promise<CompanyVerificationResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockCompanyResult(request)
      }

      const response = await fetch(`${this.getBaseUrl()}/mca/company`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          cin: request.cin,
          company_name: request.company_name,
          consent: 'Y'
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`MCA API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseCompanyResponse(result)
    } catch (error) {
      return {
        success: false,
        verification_time: new Date().toISOString(),
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Company verification failed'
        }
      }
    }
  }

  /**
   * Verify director by DIN
   */
  async verifyDirector(request: DirectorSearchRequest): Promise<DirectorVerificationResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockDirectorResult(request)
      }

      const response = await fetch(`${this.getBaseUrl()}/mca/director`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          din: request.din,
          pan: request.pan,
          consent: 'Y'
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`MCA Director API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseDirectorResponse(result)
    } catch (error) {
      return {
        success: false,
        verification_time: new Date().toISOString(),
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Director verification failed'
        }
      }
    }
  }

  /**
   * Verify Udyam/MSME registration
   */
  async verifyUdyam(udyamNumber: string): Promise<UdyamVerificationResult> {
    try {
      // Validate Udyam format: UDYAM-XX-00-0000000
      if (!/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(udyamNumber.toUpperCase())) {
        return {
          success: false,
          verification_time: new Date().toISOString(),
          error: {
            code: 'INVALID_FORMAT',
            message: 'Invalid Udyam number format. Expected: UDYAM-XX-00-0000000'
          }
        }
      }

      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockUdyamResult(udyamNumber)
      }

      const response = await fetch(`${this.getBaseUrl()}/udyam/verify`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          udyam_number: udyamNumber.toUpperCase(),
          consent: 'Y'
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Udyam API returned ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        verification_time: new Date().toISOString(),
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Udyam verification failed'
        }
      }
    }
  }

  /**
   * Get company charges/encumbrances
   */
  async getCompanyCharges(cin: string): Promise<{ success: boolean; charges?: ChargeDetails[]; error?: { code: string; message: string } }> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return {
          success: true,
          charges: [
            {
              charge_id: 'CHG001',
              charge_holder: 'HDFC Bank Ltd',
              charge_amount: 5000000,
              date_of_creation: '2023-01-15',
              status: 'OPEN',
              assets_under_charge: 'All present and future movable and immovable assets'
            }
          ]
        }
      }

      const response = await fetch(`${this.getBaseUrl()}/mca/charges/${cin}`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000)
      })

      if (!response.ok) {
        throw new Error(`Charges API returned ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch charges'
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
    const provider = this.config.config?.provider || 'karza'

    if (provider === 'signzy') {
      return environment === 'production' ? this.SIGNZY_PRODUCTION_URL : this.SIGNZY_SANDBOX_URL
    }
    return environment === 'production' ? this.KARZA_PRODUCTION_URL : this.KARZA_SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-karza-key': this.config.api_key || '',
      'Authorization': `Bearer ${this.config.api_key || ''}`
    }
  }

  private getMockCompanyResult(request: CompanySearchRequest): CompanyVerificationResult {
    const mockCIN = request.cin || 'U72200MH2015PTC123456'

    return {
      success: true,
      verification_time: new Date().toISOString(),
      data: {
        cin: mockCIN,
        company_name: request.company_name || 'TEST TECHNOLOGIES PRIVATE LIMITED',
        company_type: 'PRIVATE_LIMITED',
        company_status: 'ACTIVE',
        registration_date: '2015-03-15',
        registration_number: '123456',
        roc: 'RoC-Mumbai',
        registered_address: {
          line1: '123, Business Park',
          line2: 'Tech Hub',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        },
        authorized_capital: 10000000,
        paid_up_capital: 5000000,
        main_business_activity: 'Computer programming, consultancy and related activities',
        industrial_class: 'Computer Programming Activities',
        email: 'info@testtech.com',
        last_agm_date: '2025-09-30',
        last_balance_sheet_date: '2025-03-31',
        last_annual_return_date: '2025-03-31',
        compliance_status: 'COMPLIANT',
        charges_count: 1,
        directors: [
          {
            din: '01234567',
            name: 'AMIT KUMAR SHARMA',
            designation: 'Managing Director',
            appointment_date: '2015-03-15',
            is_current: true,
            nationality: 'Indian',
            disqualification_status: 'NONE'
          },
          {
            din: '07654321',
            name: 'PRIYA PATEL',
            designation: 'Director',
            appointment_date: '2018-06-01',
            is_current: true,
            nationality: 'Indian',
            disqualification_status: 'NONE'
          }
        ]
      },
      flags: []
    }
  }

  private getMockDirectorResult(request: DirectorSearchRequest): DirectorVerificationResult {
    return {
      success: true,
      verification_time: new Date().toISOString(),
      data: {
        din: request.din || '01234567',
        name: request.name || 'AMIT KUMAR SHARMA',
        designation: 'Managing Director',
        appointment_date: '2015-03-15',
        is_current: true,
        dob: '1985-05-15',
        nationality: 'Indian',
        pan_masked: 'XXXXX1234X',
        disqualification_status: 'NONE',
        total_directorships: 3,
        active_directorships: 2,
        current_companies: [
          {
            cin: 'U72200MH2015PTC123456',
            company_name: 'TEST TECHNOLOGIES PRIVATE LIMITED',
            designation: 'Managing Director',
            status: 'ACTIVE',
            appointment_date: '2015-03-15'
          },
          {
            cin: 'U74999MH2020PTC234567',
            company_name: 'ANOTHER COMPANY PRIVATE LIMITED',
            designation: 'Director',
            status: 'ACTIVE',
            appointment_date: '2020-01-10'
          }
        ],
        past_companies: [
          {
            cin: 'U99999MH2010PTC111111',
            company_name: 'OLD COMPANY PRIVATE LIMITED',
            designation: 'Director',
            cessation_date: '2018-12-31'
          }
        ]
      },
      flags: []
    }
  }

  private getMockUdyamResult(udyamNumber: string): UdyamVerificationResult {
    return {
      success: true,
      verification_time: new Date().toISOString(),
      data: {
        udyam_number: udyamNumber.toUpperCase(),
        enterprise_name: 'TEST ENTERPRISES',
        enterprise_type: 'SMALL',
        social_category: 'General',
        date_of_incorporation: '2020-06-15',
        major_activity: 'Manufacturing',
        nic_2_digit: '28',
        nic_4_digit: '2812',
        nic_5_digit: '28120',
        owner_name: 'RAHUL SHARMA',
        gender: 'Male',
        mobile: '98XXXXXX00',
        email: 'rahul@testenterprises.com',
        address: {
          flat: 'Plot No. 123',
          building: 'Industrial Estate',
          city: 'Pune',
          district: 'Pune',
          state: 'Maharashtra',
          pincode: '411001'
        },
        investment_in_plant_machinery: 5000000,
        turnover: 20000000
      }
    }
  }

  private parseCompanyResponse(response: any): CompanyVerificationResult {
    if (response.error) {
      return {
        success: false,
        verification_time: new Date().toISOString(),
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Verification failed'
        }
      }
    }

    return {
      success: true,
      verification_time: new Date().toISOString(),
      data: response.data || response.result,
      charges: response.charges,
      flags: response.flags
    }
  }

  private parseDirectorResponse(response: any): DirectorVerificationResult {
    if (response.error) {
      return {
        success: false,
        verification_time: new Date().toISOString(),
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Verification failed'
        }
      }
    }

    return {
      success: true,
      verification_time: new Date().toISOString(),
      data: response.data || response.result,
      flags: response.flags
    }
  }
}

/**
 * Factory function to create MCA adapter
 */
export function createMCAAdapter(config: MCAConfig): MCAAdapter {
  return new MCAAdapter(config)
}
