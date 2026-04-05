/**
 * Trace Token Utility
 * Handles encoding and decoding of referral tracking tokens
 */

import crypto from 'crypto'
import type { TraceToken, PartnerType } from '@/types/unified-crm.types'
import type { CustomerTraceToken } from '@/types/customer-referrals'

// Extended role type to include CUSTOMER
export type ExtendedRoleType = PartnerType | 'CUSTOMER'

// Encryption key (should be stored in environment variable)
const ENCRYPTION_KEY = process.env.TRACE_TOKEN_SECRET || 'loanz360-trace-token-secret-key-2025'

// Ensure key is 32 bytes for AES-256
const getEncryptionKey = (): Buffer => {
  const hash = crypto.createHash('sha256')
  hash.update(ENCRYPTION_KEY)
  return hash.digest()
}

/**
 * Generate a trace token for lead tracking
 * Format: role_userID_partnerID_partnerCode_timestamp_randomKey
 */
export function generateTraceToken(params: {
  role: PartnerType
  userId: string
  partnerId: string
  partnerCode: string
}): string {
  const { role, userId, partnerId, partnerCode } = params

  const timestamp = Date.now()
  const randomKey = crypto.randomBytes(8).toString('hex')

  const tokenData: TraceToken = {
    role,
    userId,
    partnerId,
    partnerCode,
    timestamp,
    randomKey,
  }

  return encryptTraceToken(tokenData)
}

/**
 * Encrypt trace token data
 */
function encryptTraceToken(tokenData: TraceToken): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    const plaintext = JSON.stringify(tokenData)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Combine IV and encrypted data
    const combined = iv.toString('hex') + ':' + encrypted

    // Base64 encode for URL safety
    return Buffer.from(combined).toString('base64url')
  } catch (error) {
    console.error('Error encrypting trace token:', error)
    throw new Error('Failed to generate trace token')
  }
}

/**
 * Decrypt and parse trace token
 */
export function decryptTraceToken(encryptedToken: string): TraceToken | null {
  try {
    const key = getEncryptionKey()

    // Base64 decode
    const combined = Buffer.from(encryptedToken, 'base64url').toString()

    // Split IV and encrypted data
    const [ivHex, encryptedHex] = combined.split(':')

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid token format')
    }

    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    const tokenData = JSON.parse(decrypted) as TraceToken

    // Validate token structure
    if (
      !tokenData.role ||
      !tokenData.userId ||
      !tokenData.partnerId ||
      !tokenData.partnerCode ||
      !tokenData.timestamp ||
      !tokenData.randomKey
    ) {
      throw new Error('Invalid token structure')
    }

    return tokenData
  } catch (error) {
    console.error('Error decrypting trace token:', error)
    return null
  }
}

/**
 * Validate trace token (check if expired, etc.)
 */
export function validateTraceToken(
  traceToken: TraceToken,
  options: {
    maxAgeMs?: number // Maximum age in milliseconds
  } = {}
): { valid: boolean; reason?: string } {
  const { maxAgeMs = 30 * 24 * 60 * 60 * 1000 } = options // Default: 30 days

  // Check token age
  const tokenAge = Date.now() - traceToken.timestamp
  if (tokenAge > maxAgeMs) {
    return { valid: false, reason: 'Token expired' }
  }

  // Check required fields
  if (!traceToken.role || !traceToken.userId || !traceToken.partnerId) {
    return { valid: false, reason: 'Invalid token structure' }
  }

  return { valid: true }
}

/**
 * Generate a human-readable trace token string (for logging/debugging)
 */
export function traceTokenToString(token: TraceToken): string {
  return `${token.role}_${token.partnerCode}_${new Date(token.timestamp).toISOString()}`
}

/**
 * Generate a simple unencrypted trace token (for testing/debugging only)
 */
export function generateSimpleTraceToken(params: {
  role: PartnerType
  userId: string
  partnerId: string
  partnerCode: string
}): string {
  const { role, userId, partnerId, partnerCode } = params
  const timestamp = Date.now()
  const randomKey = crypto.randomBytes(4).toString('hex')

  return `${role}_${userId.slice(0, 8)}_${partnerId.slice(0, 8)}_${partnerCode}_${timestamp}_${randomKey}`
}

// ============================================================================
// CUSTOMER REFERRAL TOKEN FUNCTIONS
// ============================================================================

/**
 * Generate a trace token for customer referral tracking
 * Format: CUSTOMER_userID_customerID_timestamp_randomKey
 */
export function generateCustomerTraceToken(params: {
  userId: string
  customerId: string
}): string {
  const { userId, customerId } = params

  const timestamp = Date.now()
  const randomKey = crypto.randomBytes(8).toString('hex')

  const tokenData: CustomerTraceToken = {
    role: 'CUSTOMER',
    userId,
    customerId,
    timestamp,
    randomKey,
  }

  return encryptCustomerTraceToken(tokenData)
}

/**
 * Encrypt customer trace token data
 */
function encryptCustomerTraceToken(tokenData: CustomerTraceToken): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    const plaintext = JSON.stringify(tokenData)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Combine IV and encrypted data
    const combined = iv.toString('hex') + ':' + encrypted

    // Base64 encode for URL safety
    return Buffer.from(combined).toString('base64url')
  } catch (error) {
    console.error('Error encrypting customer trace token:', error)
    throw new Error('Failed to generate customer trace token')
  }
}

/**
 * Decrypt and parse customer trace token
 */
export function decryptCustomerTraceToken(encryptedToken: string): CustomerTraceToken | null {
  try {
    const key = getEncryptionKey()

    // Base64 decode
    const combined = Buffer.from(encryptedToken, 'base64url').toString()

    // Split IV and encrypted data
    const [ivHex, encryptedHex] = combined.split(':')

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid token format')
    }

    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    const tokenData = JSON.parse(decrypted) as CustomerTraceToken

    // Validate token structure
    if (
      tokenData.role !== 'CUSTOMER' ||
      !tokenData.userId ||
      !tokenData.customerId ||
      !tokenData.timestamp ||
      !tokenData.randomKey
    ) {
      throw new Error('Invalid customer token structure')
    }

    return tokenData
  } catch (error) {
    console.error('Error decrypting customer trace token:', error)
    return null
  }
}

/**
 * Determine if a trace token is from a customer or partner
 */
export function detectTraceTokenType(encryptedToken: string): 'CUSTOMER' | 'PARTNER' | null {
  // Try to decrypt as customer token first
  const customerToken = decryptCustomerTraceToken(encryptedToken)
  if (customerToken && customerToken.role === 'CUSTOMER') {
    return 'CUSTOMER'
  }

  // Try to decrypt as partner token
  const partnerToken = decryptTraceToken(encryptedToken)
  if (partnerToken) {
    return 'PARTNER'
  }

  return null
}

/**
 * Validate customer trace token
 */
export function validateCustomerTraceToken(
  traceToken: CustomerTraceToken,
  options: {
    maxAgeMs?: number // Maximum age in milliseconds (no expiry by default for customers)
  } = {}
): { valid: boolean; reason?: string } {
  // No expiry by default for customer referral links
  const { maxAgeMs } = options

  // Check token age only if maxAgeMs is specified
  if (maxAgeMs) {
    const tokenAge = Date.now() - traceToken.timestamp
    if (tokenAge > maxAgeMs) {
      return { valid: false, reason: 'Token expired' }
    }
  }

  // Check required fields
  if (!traceToken.role || !traceToken.userId || !traceToken.customerId) {
    return { valid: false, reason: 'Invalid token structure' }
  }

  return { valid: true }
}
