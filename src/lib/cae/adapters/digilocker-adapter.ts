/**
 * DigiLocker Identity Verification Adapter
 * Integrates with DigiLocker API for document verification
 * Supports Aadhar, PAN, DL, and other government documents
 */

import { CAEProviderConfig } from '../types'

export type DigiLockerDocType = 'AADHAAR' | 'PAN' | 'DRIVING_LICENSE' | 'VOTER_ID' | 'PASSPORT'

export interface DigiLockerConfig extends CAEProviderConfig {
  config?: {
    client_id?: string
    client_secret?: string
    redirect_uri?: string
    environment?: 'sandbox' | 'production'
  }
}

export interface DigiLockerDocument {
  docType: DigiLockerDocType
  docNumber: string
  name?: string
  dateOfBirth?: string
  fatherName?: string
  address?: string
}

export interface DigiLockerVerificationResult {
  success: boolean
  docType: DigiLockerDocType
  docNumber: string
  verified: boolean
  verificationTime: string
  data?: {
    name: string
    dateOfBirth?: string
    gender?: string
    address?: string
    fatherName?: string
    photo?: string // Base64 encoded
    maskedNumber: string
    issueDate?: string
    expiryDate?: string
  }
  error?: {
    code: string
    message: string
  }
}

export interface DigiLockerEKYCResult {
  success: boolean
  aadharNumber: string
  verified: boolean
  data?: {
    name: string
    dateOfBirth: string
    gender: string
    address: {
      house: string
      street: string
      landmark: string
      locality: string
      vtc: string
      district: string
      state: string
      pincode: string
    }
    photo: string // Base64
    maskedAadhar: string
  }
  error?: {
    code: string
    message: string
  }
}

export class DigiLockerAdapter {
  private config: DigiLockerConfig
  private readonly SANDBOX_URL = 'https://sandbox.digitallocker.gov.in/api/v1'
  private readonly PRODUCTION_URL = 'https://api.digitallocker.gov.in/v1'

  constructor(config: DigiLockerConfig) {
    this.config = config
  }

  /**
   * Verify a document (PAN, DL, Voter ID, Passport)
   */
  async verifyDocument(document: DigiLockerDocument): Promise<DigiLockerVerificationResult> {
    const startTime = Date.now()

    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockVerificationResult(document)
      }

