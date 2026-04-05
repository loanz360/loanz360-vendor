/**
 * Request Signing Service
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Cryptographic request signing for API integrity
 *
 * Features:
 * - HMAC-SHA256 request signing
 * - Timestamp-based replay protection
 * - Request body integrity verification
 * - API key authentication
 * - Signature caching for performance
 */

import crypto from 'crypto'
import { NextRequest } from 'next/server'

// Signature configuration
const SIGNATURE_HEADER = 'x-signature'
const TIMESTAMP_HEADER = 'x-timestamp'
const NONCE_HEADER = 'x-nonce'
const API_KEY_HEADER = 'x-api-key'
const SIGNATURE_ALGORITHM = 'sha256'
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000 // 5 minutes
const NONCE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

// Used nonces for replay protection
const usedNonces: Map<string, number> = new Map()

// API keys (in production, load from database/vault)
const apiKeys: Map<string, { secret: string; name: string; permissions: string[] }> = new Map()

/**
 * Initialize API keys
 */
export function initializeAPIKeys(): void {
  // Load from environment or database
  const internalKey = process.env.INTERNAL_API_KEY
  const internalSecret = process.env.INTERNAL_API_SECRET

  if (internalKey && internalSecret) {
    apiKeys.set(internalKey, {
      secret: internalSecret,
      name: 'Internal Service',
      permissions: ['*'],
    })
  }
}

/**
 * Generate signing key from secret
 */
function deriveSigningKey(secret: string, timestamp: string): Buffer {
  const dateKey = crypto.createHmac('sha256', secret)
    .update(timestamp.substring(0, 8))
    .digest()

  return crypto.createHmac('sha256', dateKey)
    .update('loanz360_request_signing')
    .digest()
}

/**
 * Create canonical request string
 */
function createCanonicalRequest(
  method: string,
  path: string,
  query: string,
  headers: Record<string, string>,
  bodyHash: string
): string {
  // Canonical headers (sorted, lowercase)
  const canonicalHeaders = Object.entries(headers)
    .filter(([key]) => key.startsWith('x-'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
    .join('\n')

  const signedHeaders = Object.keys(headers)
    .filter(key => key.startsWith('x-'))
    .sort()
    .map(key => key.toLowerCase())
    .join(';')

  return [
    method.toUpperCase(),
    path,
    query,
    canonicalHeaders,
    '',
    signedHeaders,
    bodyHash,
  ].join('\n')
}

/**
 * Create string to sign
 */
function createStringToSign(
  timestamp: string,
  canonicalRequestHash: string
): string {
  return [
    'LOANZ360-HMAC-SHA256',
    timestamp,
    canonicalRequestHash,
  ].join('\n')
}

/**
 * Sign a request
 */
export function signRequest(
  method: string,
  path: string,
  query: string,
  headers: Record<string, string>,
  body: string | Buffer,
  secret: string
): {
  signature: string
  timestamp: string
  nonce: string
  signedHeaders: string[]
} {
  const timestamp = new Date().toISOString()
  const nonce = crypto.randomBytes(16).toString('hex')

  // Add required headers
  headers[TIMESTAMP_HEADER] = timestamp
  headers[NONCE_HEADER] = nonce

  // Hash the body
  const bodyHash = crypto
    .createHash(SIGNATURE_ALGORITHM)
    .update(typeof body === 'string' ? body : body.toString())
    .digest('hex')

  // Create canonical request
  const canonicalRequest = createCanonicalRequest(
    method,
    path,
    query,
    headers,
    bodyHash
  )

  // Hash canonical request
  const canonicalRequestHash = crypto
    .createHash(SIGNATURE_ALGORITHM)
    .update(canonicalRequest)
    .digest('hex')

  // Create string to sign
  const stringToSign = createStringToSign(timestamp, canonicalRequestHash)

  // Derive signing key
  const signingKey = deriveSigningKey(secret, timestamp)

  // Create signature
  const signature = crypto
    .createHmac(SIGNATURE_ALGORITHM, signingKey)
    .update(stringToSign)
    .digest('hex')

  const signedHeaders = Object.keys(headers)
    .filter(key => key.startsWith('x-'))
    .sort()
    .map(key => key.toLowerCase())

  return {
    signature,
    timestamp,
    nonce,
    signedHeaders,
  }
}

/**
 * Verify request signature
 */
export async function verifyRequestSignature(
  request: NextRequest
): Promise<{
  valid: boolean
  error?: string
  apiKeyName?: string
  permissions?: string[]
}> {
  try {
    // Extract headers
    const signature = request.headers.get(SIGNATURE_HEADER)
    const timestamp = request.headers.get(TIMESTAMP_HEADER)
    const nonce = request.headers.get(NONCE_HEADER)
    const apiKey = request.headers.get(API_KEY_HEADER)

    // Check required headers
    if (!signature || !timestamp || !nonce || !apiKey) {
      return { valid: false, error: 'Missing required signature headers' }
    }

    // Validate API key
    const keyConfig = apiKeys.get(apiKey)
    if (!keyConfig) {
      return { valid: false, error: 'Invalid API key' }
    }

    // Validate timestamp (prevent replay attacks)
    const requestTime = new Date(timestamp).getTime()
    const now = Date.now()

    if (Math.abs(now - requestTime) > MAX_TIMESTAMP_DRIFT_MS) {
      return { valid: false, error: 'Request timestamp too old or in future' }
    }

    // Check nonce (prevent replay attacks)
    const nonceKey = `${apiKey}:${nonce}`
    if (usedNonces.has(nonceKey)) {
      return { valid: false, error: 'Nonce already used (replay attack detected)' }
    }

    // Store nonce
    usedNonces.set(nonceKey, now)

    // Clean old nonces
    cleanupNonces()

    // Get request body
    let body = ''
    try {
      body = await request.clone().text()
    } catch {
      body = ''
    }

    // Collect headers for verification
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (key.startsWith('x-')) {
        headers[key] = value
      }
    })

    // Recalculate signature
    const { signature: expectedSignature } = signRequest(
      request.method,
      request.nextUrl.pathname,
      request.nextUrl.search.substring(1),
      { ...headers },
      body,
      keyConfig.secret
    )

    // Timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: 'Invalid signature' }
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, error: 'Signature verification failed' }
    }

    return {
      valid: true,
      apiKeyName: keyConfig.name,
      permissions: keyConfig.permissions,
    }
  } catch (error) {
    console.error('[RequestSigning] Verification error:', error)
    return { valid: false, error: 'Signature verification error' }
  }
}

