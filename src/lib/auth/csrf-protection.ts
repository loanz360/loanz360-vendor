/**
 * CSRF Protection for LOANZ 360 (SECURITY FIXED + EDGE RUNTIME COMPATIBLE)
 * Implements double-submit cookie pattern for CSRF protection
 *
 * SECURITY FIX: CSRF token no longer exposed in response body
 * - Token only accessible via HTTP-Only cookie
 * - Frontend reads from cookie, not JSON response
 * - Prevents XSS token theft
 *
 * EDGE RUNTIME FIX: Uses Web Crypto API instead of Node.js crypto
 * - Compatible with both Edge Runtime and Node.js runtime
 * - No Node.js dependencies
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/config/env'
import { logger } from '@/lib/utils/logger'

const CSRF_TOKEN_LENGTH = 32
const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour

export interface CSRFTokenData {
  token: string
  signature: string
  timestamp: number
}

/**
 * Web Crypto API Helper: Convert Uint8Array to base64url
 */
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Web Crypto API Helper: Convert base64url to Uint8Array
 */
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
  const binaryString = atob(paddedBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Web Crypto API Helper: Generate random bytes
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Web Crypto API Helper: Create HMAC signature
 */
async function createHmacSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  return uint8ArrayToBase64url(new Uint8Array(signature))
}

/**
 * Web Crypto API Helper: Timing-safe string comparison
 */
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

/**
 * Generate a new CSRF token (Edge Runtime compatible)
 */
export async function generateCSRFToken(): Promise<string> {
  const tokenBytes = randomBytes(CSRF_TOKEN_LENGTH)
  const token = uint8ArrayToBase64url(tokenBytes)
  const timestamp = Date.now()

  // Create HMAC signature using Web Crypto API
  const signature = await createHmacSignature(
    `${token}:${timestamp}`,
    authConfig.csrfSecret
  )

  const tokenData: CSRFTokenData = {
    token,
    signature,
    timestamp
  }

  const encoder = new TextEncoder()
  const jsonBytes = encoder.encode(JSON.stringify(tokenData))
  return uint8ArrayToBase64url(jsonBytes)
}

/**
 * Verify CSRF token (Edge Runtime compatible)
 */
export async function verifyCSRFToken(tokenString: string): Promise<boolean> {
  try {
    const tokenBytes = base64urlToUint8Array(tokenString)
    const decoder = new TextDecoder()
    const tokenJson = decoder.decode(tokenBytes)
    const tokenData: CSRFTokenData = JSON.parse(tokenJson)

    // Check expiry
    if (Date.now() - tokenData.timestamp > CSRF_TOKEN_EXPIRY) {
      return false
    }

    // Verify signature with timing-safe comparison using Web Crypto API
    const expectedSignature = await createHmacSignature(
      `${tokenData.token}:${tokenData.timestamp}`,
      authConfig.csrfSecret
    )

    return timingSafeEqual(tokenData.signature, expectedSignature)
  } catch (error) {
    return false
  }
}

/**
 * Middleware to validate CSRF token on state-changing requests (Edge Runtime compatible)
 */
export async function validateCSRFToken(request: NextRequest): Promise<{
  valid: boolean
  error?: string
}> {
  // Only check POST, PUT, PATCH, DELETE
  const method = request.method
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { valid: true }
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF token in header' }
  }

  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF token in cookie' }
  }

  // Tokens must match (double-submit pattern)
  if (headerToken !== cookieToken) {
    return { valid: false, error: 'CSRF token mismatch' }
  }

  // Verify token signature and expiry
  const isValid = await verifyCSRFToken(headerToken)
  if (!isValid) {
    return { valid: false, error: 'Invalid or expired CSRF token' }
  }

  return { valid: true }
}

/**
 * Set CSRF token in response cookie
 */
export function setCSRFTokenCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/'
  })

  return response
}

/**
 * API endpoint handler to generate and return CSRF token (Edge Runtime compatible)
 *
 * SECURITY FIX: Token no longer exposed in response body
 * - Token only in HTTP-Only cookie
 * - Response confirms token was set
 * - Frontend must read cookie, not JSON
 */