      const response = await fetch(`${this.getBaseUrl()}/verify/${document.docType.toLowerCase()}`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          documentNumber: document.docNumber,
          name: document.name,
          dateOfBirth: document.dateOfBirth,
          fatherName: document.fatherName,
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
      })

      if (!response.ok) {
        throw new Error(`DigiLocker API returned ${response.status}`)
      }

      const result = await response.json()
      return this.parseVerificationResponse(result, document)
    } catch (error) {
      return {
        success: false,
        docType: document.docType,
        docNumber: document.docNumber,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Verification failed',
        },
      }
    }
  }

  /**
   * Perform Aadhar e-KYC using DigiLocker
   */
  async performEKYC(aadharNumber: string, otp?: string): Promise<DigiLockerEKYCResult> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return this.getMockEKYCResult(aadharNumber)
      }

      const response = await fetch(`${this.getBaseUrl()}/ekyc/aadhaar`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          aadharNumber: aadharNumber.replace(/\s/g, ''),
          otp,
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
      })

      if (!response.ok) {
        throw new Error(`DigiLocker e-KYC API returned ${response.status}`)
      }

      return response.json()
    } catch (error) {
      return {
        success: false,
        aadharNumber,
        verified: false,
        error: {
          code: 'EKYC_FAILED',
          message: error instanceof Error ? error.message : 'e-KYC failed',
        },
      }
    }
  }

  /**
   * Initiate OTP for Aadhar e-KYC
   */
  async initiateEKYCOTP(aadharNumber: string): Promise<{ success: boolean; txnId?: string; error?: string }> {
    try {
      const environment = this.config.config?.environment || 'sandbox'

      if (environment === 'sandbox') {
        return { success: true, txnId: `TXN${Date.now()}` }
      }

      const response = await fetch(`${this.getBaseUrl()}/ekyc/otp/initiate`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          aadharNumber: aadharNumber.replace(/\s/g, ''),
        }),
        signal: AbortSignal.timeout(this.config.timeout_ms || 30000),
      })

      if (!response.ok) {
        throw new Error(`DigiLocker OTP initiation failed: ${response.status}`)
      }

      const result = await response.json()
      return { success: true, txnId: result.txnId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OTP initiation failed',
      }
    }
  }

  /**
   * Health check for DigiLocker API
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    const start = Date.now()
    try {
      const response = await fetch(`${this.getBaseUrl()}/health`, {
        method: 'GET',
        headers: await this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      })

      return {
        healthy: response.ok,
        latency_ms: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      }
    } catch (error) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : 'Health check failed',
      }
    }
  }

  private getBaseUrl(): string {
    const environment = this.config.config?.environment || 'sandbox'
    return environment === 'production' ? this.PRODUCTION_URL : this.SANDBOX_URL
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.config.api_key || ''}`,
      'X-Client-Id': this.config.config?.client_id || '',
    }
  }

  private getMockVerificationResult(document: DigiLockerDocument): DigiLockerVerificationResult {
    const verified = Math.random() > 0.1 // 90% success rate for sandbox

    if (!verified) {
      return {
        success: false,
        docType: document.docType,
        docNumber: document.docNumber,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found in government database',
        },
      }
    }

    const maskedNumber = this.maskDocumentNumber(document.docNumber, document.docType)

    return {
      success: true,
      docType: document.docType,
      docNumber: document.docNumber,
      verified: true,
      verificationTime: new Date().toISOString(),
      data: {
        name: document.name || 'Test User',
        dateOfBirth: document.dateOfBirth || '1990-01-01',
        gender: 'M',
        address: document.address || '123 Test Street, Test City, Test State - 400001',
        fatherName: document.fatherName || 'Test Father',
        maskedNumber,
        issueDate: '2015-01-01',
        expiryDate: document.docType === 'DRIVING_LICENSE' || document.docType === 'PASSPORT' ? '2030-01-01' : undefined,
      },
    }
  }

  private getMockEKYCResult(aadharNumber: string): DigiLockerEKYCResult {
    const verified = Math.random() > 0.05 // 95% success rate

    if (!verified) {
      return {
        success: false,
        aadharNumber,
        verified: false,
        error: {
          code: 'AADHAAR_NOT_FOUND',
          message: 'Aadhar number not found or invalid',
        },
      }
    }

    return {
      success: true,
      aadharNumber,
      verified: true,
      data: {
        name: 'Test User',
        dateOfBirth: '1990-01-01',
        gender: 'M',
        address: {
          house: '123',
          street: 'Test Street',
          landmark: 'Near Test Building',
          locality: 'Test Locality',
          vtc: 'Test VTC',
          district: 'Test District',
          state: 'Maharashtra',
          pincode: '400001',
        },
        photo: '', // Base64 would be here
        maskedAadhar: `XXXX-XXXX-${aadharNumber.slice(-4)}`,
      },
    }
  }

  private parseVerificationResponse(response: any, document: DigiLockerDocument): DigiLockerVerificationResult {
    if (response.error) {
      return {
        success: false,
        docType: document.docType,
        docNumber: document.docNumber,
        verified: false,
        verificationTime: new Date().toISOString(),
        error: {
          code: response.error.code || 'UNKNOWN_ERROR',
          message: response.error.message || 'Verification failed',
        },
      }
    }

    return {
      success: true,
      docType: document.docType,
      docNumber: document.docNumber,
      verified: response.verified === true,
      verificationTime: new Date().toISOString(),
      data: response.data,
    }
  }

  private maskDocumentNumber(number: string, docType: DigiLockerDocType): string {
    const clean = number.replace(/[\s-]/g, '')

    switch (docType) {
      case 'AADHAAR':
        return `XXXX-XXXX-${clean.slice(-4)}`
      case 'PAN':
        return `${clean.slice(0, 2)}XXXXX${clean.slice(-2)}`
      case 'DRIVING_LICENSE':
        return `${clean.slice(0, 3)}XXXXX${clean.slice(-3)}`
      case 'PASSPORT':
        return `${clean[0]}XXXXXX${clean.slice(-1)}`
      case 'VOTER_ID':
        return `${clean.slice(0, 3)}XXXXX${clean.slice(-2)}`
      default:
        return `XXXXX${clean.slice(-4)}`
    }
  }
}

/**
 * Factory function to create DigiLocker adapter
 */
export function createDigiLockerAdapter(config: DigiLockerConfig): DigiLockerAdapter {
  return new DigiLockerAdapter(config)
}
