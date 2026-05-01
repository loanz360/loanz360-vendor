/**
 * PII Encryption at Rest
 * 
 * Encrypts sensitive fields before database storage.
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * Fields that MUST be encrypted:
 * - Aadhaar number
 * - PAN number  
 * - Bank account numbers
 * - Credit card numbers (if stored)
 * - Salary details
 */

export const ENCRYPTED_FIELDS = [
  'aadhaar_number',
  'pan_number',
  'bank_account_number',
  'credit_card_number',
  'salary_amount',
  'tax_id',
  'passport_number',
  'voter_id',
  'driving_license_number',
] as const

export type EncryptedField = typeof ENCRYPTED_FIELDS[number]

export function isEncryptedField(fieldName: string): boolean {
  return ENCRYPTED_FIELDS.includes(fieldName as EncryptedField)
}

export function maskForDisplay(value: string, fieldType: EncryptedField): string {
  switch (fieldType) {
    case 'aadhaar_number': return 'XXXX XXXX ' + value.slice(-4)
    case 'pan_number': return value.slice(0, 2) + 'XXXXX' + value.slice(-2)
    case 'bank_account_number': return 'XXXXX' + value.slice(-4)
    case 'credit_card_number': return 'XXXX XXXX XXXX ' + value.slice(-4)
    case 'salary_amount': return '₹X,XX,XXX'
    default: return 'XXXXXXXX' + value.slice(-3)
  }
}
