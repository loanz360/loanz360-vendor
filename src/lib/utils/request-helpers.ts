/**
 * Request Helper Utilities
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Secure request processing utilities
 *
 * Features:
 * - IP address extraction with proxy support
 * - Request fingerprinting
 * - Secure header parsing
 * - Request metadata extraction
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'

/**
 * Get the client's real IP address
 * Handles various proxy configurations (Cloudflare, AWS ALB, Nginx, etc.)
 */
export function getClientIP(request: NextRequest): string {
  // Priority order for IP extraction:
  // 1. CF-Connecting-IP (Cloudflare)
  // 2. True-Client-IP (Akamai, Cloudflare Enterprise)
  // 3. X-Real-IP (Nginx)
  // 4. X-Forwarded-For (first IP)
  // 5. Request IP (direct connection)

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return sanitizeIP(cfConnectingIP)
  }

  const trueClientIP = request.headers.get('true-client-ip')
  if (trueClientIP) {
    return sanitizeIP(trueClientIP)
  }

  const xRealIP = request.headers.get('x-real-ip')
  if (xRealIP) {
    return sanitizeIP(xRealIP)
  }

  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    // Get the first IP (original client)
    const ips = xForwardedFor.split(',').map(ip => ip.trim())
    if (ips.length > 0) {
      return sanitizeIP(ips[0])
    }
  }

  // Fallback to direct IP
  return request.ip || 'unknown'
}

/**
 * Sanitize IP address to prevent injection
 */
function sanitizeIP(ip: string): string {
  // Remove any non-IP characters
  const sanitized = ip.trim()

  // Validate IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(sanitized)) {
    // Validate each octet
    const octets = sanitized.split('.').map(Number)
    if (octets.every(o => o >= 0 && o <= 255)) {
      return sanitized
    }
  }

  // Validate IPv6
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  if (ipv6Regex.test(sanitized)) {
    return sanitized.toLowerCase()
  }

  // Return masked if invalid
  return 'invalid-ip'
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

/**
 * Get or generate request ID from headers
 */
export function getRequestId(request: NextRequest): string {
  const existingId = request.headers.get('x-request-id')
  if (existingId && /^[a-zA-Z0-9_-]{10,64}$/.test(existingId)) {
    return existingId
  }
  return generateRequestId()
}

/**
 * Get user agent with length limit
 */
export function getUserAgent(request: NextRequest, maxLength: number = 500): string {
  const ua = request.headers.get('user-agent') || 'unknown'
  return ua.slice(0, maxLength)
}

/**
 * Generate a request fingerprint for fraud detection
 * Uses multiple signals to identify unique clients
 */
export function generateRequestFingerprint(request: NextRequest): string {
  const signals = [
    getClientIP(request),
    getUserAgent(request),
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    request.headers.get('sec-ch-ua') || '',
    request.headers.get('sec-ch-ua-platform') || '',
    request.headers.get('sec-ch-ua-mobile') || '',
  ].join('|')

  return crypto.createHash('sha256').update(signals).digest('hex').substring(0, 32)
}

/**
 * Extract request metadata for logging
 */
export function extractRequestMetadata(request: NextRequest): {
  ip: string
  userAgent: string
  requestId: string
  fingerprint: string
  method: string
  path: string
  query: Record<string, string>
  origin: string | null
  referer: string | null
  contentType: string | null
  contentLength: string | null
} {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams)

  return {
    ip: getClientIP(request),
    userAgent: getUserAgent(request),
    requestId: getRequestId(request),
    fingerprint: generateRequestFingerprint(request),
    method: request.method,
    path: request.nextUrl.pathname,
    query: searchParams,
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    contentType: request.headers.get('content-type'),
    contentLength: request.headers.get('content-length'),
  }
}

/**
 * Check if request is from a bot
 */
export function isBot(request: NextRequest): boolean {
  const ua = (request.headers.get('user-agent') || '').toLowerCase()

  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
    'httpclient', 'apache-httpclient', 'java/', 'php/', 'ruby/', 'perl/',
    'libwww', 'phantom', 'headless', 'selenium', 'puppeteer', 'playwright'
  ]

  return botPatterns.some(pattern => ua.includes(pattern))
}

/**
 * Check if request is from a known bad actor
 * This is a basic check - in production, use a threat intelligence service
 */
export function isSuspiciousRequest(request: NextRequest): {
  suspicious: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  // Check for missing required headers
  if (!request.headers.get('user-agent')) {
    reasons.push('missing_user_agent')
  }

  if (!request.headers.get('accept')) {
    reasons.push('missing_accept_header')
  }

  // Check for suspicious user agents
  const ua = request.headers.get('user-agent') || ''
  if (ua.length < 10) {
    reasons.push('short_user_agent')
  }

  // Check for curl/wget without proper headers
  if (isBot(request) && !request.headers.get('accept-language')) {
    reasons.push('bot_without_locale')
  }

  // Check for suspicious characters in path
  const path = request.nextUrl.pathname
  const suspiciousPatterns = [
    /\.\.\//,           // Path traversal
    /<script/i,         // XSS attempt
    /union\s+select/i,  // SQL injection
    /etc\/passwd/,      // Linux file access
    /\.env$/,           // Env file access
    /\.git\//,          // Git directory access
    /wp-admin/,         // WordPress admin
    /phpmyadmin/i,      // PHPMyAdmin
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(path)) {
      reasons.push('suspicious_path_pattern')
      break
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons
  }
}

/**
 * Parse JSON body safely
 */
export async function parseJSONBody<T = unknown>(
  request: NextRequest
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    // Check content type
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return { success: false, error: 'Content-Type must be application/json' }
    }

    // Check content length
    const contentLength = request.headers.get('content-length')
    const maxSize = 1024 * 1024 // 1MB
    if (contentLength && parseInt(contentLength) > maxSize) {
      return { success: false, error: 'Request body too large' }
    }

    const body = await request.json()
    return { success: true, data: body as T }
  } catch (error) {
    return { success: false, error: 'Invalid JSON body' }
  }
}

/**
 * Get country from Cloudflare headers
 */
export function getCountry(request: NextRequest): string | null {
  return request.headers.get('cf-ipcountry') || null
}

/**
 * Check if request is from allowed country
 */
export function isAllowedCountry(
  request: NextRequest,
  allowedCountries: string[]
): boolean {
  const country = getCountry(request)
  if (!country) {
    return true // Allow if country detection not available
  }
  return allowedCountries.includes(country.toUpperCase())
}
