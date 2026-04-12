/**
 * CORS and Origin Validation for LOANZ 360
 * Prevents cross-origin attacks and validates request origins
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { getClientIP } from '@/lib/utils/request-helpers'

// Allowed origins for production
const PRODUCTION_ORIGINS = [
  'https://loanz360.com',
  'https://www.loanz360.com',
  'https://app.loanz360.com',
  'https://admin.loanz360.com',
]

// Development origins
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3010',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:3004',
  'http://127.0.0.1:3010',
]

/**
 * Get allowed origins based on environment
 */
export function getAllowedOrigins(): string[] {
  if (process.env.NODE_ENV === 'production') {
    // Add any custom origins from environment
    const customOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []
    return [...PRODUCTION_ORIGINS, ...customOrigins]
  }

  return DEVELOPMENT_ORIGINS
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    // Allow requests without origin (same-origin or non-browser clients)
    // But be cautious - this should be restricted for sensitive endpoints
    return false
  }

  const allowedOrigins = getAllowedOrigins()
  return allowedOrigins.includes(origin)
}

/**
 * Validate request origin
 */
export function validateOrigin(request: NextRequest): {
  valid: boolean
  origin: string | null
  error?: string
} {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // For API requests, origin header should be present
  if (!origin) {
    // Check referer as fallback
    if (referer) {
      try {
        const refererUrl = new URL(referer)
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`

        if (isOriginAllowed(refererOrigin)) {
          return { valid: true, origin: refererOrigin }
        }
      } catch {
        return { valid: false, origin: null, error: 'Invalid referer URL' }
      }
    }

    // For same-origin requests, origin might be null
    // Allow but log for monitoring
    return {
      valid: true,
      origin: null,
      error: 'No origin header (same-origin or server-to-server)'
    }
  }

  if (!isOriginAllowed(origin)) {
    return {
      valid: false,
      origin,
      error: `Origin ${origin} not allowed`
    }
  }

  return { valid: true, origin }
}

/**
 * Set CORS headers in response
 */
export function setCORSHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  const allowedOrigins = getAllowedOrigins()

  // Set Access-Control-Allow-Origin
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow all origins (less restrictive)
    response.headers.set('Access-Control-Allow-Origin', origin || '*')
  }

  // Set other CORS headers
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours

  return response
}

/**
 * Create CORS preflight response
 */
export function createCORSPreflightResponse(origin: string | null): NextResponse {
  const response = NextResponse.json({ success: true }, { status: 204 })
  return setCORSHeaders(response, origin)
}

/**
 * Create origin validation error response
 */
export function createOriginErrorResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Origin validation failed',
      message: error,
      code: 'INVALID_ORIGIN'
    },
    { status: 403 }
  )
}

/**
 * Security headers to add to all responses
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Enable XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // NOTE: CSP is set by middleware via csp-nonce.ts (nonce-based). Do not set it here.

  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  return response
}

/**
 * Check if endpoint requires origin validation
 */
export function requiresOriginValidation(pathname: string): boolean {
  // Endpoints that require strict origin validation
  const strictPatterns = [
    '/api/auth',
    '/api/superadmin/auth',
    '/api/admin/auth',
    '/api/partner/auth',
    '/api/customer/auth',
    '/api/employee/auth',
  ]

  return strictPatterns.some(pattern => pathname.startsWith(pattern))
}

/**
 * Middleware helper for origin validation
 */
export async function validateRequestOrigin(
  request: NextRequest,
  requireStrict = false
): Promise<{ allowed: boolean; response?: NextResponse }> {
  // Disable origin validation in development for easier testing
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true }
  }

  // Handle OPTIONS (preflight) requests
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')
    return {
      allowed: true,
      response: createCORSPreflightResponse(origin)
    }
  }

  // Validate origin for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || requireStrict) {
    const validation = validateOrigin(request)

    if (!validation.valid && requireStrict) {
      return {
        allowed: false,
        response: createOriginErrorResponse(validation.error || 'Invalid origin')
      }
    }
  }

  return { allowed: true }
}

/**
 * Get request origin (normalized)
 */
export function getRequestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin')
  if (origin) return origin

  // Fallback to referer
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const url = new URL(referer)
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }

  return null
}

/**
 * Check if request is from same origin
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = getRequestOrigin(request)
  if (!origin) return true // No origin header means same-origin

  const requestUrl = new URL(request.url)
  const requestOrigin = `${requestUrl.protocol}//${requestUrl.host}`

  return origin === requestOrigin
}

/**
 * Log origin validation events
 */
export function logOriginValidation(
  request: NextRequest,
  validation: { valid: boolean; origin: string | null; error?: string }
): void {
  if (!validation.valid) {
    logger.warn('[CORS] Origin validation failed', {
      origin: validation.origin,
      error: validation.error,
      path: request.nextUrl.pathname,
      method: request.method,
      ip: getClientIP(request),
    })
  }
}

/**
 * Configuration for CORS and origin validation
 */
export const CORS_CONFIG = {
  allowCredentials: true,
  maxAge: 86400, // 24 hours
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
} as const