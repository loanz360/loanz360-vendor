/**
 * Credential Encryption Service
 * Production-ready AES-256-GCM encryption for credentials at rest
 *
 * SECURITY FEATURES:
 * - AES-256-GCM authenticated encryption
 * - PBKDF2 key derivation with 100,000 iterations
 * - Cryptographically secure random IV generation
 * - Constant-time comparison for authentication tags
 * - Memory-safe key handling
 *
 * COMPLIANCE: PCI-DSS, SOC 2, GDPR
 */

import * as crypto from 'crypto'

// ==================== CONFIGURATION ====================

/** AES-256-GCM encryption algorithm */
const ALGORITHM = 'aes-256-gcm' as const

/** Key length in bytes (256 bits) */
const KEY_LENGTH = 32

/** IV length in bytes (96 bits recommended for GCM) */
const IV_LENGTH = 12

/** Authentication tag length in bytes (128 bits) */
const AUTH_TAG_LENGTH = 16

/** Salt length in bytes for PBKDF2 */
const SALT_LENGTH = 32

/** PBKDF2 iterations (OWASP recommended minimum: 100,000 for PBKDF2-SHA256) */
const PBKDF2_ITERATIONS = 100000

/** PBKDF2 hash algorithm */
const PBKDF2_DIGEST = 'sha256'

/** Version identifier for encrypted data format */
const ENCRYPTION_VERSION = 1

// ==================== TYPES ====================

/** Result of an encryption operation */
export interface EncryptionResult {
  /** Base64-encoded encrypted data with embedded metadata */
  encrypted: string
  /** Version of the encryption format */
  version: number
}

/** Result of a decryption operation */
export interface DecryptionResult {
  /** Decrypted plaintext string */
  decrypted: string
  /** Version of the encryption format used */
  version: number
}

/** Encrypted credential storage format */
export interface EncryptedCredential {
  /** Unique identifier for the credential */
  id: string
  /** Type of credential (e.g., 'api_key', 'oauth_token', 'password') */
  type: CredentialType
  /** Base64-encoded encrypted value */
  encryptedValue: string
  /** Encryption version used */
  version: number
  /** ISO timestamp when credential was encrypted */
  encryptedAt: string
  /** ISO timestamp when credential expires (optional) */
  expiresAt?: string
  /** Additional metadata (non-sensitive) */
  metadata?: Record<string, string>
}

/** Types of credentials that can be encrypted */
export type CredentialType =
  | 'api_key'
  | 'api_secret'
  | 'oauth_token'
  | 'oauth_refresh_token'
  | 'password'
  | 'private_key'
  | 'certificate'
  | 'webhook_secret'
  | 'database_password'
  | 'encryption_key'
  | 'other'

/** Options for credential encryption */
export interface CredentialEncryptionOptions {
  /** Type of credential being encrypted */
  type: CredentialType
  /** Optional expiration date */
  expiresAt?: Date
  /** Additional non-sensitive metadata */
  metadata?: Record<string, string>
}

/** Encryption error with specific error codes */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: EncryptionErrorCode,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'EncryptionError'
    Object.setPrototypeOf(this, EncryptionError.prototype)
  }
}

/** Error codes for encryption operations */
export type EncryptionErrorCode =
  | 'MISSING_SECRET_KEY'
  | 'INVALID_SECRET_KEY'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'INVALID_DATA_FORMAT'
  | 'DATA_TAMPERING_DETECTED'
  | 'EMPTY_DATA'
  | 'KEY_DERIVATION_FAILED'
  | 'UNSUPPORTED_VERSION'
  | 'CREDENTIAL_EXPIRED'

// ==================== KEY MANAGEMENT ====================

/** Cached derived key for performance */
let cachedDerivedKey: Buffer | null = null
let cachedSalt: Buffer | null = null

/**
 * Get the encryption secret from environment
 * @throws {EncryptionError} If ENCRYPTION_SECRET_KEY is not configured
 */
function getSecretKey(): string {
  const secretKey = process.env.ENCRYPTION_SECRET_KEY

  if (!secretKey) {
    throw new EncryptionError(
      'ENCRYPTION_SECRET_KEY environment variable is not configured. ' +
        'This is required for credential encryption.',
      'MISSING_SECRET_KEY'
    )
  }

  if (secretKey.length < 32) {
    throw new EncryptionError(
      'ENCRYPTION_SECRET_KEY must be at least 32 characters long for adequate security.',
      'INVALID_SECRET_KEY'
    )
  }

  return secretKey
}

