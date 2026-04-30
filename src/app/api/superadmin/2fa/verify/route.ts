import { parseBody } from '@/lib/utils/parse-body'
/**
 * Super Admin 2FA Verification API
 * Verifies 2FA code during login
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyTwoFactorCode } from '@/lib/auth/two-factor-auth'
import { recordSuperAdminLogin } from '@/lib/auth/super-admin-service'
import { createSessionToken } from '@/lib/auth/tokens'
import { setAuthCookiesInResponse } from '@/lib/auth/secure-cookies'
// Removed import - using inline dynamic import for Edge Runtime compatibility
import { SESSION_CONFIG, getSessionLifetime } from '@/lib/auth/session-config'
import { z } from 'zod'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { logger } from '@/lib/utils/logger'
import { getClientIP } from '@/lib/utils/request-helpers'
import { API_ERRORS, createErrorResponse } from '@/lib/utils/api-errors'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Force this route to use Node.js runtime
 * This route uses crypto operations from tokens.ts and two-factor-auth.ts that require Node.js crypto module
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

const verifyTwoFactorSchema = z.object({
  adminId: z.string().uuid('Invalid admin ID'),
  code: z.string().min(1, 'Verification code is required'),
})

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  // SECURITY: Validate Content-Type header (prevents CSRF, content smuggling, XSS)
  const contentTypeValidation = validateJsonContentType(request)
  if (!contentTypeValidation.valid) {
    return createContentTypeErrorResponse(
      contentTypeValidation.error || 'Invalid Content-Type',
      contentTypeValidation.status
    )
  }

  try {
    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validation = verifyTwoFactorSchema.safeParse(body)

    if (!validation.success) {
      // SECURITY FIX HIGH-02: Generic error message
      const clientIP = getClientIP(request)
      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_FAILED, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { adminId, code } = validation.data

    // Verify 2FA code
    const verification = await verifyTwoFactorCode(adminId, code)

    if (!verification.valid) {
      // SECURITY FIX HIGH-02: Generic error - don't reveal why verification failed
      const clientIP = getClientIP(request)
      return NextResponse.json(
        createErrorResponse(API_ERRORS.AUTH_UNAUTHORIZED, verification.error, { adminId, ip: clientIP }),
        { status: 401 }
      )
    }

    // Get request metadata
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create session token with role-based lifetime
    const sessionId = `sa_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    const sessionLifetime = getSessionLifetime('SUPER_ADMIN')
    const expiresAt = new Date(Date.now() + sessionLifetime * 1000)

    const authToken = await createSessionToken({
      userId: adminId,
      sessionId,
      role: 'SUPER_ADMIN',
      expiresAt,
    })

    // Record login in database
    const loginResult = await recordSuperAdminLogin(
      adminId,
      sessionId,
      authToken.tokenHash,
      ipAddress,
      userAgent,
      expiresAt
    )

    if (!loginResult.success) {
      return NextResponse.json(
        createErrorResponse(API_ERRORS.DATABASE_ERROR, 'Failed to record login', { adminId }),
        { status: 500 }
      )
    }

    // Generate CSRF token
    const csrfToken = await generateCSRFToken()

    // Create response
    const response = NextResponse.json({
      success: true,
      message: '2FA verification successful',
      user: {
        id: adminId,
        role: 'SUPER_ADMIN',
      },
      usedBackupCode: verification.usedBackupCode,
    })

    // Set HTTP-Only cookies with centralized config
    await setAuthCookiesInResponse(response, authToken.token, csrfToken, {
      sessionMaxAge: sessionLifetime,
      csrfMaxAge: SESSION_CONFIG.COOKIE_MAX_AGE.CSRF,
    })

    return response
  } catch (error) {
    logger.error('2FA verification error:', error as Error)
    const clientIP = getClientIP(request)
    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
