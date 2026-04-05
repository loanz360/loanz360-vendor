/**
 * Document Expiry Tracking Utility
 *
 * Provides rules and helpers for tracking KYC document validity periods,
 * detecting approaching expirations, and categorizing documents by filename.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentInfo {
  id: string
  name: string
  /** Document type key, e.g. "BANK_STATEMENT", "ITR", "AADHAAR" */
  type: string
  /** ISO-8601 date string of when the document was uploaded */
  uploadDate: string
  customerId?: string
}

export interface ExpiryRule {
  /** Document type key */
  type: string
  /** Human-readable label */
  label: string
  /** Validity period in days from the upload date */
  validityDays: number
  /** Short description shown in UI */
  description: string
}

export interface ExpiryCheckResult {
  isExpired: boolean
  /** Negative when already expired */
  daysUntilExpiry: number
  /** ISO-8601 date string */
  expiryDate: string
}

export interface ExpiringDocument extends DocumentInfo {
  daysUntilExpiry: number
  expiryDate: string
}

export type DocumentCategory =
  | 'AADHAAR'
  | 'PAN'
  | 'BANK_STATEMENT'
  | 'ITR'
  | 'SALARY_SLIP'
  | 'PROPERTY_DOCUMENT'
  | 'GST_RETURN'
  | 'FINANCIAL_STATEMENT'
  | 'EMPLOYMENT_PROOF'
  | 'ADDRESS_PROOF'
  | 'VEHICLE_QUOTATION'
  | 'DRIVING_LICENSE'
  | 'BUSINESS_REGISTRATION'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'PHOTO'
  | 'UNKNOWN'

// ---------------------------------------------------------------------------
// Expiry rules
// ---------------------------------------------------------------------------

const EXPIRY_RULES: ExpiryRule[] = [
  { type: 'BANK_STATEMENT', label: 'Bank Statement', validityDays: 90, description: 'Bank statements are valid for 3 months from upload' },
  { type: 'SALARY_SLIP', label: 'Salary Slip', validityDays: 90, description: 'Salary slips are valid for 3 months from upload' },
  { type: 'ITR', label: 'Income Tax Return', validityDays: 365, description: 'ITR documents are valid for 1 year from upload' },
  { type: 'GST_RETURN', label: 'GST Return', validityDays: 365, description: 'GST returns are valid for 1 year from upload' },
  { type: 'FINANCIAL_STATEMENT', label: 'Financial Statement', validityDays: 365, description: 'Financial statements are valid for 1 year from upload' },
  { type: 'EMPLOYMENT_PROOF', label: 'Employment Proof', validityDays: 180, description: 'Employment proof is valid for 6 months from upload' },
  { type: 'ADDRESS_PROOF', label: 'Address Proof', validityDays: 180, description: 'Address proof is valid for 6 months from upload' },
  { type: 'VEHICLE_QUOTATION', label: 'Vehicle Quotation', validityDays: 30, description: 'Vehicle quotation is valid for 30 days from upload' },
  { type: 'AADHAAR', label: 'Aadhaar Card', validityDays: 3650, description: 'Aadhaar does not expire but should be refreshed every ~10 years' },
  { type: 'PAN', label: 'PAN Card', validityDays: 3650, description: 'PAN card does not expire' },
  { type: 'DRIVING_LICENSE', label: 'Driving License', validityDays: 1825, description: 'Driving license validity assumed 5 years; upload renewed copy when expired' },
  { type: 'PASSPORT', label: 'Passport', validityDays: 3650, description: 'Passport validity assumed 10 years' },
  { type: 'PROPERTY_DOCUMENT', label: 'Property Document', validityDays: 3650, description: 'Property documents do not expire' },
  { type: 'BUSINESS_REGISTRATION', label: 'Business Registration', validityDays: 3650, description: 'Business registration does not expire' },
  { type: 'PHOTO', label: 'Photograph', validityDays: 180, description: 'Passport-size photograph valid for 6 months' },
  { type: 'VOTER_ID', label: 'Voter ID', validityDays: 3650, description: 'Voter ID does not expire' },
]

/**
 * Returns the full list of document expiry rules.
 */
export function getDocumentExpiryRules(): ExpiryRule[] {
  return EXPIRY_RULES
}

// ---------------------------------------------------------------------------
// Expiry checking
// ---------------------------------------------------------------------------

/**
 * Determines the default validity period for a given document type.
 * Falls back to 180 days (6 months) for unrecognised types.
 */
function getValidityDays(documentType: string): number {
  // Normalise to uppercase and strip suffixes like _3M, _6M, _12M, _1Y etc.
  const normalised = documentType
    .toUpperCase()
    .replace(/_\d+[MY]$/, '')

  const rule = EXPIRY_RULES.find((r) => r.type === normalised)
  return rule?.validityDays ?? 180
}