/**
 * Derive an encryption key from the secret using PBKDF2
 *
 * Uses PBKDF2 with SHA-256 and 100,000 iterations to derive a 256-bit key
 * from the secret. The salt ensures that the same secret produces different
 * keys when used with different salts.
 *
 * @param salt - Salt for key derivation (must be cryptographically random)
 * @returns Derived key buffer of KEY_LENGTH bytes
 * @throws {EncryptionError} If key derivation fails
 */
function deriveKey(salt: Buffer): Buffer {
  // Use cached key if salt matches (performance optimization)
  if (cachedDerivedKey && cachedSalt && cachedSalt.equals(salt)) {
    return cachedDerivedKey
  }

  try {
    const secretKey = getSecretKey()

    const derivedKey = crypto.pbkdf2Sync(
      secretKey,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      PBKDF2_DIGEST
    )

    // Cache for performance (same salt = same key)
    cachedDerivedKey = derivedKey
    cachedSalt = Buffer.from(salt)

    return derivedKey
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }
    throw new EncryptionError(
      'Failed to derive encryption key',
      'KEY_DERIVATION_FAILED',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Generate a cryptographically secure random IV
 *
 * Uses Node.js crypto.randomBytes for cryptographic randomness.
 * The IV length of 12 bytes (96 bits) is the recommended size for GCM mode.
 *
 * @returns Random IV buffer of IV_LENGTH bytes
 */
function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH)
}

/**
 * Generate a cryptographically secure random salt
 *
 * Uses Node.js crypto.randomBytes for cryptographic randomness.
 * The salt is used in PBKDF2 key derivation to ensure unique keys.
 *
 * @returns Random salt buffer of SALT_LENGTH bytes
 */
function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH)
}

/**
 * Clear cached keys from memory
 *
 * Securely overwrites cached key material with random data before
 * dereferencing. Call this when security context changes or on logout.
 */
export function clearKeyCache(): void {
  if (cachedDerivedKey) {
    crypto.randomFillSync(cachedDerivedKey)
    cachedDerivedKey = null
  }
  if (cachedSalt) {
    crypto.randomFillSync(cachedSalt)
    cachedSalt = null
  }
}

// ==================== CORE ENCRYPTION FUNCTIONS ====================

/**
 * Encrypt sensitive data using AES-256-GCM
 *
 * Data format (all concatenated then Base64 encoded):
 * [version:1 byte][salt:32 bytes][iv:12 bytes][authTag:16 bytes][ciphertext:variable]
 *
 * The salt and IV are generated fresh for each encryption operation,
 * ensuring that encrypting the same plaintext produces different ciphertext.
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns EncryptionResult with Base64-encoded encrypted data and version
 * @throws {EncryptionError} If encryption fails or data is empty
 *
 * @example
 * ```typescript
 * const { encrypted } = encrypt('my-secret-api-key')
 * // Store 'encrypted' in database
 * ```
 */
