/**
 * Employee Document Auto-Verification Service
 *
 * Wraps the DigiLocker adapter for employee document verification.
 * Supports PAN, Aadhaar, Driving License, Voter ID, and Passport.
 * Auto-approves documents that pass DigiLocker verification.
 */

import {
  DigiLockerAdapter,
  DigiLockerDocType,
  DigiLockerVerificationResult,
  DigiLockerEKYCResult,
} from '@/lib/cae/adapters/digilocker-adapter'
import { logger } from '@/lib/utils/logger'

// ============================================================================
// TYPES
// ============================================================================

export interface VerifyEmployeeDocumentRequest {
  documentId: string
  employeeId: string
  documentTypeCode: string // PAN, AADHAR, DRIVING_LICENSE, etc.
  documentNumber: string
  employeeName?: string
  dateOfBirth?: string
  fatherName?: string
  initiatedBy: string // user_id of who triggered
}

export interface VerifyEmployeeDocumentResult {
  success: boolean
  verified: boolean
  autoApproved: boolean
  confidence: number // 0-100
  method: 'DIGILOCKER' | 'EKYC'
  provider: string
  maskedNumber?: string
  extractedData?: Record<string, unknown>
  discrepancies?: NameDiscrepancy[]
  error?: string
  latencyMs: number
}

interface NameDiscrepancy {
  field: string
  submitted: string
  verified: string
  match: boolean
}

// Map employee_document_types.type_code to DigiLocker doc types
const DOC_TYPE_MAP: Record<string, DigiLockerDocType> = {
  PAN: 'PAN',
  AADHAR: 'AADHAAR',
  AADHAAR: 'AADHAAR',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  VOTER_ID: 'VOTER_ID',
  PASSPORT: 'PASSPORT',
}

// Document types that support auto-verification via DigiLocker
export const VERIFIABLE_DOC_TYPES = Object.keys(DOC_TYPE_MAP)

// ============================================================================
// SERVICE
// ============================================================================

export class EmployeeDocumentVerificationService {
  private adapter: DigiLockerAdapter

