/**
 * CSRF Protection - Node.js Runtime Version
 * Uses Node.js crypto module for better performance
 * Only use in routes with: export const runtime = 'nodejs'
 */

import { randomBytes, createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'crypto'
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
 * Generate a cryptographically secure CSRF token using Node.js crypto
 */
export function generateCSRFToken(): string {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('base64url')
  const timestamp = Date.now()
  const signature = createHmac('sha256', authConfig.csrfSecret)
    .update(`${token}:${timestamp}`)
    .digest('base64url')
  
  const csrfData: CSRFTokenData = { token, signature, timestamp }
  return Buffer.from(JSON.stringify(csrfData)).toString('base64url')
}

/**
 * Verify CSRF token using Node.js crypto
 */
export function verifyCSRFToken(csrfToken: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(csrfToken, 'base64url').toString())
    const { token, signature, timestamp } = decoded as CSRFTokenData

    // Check expiry
    if (Date.now() - timestamp > CSRF_TOKEN_EXPIRY) {
      logger.debug('CSRF token expired')
      return false
    }

    // Verify signature
    const expectedSignature = createHmac('sha256', authConfig.csrfSecret)
      .update(`${token}:${timestamp}`)
      .digest('base64url')

    const signatureBuffer = Buffer.from(signature, 'base64url')
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url')

    if (!nodeTimingSafeEqual(signatureBuffer, expectedBuffer)) {
      logger.debug('CSRF signature mismatch')
      return false
    }

    return true
  } catch (error) {
    logger.error('CSRF verification error', error as Error)
    return false
  }
}

/**
 * Create response with CSRF token cookie
 */
export function createCSRFResponse(): NextResponse {
  const csrfToken = generateCSRFToken()
  
  const response = NextResponse.json({ 
    success: true,
    message: 'CSRF token generated'
  })

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/'
  })

  return response
}

/**
 * Validate CSRF token from request
 */
export function validateCSRFToken(request: NextRequest): { valid: boolean; error?: string } {
  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME)

  if (!csrfCookie) {
    return { valid: false, error: 'CSRF cookie missing' }
  }

  if (!csrfHeader) {
    return { valid: false, error: 'CSRF header missing' }
  }

  if (csrfCookie !== csrfHeader) {
    return { valid: false, error: 'CSRF token mismatch' }
  }

  if (!verifyCSRFToken(csrfCookie)) {
    return { valid: false, error: 'CSRF token invalid or expired' }
  }

  return { valid: true }
}