export function encrypt(plaintext: string): EncryptionResult {
  if (!plaintext || plaintext.length === 0) {
    throw new EncryptionError(
      'Cannot encrypt empty data',
      'EMPTY_DATA'
    )
  }

  try {
    // Generate random salt and IV for this encryption
    const salt = generateSalt()
    const iv = generateIV()

    // Derive encryption key from secret + salt
    const key = deriveKey(salt)

    // Create AES-256-GCM cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    // Get authentication tag (provides integrity verification)
    const authTag = cipher.getAuthTag()

    // Combine all components: version + salt + iv + authTag + ciphertext
    const combined = Buffer.concat([
      Buffer.from([ENCRYPTION_VERSION]),
      salt,
      iv,
      authTag,
      encrypted,
    ])

    return {
      encrypted: combined.toString('base64'),
      version: ENCRYPTION_VERSION,
    }
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }
    throw new EncryptionError(
      'Encryption operation failed',
      'ENCRYPTION_FAILED',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Decrypt data encrypted with the encrypt function
 *
 * Extracts the version, salt, IV, and auth tag from the encrypted data,
 * derives the same key using PBKDF2, and decrypts. The GCM auth tag
 * provides tamper detection.
 *
 * @param encryptedData - Base64-encoded encrypted data from encrypt()
 * @returns DecryptionResult with decrypted plaintext and version
 * @throws {EncryptionError} If decryption fails, data is tampered, or format is invalid
 *
 * @example
 * ```typescript
 * const { decrypted } = decrypt(storedEncryptedValue)
 * // Use 'decrypted' (the original plaintext)
 * ```
 */
export function decrypt(encryptedData: string): DecryptionResult {
  if (!encryptedData || encryptedData.length === 0) {
    throw new EncryptionError(
      'Cannot decrypt empty data',
      'EMPTY_DATA'
    )
  }

  try {
    // Decode from Base64
    const combined = Buffer.from(encryptedData, 'base64')

    // Calculate minimum expected length
    const minLength = 1 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1
    if (combined.length < minLength) {
      throw new EncryptionError(
        'Invalid encrypted data format: data too short',
        'INVALID_DATA_FORMAT'
      )
    }

    // Extract version byte
    const version = combined[0]

    if (version !== ENCRYPTION_VERSION) {
      throw new EncryptionError(
        `Unsupported encryption version: ${version}. Expected: ${ENCRYPTION_VERSION}`,
        'UNSUPPORTED_VERSION'
      )
    }

    // Extract components from the combined buffer
    let offset = 1
    const salt = combined.subarray(offset, offset + SALT_LENGTH)
    offset += SALT_LENGTH

    const iv = combined.subarray(offset, offset + IV_LENGTH)
    offset += IV_LENGTH

    const authTag = combined.subarray(offset, offset + AUTH_TAG_LENGTH)
    offset += AUTH_TAG_LENGTH

    const ciphertext = combined.subarray(offset)

    // Derive decryption key using the same salt
    const key = deriveKey(salt)

    // Create AES-256-GCM decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return {
      decrypted: decrypted.toString('utf8'),
      version,
    }
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }

    // GCM authentication failure indicates tampering
    if (
      error instanceof Error &&
      error.message.includes('Unsupported state or unable to authenticate data')
    ) {
      throw new EncryptionError(
        'Data authentication failed. The encrypted data may have been tampered with.',
        'DATA_TAMPERING_DETECTED',
        error
      )
    }

    throw new EncryptionError(
      'Decryption operation failed',
      'DECRYPTION_FAILED',
      error instanceof Error ? error : undefined
    )
  }
}

// ==================== CREDENTIAL MANAGEMENT ====================

/**
 * Encrypt a credential for secure storage
 *
 * Creates a complete credential record with encrypted value, metadata,
 * and timestamps suitable for database storage.
 *
 * @param credentialValue - The sensitive credential value to encrypt
 * @param options - Encryption options including type, expiration, and metadata
 * @returns EncryptedCredential object ready for storage
 *
 * @example
 * ```typescript
 * const credential = encryptCredential('sk_live_abc123...', {
 *   type: 'api_secret',
 *   expiresAt: new Date('2025-12-31'),
 *   metadata: { provider: 'stripe' }
 * })
 * // Store credential in database
 * ```
 */
export function encryptCredential(
  credentialValue: string,
  options: CredentialEncryptionOptions
): EncryptedCredential {
  const { encrypted, version } = encrypt(credentialValue)

  return {
    id: crypto.randomUUID(),
    type: options.type,
    encryptedValue: encrypted,
    version,
    encryptedAt: new Date().toISOString(),
    expiresAt: options.expiresAt?.toISOString(),
    metadata: options.metadata,
  }
}

/**
 * Decrypt a stored credential
 *
 * Validates expiration before decryption and returns the original
 * credential value.
 *
 * @param credential - The encrypted credential object from storage
 * @returns Decrypted credential value as string
 * @throws {EncryptionError} If decryption fails or credential has expired
 *
 * @example
 * ```typescript
 * const apiKey = decryptCredential(storedCredential)
 * // Use apiKey to make API calls
 * ```
 */
export function decryptCredential(credential: EncryptedCredential): string {
  // Check expiration before decrypting
  if (credential.expiresAt) {
    const expirationDate = new Date(credential.expiresAt)
    if (expirationDate < new Date()) {
      throw new EncryptionError(
        `Credential expired on ${credential.expiresAt}`,
        'CREDENTIAL_EXPIRED'
      )
    }
  }

  const { decrypted } = decrypt(credential.encryptedValue)
  return decrypted
}

/**
 * Re-encrypt a credential with fresh encryption
 *
 * Useful for key rotation scenarios or when updating encryption
 * parameters. Decrypts with the current key and re-encrypts with
 * fresh salt and IV.
 *
 * @param credential - The existing encrypted credential
 * @returns New EncryptedCredential with fresh encryption
 *
 * @example
 * ```typescript
 * // During key rotation
 * const refreshedCredential = reencryptCredential(oldCredential)
 * // Update in database
 * ```
 */