/**
 * Clean up old nonces
 */
function cleanupNonces(): void {
  const now = Date.now()

  for (const [key, timestamp] of usedNonces) {
    if (now - timestamp > NONCE_EXPIRY_MS) {
      usedNonces.delete(key)
    }
  }
}

/**
 * Generate API key pair
 */
export function generateAPIKeyPair(): { apiKey: string; apiSecret: string } {
  const apiKey = `lz_${crypto.randomBytes(16).toString('hex')}`
  const apiSecret = crypto.randomBytes(32).toString('base64')

  return { apiKey, apiSecret }
}

/**
 * Register new API key
 */
export function registerAPIKey(
  apiKey: string,
  secret: string,
  name: string,
  permissions: string[] = []
): void {
  apiKeys.set(apiKey, { secret, name, permissions })
}

/**
 * Revoke API key
 */
export function revokeAPIKey(apiKey: string): boolean {
  return apiKeys.delete(apiKey)
}

/**
 * Middleware for signed requests
 */
export async function signedRequestMiddleware(
  request: NextRequest,
  requiredPermission?: string
): Promise<{ authorized: boolean; error?: string }> {
  const result = await verifyRequestSignature(request)

  if (!result.valid) {
    return { authorized: false, error: result.error }
  }

  // Check permission if required
  if (requiredPermission && result.permissions) {
    const hasPermission =
      result.permissions.includes('*') ||
      result.permissions.includes(requiredPermission)

    if (!hasPermission) {
      return { authorized: false, error: 'Insufficient permissions' }
    }
  }

  return { authorized: true }
}

/**
 * Webhook signature verification
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp?: string
): boolean {
  try {
    // If timestamp provided, check freshness
    if (timestamp) {
      const requestTime = parseInt(timestamp)
      const now = Math.floor(Date.now() / 1000)

      if (Math.abs(now - requestTime) > 300) {
        // 5 minutes
        return false
      }
    }

    // Calculate expected signature
    const signedPayload = timestamp ? `${timestamp}.${payload}` : payload
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Generate webhook signature
 */
export function generateWebhookSignature(
  payload: string,
  secret: string
): { signature: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signedPayload = `${timestamp}.${payload}`

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  return { signature, timestamp }
}

// Initialize on load
initializeAPIKeys()