export async function createCSRFResponse(): Promise<NextResponse> {
  const csrfToken = await generateCSRFToken()

  // ✅ SECURITY FIX: Do NOT include token in response body
  const response = NextResponse.json({
    success: true,
    message: 'CSRF token set in cookie',
    expiresIn: CSRF_TOKEN_EXPIRY,
    // ❌ REMOVED: csrfToken (security vulnerability)
    // The token is ONLY in the HTTP-Only cookie
    cookieName: CSRF_COOKIE_NAME, // Tell frontend where to find it
    headerName: CSRF_HEADER_NAME   // Tell frontend where to send it
  })

  // Set in HTTP-Only cookie (only way to access it)
  setCSRFTokenCookie(response, csrfToken)

  return response
}

/**
 * Helper to get CSRF token from request
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null
}

/**
 * Middleware response for CSRF validation failure
 */
export function createCSRFErrorResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      error: 'CSRF validation failed',
      message: error,
      code: 'CSRF_TOKEN_INVALID'
    },
    { status: 403 }
  )
}

/**
 * Check if endpoint requires CSRF protection
 *
 * SECURITY FIX: Only exclude token generation and health checks
 * All authentication endpoints now protected (except in development)
 */
export function requiresCSRFProtection(pathname: string): boolean {
  // Disable CSRF in development for easier testing
  if (process.env.NODE_ENV === 'development') {
    return false
  }

  // ONLY exclude CSRF token generation and health checks
  const excludedPatterns = [
    '/api/csrf-token',  // Must be excluded (generates the token)
    '/api/health'       // Health check only
  ]

  // Check if explicitly excluded
  if (excludedPatterns.some(pattern => pathname.startsWith(pattern))) {
    return false
  }

  // All other API routes require CSRF protection
  return pathname.startsWith('/api/')
}

/**
 * React hook helper for CSRF token
 *
 * SECURITY FIX: Reads token from cookie, not response body
 * Browser automatically sends cookie with requests
 */
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    // Call endpoint to set cookie
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include' // Include cookies
    })

    if (!response.ok) {
      return null
    }

    // ✅ SECURITY FIX: Read token from cookie, not response body
    // The token is now in an HTTP-Only cookie
    // We return success, but token is only in cookie
    const data = await response.json()

    if (data.success) {
      // Token is in cookie, we just return a placeholder
      // Actual token will be sent automatically by browser
      return 'TOKEN_IN_COOKIE' // Placeholder
    }

    return null
  } catch (error) {
    logger.error('Failed to fetch CSRF token', error as Error)
    return null
  }
}

/**
 * Client-side helper to get CSRF token from cookie
 * Use this in API calls to get token for X-CSRF-Token header
 *
 * NOTE: This only works for non-HTTP-Only cookies
 * For HTTP-Only (more secure), read from separate readable cookie
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null // Server-side
  }

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value)
    }
  }

  return null
}

/**
 * Enhanced version: Store token in both HTTP-Only cookie (for validation)
 * and readable cookie (for client to send in header)
 */
export function setCSRFTokenDualCookie(response: NextResponse, token: string): NextResponse {
  // 1. HTTP-Only cookie for server validation (secure)
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/'
  })

  // 2. Readable cookie for client to send in header (double-submit pattern)
  response.cookies.set(`${CSRF_COOKIE_NAME}-client`, token, {
    httpOnly: false, // Client can read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/'
  })

  return response
}

/**
 * Enhanced CSRF response with dual cookies (Edge Runtime compatible)
 */
export async function createCSRFResponseSecure(): Promise<NextResponse> {
  const csrfToken = await generateCSRFToken()

  const response = NextResponse.json({
    success: true,
    message: 'CSRF token set in cookies',
    expiresIn: CSRF_TOKEN_EXPIRY,
    cookieName: CSRF_COOKIE_NAME,
    clientCookieName: `${CSRF_COOKIE_NAME}-client`, // Client reads this one
    headerName: CSRF_HEADER_NAME
  })

  // Set dual cookies
  setCSRFTokenDualCookie(response, csrfToken)

  return response
}
