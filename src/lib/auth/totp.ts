/**
 * Time-based One-Time Password (TOTP) Library
 *
 * RFC 6238 compliant TOTP implementation for 2FA
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.
 *
 * Features:
 * - Secret key generation (Base32 encoded)
 * - TOTP token generation
 * - TOTP token verification with time window
 * - QR code generation for authenticator apps
 * - Backup code generation and verification
 */

import crypto from 'crypto'

/**
 * TOTP Configuration
 */
export interface TOTPConfig {
  /** Time step in seconds (default: 30) */
  timeStep?: number
  /** Number of digits in OTP (default: 6) */
  digits?: number
  /** Hash algorithm (default: 'sha1') */
  algorithm?: 'sha1' | 'sha256' | 'sha512'
  /** Time window for verification (default: 1 = ±30 seconds) */
  window?: number
  /** Issuer name for QR code (default: 'LOANZ 360') */
  issuer?: string
}

const DEFAULT_CONFIG: Required<TOTPConfig> = {
  timeStep: 30,
  digits: 6,
  algorithm: 'sha1',
  window: 1,
  issuer: 'LOANZ 360',
}

/**
 * Base32 encoding/decoding
 * Required for TOTP secret keys
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31]
  }

  // Add padding
  while (output.length % 8 !== 0) {
    output += '='
  }

  return output
}

function base32Decode(encoded: string): Buffer {
  // Remove padding
  encoded = encoded.toUpperCase().replace(/=+$/, '')

  let bits = 0
  let value = 0
  let index = 0
  const output = Buffer.alloc(((encoded.length * 5) / 8) | 0)

  for (let i = 0; i < encoded.length; i++) {
    const charIndex = BASE32_CHARS.indexOf(encoded[i])
    if (charIndex === -1) {
      throw new Error('Invalid base32 character')
    }

    value = (value << 5) | charIndex
    bits += 5

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
    }
  }

  return output
}

/**
 * Generate a random TOTP secret key
 * Returns a Base32 encoded string
 */
export function generateSecret(length: number = 32): string {
  const buffer = crypto.randomBytes(length)
  return base32Encode(buffer)
}

/**
 * Generate TOTP token for a given secret and time
 */
function generateTOTP(
  secret: string,
  time: number,
  config: Required<TOTPConfig>
): string {
  const { timeStep, digits, algorithm } = config

  // Decode Base32 secret
  const key = base32Decode(secret)

  // Calculate time counter
  const counter = Math.floor(time / timeStep)

  // Create counter buffer (8 bytes, big-endian)
  const counterBuffer = Buffer.alloc(8)
  let counterValue = counter
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counterValue & 0xff
    counterValue = counterValue >> 8
  }

  // Generate HMAC
  const hmac = crypto.createHmac(algorithm, key)
  hmac.update(counterBuffer)
  const digest = hmac.digest()

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0xf
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  // Generate OTP
  const otp = binary % Math.pow(10, digits)
  return otp.toString().padStart(digits, '0')
}

/**
 * Generate current TOTP token
 */
export function generateToken(
  secret: string,
  config: Partial<TOTPConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const now = Math.floor(Date.now() / 1000)
  return generateTOTP(secret, now, finalConfig)
}

/**
 * Verify TOTP token
 * Checks current time and ±window time steps
 */
export function verifyToken(
  token: string,
  secret: string,
  config: Partial<TOTPConfig> = {}
): boolean {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { timeStep, window } = finalConfig
  const now = Math.floor(Date.now() / 1000)

  // Try current time and ±window time steps
  for (let i = -window; i <= window; i++) {
    const time = now + i * timeStep
    const expectedToken = generateTOTP(secret, time, finalConfig)

    if (token === expectedToken) {
      return true
    }
  }

  return false
}

/**
 * Generate TOTP URI for QR code
 * Compatible with Google Authenticator, Authy, etc.
 */
export function generateTOTPUri(
  secret: string,
  accountName: string,
  config: Partial<TOTPConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { issuer, digits, timeStep, algorithm } = finalConfig

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm.toUpperCase(),
    digits: digits.toString(),
    period: timeStep.toString(),
  })

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params.toString()}`
}

/**
 * Generate QR code data URL
 * Returns a data URL that can be displayed as an image
 */
export async function generateQRCode(
  secret: string,
  accountName: string,
  config: Partial<TOTPConfig> = {}
): Promise<string> {
  const uri = generateTOTPUri(secret, accountName, config)

  // Use a simple QR code generation approach
  // In production, you might want to use a library like 'qrcode'
  // For now, we'll return a URL that can be used with a QR code service
  const qrCodeServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(uri)}`

  return qrCodeServiceUrl
}

