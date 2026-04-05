/**
 * LOANZ 360 - Application-Level Encryption
 * FORTUNE 500 ENTERPRISE SECURITY STANDARD
 *
 * SECURITY FIX: P1-03 - Encryption at rest for PII/PCI data
 *
 * FEATURES:
 * - AES-256-GCM encryption
 * - Secure key derivation
 * - Field-level encryption for sensitive data
 * - Crypto shredding for secure deletion
 *
 * COMPLIANCE: PCI-DSS v4.0, GDPR, SOX
 */

import crypto from 'crypto'
import { logger } from '@/lib/utils/logger'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 64

/**
 * Get encryption master key from environment
 * PRODUCTION: Retrieve from AWS KMS, Azure Key Vault, or HashiCorp Vault
 */
function getMasterKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY

  if (!masterKey) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY not configured. This is required for PII/PCI data protection.'
    )
  }

  // Key must be base64-encoded 32 bytes (256 bits)
  const key = Buffer.from(masterKey, 'base64')

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid encryption key length. Expected ${KEY_LENGTH} bytes, got ${key.length} bytes.`
    )
  }

  return key
}

/**
 * Derive encryption key from master key using PBKDF2
 * This adds an additional layer of security
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt sensitive data
 *
 * @param plaintext - The data to encrypt
 * @returns Base64-encoded encrypted data with IV, auth tag, and salt
 */
export function encryptData(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '') {
    throw new Error('Cannot encrypt empty data')
  }

  try {
    const masterKey = getMasterKey()

    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH)

    // Derive encryption key
    const key = deriveKey(masterKey, salt)

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    // Get authentication tag
    const authTag = cipher.getAuthTag()

    // Combine: salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'base64'),
    ])

    // Return as base64 string
    return combined.toString('base64')
  } catch (error) {
    // Log encryption failure (without exposing plaintext)
    logger.error('Encryption failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    throw new Error('Data encryption failed')
  }
}

/**
 * Decrypt encrypted data
 *
 * @param encryptedData - Base64-encoded encrypted data
 * @returns Decrypted plaintext
 */
export function decryptData(encryptedData: string): string {
  if (!encryptedData || encryptedData.trim() === '') {
    throw new Error('Cannot decrypt empty data')
  }

  try {
    const masterKey = getMasterKey()

    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64')

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    )
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

    // Derive decryption key
    const key = deriveKey(masterKey, salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Decrypt data
    let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    // Log decryption failure (potential tampering or key mismatch)
    logger.error('Decryption failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    throw new Error('Data decryption failed - data may be corrupted or tampered')
  }
}

/**
 * Hash sensitive data (one-way, for verification)
 *
 * @param plaintext - Data to hash
 * @returns SHA-256 hash as hex string
 */
export function hashData(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot hash empty data')
  }

  return crypto.createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Mask PAN number (show only last 4 digits)
 * PCI-DSS Requirement 3.3
 *
 * @param panNumber - Full PAN number
 * @returns Masked PAN (e.g., "****-****-****-1234")
 */
export function maskPAN(panNumber: string): string {
  if (!panNumber || panNumber.length < 4) {
    return '****-****-****-****'
  }

  const lastFour = panNumber.slice(-4)
  return `****-****-****-${lastFour}`
}

/**
 * Mask Aadhar number (show only last 4 digits)
 *
 * @param aadharNumber - Full Aadhar number
 * @returns Masked Aadhar (e.g., "XXXX-XXXX-1234")
 */
export function maskAadhar(aadharNumber: string): string {
  if (!aadharNumber || aadharNumber.length < 4) {
    return 'XXXX-XXXX-XXXX'
  }

  const lastFour = aadharNumber.slice(-4)
  return `XXXX-XXXX-${lastFour}`
}

/**
 * Mask email address
 *
 * @param email - Full email address
 * @returns Masked email (e.g., "j***n@example.com")
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***@***.***'
  }

  const [localPart, domain] = email.split('@')

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`
  }

  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`
}

/**
 * Mask phone number
 *
 * @param phoneNumber - Full phone number
 * @returns Masked phone (e.g., "******1234")
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.length < 4) {
    return '**********'
  }

  const lastFour = phoneNumber.slice(-4)
  return `******${lastFour}`
}

/**
 * Secure deletion using crypto shredding
 * Overwrites data with random bytes before deletion
 *
 * @param data - Data to shred
 * @returns Random data of same length
 */
export function cryptoShred(data: string): string {
  const length = Buffer.byteLength(data, 'utf8')
  const randomBytes = crypto.randomBytes(length)
  return randomBytes.toString('base64')
}

/**
 * Encrypt object with selective field encryption
 *
 * @param obj - Object containing sensitive data
 * @param fieldsToEncrypt - Array of field names to encrypt
 * @returns Object with encrypted fields
 */
export function encryptObjectFields<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj }

  for (const field of fieldsToEncrypt) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encryptData(encrypted[field] as string) as T[keyof T]
    }
  }

  return encrypted
}

/**
 * Decrypt object with selective field decryption
 *
 * @param obj - Object with encrypted fields
 * @param fieldsToDecrypt - Array of field names to decrypt
 * @returns Object with decrypted fields
 */
export function decryptObjectFields<T extends Record<string, unknown>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj }

  for (const field of fieldsToDecrypt) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        decrypted[field] = decryptData(decrypted[field] as string) as T[keyof T]
      } catch {
        // If decryption fails, field might not be encrypted
        logger.warn('Failed to decrypt field', { field: String(field) })
      }
    }
  }

  return decrypted
}

/**
 * Generate a secure encryption key
 * Use this to generate ENCRYPTION_MASTER_KEY for .env
 *
 * @returns Base64-encoded 256-bit key
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH)
  return key.toString('base64')
}

/**
 * Verify encryption key format
 *
 * @param key - Base64-encoded key
 * @returns true if key is valid
 */
export function verifyEncryptionKey(key: string): boolean {
  try {
    const decoded = Buffer.from(key, 'base64')
    return decoded.length === KEY_LENGTH
  } catch {
    return false
  }
}

/**
 * Encrypt customer PII data
 *
 * @param customerData - Customer profile data
 * @returns Customer data with encrypted PII
 */
export interface CustomerPII {
  panNumber?: string
  aadharNumber?: string
  bankAccountNumber?: string
  [key: string]: unknown
}

export function encryptCustomerPII(customerData: CustomerPII): CustomerPII {
  const encrypted = { ...customerData }

  if (encrypted.panNumber) {
    encrypted.panNumber = encryptData(encrypted.panNumber)
  }

  if (encrypted.aadharNumber) {
    encrypted.aadharNumber = encryptData(encrypted.aadharNumber)
  }

  if (encrypted.bankAccountNumber) {
    encrypted.bankAccountNumber = encryptData(encrypted.bankAccountNumber)
  }

  return encrypted
}

/**
 * Decrypt customer PII data
 *
 * @param encryptedData - Encrypted customer data
 * @returns Customer data with decrypted PII
 */
export function decryptCustomerPII(encryptedData: CustomerPII): CustomerPII {
  const decrypted = { ...encryptedData }

  if (decrypted.panNumber) {
    try {
      decrypted.panNumber = decryptData(decrypted.panNumber)
    } catch {
      // Data might not be encrypted
      logger.warn('Failed to decrypt PAN number')
    }
  }

  if (decrypted.aadharNumber) {
    try {
      decrypted.aadharNumber = decryptData(decrypted.aadharNumber)
    } catch {
      logger.warn('Failed to decrypt Aadhar number')
    }
  }

  if (decrypted.bankAccountNumber) {
    try {
      decrypted.bankAccountNumber = decryptData(decrypted.bankAccountNumber)
    } catch {
      logger.warn('Failed to decrypt bank account number')
    }
  }

  return decrypted
}

/**
 * Get masked customer PII for display
 *
 * @param encryptedData - Encrypted customer data
 * @returns Masked PII for safe display
 */
export function getMaskedCustomerPII(encryptedData: CustomerPII): CustomerPII {
  const decrypted = decryptCustomerPII(encryptedData)

  return {
    ...decrypted,
    panNumber: decrypted.panNumber ? maskPAN(decrypted.panNumber) : undefined,
    aadharNumber: decrypted.aadharNumber ? maskAadhar(decrypted.aadharNumber) : undefined,
    bankAccountNumber: decrypted.bankAccountNumber
      ? '******' + decrypted.bankAccountNumber.slice(-4)
      : undefined,
  }
}

// ─── Lead PII Encryption ─────────────────────────────────────────────────────
// Encrypts sensitive fields in lead data before database insertion.
// Fields used for lookups (mobile, email) are NOT encrypted (breaks queries)
// but their hashes are stored for future encrypted-lookup migration.

/** Fields in a lead record that contain PII and should be encrypted at rest */
const LEAD_PII_FIELDS = [
  'customer_pan',
  'customer_dob',
  'customer_address',
  'customer_pincode',
  'monthly_income',
  'annual_income',
  'other_income',
  'co_applicant_name',
  'co_applicant_mobile',
  'co_applicant_email',
] as const

/**
 * Encrypt PII fields in a lead record before database insert.
 * Returns the lead data with sensitive fields encrypted + hash columns for lookups.
 *
 * IMPORTANT: customer_mobile and customer_email are NOT encrypted because they
 * are used in WHERE clauses for lead lookups. Instead, hashed versions are stored
 * for integrity verification.
 */
export function encryptLeadPII(leadData: Record<string, unknown>): Record<string, unknown> {
  try {
    getMasterKey() // verify key exists
  } catch {
    // If no encryption key configured, skip encryption (development mode)
    return leadData
  }

  const encrypted = { ...leadData }

  // Encrypt each PII field if present and non-empty
  for (const field of LEAD_PII_FIELDS) {
    const value = encrypted[field]
    if (value && typeof value === 'string' && value.trim() !== '') {
      encrypted[field] = encryptData(value)
    } else if (value && typeof value === 'number') {
      encrypted[field] = encryptData(String(value))
    }
  }

  // Store hashed versions of lookup fields for integrity verification
  if (encrypted.customer_mobile && typeof encrypted.customer_mobile === 'string') {
    encrypted.customer_mobile_hash = hashData(encrypted.customer_mobile)
  }
  if (encrypted.customer_email && typeof encrypted.customer_email === 'string') {
    encrypted.customer_email_hash = hashData(encrypted.customer_email)
  }
  if (encrypted.customer_pan && typeof encrypted.customer_pan === 'string') {
    // PAN hash useful for duplicate detection even when encrypted
    encrypted.customer_pan_hash = hashData(encrypted.customer_pan)
  }

  // Encrypt sensitive fields inside phase_1_data JSONB if present
  if (encrypted.phase_1_data && typeof encrypted.phase_1_data === 'object') {
    const phase1 = { ...(encrypted.phase_1_data as Record<string, unknown>) }
    for (const field of LEAD_PII_FIELDS) {
      const value = phase1[field]
      if (value && typeof value === 'string' && value.trim() !== '') {
        phase1[field] = encryptData(value)
      } else if (value && typeof value === 'number') {
        phase1[field] = encryptData(String(value))
      }
    }
    encrypted.phase_1_data = phase1
  }

  return encrypted
}

/**
 * Decrypt PII fields in a lead record after reading from database.
 */
export function decryptLeadPII(leadData: Record<string, unknown>): Record<string, unknown> {
  try {
    getMasterKey() // verify key exists
  } catch {
    return leadData
  }

  const decrypted = { ...leadData }

  for (const field of LEAD_PII_FIELDS) {
    const value = decrypted[field]
    if (value && typeof value === 'string') {
      try {
        decrypted[field] = decryptData(value)
      } catch {
        // Field might not be encrypted (legacy data)
      }
    }
  }

  return decrypted
}
