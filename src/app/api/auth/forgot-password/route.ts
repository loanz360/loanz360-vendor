import { parseBody } from '@/lib/utils/parse-body'

/**
 * Forgot Password API
 * Sends password reset email to user
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, recordFailedAttempt, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { getClientIP } from '@/lib/utils/request-helpers'
import { API_ERRORS, createErrorResponse } from '@/lib/utils/api-errors'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  // SECURITY: Validate Content-Type header (prevents CSRF, content smuggling, XSS)
  const contentTypeValidation = validateJsonContentType(request)
  if (!contentTypeValidation.valid) {
    return createContentTypeErrorResponse(
      contentTypeValidation.error || 'Invalid Content-Type',
      contentTypeValidation.status
    )
  }

  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'

  try {
    // Rate limiting - stricter for password reset to prevent email bombing
    const rateLimitResult = await checkRateLimit(clientIP, '/api/auth/forgot-password')

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('PASSWORD_RESET_RATE_LIMIT_EXCEEDED', {
        ip: clientIP,
        userAgent,
      })

      return NextResponse.json(
        {
          error: API_ERRORS.RATE_LIMIT_EXCEEDED,
          rateLimited: true,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      await recordFailedAttempt(clientIP, '/api/auth/forgot-password', undefined, userAgent)

      // SECURITY FIX HIGH-02: Generic error message
      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_EMAIL_INVALID, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { email } = validation.data

    const supabaseAdmin = createSupabaseAdmin()

    // Check if this is a super admin first
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (superAdmin) {
      // Super admins cannot use this endpoint - they should use /api/superadmin/auth/forgot-password
      await logAuthEvent.info('PASSWORD_RESET_REQUEST_SUPER_ADMIN_REDIRECT', {
        email,
        ip: clientIP,
      })

      // Return success to prevent user enumeration, but don't actually send email
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    }

    // Check if user exists in profiles table (without revealing this information to the client)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (!profile) {
      // Log but don't reveal to client
      await logAuthEvent.info('PASSWORD_RESET_REQUEST_UNKNOWN_EMAIL', {
        email,
        ip: clientIP,
      })

      // Return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    }

    // Send password reset email via Supabase
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`

    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error) {
      logger.error('Failed to send password reset email', error as Error, {
        email,
        ip: clientIP
      })

      await logAuthEvent.error('PASSWORD_RESET_EMAIL_FAILED', {
        email,
        ip: clientIP,
        error: 'Internal server error',
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.SERVICE_UNAVAILABLE, error, { ip: clientIP }),
        { status: 500 }
      )
    }

    await logAuthEvent.info('PASSWORD_RESET_EMAIL_SENT', {
      email,
      ip: clientIP,
      userAgent,
    })

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    logger.error('Forgot password error', error as Error, { ip: clientIP })

    await logAuthEvent.error('PASSWORD_RESET_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