/**
 * Alternative QR code generation using canvas (for server-side)
 * This is a placeholder - in production, use a library like 'qrcode'
 */
export function generateQRCodeDataURL(
  secret: string,
  accountName: string,
  config: Partial<TOTPConfig> = {}
): string {
  const uri = generateTOTPUri(secret, accountName, config)

  // This would typically use the 'qrcode' npm package
  // For now, return the URI that can be used by a client-side QR generator
  return uri
}

/**
 * Generate backup codes
 * Returns an array of 10 alphanumeric codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()
      .slice(0, 8)

    codes.push(code)
  }

  return codes
}

/**
 * Hash backup code for storage
 * Uses SHA-256
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Verify backup code against hash
 */
export function verifyBackupCode(code: string, hash: string): boolean {
  const codeHash = hashBackupCode(code)
  return codeHash === hash
}

/**
 * Generate device fingerprint
 * Creates a unique identifier for a device based on IP, user agent, etc.
 */
export function generateDeviceFingerprint(
  ipAddress: string,
  userAgent: string,
  additionalData?: Record<string, string>
): string {
  const data = [ipAddress, userAgent]

  if (additionalData) {
    Object.keys(additionalData)
      .sort()
      .forEach((key) => {
        data.push(`${key}:${additionalData[key]}`)
      })
  }

  return crypto.createHash('sha256').update(data.join('|')).digest('hex')
}

/**
 * Get time remaining until next TOTP token change
 * Returns seconds remaining
 */
export function getTimeRemaining(config: Partial<TOTPConfig> = {}): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { timeStep } = finalConfig
  const now = Math.floor(Date.now() / 1000)
  const timeInCurrentStep = now % timeStep
  return timeStep - timeInCurrentStep
}

/**
 * Validate secret key format
 */
export function isValidSecret(secret: string): boolean {
  try {
    // Check if it's valid Base32
    base32Decode(secret)
    return true
  } catch {
    return false
  }
}

/**
 * Format token for display (e.g., "123 456")
 */
export function formatToken(token: string): string {
  if (token.length === 6) {
    return `${token.slice(0, 3)} ${token.slice(3)}`
  }
  return token
}

/**
 * Parse and clean token input
 * Removes spaces, dashes, and non-numeric characters
 */
export function parseToken(input: string): string {
  return input.replace(/\s|-/g, '').replace(/\D/g, '')
}

/**
 * TOTP Service Class
 * Convenience wrapper around TOTP functions
 */
export class TOTPService {
  private config: Required<TOTPConfig>

  constructor(config: Partial<TOTPConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Generate a new secret key
   */
  generateSecret(length: number = 32): string {
    return generateSecret(length)
  }

  /**
   * Generate current token
   */
  generateToken(secret: string): string {
    return generateToken(secret, this.config)
  }

  /**
   * Verify token
   */
  verifyToken(token: string, secret: string): boolean {
    const cleanToken = parseToken(token)
    return verifyToken(cleanToken, secret, this.config)
  }

  /**
   * Generate TOTP URI
   */
  generateUri(secret: string, accountName: string): string {
    return generateTOTPUri(secret, accountName, this.config)
  }

  /**
   * Generate QR code
   */
  async generateQRCode(secret: string, accountName: string): Promise<string> {
    return generateQRCode(secret, accountName, this.config)
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    return generateBackupCodes(count)
  }

  /**
   * Hash backup code
   */
  hashBackupCode(code: string): string {
    return hashBackupCode(code)
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(code: string, hash: string): boolean {
    return verifyBackupCode(code, hash)
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(
    ipAddress: string,
    userAgent: string,
    additionalData?: Record<string, string>
  ): string {
    return generateDeviceFingerprint(ipAddress, userAgent, additionalData)
  }

  /**
   * Get time remaining
   */
  getTimeRemaining(): number {
    return getTimeRemaining(this.config)
  }

  /**
   * Validate secret
   */
  isValidSecret(secret: string): boolean {
    return isValidSecret(secret)
  }

  /**
   * Format token
   */
  formatToken(token: string): string {
    return formatToken(token)
  }

  /**
   * Parse token
   */
  parseToken(input: string): string {
    return parseToken(input)
  }
}

/**
 * Default TOTP service instance
 */
export const totp = new TOTPService()
