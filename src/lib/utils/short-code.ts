/**
 * Short Code Utility
 * Handles generation of short codes for URL shortening
 */

import crypto from 'crypto'

/**
 * Character set for short codes
 * Excludes confusing characters: 0, O, I, l, 1
 */
const CHARSET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a random short code
 */
export function generateShortCode(length: number = 8): string {
  const charsetLength = CHARSET.length
  let shortCode = ''

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charsetLength)
    shortCode += CHARSET[randomIndex]
  }

  return shortCode
}

/**
 * Generate a cryptographically secure short code
 */
export function generateSecureShortCode(length: number = 8): string {
  const bytes = crypto.randomBytes(length)
  let shortCode = ''

  for (let i = 0; i < length; i++) {
    const randomIndex = bytes[i] % CHARSET.length
    shortCode += CHARSET[randomIndex]
  }

  return shortCode
}

/**
 * Generate a short code from a hash (deterministic)
 */
export function generateHashedShortCode(input: string, length: number = 8): string {
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  let shortCode = ''

  for (let i = 0; i < length; i++) {
    const charIndex = parseInt(hash.substr(i * 2, 2), 16) % CHARSET.length
    shortCode += CHARSET[charIndex]
  }

  return shortCode
}

/**
 * Validate short code format
 */
export function isValidShortCode(code: string): boolean {
  // Check length (6-20 characters)
  if (code.length < 6 || code.length > 20) {
    return false
  }

  // Check if all characters are in the charset
  for (const char of code) {
    if (!CHARSET.includes(char)) {
      return false
    }
  }

  return true
}

/**
 * Generate a unique short code with retry logic
 */
export async function generateUniqueShortCode(
  checkExists: (code: string) => Promise<boolean>,
  length: number = 8,
  maxRetries: number = 10
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const shortCode = generateSecureShortCode(length)
    const exists = await checkExists(shortCode)

    if (!exists) {
      return shortCode
    }
  }

  // If we couldn't find a unique code, increase length and try once more
  const longerCode = generateSecureShortCode(length + 2)
  const exists = await checkExists(longerCode)

  if (!exists) {
    return longerCode
  }

  throw new Error('Failed to generate unique short code after multiple attempts')
}

/**
 * Build full short URL
 */
export function buildShortUrl(shortCode: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
  return `${base}/apply/${shortCode}`
}

/**
 * Extract short code from URL
 */
export function extractShortCodeFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)

    // Check if URL matches pattern /apply/{shortCode}
    if (pathParts.length >= 2 && pathParts[0] === 'apply') {
      return pathParts[1]
    }

    // Check if URL matches pattern /l/{shortCode} (alternative format)
    if (pathParts.length >= 2 && pathParts[0] === 'l') {
      return pathParts[1]
    }

    return null
  } catch (error) {
    return null
  }
}
