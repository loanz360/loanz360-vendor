import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { securityLogger } from '@/lib/security-logger'
import { verifySuperAdmin, recordSuperAdminLogin } from '@/lib/auth/super-admin-service'
import { createSessionToken } from '@/lib/auth/tokens'
// Removed import - using inline dynamic import for Edge Runtime compatibility
import { setAuthCookiesInResponse } from '@/lib/auth/secure-cookies'
import { SESSION_CONFIG, getSessionLifetime } from '@/lib/auth/session-config'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { validateAPIRequest, superAdminLoginSchema, validationErrorResponse } from '@/lib/middleware/api-validation'
import { logger } from '@/lib/utils/logger'
import { getClientIP } from '@/lib/utils/request-helpers'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { logAuthActivity } from '@/lib/utils/activity-logger'
import crypto from 'crypto'

/**
 * Force this route to use Node.js runtime
 * This route uses crypto operations from tokens.ts that require Node.js crypto module
 */
export const runtime = 'nodejs'
// Inline CSRF token generation using dynamic import (Edge Runtime safe)
async function generateCSRFToken(): Promise<string> {
  const crypto = await import('crypto')
  const csrfSecret = process.env.CSRF_SECRET!
  const CSRF_TOKEN_LENGTH = 32
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64url')
  const timestamp = Date.now()
  const signature = crypto.createHmac('sha256', csrfSecret).update(`${token}:${timestamp}`).digest('base64url')
  const csrfData = { token, signature, timestamp }
  return Buffer.from(JSON.stringify(csrfData)).toString('base64url')
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let clientIP: string = 'unknown'
  let userAgent: string = 'unknown'

  try {
    // SECURITY: Validate Content-Type header (prevents CSRF, content smuggling, XSS)
    const contentTypeValidation = validateJsonContentType(request)
    if (!contentTypeValidation.valid) {
      return createContentTypeErrorResponse(
        contentTypeValidation.error || 'Invalid Content-Type',
        contentTypeValidation.status
      )
    }

    clientIP = getClientIP(request)
    userAgent = request.headers.get('user-agent') || 'unknown'

    // Check rate limiting
    const rateLimitResult = await checkRateLimit(clientIP, '/api/superadmin/auth')
    if (!rateLimitResult.allowed) {
      const responseHeaders = getRateLimitHeaders(rateLimitResult)

      securityLogger.logSecurityEvent({
        level: rateLimitResult.isLockedOut ? 'critical' : 'warn',
        event: 'RATE_LIMIT_EXCEEDED',
        ip: clientIP,
        userAgent,
        details: {
          isLockedOut: rateLimitResult.isLockedOut,
          lockoutResetTime: rateLimitResult.lockoutResetTime,
          remainingAttempts: rateLimitResult.remainingAttempts
        }
      })

      return NextResponse.json(
        {
          error: rateLimitResult.isLockedOut
            ? 'Account temporarily locked due to too many failed attempts. Please try again later.'
            : 'Too many login attempts. Please try again later.',
          rateLimited: true,
          resetTime: rateLimitResult.resetTime
        },
        {
          status: 429,
          headers: responseHeaders
        }
      )
    }

    // SECURITY: Validate and sanitize input
    const validation = await validateAPIRequest(request, superAdminLoginSchema)

    if (!validation.valid) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth', undefined, userAgent)

      logger.warn('Super admin login validation failed', {
        ip: clientIP,
        errors: validation.errors
      })

      return validationErrorResponse(validation.errors!, validation.statusCode)
    }

    const { email, password } = validation.sanitized!

    // Verify super admin credentials using database
    const verifyResult = await verifySuperAdmin(
      email as string,
      password as string,
      clientIP,
      userAgent
    )

    if (!verifyResult.success) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth', email as string, userAgent)

      securityLogger.logSecurityEvent({
        level: 'warn',
        event: 'INVALID_CREDENTIALS_ATTEMPT',
        ip: clientIP,
        userAgent,
        details: {
          error: verifyResult.error
          // Email and password NOT logged for security
        }
      })

      // Log failed login activity
      await logAuthActivity(
        'failed_login',
        'superadmin',
        'high',
        {
          userEmail: email as string,
          ipAddress: clientIP,
          userAgent,
          description: `Failed Super Admin login attempt for ${email}`,
          requestMethod: 'POST',
          requestPath: '/api/superadmin/auth'
        },
        request
      )

      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: getRateLimitHeaders(await checkRateLimit(clientIP, '/api/superadmin/auth'))
        }
      )
    }

    // Check if 2FA is required
    if (verifyResult.requiresTwoFactor && verifyResult.admin) {
      // Clear rate limit for successful password verification
      await clearFailedAttempts(clientIP, '/api/superadmin/auth')

      securityLogger.logSecurityEvent({
        level: 'info',
        event: 'TWO_FACTOR_REQUIRED',
        ip: clientIP,
        userAgent,
        email: verifyResult.admin.email,
        details: {
          adminId: verifyResult.admin.id
        }
      })

      // Return 2FA required response
      return NextResponse.json({
        success: false,
        requiresTwoFactor: true,
        adminId: verifyResult.admin.id,
        message: 'Two-factor authentication required',
      })
    }

    // Authentication successful (no 2FA or 2FA not enabled)
    const admin = verifyResult.admin!

    // Clear failed attempts on successful authentication
    await clearFailedAttempts(clientIP, '/api/superadmin/auth')

    // H1 FIX: Use cryptographically secure session ID
    const sessionId = `sa_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`
    const sessionLifetime = getSessionLifetime('SUPER_ADMIN')
    const expiresAt = new Date(Date.now() + sessionLifetime * 1000)

    const authToken = await createSessionToken({
      userId: admin.id,
      email: admin.email,
      sessionId,
      role: 'SUPER_ADMIN',
      expiresAt,
    })

    // Record login in database
    const loginResult = await recordSuperAdminLogin(
      admin.id,
      sessionId,
      authToken.tokenHash,
      clientIP,
      userAgent,
      expiresAt
    )

    if (!loginResult.success) {
      securityLogger.logSecurityEvent({
        level: 'error',
        event: 'LOGIN_RECORDING_FAILED',
        ip: clientIP,
        userAgent,
        email: admin.email,
        details: {
          adminId: admin.id
        }
      })

      return NextResponse.json(
        { error: 'Login failed', message: 'Failed to record login' },
        { status: 500 }
      )
    }

    // Generate CSRF token
    const csrfToken = await generateCSRFToken()

    // Log successful authentication
    const duration = Date.now() - startTime
    securityLogger.logSecurityEvent({
      level: 'info',
      event: 'SUCCESSFUL_LOGIN',
      ip: clientIP,
      userAgent,
      email: admin.email,
      duration: `${duration}ms`,
      details: {
        success: true,
        authMethod: 'password',
        role: 'SUPER_ADMIN',
        adminId: admin.id,
        sessionId
        // Token NOT logged for security
      }
    })

    // Log successful login activity
    await logAuthActivity(
      'login',
      'superadmin',
      'low',
      {
        userId: admin.id,
        userFullName: admin.full_name,
        userEmail: admin.email,
        userRole: 'superadmin',
        ipAddress: clientIP,
        userAgent,
        description: `Super Admin ${admin.full_name || admin.email} logged in successfully`,
        requestMethod: 'POST',
        requestPath: '/api/superadmin/auth',
        metadata: {
          sessionId,
          duration_ms: duration
        }
      },
      request
    )

    // Create response with HTTP-Only cookies
    const response = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: 'SUPER_ADMIN'
      }
      // Token NOT sent in response body (in HTTP-Only cookie instead)
    })

    // Set HTTP-Only cookies for session and CSRF with centralized config
    await setAuthCookiesInResponse(response, authToken.token, csrfToken, {
      sessionMaxAge: sessionLifetime,
      csrfMaxAge: SESSION_CONFIG.COOKIE_MAX_AGE.CSRF
    })

    return response

  } catch (error) {
    // Record failed attempt for any server errors
    if (clientIP) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth', undefined, userAgent)
    }

    // Log server error
    securityLogger.logSecurityEvent({
      level: 'error',
      event: 'AUTHENTICATION_SERVER_ERROR',
      ip: clientIP || 'unknown',
      userAgent: userAgent || 'unknown',
      details: {
        error: 'Internal server error',
        stack: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: clientIP ? getRateLimitHeaders(await checkRateLimit(clientIP, '/api/superadmin/auth')) : {}
      }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}