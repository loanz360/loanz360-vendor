/**
 * Edge Runtime-compatible token verification
 * Uses Web Crypto API instead of Node.js crypto
 */

import { authConfig } from '@/lib/config/env'
import { jwtVerify } from 'jose'
import { logger } from '@/lib/utils/logger'

export interface SessionData {
  userId: string
  email: string
  role: string
  sessionId: string
  issuedAt: number
  expiresAt: number
}

// Convert base64url string to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  // Replace URL-safe characters
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
  // Decode base64
  const binaryString = atob(paddedBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Convert Uint8Array to base64url string
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  // Convert to URL-safe format
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Verify session token with Web Crypto API (Edge Runtime compatible)
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  try {
    // Decode the token
    const tokenBytes = base64urlToUint8Array(token)
    const tokenString = new TextDecoder().decode(tokenBytes)
    const decoded = JSON.parse(tokenString)

    logger.debug('Token verification', {
      hasSignature: !!decoded.signature,
      tokenType: decoded.tokenType,
      hasEmail: !!decoded.email,
      email: decoded.email
    })

    if (!decoded.signature || decoded.tokenType !== 'session') {
      logger.debug('Token validation failed: missing signature or wrong type')
      return null
    }

    // Verify signature using Web Crypto API HMAC-SHA256
    // Must match the signature created in tokens.ts: createHmac('sha256', secret).update(tokenData).digest('base64url')
    const { signature, ...payload } = decoded

    // Create canonical payload with sorted keys (same as creation in tokens.ts)
    const sortedKeys = Object.keys(payload).sort()
    const canonicalPayload = sortedKeys.reduce((obj: Record<string, unknown>, key: string) => {
      obj[key] = payload[key as keyof typeof payload]
      return obj
    }, {} as Record<string, unknown>)
    const payloadString = JSON.stringify(canonicalPayload)

    // Import HMAC key
    const encoder = new TextEncoder()
    const keyData = encoder.encode(authConfig.jwtSecret)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )

    // Generate expected signature using HMAC
    const messageData = encoder.encode(payloadString)
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = uint8ArrayToBase64url(new Uint8Array(signatureBuffer))

    logger.debug('Signature comparison', {
      providedSig: signature.substring(0, 20) + '...',
      expectedSig: expectedSignature.substring(0, 20) + '...',
      match: signature === expectedSignature
    })

    // Timing-safe comparison
    if (!timingSafeEqual(signature, expectedSignature)) {
      logger.debug('Signature mismatch')
      return null
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (now > payload.expiresAt) {
      logger.debug('Token expired')
      return null
    }

    logger.debug('Token verification successful')

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    }
  } catch {
    return null
  }
}

// Synchronous fallback for simple verification (less secure, but works in Edge)
export function verifySessionTokenSync(token: string): SessionData | null {
  try {
    // Decode the token
    const tokenBytes = base64urlToUint8Array(token)
    const tokenString = new TextDecoder().decode(tokenBytes)
    const decoded = JSON.parse(tokenString)

    if (!decoded.signature || decoded.tokenType !== 'session') {
      return null
    }

    // For sync verification, we just check structure and expiration
    // Signature verification requires async Web Crypto API
    const { signature: _signature, ...payload } = decoded

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (now > payload.expiresAt) {
      return null
    }

    // Return payload (note: signature NOT verified in sync mode)
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    }
  } catch {
    return null
  }
}

// Helper to convert JWT secret string to Uint8Array for jose library
function getSecretKey(secret: string | undefined): Uint8Array {
  if (!secret) {
    throw new Error('JWT secret is not configured')
  }
  return new TextEncoder().encode(secret)
}

// Verify JWT access token (Edge Runtime compatible)
export async function verifyAccessToken(token: string): Promise<SessionData | null> {
  try {
    const secret = getSecretKey(authConfig.jwtSecret)
    const { payload } = await jwtVerify(token, secret)

    if (payload.tokenType !== 'access') {
      return null
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      sessionId: payload.sessionId as string,
      issuedAt: payload.iat as number,
      expiresAt: payload.exp as number
    }
  } catch {
    return null
  }
}