/**
 * Checks whether a document has expired (or will expire soon) based on its
 * upload date and document type.
 *
 * @param uploadDate  ISO-8601 date string (e.g. "2025-12-01" or full ISO)
 * @param documentType  Document type key (e.g. "BANK_STATEMENT", "ITR_2Y")
 * @returns An object describing expiry status
 */
export function checkDocumentExpiry(
  uploadDate: string,
  documentType: string,
): ExpiryCheckResult {
  const upload = new Date(uploadDate)
  const validityDays = getValidityDays(documentType)
  const expiryMs = upload.getTime() + validityDays * 86_400_000
  const expiryDate = new Date(expiryMs)
  const now = Date.now()
  const diffMs = expiryMs - now
  const daysUntilExpiry = Math.ceil(diffMs / 86_400_000)

  return {
    isExpired: daysUntilExpiry <= 0,
    daysUntilExpiry,
    expiryDate: expiryDate.toISOString().split('T')[0],
  }
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/**
 * Filters the provided documents to those expiring within the given threshold
 * (default: 30 days). Documents that are *already* expired are also returned.
 *
 * Results are sorted by days-until-expiry ascending (most urgent first).
 */
export function getExpiringDocuments(
  documents: DocumentInfo[],
  thresholdDays: number = 30,
): ExpiringDocument[] {
  const results: ExpiringDocument[] = []

  for (const doc of documents) {
    const { isExpired, daysUntilExpiry, expiryDate } = checkDocumentExpiry(doc.uploadDate, doc.type)

    if (isExpired || daysUntilExpiry <= thresholdDays) {
      results.push({
        ...doc,
        daysUntilExpiry,
        expiryDate,
      })
    }
  }

  results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  return results
}

// ---------------------------------------------------------------------------
// Filename-based categorisation
// ---------------------------------------------------------------------------

interface PatternRule {
  pattern: RegExp
  category: DocumentCategory
}

const CATEGORISATION_PATTERNS: PatternRule[] = [
  // Identity documents
  { pattern: /aadhaar|aadhar|uid/i, category: 'AADHAAR' },
  { pattern: /\bpan\b|pan[_\s-]?card/i, category: 'PAN' },
  { pattern: /passport/i, category: 'PASSPORT' },
  { pattern: /voter[_\s-]?id|epic/i, category: 'VOTER_ID' },
  { pattern: /driving[_\s-]?licen[cs]e|dl[_\s-]?copy/i, category: 'DRIVING_LICENSE' },

  // Financial documents
  { pattern: /bank[_\s-]?stat|account[_\s-]?stat|stmt/i, category: 'BANK_STATEMENT' },
  { pattern: /\bitr\b|income[_\s-]?tax|tax[_\s-]?return/i, category: 'ITR' },
  { pattern: /salary[_\s-]?slip|pay[_\s-]?slip|payslip/i, category: 'SALARY_SLIP' },
  { pattern: /gst[_\s-]?return|gstr|gst[_\s-]?3b/i, category: 'GST_RETURN' },
  { pattern: /financial[_\s-]?stat|balance[_\s-]?sheet|p[&]?l[_\s-]?stat|profit[_\s-]?(and|&)?[_\s-]?loss/i, category: 'FINANCIAL_STATEMENT' },

  // Property & business
  { pattern: /property|sale[_\s-]?deed|title[_\s-]?deed|allotment|encumbrance/i, category: 'PROPERTY_DOCUMENT' },
  { pattern: /business[_\s-]?reg|incorporat|partnership[_\s-]?deed|udyam|msme/i, category: 'BUSINESS_REGISTRATION' },

  // Employment & address
  { pattern: /employ|offer[_\s-]?letter|appointment|experience[_\s-]?letter/i, category: 'EMPLOYMENT_PROOF' },
  { pattern: /address[_\s-]?proof|utility[_\s-]?bill|rent[_\s-]?agree|electric[_\s-]?bill/i, category: 'ADDRESS_PROOF' },

  // Vehicle
  { pattern: /vehicle[_\s-]?quot|proforma|dealer[_\s-]?invoice/i, category: 'VEHICLE_QUOTATION' },

  // Photo
  { pattern: /photo|passport[_\s-]?size|selfie/i, category: 'PHOTO' },
]

/**
 * Attempts to categorise a document based on its filename and optional MIME
 * type. Uses pattern-matching heuristics (no external AI call).
 *
 * @param fileName  Original filename, e.g. "bank_stmt_jan2025.pdf"
 * @param mimeType  Optional MIME type, e.g. "application/pdf"
 * @returns The best-guess document category
 */
export function categorizeDocument(
  fileName: string,
  mimeType?: string,
): DocumentCategory {
  // Try filename patterns first
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')

  for (const rule of CATEGORISATION_PATTERNS) {
    if (rule.pattern.test(nameWithoutExt)) {
      return rule.category
    }
  }

  // If the MIME type hints at an image and nothing else matched, assume PHOTO
  if (mimeType && mimeType.startsWith('image/')) {
    return 'PHOTO'
  }

  return 'UNKNOWN'
}
