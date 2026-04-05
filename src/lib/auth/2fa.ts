/**
 * Two-Factor Authentication (2FA) Utilities
 * Implements TOTP (Time-based One-Time Password) using RFC 6238
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator
 */

import * as crypto from 'crypto'

// Base32 encoding/decoding for TOTP secrets
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Generate a random base32-encoded secret for TOTP
 * @returns Base32 secret string (32 characters)
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20) // 160 bits
  let secret = ''

  for (let i = 0; i < buffer.length; i++) {
    secret += BASE32_CHARS[buffer[i] % 32]
  }

  return secret
}

/**
 * Generate a QR code URL for scanning in authenticator apps
 * @param secret - Base32 TOTP secret
 * @param accountName - User's email or username
 * @param issuer - Application name (e.g., "Loanz360")
 * @returns otpauth:// URL for QR code generation
 */
export function generateQRCodeURL(
  secret: string,
  accountName: string,
  issuer: string = 'Loanz360'
): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedAccount = encodeURIComponent(accountName)

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Base32 decode helper
 */
function base32Decode(base32: string): Buffer {
  const cleanInput = base32.toUpperCase().replace(/=+$/, '')
  let bits = ''

  for (const char of cleanInput) {
    const val = BASE32_CHARS.indexOf(char)
    if (val === -1) throw new Error('Invalid base32 character')
    bits += val.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }

  return Buffer.from(bytes)
}

/**
 * Generate TOTP code for a given secret and time
 * @param secret - Base32 encoded secret
 * @param timeStep - Unix timestamp (defaults to current time)
 * @returns 6-digit TOTP code
 */
export function generateTOTP(secret: string, timeStep?: number): string {
  const time = timeStep || Math.floor(Date.now() / 1000)
  const counter = Math.floor(time / 30) // 30-second time window

  // Decode secret
  const key = base32Decode(secret)

  // Create counter buffer (8 bytes, big-endian)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  // Generate HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key)
  hmac.update(counterBuffer)
  const hash = hmac.digest()

  // Dynamic truncation (RFC 6238)
  const offset = hash[hash.length - 1] & 0xf
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  // Generate 6-digit code
  const otp = binary % 1000000
  return otp.toString().padStart(6, '0')
}

/**
 * Verify TOTP code against secret
 * Allows for time drift (±1 time window = ±30 seconds)
 * @param secret - Base32 encoded secret
 * @param token - 6-digit code to verify
 * @param window - Time windows to check (default: 1 = ±30s)
 * @returns true if code is valid
 */
export function verifyTOTP(
  secret: string,
  token: string,
  window: number = 1
): boolean {
  const time = Math.floor(Date.now() / 1000)

  // Check current window and ±window
  for (let i = -window; i <= window; i++) {
    const timeStep = time + i * 30
    const validToken = generateTOTP(secret, timeStep)

    if (validToken === token) {
      return true
    }
  }

  return false
}

/**
 * Generate backup codes for account recovery
 * @param count - Number of backup codes to generate (default: 10)
 * @returns Array of backup codes (format: XXXX-XXXX-XXXX)
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(6).toString('hex').toUpperCase()
    const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
    codes.push(formatted)
  }

  return codes
}

/**
 * Hash a backup code for secure storage
 * @param code - Backup code to hash
 * @returns SHA-256 hash of the code
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code.replace(/-/g, '')) // Remove dashes before hashing
    .digest('hex')
}

/**
 * Verify a backup code against its hash
 * @param code - Backup code to verify
 * @param hash - Stored hash to compare against
 * @returns true if code matches hash
 */
export function verifyBackupCode(code: string, hash: string): boolean {
  const codeHash = hashBackupCode(code)
  return crypto.timingSafeEqual(
    Buffer.from(codeHash),
    Buffer.from(hash)
  )
}

/**
 * Encrypt TOTP secret for database storage
 * @param secret - Base32 secret to encrypt
 * @param encryptionKey - 32-byte encryption key
 * @returns Encrypted secret with IV (format: iv:encrypted)
 */
export function encryptSecret(secret: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(16)
  const key = Buffer.from(encryptionKey, 'hex')

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Decrypt TOTP secret from database
 * @param encryptedData - Encrypted secret (format: iv:encrypted)
 * @param encryptionKey - 32-byte encryption key
 * @returns Decrypted Base32 secret
 */
export function decryptSecret(encryptedData: string, encryptionKey: string): string {
  const [ivHex, encryptedHex] = encryptedData.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const key = Buffer.from(encryptionKey, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generate device fingerprint from request headers
 * Used for trusted device tracking
 * @param userAgent - User agent string
 * @param ip - IP address
 * @returns SHA-256 hash fingerprint
 */
export function generateDeviceFingerprint(userAgent: string, ip: string): string {
  const data = `${userAgent}|${ip}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Parse user agent string to extract browser and OS
 * @param userAgent - User agent string
 * @returns Object with browser and OS info
 */
export function parseUserAgent(userAgent: string): { browser: string; os: string } {
  let browser = 'Unknown'
  let os = 'Unknown'

  // Detect browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome'
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox'
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari'
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge'
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    browser = 'Internet Explorer'
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows'
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS'
  } else if (userAgent.includes('Linux')) {
    os = 'Linux'
  } else if (userAgent.includes('Android')) {
    os = 'Android'
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS'
  }

  return { browser, os }
}

/**
 * Rate limiting for 2FA attempts
 * Prevents brute force attacks
 */
export class TwoFactorRateLimiter {
  private attempts: Map<string, number[]> = new Map()
  private maxAttempts: number
  private windowMs: number

  constructor(maxAttempts: number = 5, windowMs: number = 300000) { // 5 attempts per 5 minutes
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  /**
   * Check if user has exceeded rate limit
   * @param identifier - User identifier (admin_id or IP)
   * @returns true if rate limit exceeded
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(identifier) || []

    // Remove old attempts outside window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs)
    this.attempts.set(identifier, recentAttempts)

    return recentAttempts.length >= this.maxAttempts
  }

  /**
   * Record a failed attempt
   * @param identifier - User identifier
   */
  recordAttempt(identifier: string): void {
    const attempts = this.attempts.get(identifier) || []
    attempts.push(Date.now())
    this.attempts.set(identifier, attempts)
  }

  /**
   * Reset attempts for a user (on successful verification)
   * @param identifier - User identifier
   */
  resetAttempts(identifier: string): void {
    this.attempts.delete(identifier)
  }
}

// Export singleton rate limiter
export const twoFactorRateLimiter = new TwoFactorRateLimiter()

/**
 * Validate TOTP token format
 * @param token - Token to validate
 * @returns true if token is 6 digits
 */
export function isValidTOTPFormat(token: string): boolean {
  return /^\d{6}$/.test(token)
}

/**
 * Validate backup code format
 * @param code - Code to validate
 * @returns true if code matches format XXXX-XXXX-XXXX
 */
export function isValidBackupCodeFormat(code: string): boolean {
  return /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code)
}
