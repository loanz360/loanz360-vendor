/**
 * GDPR Right to Delete / Data Erasure
 * 
 * Handles customer requests to delete personal data.
 * Some data must be retained for regulatory compliance (RBI).
 * 
 * Process:
 * 1. Customer submits deletion request
 * 2. System identifies all PII across tables
 * 3. Regulatory-exempt data is flagged (not deleted)
 * 4. Non-exempt PII is anonymized or deleted
 * 5. Confirmation sent to customer
 * 6. Audit log entry created
 */

export interface DeletionRequest {
  userId: string
  requestedAt: Date
  reason?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'REJECTED'
}

export interface DeletionResult {
  tablesProcessed: number
  recordsAnonymized: number
  recordsRetained: number
  retainedReasons: string[]
}

// Tables containing PII that must be processed
export const PII_TABLES = [
  { table: 'profiles', fields: ['full_name', 'email', 'phone', 'address', 'date_of_birth'], canDelete: false, action: 'anonymize' },
  { table: 'kyc_documents', fields: ['document_number', 'document_image'], canDelete: false, action: 'retain_regulatory' },
  { table: 'bank_details', fields: ['account_number', 'ifsc_code', 'bank_name'], canDelete: false, action: 'anonymize' },
  { table: 'loan_applications', fields: ['applicant_name', 'applicant_phone'], canDelete: false, action: 'retain_regulatory' },
  { table: 'notifications', fields: ['message', 'title'], canDelete: true, action: 'delete' },
  { table: 'session_logs', fields: ['ip_address', 'user_agent'], canDelete: true, action: 'delete' },
  { table: 'communications', fields: ['recipient_phone', 'recipient_email', 'message_body'], canDelete: true, action: 'anonymize' },
] as const

export function anonymizeField(value: string, fieldType: string): string {
  switch (fieldType) {
    case 'email': return 'deleted_user@anonymized.loanz360.com'
    case 'phone': return '0000000000'
    case 'full_name': return 'Deleted User'
    case 'address': return 'Address Removed'
    case 'account_number': return 'XXXX' + value.slice(-4)
    case 'document_number': return 'XXXX' + value.slice(-4)
    default: return '[REDACTED]'
  }
}
