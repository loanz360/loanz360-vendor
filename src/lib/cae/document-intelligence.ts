/**
 * CAE Document Intelligence Engine
 *
 * This module handles document processing, OCR, verification,
 * and intelligent data extraction for credit appraisals.
 *
 * Key Features:
 * - Document upload and validation
 * - OCR processing via configured providers
 * - Auto-verification against government APIs
 * - Data extraction and field mapping
 * - Document checklist management per loan type
 */

// Document status enum
export type DocumentStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'VERIFICATION_FAILED'
  | 'REJECTED'
  | 'EXPIRED'

// Document verification result
export interface VerificationResult {
  is_verified: boolean
  confidence_score: number
  provider_code: string
  verified_at: string
  verification_details: Record<string, any>
  discrepancies?: string[]
}

// Extracted document data
export interface ExtractedData {
  raw_text?: string
  structured_data: Record<string, any>
  confidence_scores: Record<string, number>
  extracted_at: string
}

// Document processing request
export interface DocumentProcessingRequest {
  document_id: string
  lead_id: string
  appraisal_id: string
  document_category_code: string
  file_url: string
  file_type: string
  file_size: number
}

// Document processing result
export interface DocumentProcessingResult {
  success: boolean
  document_id: string
  status: DocumentStatus
  extracted_data?: ExtractedData
  verification_result?: VerificationResult
  error?: {
    code: string
    message: string
  }
  processing_time_ms: number
}

// Document requirement with status
export interface DocumentRequirement {
  id: string
  document_category_id: string
  category_code: string
  category_name: string
  document_group: string
  is_mandatory: boolean
  employment_type: string | null
  requires_ocr: boolean
  requires_verification: boolean
  verification_provider_type: string | null
  status: DocumentStatus
  uploaded_file_url?: string
  uploaded_at?: string
  extracted_data?: ExtractedData
  verification_result?: VerificationResult
  rejection_reason?: string
}

// Document checklist for an appraisal
export interface DocumentChecklist {
  appraisal_id: string
  lead_id: string
  loan_type_code: string
  employment_type: string
  total_documents: number
  mandatory_documents: number
  uploaded_documents: number
  verified_documents: number
  pending_documents: number
  rejected_documents: number
  completion_percentage: number
  requirements: DocumentRequirement[]
}

/**
 * Document Intelligence Service
 */