export function reencryptCredential(
  credential: EncryptedCredential
): EncryptedCredential {
  const decryptedValue = decryptCredential(credential)

  return {
    ...credential,
    id: crypto.randomUUID(),
    encryptedValue: encrypt(decryptedValue).encrypted,
    version: ENCRYPTION_VERSION,
    encryptedAt: new Date().toISOString(),
  }
}

/**
 * Check if a credential is expired
 *
 * @param credential - The credential to check
 * @returns True if expired or expiration date has passed, false otherwise
 */
export function isCredentialExpired(credential: EncryptedCredential): boolean {
  if (!credential.expiresAt) {
    return false
  }
  return new Date(credential.expiresAt) < new Date()
}

/**
 * Create a secure HMAC hash of a credential
 *
 * Useful for credential comparison without storing the plaintext,
 * or for creating lookup indices. Uses HMAC-SHA256 with the
 * encryption secret as the key.
 *
 * @param credentialValue - The credential to hash
 * @returns Base64-encoded HMAC-SHA256 hash
 *
 * @example
 * ```typescript
 * const hash = hashCredential(apiKey)
 * // Store hash for later comparison
 * ```
 */
export function hashCredential(credentialValue: string): string {
  const secretKey = getSecretKey()
  return crypto
    .createHmac('sha256', secretKey)
    .update(credentialValue)
    .digest('base64')
}

/**
 * Securely compare two credentials using constant-time comparison
 *
 * Prevents timing attacks by using crypto.timingSafeEqual.
 * Compares HMAC hashes rather than plaintext to ensure constant time.
 *
 * @param credential1 - First credential
 * @param credential2 - Second credential
 * @returns True if credentials match, false otherwise
 *
 * @example
 * ```typescript
 * if (secureCompareCredentials(providedKey, storedKey)) {
 *   // Credentials match
 * }
 * ```
 */
export function secureCompareCredentials(
  credential1: string,
  credential2: string
): boolean {
  const hash1 = hashCredential(credential1)
  const hash2 = hashCredential(credential2)

  const buffer1 = Buffer.from(hash1, 'base64')
  const buffer2 = Buffer.from(hash2, 'base64')

  if (buffer1.length !== buffer2.length) {
    return false
  }

  return crypto.timingSafeEqual(buffer1, buffer2)
}

// ==================== BATCH OPERATIONS ====================

/**
 * Encrypt multiple credentials in a batch
 *
 * @param credentials - Array of credential values with their options
 * @returns Array of encrypted credentials
 *
 * @example
 * ```typescript
 * const encrypted = encryptCredentialBatch([
 *   { value: 'api-key-1', options: { type: 'api_key' } },
 *   { value: 'api-key-2', options: { type: 'api_key' } },
 * ])
 * ```
 */
export function encryptCredentialBatch(
  credentials: Array<{ value: string; options: CredentialEncryptionOptions }>
): EncryptedCredential[] {
  return credentials.map(({ value, options }) =>
    encryptCredential(value, options)
  )
}

/**
 * Decrypt multiple credentials in a batch
 *
 * @param credentials - Array of encrypted credentials
 * @returns Array of decrypted values with their IDs and types
 *
 * @example
 * ```typescript
 * const decrypted = decryptCredentialBatch(storedCredentials)
 * // [{ id: '...', value: 'api-key-1', type: 'api_key' }, ...]
 * ```
 */
