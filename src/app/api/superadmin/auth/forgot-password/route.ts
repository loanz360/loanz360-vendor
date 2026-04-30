import { parseBody } from '@/lib/utils/parse-body'

/**
 * Super Admin Forgot Password API
 * Handles password reset for super admins (separate from regular users)
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
import crypto from 'crypto'
import { sendEmail, isEmailConfigured } from '@/lib/email/resend-client'
import { generateSuperAdminPasswordResetEmail } from '@/lib/email/templates/super-admin-password-reset'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// API Route Runtime: Node.js (uses crypto/bcrypt)
export const runtime = 'nodejs'

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
    const rateLimitResult = await checkRateLimit(clientIP, '/api/superadmin/auth/forgot-password')

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('SUPER_ADMIN_PASSWORD_RESET_RATE_LIMIT_EXCEEDED', {
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
      await recordFailedAttempt(clientIP, '/api/superadmin/auth/forgot-password', undefined, userAgent)

      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_EMAIL_INVALID, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { email } = validation.data

    const supabaseAdmin = createSupabaseAdmin()

    // Check if super admin exists (without revealing this information to the client)
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, is_active, is_locked')
      .eq('email', email)
      .maybeSingle()

    if (!superAdmin) {
      // Log but don't reveal to client
      await logAuthEvent.info('SUPER_ADMIN_PASSWORD_RESET_REQUEST_UNKNOWN_EMAIL', {
        email,
        ip: clientIP,
      })

      // Return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If a super admin account exists with this email, a password reset link has been sent.',
      })
    }

    // Check if account is locked
    if (superAdmin.is_locked) {
      await logAuthEvent.warn('SUPER_ADMIN_PASSWORD_RESET_LOCKED_ACCOUNT', {
        email,
        ip: clientIP,
      })

      // Return generic success to prevent account enumeration
      return NextResponse.json({
        success: true,
        message: 'If a super admin account exists with this email, a password reset link has been sent.',
      })
    }

    // Check if account is inactive
    if (!superAdmin.is_active) {
      await logAuthEvent.warn('SUPER_ADMIN_PASSWORD_RESET_INACTIVE_ACCOUNT', {
        email,
        ip: clientIP,
      })

      // Return generic success to prevent account enumeration
      return NextResponse.json({
        success: true,
        message: 'If a super admin account exists with this email, a password reset link has been sent.',
      })
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Store reset token in database
    const { error: updateError } = await supabaseAdmin
      .from('super_admins')
      .update({
        password_reset_token: resetTokenHash,
        password_reset_expires: resetTokenExpiry.toISOString(),
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', superAdmin.id)

    if (updateError) {
      logger.error('Failed to store password reset token', updateError as Error, {
        email,
        ip: clientIP
      })

      await logAuthEvent.error('SUPER_ADMIN_PASSWORD_RESET_TOKEN_FAILED', {
        email,
        ip: clientIP,
        error: updateError.message,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.SERVICE_UNAVAILABLE, updateError, { ip: clientIP }),
        { status: 500 }
      )
    }

    // Generate reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/superadmin/auth/reset-password-token?token=${resetToken}`

    // Send email with reset link
    if (isEmailConfigured()) {
      try {
        const { html, text } = generateSuperAdminPasswordResetEmail(email, resetUrl, 60)

        await sendEmail({
          to: email,
          subject: '🔐 Reset Your Super Admin Password - Loanz360',
          html,
          text,
        })

        await logAuthEvent.info('SUPER_ADMIN_PASSWORD_RESET_EMAIL_SENT', {
          email,
          ip: clientIP,
          userAgent,
        })
      } catch (emailError) {
        logger.error('Failed to send password reset email', emailError as Error, {
          email,
          ip: clientIP
        })

        // Log error but still return success to prevent email enumeration
        await logAuthEvent.error('SUPER_ADMIN_PASSWORD_RESET_EMAIL_FAILED', {
          email,
          ip: clientIP,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        })

        // Still return success to prevent email enumeration
        // But also return the reset URL in development mode for testing
        if (process.env.NODE_ENV === 'development') {
          return NextResponse.json({
            success: true,
            message: 'If a super admin account exists with this email, a password reset link has been sent.',
            devMode: {
              resetUrl,
              warning: 'This URL is only shown in development mode. Configure RESEND_API_KEY to send emails.'
            }
          })
        }
      }
    } else {
      // Email not configured - log the reset URL for development
      logger.warn('Email service not configured. Reset URL:', {
        email,
        resetUrl,
        message: 'Set RESEND_API_KEY in environment variables to enable email sending'
      })

      await logAuthEvent.warn('SUPER_ADMIN_PASSWORD_RESET_EMAIL_NOT_CONFIGURED', {
        email,
        ip: clientIP,
      })

      // In development mode, return the reset URL
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          success: true,
          message: 'If a super admin account exists with this email, a password reset link has been sent.',
          devMode: {
            resetUrl,
            warning: 'Email service not configured. Set RESEND_API_KEY in .env to enable email sending.'
          }
        })
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If a super admin account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    logger.error('Super admin forgot password error', error as Error, { ip: clientIP })

    await logAuthEvent.error('SUPER_ADMIN_PASSWORD_RESET_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