export class DocumentIntelligenceService {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  /**
   * Get document checklist for a lead/appraisal
   */
  async getDocumentChecklist(
    leadId: string,
    loanTypeCode: string,
    employmentType: string
  ): Promise<DocumentChecklist | null> {
    try {
      // Get loan type ID
      const { data: loanType, error: loanError } = await this.supabase
        .from('loan_types_master')
        .select('id')
        .eq('loan_type_code', loanTypeCode)
        .maybeSingle()

      if (loanError || !loanType) {
        console.error('Loan type not found:', loanTypeCode)
        return null
      }

      // Get document requirements for this loan type
      const { data: requirements, error: reqError } = await this.supabase
        .from('loan_document_requirements')
        .select(`
          id,
          document_category_id,
          is_mandatory,
          employment_type,
          priority,
          notes,
          document:document_categories_master(
            category_code,
            category_name,
            document_group,
            requires_ocr,
            requires_verification,
            verification_provider_type
          )
        `)
        .eq('loan_type_id', loanType.id)
        .eq('is_active', true)
        .or(`employment_type.is.null,employment_type.eq.${employmentType}`)
        .order('priority', { ascending: true })

      if (reqError) {
        console.error('Error fetching requirements:', reqError)
        return null
      }

      // Get uploaded documents for this lead
      const { data: uploadedDocs, error: uploadError } = await this.supabase
        .from('lead_documents')
        .select('*')
        .eq('lead_id', leadId)

      const uploadedDocsMap = new Map(
        (uploadedDocs || []).map((doc: any) => [doc.document_category_id, doc])
      )

      // Build checklist
      const docRequirements: DocumentRequirement[] = (requirements || []).map((req: any) => {
        const uploaded = uploadedDocsMap.get(req.document_category_id)
        return {
          id: req.id,
          document_category_id: req.document_category_id,
          category_code: req.document?.category_code || '',
          category_name: req.document?.category_name || '',
          document_group: req.document?.document_group || '',
          is_mandatory: req.is_mandatory,
          employment_type: req.employment_type,
          requires_ocr: req.document?.requires_ocr || false,
          requires_verification: req.document?.requires_verification || false,
          verification_provider_type: req.document?.verification_provider_type,
          status: uploaded ? this.mapDocumentStatus(uploaded) : 'PENDING_UPLOAD',
          uploaded_file_url: uploaded?.file_url,
          uploaded_at: uploaded?.created_at,
          extracted_data: uploaded?.extracted_data,
          verification_result: uploaded?.verification_result,
          rejection_reason: uploaded?.rejection_reason,
        }
      })

      const mandatoryDocs = docRequirements.filter(d => d.is_mandatory)
      const uploadedCount = docRequirements.filter(d => d.status !== 'PENDING_UPLOAD').length
      const verifiedCount = docRequirements.filter(d => d.status === 'VERIFIED').length
      const pendingCount = docRequirements.filter(
        d => d.status === 'PENDING_UPLOAD' || d.status === 'VERIFICATION_PENDING'
      ).length
      const rejectedCount = docRequirements.filter(d => d.status === 'REJECTED').length

      const completionPercentage =
        mandatoryDocs.length > 0
          ? Math.round(
              (mandatoryDocs.filter(d => d.status === 'VERIFIED').length / mandatoryDocs.length) *
                100
            )
          : 0

      return {
        appraisal_id: '',
        lead_id: leadId,
        loan_type_code: loanTypeCode,
        employment_type: employmentType,
        total_documents: docRequirements.length,
        mandatory_documents: mandatoryDocs.length,
        uploaded_documents: uploadedCount,
        verified_documents: verifiedCount,
        pending_documents: pendingCount,
        rejected_documents: rejectedCount,
        completion_percentage: completionPercentage,
        requirements: docRequirements,
      }
    } catch (error) {
      console.error('Error getting document checklist:', error)
      return null
    }
  }

  /**
   * Map database document status to enum
   */
  private mapDocumentStatus(doc: any): DocumentStatus {
    if (doc.is_rejected) return 'REJECTED'
    if (doc.is_verified) return 'VERIFIED'
    if (doc.verification_result) return 'VERIFICATION_PENDING'
    if (doc.extracted_data) return 'OCR_COMPLETE'
    if (doc.is_processing) return 'PROCESSING'
    if (doc.file_url) return 'UPLOADED'
    return 'PENDING_UPLOAD'
  }