export function decryptCredentialBatch(
  credentials: EncryptedCredential[]
): Array<{ id: string; value: string; type: CredentialType }> {
  return credentials.map((credential) => ({
    id: credential.id,
    value: decryptCredential(credential),
    type: credential.type,
  }))
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate a cryptographically secure random credential
 *
 * Useful for generating API keys, secrets, tokens, etc.
 *
 * @param length - Length of the credential in bytes (default: 32 = 256 bits)
 * @param encoding - Output encoding (default: 'base64url' for URL-safe output)
 * @returns Randomly generated credential string
 *
 * @example
 * ```typescript
 * const apiKey = generateSecureCredential(32, 'base64url')
 * // e.g., "dGhpcyBpcyBhIHNlY3VyZSBrZXk..."
 * ```
 */
export function generateSecureCredential(
  length: number = 32,
  encoding: BufferEncoding = 'base64url'
): string {
  return crypto.randomBytes(length).toString(encoding)
}

/**
 * Generate a secure API key pair
 *
 * Creates a key ID (public identifier) and key secret (sensitive value)
 * along with a hash of the secret for storage.
 *
 * @returns Object containing keyId, keySecret, and keySecretHash
 *
 * @example
 * ```typescript
 * const { keyId, keySecret, keySecretHash } = generateAPIKeyPair()
 * // Show keySecret to user once, store keyId and keySecretHash
 * ```
 */
export function generateAPIKeyPair(): {
  keyId: string
  keySecret: string
  keySecretHash: string
} {
  const keyId = `key_${crypto.randomBytes(12).toString('hex')}`
  const keySecret = `sk_${crypto.randomBytes(32).toString('base64url')}`
  const keySecretHash = hashCredential(keySecret)

  return { keyId, keySecret, keySecretHash }
}

/**
 * Mask a credential for safe logging/display
 *
 * Shows only the first and last few characters with asterisks in between.
 *
 * @param credential - The credential to mask
 * @param visibleChars - Number of characters to show at start and end (default: 4)
 * @returns Masked credential string
 *
 * @example
 * ```typescript
 * maskCredential('sk_live_abc123xyz789')
 * // Returns: "sk_l********z789"
 * ```
 */
export function maskCredential(
  credential: string,
  visibleChars: number = 4
): string {
  if (!credential) {
    return '****'
  }

  if (credential.length <= visibleChars * 2) {
    return '*'.repeat(credential.length)
  }

  const start = credential.substring(0, visibleChars)
  const end = credential.substring(credential.length - visibleChars)
  const maskedLength = credential.length - visibleChars * 2
  const masked = '*'.repeat(Math.min(maskedLength, 8))

  return `${start}${masked}${end}`
}

/**
 * Validate that the encryption system is properly configured
 *
 * Checks for the presence and validity of ENCRYPTION_SECRET_KEY
 * and performs a test encryption/decryption cycle.
 *
 * @returns Object with validation status and any issues found
 *
 * @example
 * ```typescript
 * const { valid, issues } = validateEncryptionConfig()
 * if (!valid) {
 *   console.error('Encryption misconfigured:', issues)
 * }
 * ```
 */
export function validateEncryptionConfig(): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check if secret key is configured
  const secretKey = process.env.ENCRYPTION_SECRET_KEY
  if (!secretKey) {
    issues.push('ENCRYPTION_SECRET_KEY environment variable is not set')
  } else {
    if (secretKey.length < 32) {
      issues.push('ENCRYPTION_SECRET_KEY should be at least 32 characters')
    }
    if (secretKey.length < 64) {
      issues.push(
        'ENCRYPTION_SECRET_KEY should ideally be 64+ characters for maximum security'
      )
    }
  }

  // Test encryption/decryption round-trip
  if (secretKey && secretKey.length >= 32) {
    try {
      const testData = 'encryption-validation-test-' + Date.now()
      const encrypted = encrypt(testData)
      const decrypted = decrypt(encrypted.encrypted)

      if (decrypted.decrypted !== testData) {
        issues.push('Encryption/decryption validation failed: data mismatch')
      }
    } catch (error) {
      issues.push(
        `Encryption/decryption validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Get encryption service statistics and configuration
 *
 * Returns information about the encryption configuration for
 * monitoring and debugging purposes. Does not expose sensitive data.
 *
 * @returns Configuration and status information
 */
export function getEncryptionStats(): {
  algorithm: string
  keyLengthBits: number
  ivLengthBits: number
  authTagLengthBits: number
  saltLengthBits: number
  pbkdf2Iterations: number
  pbkdf2Digest: string
  version: number
  isConfigured: boolean
} {
  const isConfigured = !!process.env.ENCRYPTION_SECRET_KEY &&
    process.env.ENCRYPTION_SECRET_KEY.length >= 32

  return {
    algorithm: ALGORITHM,
    keyLengthBits: KEY_LENGTH * 8,
    ivLengthBits: IV_LENGTH * 8,
    authTagLengthBits: AUTH_TAG_LENGTH * 8,
    saltLengthBits: SALT_LENGTH * 8,
    pbkdf2Iterations: PBKDF2_ITERATIONS,
    pbkdf2Digest: PBKDF2_DIGEST,
    version: ENCRYPTION_VERSION,
    isConfigured,
  }
}

/**
 * Generate a secure encryption secret key
 *
 * Utility function to generate a suitable ENCRYPTION_SECRET_KEY value.
 * The generated key is 64 bytes (512 bits) encoded as base64.
 *
 * @returns Base64-encoded secret key suitable for ENCRYPTION_SECRET_KEY
 *
 * @example
 * ```typescript
 * const secretKey = generateEncryptionSecretKey()
 * console.log('Add to .env: ENCRYPTION_SECRET_KEY=' + secretKey)
 * ```
 */
export function generateEncryptionSecretKey(): string {
  return crypto.randomBytes(64).toString('base64')
}
