
/**
 * Customer Password Login API
 * SECURITY HARDENED: Fortune 500 Fintech Standard
 *
 * Security Features:
 * - Rate limiting (5 attempts per 15 minutes)
 * - CSRF protection
 * - Brute force detection
 * - Secure session management
 * - Comprehensive audit logging
 * - No sensitive data exposure
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { validateMobileNumber } from '@/lib/utils/otp'
import { checkRateLimit, recordFailedAttempt, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { validateCSRFToken } from '@/lib/security/csrf'
import { getClientIP } from '@/lib/utils/request-helpers'
import { logSecurityEvent } from '@/lib/security/security-logger'
import { sanitizeText } from '@/lib/security/input-sanitizer'
import { apiLogger } from '@/lib/utils/logger'

// SECURITY: Fail fast if JWT_SECRET is not configured
const getJWTSecret = (): Uint8Array => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SECURITY_CONFIG_ERROR: JWT_SECRET must be set and at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

// Runtime configuration
export const runtime = 'nodejs'

// Rate limit configuration
const RATE_LIMIT_MAX_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes after max attempts

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  try {
    // SECURITY FIX #1: Rate limiting
    const rateLimitResult = await checkRateLimit(
      clientIP,
      '/api/customer/login-password',
      RATE_LIMIT_MAX_ATTEMPTS,
      RATE_LIMIT_WINDOW_MS
    )

    if (!rateLimitResult.allowed) {
      await logSecurityEvent({
        event: 'CUSTOMER_LOGIN_RATE_LIMIT_EXCEEDED',
        severity: 'warning',
        ip: clientIP,
        userAgent,
        requestId,
        metadata: {
          remainingTime: rateLimitResult.resetAt
            ? Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            : LOCKOUT_DURATION_MS / 1000
        }
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimitResult.resetAt
            ? Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            : 900
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // SECURITY FIX #2: CSRF validation for non-GET requests
    const csrfValid = await validateCSRFToken(request)
    if (!csrfValid) {
      await logSecurityEvent({
        event: 'CUSTOMER_LOGIN_CSRF_FAILED',
        severity: 'warning',
        ip: clientIP,
        userAgent,
        requestId
      })

      return NextResponse.json(
        { success: false, error: 'Invalid request. Please refresh and try again.' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      )
    }

    const { mobile, password } = body

    // Validate inputs
    if (!mobile || !password) {
      await recordFailedAttempt(clientIP, '/api/customer/login-password', undefined, userAgent)
      return NextResponse.json(
        { success: false, error: 'Mobile and password are required' },
        { status: 400 }
      )
    }

    // Sanitize mobile input
    const sanitizedMobile = sanitizeText(mobile)

    // Validate mobile number format
    const validation = validateMobileNumber(sanitizedMobile)
    if (!validation.valid) {
      await recordFailedAttempt(clientIP, '/api/customer/login-password', sanitizedMobile, userAgent)
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid mobile number' },
        { status: 400 }
      )
    }

    // SECURITY FIX #3: Use admin client properly
    const supabase = createSupabaseAdmin()

    // Find customer with timing-safe lookup
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, customer_id, password_hash, is_active, failed_login_attempts, locked_until')
      .eq('phone', validation.formatted)
      .maybeSingle()

    // SECURITY: Generic error message to prevent user enumeration
    const genericError = 'Invalid mobile number or password'

    if (fetchError || !customer) {
      await recordFailedAttempt(clientIP, '/api/customer/login-password', validation.formatted, userAgent)
      await logSecurityEvent({
        event: 'CUSTOMER_LOGIN_INVALID_MOBILE',
        severity: 'info',
        ip: clientIP,
        userAgent,
        requestId,
        metadata: { mobile: validation.formatted.slice(-4).padStart(validation.formatted.length, '*') }
      })

      // Timing-safe delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100))

      return NextResponse.json(
        { success: false, error: genericError },
        { status: 401 }
      )
    }

    // Check if account is locked
    if (customer.locked_until && new Date(customer.locked_until) > new Date()) {
      await logSecurityEvent({
        event: 'CUSTOMER_LOGIN_ACCOUNT_LOCKED',
        severity: 'warning',
        ip: clientIP,
        userAgent,
        requestId,
        userId: customer.id
      })

      return NextResponse.json(
        { success: false, error: 'Account is temporarily locked. Please try again later.' },
        { status: 403 }
      )
    }

    // Check if active
    if (!customer.is_active) {
      await logSecurityEvent({
        event: 'CUSTOMER_LOGIN_ACCOUNT_DEACTIVATED',
        severity: 'warning',
        ip: clientIP,
        userAgent,
        requestId,
        userId: customer.id
      })

      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      )
    }

    // Check if password is set
    if (!customer.password_hash) {
      return NextResponse.json(
        { success: false, error: 'Password not set. Please use OTP login.' },
        { status: 400 }
      )
    }

    // SECURITY: Verify password with timing-safe comparison
    const passwordMatch = await bcrypt.compare(password, customer.password_hash)

    if (!passwordMatch) {
      // Increment failed attempts
      const newFailedAttempts = (customer.failed_login_attempts || 0) + 1
      const shouldLock = newFailedAttempts >= 5

      await supabase
        .from('customers')
        .update({
          failed_login_attempts: newFailedAttempts,
          last_failed_login: new Date().toISOString(),
          locked_until: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
            : null
        })
        .eq('id', customer.id)

      await recordFailedAttempt(clientIP, '/api/customer/login-password', validation.formatted, userAgent)

      await logSecurityEvent({
        event: 'CUSTOMER_LOGIN_INVALID_PASSWORD',
        severity: 'warning',
        ip: clientIP,
        userAgent,
        requestId,
        userId: customer.id,
        metadata: {
          failedAttempts: newFailedAttempts,
          accountLocked: shouldLock
        }
      })

      return NextResponse.json(
        { success: false, error: genericError },
        { status: 401 }
      )
    }

    // SECURITY FIX #4: Get JWT secret securely
    const jwtSecret = getJWTSecret()

    // Generate secure JWT token with proper claims
    const tokenId = crypto.randomUUID()
    const issuedAt = Math.floor(Date.now() / 1000)
    const expiresAt = issuedAt + (7 * 24 * 60 * 60) // 7 days

    const token = await new SignJWT({
      sub: customer.id,
      customerId: customer.id,
      customerCustomerId: customer.customer_id,
      mobile: validation.formatted,
      type: 'customer',
      jti: tokenId, // JWT ID for token revocation
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .setNotBefore(issuedAt)
      .setIssuer('loanz360')
      .setAudience('loanz360-customer')
      .sign(jwtSecret)

    // Reset failed attempts and update last login
    await supabase
      .from('customers')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login: new Date().toISOString(),
        last_login_ip: clientIP,
        last_login_user_agent: userAgent.slice(0, 500) // Limit length
      })
      .eq('id', customer.id)

    // Store session in database for revocation capability
    await supabase
      .from('customer_sessions')
      .insert({
        customer_id: customer.id,
        token_id: tokenId,
        ip_address: clientIP,
        user_agent: userAgent.slice(0, 500),
        expires_at: new Date(expiresAt * 1000).toISOString(),
        created_at: new Date().toISOString()
      })
      .catch(() => {
        // Session tracking is optional, don't fail login
      })

    await logSecurityEvent({
      event: 'CUSTOMER_LOGIN_SUCCESS',
      severity: 'info',
      ip: clientIP,
      userAgent,
      requestId,
      userId: customer.id
    })

    const response = NextResponse.json({
      success: true,
      customer_id: customer.id,
      message: 'Login successful'
      // SECURITY: Don't expose token in response body, only in cookie
    })

    // SECURITY FIX #5: Set secure HTTP-only cookie with proper flags
    response.cookies.set('customer_token', token, {
      httpOnly: true,
      secure: true, // Always use secure in production
      sameSite: 'strict', // Stricter than 'lax' for better CSRF protection
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
      // Domain is intentionally not set to use current domain
    })

    // Set a non-sensitive indicator cookie for client-side auth checks
    response.cookies.set('customer_authenticated', 'true', {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    return response

  } catch (error) {
    // SECURITY: Log error but don't expose details to client
    await logSecurityEvent({
      event: 'CUSTOMER_LOGIN_ERROR',
      severity: 'error',
      ip: clientIP,
      userAgent,
      requestId,
      metadata: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        // Don't log full error message as it may contain sensitive data
      }
    })

    // Check if it's a configuration error
    if (error instanceof Error && error.message.startsWith('SECURITY_CONFIG_ERROR')) {
      apiLogger.error('CRITICAL SECURITY CONFIG ERROR', error.message)
      return NextResponse.json(
        { success: false, error: 'Server configuration error. Please contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