  constructor() {
    this.adapter = new DigiLockerAdapter({
      id: 'digilocker-employee-docs',
      name: 'DigiLocker Employee Document Verification',
      provider_type: 'INTERNAL',
      api_key: process.env.DIGILOCKER_API_KEY || '',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: {
        client_id: process.env.DIGILOCKER_CLIENT_ID,
        client_secret: process.env.DIGILOCKER_CLIENT_SECRET,
        redirect_uri: process.env.DIGILOCKER_REDIRECT_URI,
        environment: (process.env.DIGILOCKER_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      },
    })
  }

  /**
   * Check if a document type supports auto-verification
   */
  isVerifiable(documentTypeCode: string): boolean {
    return documentTypeCode.toUpperCase() in DOC_TYPE_MAP
  }

  /**
   * Verify an employee document via DigiLocker
   */
  async verifyDocument(request: VerifyEmployeeDocumentRequest): Promise<VerifyEmployeeDocumentResult> {
    const startTime = Date.now()
    const typeCode = request.documentTypeCode.toUpperCase()

    if (!this.isVerifiable(typeCode)) {
      return {
        success: false,
        verified: false,
        autoApproved: false,
        confidence: 0,
        method: 'DIGILOCKER',
        provider: 'DigiLocker',
        error: `Document type ${typeCode} is not supported for auto-verification`,
        latencyMs: Date.now() - startTime,
      }
    }

    const digiLockerDocType = DOC_TYPE_MAP[typeCode]

    try {
      // For Aadhaar, use e-KYC for richer verification
      if (digiLockerDocType === 'AADHAAR') {
        return await this.verifyAadhaar(request, startTime)
      }

      // For other documents, use standard verification
      return await this.verifyStandardDocument(request, digiLockerDocType, startTime)
    } catch (error) {
      logger.error(`Document verification failed for ${request.documentId}:`, error)
      return {
        success: false,
        verified: false,
        autoApproved: false,
        confidence: 0,
        method: 'DIGILOCKER',
        provider: 'DigiLocker',
        error: error instanceof Error ? error.message : 'Verification failed unexpectedly',
        latencyMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Verify Aadhaar using e-KYC (richer data extraction)
   */
  private async verifyAadhaar(
    request: VerifyEmployeeDocumentRequest,
    startTime: number
  ): Promise<VerifyEmployeeDocumentResult> {
    const result: DigiLockerEKYCResult = await this.adapter.performEKYC(request.documentNumber)

    if (!result.success || !result.verified) {
      return {
        success: false,
        verified: false,
        autoApproved: false,
        confidence: 0,
        method: 'EKYC',
        provider: 'DigiLocker',
        error: result.error?.message || 'Aadhaar e-KYC verification failed',
        latencyMs: Date.now() - startTime,
      }
    }

    // Check name discrepancies
    const discrepancies = this.checkNameDiscrepancies(
      request.employeeName,
      result.data?.name
    )

    const hasNameMismatch = discrepancies.some((d) => !d.match)
    const confidence = hasNameMismatch ? 70 : 100
    const autoApproved = !hasNameMismatch

    return {
      success: true,
      verified: true,
      autoApproved,
      confidence,
      method: 'EKYC',
      provider: 'DigiLocker',
      maskedNumber: result.data?.maskedAadhar,
      extractedData: result.data
        ? {
            name: result.data.name,
            dateOfBirth: result.data.dateOfBirth,
            gender: result.data.gender,
            address: result.data.address,
            maskedNumber: result.data.maskedAadhar,
          }
        : undefined,
      discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      latencyMs: Date.now() - startTime,
    }
  }

  /**
   * Verify PAN, DL, Voter ID, Passport via standard verification
   */
  private async verifyStandardDocument(
    request: VerifyEmployeeDocumentRequest,
    docType: DigiLockerDocType,
    startTime: number
  ): Promise<VerifyEmployeeDocumentResult> {
    const result: DigiLockerVerificationResult = await this.adapter.verifyDocument({
      docType,
      docNumber: request.documentNumber,
      name: request.employeeName,
      dateOfBirth: request.dateOfBirth,
      fatherName: request.fatherName,
    })

    if (!result.success || !result.verified) {
      return {
        success: false,
        verified: false,
        autoApproved: false,
        confidence: 0,
        method: 'DIGILOCKER',
        provider: 'DigiLocker',
        maskedNumber: result.data?.maskedNumber,
        error: result.error?.message || 'Document verification failed',
        latencyMs: Date.now() - startTime,
      }
    }

    // Check name discrepancies
    const discrepancies = this.checkNameDiscrepancies(
      request.employeeName,
      result.data?.name
    )

    const hasNameMismatch = discrepancies.some((d) => !d.match)
    const confidence = hasNameMismatch ? 70 : 100
    const autoApproved = !hasNameMismatch

    return {
      success: true,
      verified: true,
      autoApproved,
      confidence,
      method: 'DIGILOCKER',
      provider: 'DigiLocker',
      maskedNumber: result.data?.maskedNumber,
      extractedData: result.data
        ? {
            name: result.data.name,
            dateOfBirth: result.data.dateOfBirth,
            gender: result.data.gender,
            address: result.data.address,
            fatherName: result.data.fatherName,
            maskedNumber: result.data.maskedNumber,
            issueDate: result.data.issueDate,
            expiryDate: result.data.expiryDate,
          }
        : undefined,
      discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      latencyMs: Date.now() - startTime,
    }
  }

  /**
   * Compare submitted name with DigiLocker-verified name
   */
  private checkNameDiscrepancies(
    submittedName?: string,
    verifiedName?: string
  ): NameDiscrepancy[] {
    if (!submittedName || !verifiedName) return []

    const normalize = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z\s]/g, '')

    const submitted = normalize(submittedName)
    const verified = normalize(verifiedName)

    // Exact match
    if (submitted === verified) return []

    // Check if one contains the other (partial match is OK for many Indian names)
    const submittedParts = submitted.split(' ')
    const verifiedParts = verified.split(' ')

    // Check if at least first and last name match
    const firstNameMatch =
      submittedParts[0] === verifiedParts[0] ||
      verifiedParts.includes(submittedParts[0])
    const lastNameMatch =
      submittedParts[submittedParts.length - 1] === verifiedParts[verifiedParts.length - 1] ||
      verifiedParts.includes(submittedParts[submittedParts.length - 1])

    if (firstNameMatch && lastNameMatch) return []

    return [
      {
        field: 'name',
        submitted: submittedName,
        verified: verifiedName,
        match: false,
      },
    ]
  }

  /**
   * Check DigiLocker service health
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    return this.adapter.healthCheck()
  }
}

// Singleton instance
let _instance: EmployeeDocumentVerificationService | null = null

export function getDocumentVerificationService(): EmployeeDocumentVerificationService {
  if (!_instance) {
    _instance = new EmployeeDocumentVerificationService()
  }
  return _instance
}