  /**
   * Process an uploaded document
   */
  async processDocument(request: DocumentProcessingRequest): Promise<DocumentProcessingResult> {
    const startTime = Date.now()

    try {
      // Update status to processing
      await this.supabase
        .from('lead_documents')
        .update({ is_processing: true, updated_at: new Date().toISOString() })
        .eq('id', request.document_id)

      // Get document category config
      const { data: docCategory, error: catError } = await this.supabase
        .from('document_categories_master')
        .select('*')
        .eq('category_code', request.document_category_code)
        .maybeSingle()

      if (catError || !docCategory) {
        throw new Error(`Document category not found: ${request.document_category_code}`)
      }

      let extractedData: ExtractedData | undefined
      let verificationResult: VerificationResult | undefined
      let finalStatus: DocumentStatus = 'UPLOADED'

      // Step 1: OCR Processing (if required)
      if (docCategory.requires_ocr) {
        extractedData = await this.performOCR(request, docCategory)
        finalStatus = 'OCR_COMPLETE'
      }

      // Step 2: Verification (if required and OCR complete)
      if (docCategory.requires_verification && docCategory.verification_provider_type) {
        verificationResult = await this.performVerification(
          request,
          docCategory,
          extractedData
        )
        finalStatus = verificationResult.is_verified ? 'VERIFIED' : 'VERIFICATION_FAILED'
      } else if (extractedData) {
        // Auto-verify if no external verification needed
        finalStatus = 'VERIFIED'
      }

      // Update document record
      await this.supabase
        .from('lead_documents')
        .update({
          is_processing: false,
          status: finalStatus,
          extracted_data: extractedData,
          verification_result: verificationResult,
          is_verified: finalStatus === 'VERIFIED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.document_id)

      // Log the processing
      await this.logDocumentProcessing(request, finalStatus, Date.now() - startTime)

      return {
        success: true,
        document_id: request.document_id,
        status: finalStatus,
        extracted_data: extractedData,
        verification_result: verificationResult,
        processing_time_ms: Date.now() - startTime,
      }
    } catch (error: unknown) {
      // Update status to failed
      await this.supabase
        .from('lead_documents')
        .update({
          is_processing: false,
          status: 'VERIFICATION_FAILED',
          error_message: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.document_id)

      return {
        success: false,
        document_id: request.document_id,
        status: 'VERIFICATION_FAILED',
        error: {
          code: 'PROCESSING_ERROR',
          message: error.message,
        },
        processing_time_ms: Date.now() - startTime,
      }
    }
  }

  /**
   * Perform OCR on document
   */
  private async performOCR(
    request: DocumentProcessingRequest,
    docCategory: any
  ): Promise<ExtractedData> {
    // In production, this would call the configured OCR provider
    // For now, return mock extracted data based on document type

    const mockData = this.getMockExtractedData(docCategory.category_code)

    return {
      structured_data: mockData.data,
      confidence_scores: mockData.confidence,
      extracted_at: new Date().toISOString(),
    }
  }

  /**
   * Perform verification against external APIs
   */
  private async performVerification(
    request: DocumentProcessingRequest,
    docCategory: any,
    extractedData?: ExtractedData
  ): Promise<VerificationResult> {
    // In production, this would call the configured verification provider
    // For now, return mock verification result

    const isVerified = Math.random() > 0.1 // 90% success rate for mock

    return {
      is_verified: isVerified,
      confidence_score: isVerified ? 0.95 : 0.3,
      provider_code: docCategory.verification_provider_type || 'MOCK',
      verified_at: new Date().toISOString(),
      verification_details: {
        source: 'MOCK_VERIFICATION',
        checks_passed: isVerified ? ['format', 'authenticity', 'data_match'] : [],
        checks_failed: isVerified ? [] : ['data_mismatch'],
      },
      discrepancies: isVerified ? undefined : ['Name mismatch detected'],
    }
  }

  /**
   * Get mock extracted data for testing
   */
  private getMockExtractedData(categoryCode: string): {
    data: Record<string, any>
    confidence: Record<string, number>
  } {
    switch (categoryCode) {
      case 'PAN_CARD':
        return {
          data: {
            pan_number: 'ABCDE1234F',
            name: 'JOHN DOE',
            father_name: 'JAMES DOE',
            date_of_birth: '1990-01-15',
          },
          confidence: {
            pan_number: 0.98,
            name: 0.95,
            father_name: 0.92,
            date_of_birth: 0.96,
          },
        }

      case 'AADHAAR_CARD':
        return {
          data: {
            aadhaar_number: '****-****-1234',
            name: 'JOHN DOE',
            gender: 'Male',
            date_of_birth: '1990-01-15',
            address: '123 Main Street, City, State - 123456',
          },
          confidence: {
            aadhaar_number: 0.99,
            name: 0.96,
            gender: 0.98,
            date_of_birth: 0.94,
            address: 0.88,
          },
        }

      case 'SALARY_SLIP':
        return {
          data: {
            employee_name: 'JOHN DOE',
            employee_id: 'EMP001',
            month: 'December 2025',
            gross_salary: 75000,
            net_salary: 62500,
            basic: 37500,
            hra: 15000,
            other_allowances: 22500,
            pf_deduction: 4500,
            tax_deduction: 8000,
            employer_name: 'ABC Corporation Ltd',
          },
          confidence: {
            employee_name: 0.94,
            gross_salary: 0.97,
            net_salary: 0.97,
            employer_name: 0.91,
          },
        }

      case 'BANK_STATEMENT':
        return {
          data: {
            account_holder: 'JOHN DOE',
            account_number: '****1234',
            bank_name: 'State Bank of India',
            ifsc_code: 'SBIN0001234',
            statement_period: 'July 2025 - December 2025',
            opening_balance: 45000,
            closing_balance: 125000,
            total_credits: 450000,
            total_debits: 370000,
            average_balance: 85000,
            salary_credits_count: 6,
            emi_debits_count: 3,
            bounce_count: 0,
          },
          confidence: {
            account_holder: 0.96,
            account_number: 0.99,
            total_credits: 0.98,
            total_debits: 0.98,
            average_balance: 0.95,
          },
        }

      case 'ITR':
        return {
          data: {
            pan: 'ABCDE1234F',
            name: 'JOHN DOE',
            assessment_year: '2025-26',
            gross_total_income: 1200000,
            total_deductions: 150000,
            taxable_income: 1050000,
            tax_paid: 125000,
            filing_date: '2025-07-31',
            acknowledgement_number: 'ACK123456789',
          },
          confidence: {
            pan: 0.99,
            name: 0.95,
            gross_total_income: 0.97,
            taxable_income: 0.97,
          },
        }

      case 'GST_CERTIFICATE':
        return {
          data: {
            gstin: '29ABCDE1234F1Z5',
            legal_name: 'ABC Enterprises',
            trade_name: 'ABC Trading Co',
            registration_date: '2020-01-15',
            business_type: 'Proprietorship',
            principal_place: 'Bangalore, Karnataka',
            status: 'Active',
          },
          confidence: {
            gstin: 0.99,
            legal_name: 0.96,
            registration_date: 0.98,
            status: 0.99,
          },
        }

      default:
        return {
          data: {
            document_type: categoryCode,
            extracted: true,
            extraction_date: new Date().toISOString(),
          },
          confidence: {
            document_type: 0.9,
          },
        }
    }
  }

  /**
   * Log document processing activity
   */
  private async logDocumentProcessing(
    request: DocumentProcessingRequest,
    status: DocumentStatus,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await this.supabase.from('cae_api_logs').insert({
        appraisal_id: request.appraisal_id,
        request_type: 'DOCUMENT_PROCESSING',
        request_payload: {
          document_id: request.document_id,
          category_code: request.document_category_code,
          file_type: request.file_type,
        },
        response_payload: {
          status,
        },
        is_success: status === 'VERIFIED' || status === 'OCR_COMPLETE',
        latency_ms: processingTimeMs,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error logging document processing:', error)
    }
  }

  /**
   * Reject a document with reason
   */
  async rejectDocument(documentId: string, reason: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('lead_documents')
        .update({
          status: 'REJECTED',
          is_rejected: true,
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get document processing statistics
   */
  async getProcessingStats(appraisalId?: string): Promise<{
    total: number
    by_status: Record<DocumentStatus, number>
    avg_processing_time_ms: number
    verification_success_rate: number
  }> {
    try {
      let query = this.supabase.from('lead_documents').select('status, processing_time_ms, is_verified')

      if (appraisalId) {
        query = query.eq('appraisal_id', appraisalId)
      }

      const { data, error } = await query

      if (error || !data) {
        return {
          total: 0,
          by_status: {} as Record<DocumentStatus, number>,
          avg_processing_time_ms: 0,
          verification_success_rate: 0,
        }
      }

      const byStatus: Record<string, number> = {}
      let totalProcessingTime = 0
      let verifiedCount = 0
      let verificationAttempts = 0

      data.forEach((doc: any) => {
        byStatus[doc.status] = (byStatus[doc.status] || 0) + 1
        if (doc.processing_time_ms) {
          totalProcessingTime += doc.processing_time_ms
        }
        if (doc.is_verified !== null) {
          verificationAttempts++
          if (doc.is_verified) verifiedCount++
        }
      })

      return {
        total: data.length,
        by_status: byStatus as Record<DocumentStatus, number>,
        avg_processing_time_ms: data.length > 0 ? totalProcessingTime / data.length : 0,
        verification_success_rate:
          verificationAttempts > 0 ? (verifiedCount / verificationAttempts) * 100 : 0,
      }
    } catch {
      return {
        total: 0,
        by_status: {} as Record<DocumentStatus, number>,
        avg_processing_time_ms: 0,
        verification_success_rate: 0,
      }
    }
  }
}

// Export singleton factory
export function createDocumentIntelligenceService(supabase: any): DocumentIntelligenceService {
  return new DocumentIntelligenceService(supabase)
}
