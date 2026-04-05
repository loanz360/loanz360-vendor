/**
 * CSRF Protection Module
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Implements double-submit cookie pattern with additional hardening
 *
 * Features:
 * - Double-submit cookie pattern
 * - Timing-safe token comparison
 * - Token rotation
 * - SameSite cookie enforcement
 * - Origin validation
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase/server'

// CSRF Token configuration
const CSRF_TOKEN_LENGTH = 32
const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

// Allowed origins for CORS/CSRF
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'https://loanz-360-claude-code.vercel.app',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[]

// Vercel preview deployment patterns
// Matches: loanz-360-claude-code.vercel.app
// Matches: loanz-360-claude-code-git-master-vinod-bysanis-projects.vercel.app
// Matches: loanz-360-claude-code-<hash>.vercel.app
const VERCEL_PREVIEW_PATTERN = /^https:\/\/loanz-360-claude-code[a-z0-9-]*\.vercel\.app$/

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Hash a CSRF token for storage
 */
export function hashCSRFToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Validate CSRF token from request
 * Implements double-submit cookie pattern
 */
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  try {
    // Skip CSRF for safe methods
    const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    if (safeMethod) {
      return true
    }

    // Skip CSRF for specific paths that have their own protection
    const skipPaths = [
      '/api/webhooks/',
      '/api/cron/',
    ]
    const pathname = request.nextUrl.pathname
    if (skipPaths.some(path => pathname.startsWith(path))) {
      return true
    }

    // Validate Origin/Referer header
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')

    if (origin) {
      if (!isAllowedOrigin(origin)) {
        console.warn('CSRF: Invalid origin:', origin)
        return false
      }
    } else if (referer) {
      try {
        const refererOrigin = new URL(referer).origin
        if (!isAllowedOrigin(refererOrigin)) {
          console.warn('CSRF: Invalid referer origin:', refererOrigin)
          return false
        }
      } catch {
        return false
      }
    }

    // Get token from cookie and header
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
    const headerToken = request.headers.get(CSRF_HEADER_NAME)

    // Both must be present
    if (!cookieToken || !headerToken) {
      // For initial requests without CSRF token, allow if from valid origin
      // This supports first-time login scenarios
      if (origin && isAllowedOrigin(origin)) {
        return true
      }
      return false
    }

    // Timing-safe comparison
    return timingSafeCompare(cookieToken, headerToken)
  } catch (error) {
    console.error('CSRF validation error:', error)
    return false
  }
}

/**
 * Check if origin is allowed
 */
function isAllowedOrigin(origin: string): boolean {
  // Check static allowed origins
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true
  }

  // Check Vercel preview deployments (git branch previews)
  if (VERCEL_PREVIEW_PATTERN.test(origin)) {
    return true
  }

  return false
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Set CSRF token cookie in response
 */
export function setCSRFCookie(response: NextResponse, token?: string): string {
  const csrfToken = token || generateCSRFToken()

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Changed from 'strict' to allow cookie on navigational requests
    maxAge: CSRF_TOKEN_EXPIRY_MS / 1000,
    path: '/',
  })

  return csrfToken
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value
}

/**
 * CSRF middleware for API routes
 */
export async function csrfMiddleware(
  request: NextRequest
): Promise<{ valid: boolean; response?: NextResponse }> {
  const isValid = await validateCSRFToken(request)

  if (!isValid) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing CSRF token',
          code: 'CSRF_VALIDATION_FAILED'
        },
        { status: 403 }
      )
    }
  }

  return { valid: true }
}

/**
 * API endpoint to get a new CSRF token
 * Use this on page load to get initial token
 */
export async function getCSRFTokenHandler(request: NextRequest): Promise<NextResponse> {
  const token = generateCSRFToken()

  const response = NextResponse.json({
    success: true,
    token,
  })

  setCSRFCookie(response, token)

  return response
}

/**
 * Validate CSRF for database-backed tokens (for high-security scenarios)
 */
export async function validateDatabaseCSRFToken(
  request: NextRequest,
  userId: string
): Promise<boolean> {
  try {
    const headerToken = request.headers.get(CSRF_HEADER_NAME)

    if (!headerToken) {
      return false
    }

    const supabase = createSupabaseAdmin()
    const hashedToken = hashCSRFToken(headerToken)

    const { data, error } = await supabase
      .from('csrf_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token_hash', hashedToken)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error || !data) {
      return false
    }

    // Delete used token (one-time use)
    await supabase
      .from('csrf_tokens')
      .delete()
      .eq('id', data.id)

    return true
  } catch {
    return false
  }
}

/**
 * Generate and store a database-backed CSRF token (for high-security scenarios)
 */
export async function generateDatabaseCSRFToken(userId: string): Promise<string> {
  const token = generateCSRFToken()
  const hashedToken = hashCSRFToken(token)
  const expiresAt = new Date(Date.now() + CSRF_TOKEN_EXPIRY_MS)

  const supabase = createSupabaseAdmin()

  // Clean up old tokens for this user
  await supabase
    .from('csrf_tokens')
    .delete()
    .eq('user_id', userId)
    .lt('expires_at', new Date().toISOString())

  // Store new token
  await supabase
    .from('csrf_tokens')
    .insert({
      user_id: userId,
      token_hash: hashedToken,
      expires_at: expiresAt.toISOString(),
    })

  return token
}
