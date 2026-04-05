/**
 * Document OCR Auto-Fill Service
 * Extract data from uploaded documents to pre-fill forms
 *
 * Supported documents:
 * - PAN Card → Name, PAN number, DOB
 * - Aadhaar Card → Name, Aadhaar number, Address
 * - Salary Slip → Employer, Gross salary, Net salary, Deductions
 * - Bank Statement → Account number, IFSC, Balance
 * - ITR → Income, Tax paid, Assessment year
 *
 * Providers: Google Vision, AWS Textract, Azure Form Recognizer
 * TODO: Configure OCR provider API credentials
 */

export type DocumentType = 'PAN' | 'AADHAAR' | 'SALARY_SLIP' | 'BANK_STATEMENT' | 'ITR' | 'DRIVING_LICENSE' | 'PASSPORT'

export interface OCRResult {
  success: boolean
  documentType: DocumentType
  confidence: number
  extractedFields: Record<string, string>
  rawText?: string
  error?: string
}

/**
 * Extract data from a document image/PDF
 * TODO: Connect to OCR provider (Google Vision / AWS Textract)
 */
export async function extractDocumentData(
  fileUrl: string,
  expectedType?: DocumentType
): Promise<OCRResult> {
  // TODO: Replace with actual OCR API call
  return {
    success: false,
    documentType: expectedType || 'PAN',
    confidence: 0,
    extractedFields: {},
    error: 'OCR integration pending. Configure Google Vision or AWS Textract API to enable auto-fill.',
  }
}

/**
 * Validate extracted PAN number format
 */
export function validatePAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())
}

/**
 * Validate extracted Aadhaar number format
 */
export function validateAadhaar(aadhaar: string): boolean {
  const cleaned = aadhaar.replace(/\s/g, '')
  return /^\d{12}$/.test(cleaned)
}

/**
 * Mask extracted sensitive data for display
 */
export function maskExtractedField(field: string, type: 'PAN' | 'AADHAAR' | 'ACCOUNT'): string {
  if (type === 'PAN' && field.length === 10) {
    return `${field.substring(0, 2)}XXXX${field.substring(6)}`
  }
  if (type === 'AADHAAR' && field.replace(/\s/g, '').length === 12) {
    return `XXXX XXXX ${field.slice(-4)}`
  }
  if (type === 'ACCOUNT' && field.length > 4) {
    return `${'X'.repeat(field.length - 4)}${field.slice(-4)}`
  }
  return field
}
