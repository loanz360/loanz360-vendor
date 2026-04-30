import { parseBody } from '@/lib/utils/parse-body'

/**
 * Super Admin Reset Password API
 * Validates reset token and updates password
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
import { passwordSchema } from '@/lib/validation/password-policy'
import { checkSuperAdminPasswordHistory, saveSuperAdminPasswordHistory } from '@/lib/auth/password-history'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

// SECURITY FIX HIGH-03: Use enterprise-grade password policy (12+ chars)
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema, // Enterprise-grade: 12+ characters with complexity
})

// API Route Runtime: Node.js (uses crypto/bcrypt)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // SECURITY: Validate Content-Type header
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
    // Rate limiting
    const rateLimitResult = await checkRateLimit(clientIP, '/api/superadmin/auth/reset-password')

    if (!rateLimitResult.allowed) {
      await logAuthEvent.warn('SUPER_ADMIN_RESET_PASSWORD_RATE_LIMIT_EXCEEDED', {
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
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      await recordFailedAttempt(clientIP, '/api/superadmin/auth/reset-password', undefined, userAgent)

      return NextResponse.json(
        createErrorResponse(API_ERRORS.VALIDATION_FAILED, validation.error, { ip: clientIP }),
        { status: 400 }
      )
    }

    const { token, newPassword } = validation.data

    // Hash the token to match database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const supabaseAdmin = createSupabaseAdmin()

    // Find super admin with this token
    const { data: superAdmin, error: findError } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, password_reset_token, password_reset_expires, is_active, is_locked')
      .eq('password_reset_token', tokenHash)
      .maybeSingle()

    if (findError || !superAdmin) {
      await logAuthEvent.warn('SUPER_ADMIN_RESET_PASSWORD_INVALID_TOKEN', {
        ip: clientIP,
        userAgent,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired reset token. Please request a new password reset link.',
        },
        { status: 400 }
      )
    }

    // Check if token has expired
    const expiryDate = new Date(superAdmin.password_reset_expires)
    if (expiryDate < new Date()) {
      await logAuthEvent.warn('SUPER_ADMIN_RESET_PASSWORD_EXPIRED_TOKEN', {
        email: superAdmin.email,
        ip: clientIP,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Reset token has expired. Please request a new password reset link.',
        },
        { status: 400 }
      )
    }

    // Check if account is locked
    if (superAdmin.is_locked) {
      await logAuthEvent.warn('SUPER_ADMIN_RESET_PASSWORD_LOCKED_ACCOUNT', {
        email: superAdmin.email,
        ip: clientIP,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Account is locked. Please contact system administrator.',
        },
        { status: 403 }
      )
    }

    // Check if account is inactive
    if (!superAdmin.is_active) {
      await logAuthEvent.warn('SUPER_ADMIN_RESET_PASSWORD_INACTIVE_ACCOUNT', {
        email: superAdmin.email,
        ip: clientIP,
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Account is inactive. Please contact system administrator.',
        },
        { status: 403 }
      )
    }

    // SECURITY FIX HIGH-02: Check password history before allowing reset
    const historyCheck = await checkSuperAdminPasswordHistory(superAdmin.id, newPassword)
    if (!historyCheck.allowed) {
      await logAuthEvent.warn('SUPER_ADMIN_RESET_PASSWORD_REUSED', {
        email: superAdmin.email,
        ip: clientIP,
      })

      return NextResponse.json(
        {
          success: false,
          error: historyCheck.message || 'Password was used recently. Please choose a different password.',
        },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // SECURITY FIX HIGH-02: Save to password history
    await saveSuperAdminPasswordHistory(superAdmin.id, passwordHash)

    // Update password and clear reset token
    const { error: updateError } = await supabaseAdmin
      .from('super_admins')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        password_must_change: false,
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
        last_failed_login: null,
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', superAdmin.id)

    if (updateError) {
      logger.error('Failed to update super admin password', updateError as Error, {
        email: superAdmin.email,
        ip: clientIP
      })

      await logAuthEvent.error('SUPER_ADMIN_RESET_PASSWORD_UPDATE_FAILED', {
        email: superAdmin.email,
        ip: clientIP,
        error: updateError.message,
      })

      return NextResponse.json(
        createErrorResponse(API_ERRORS.SERVICE_UNAVAILABLE, updateError, { ip: clientIP }),
        { status: 500 }
      )
    }

    await logAuthEvent.info('SUPER_ADMIN_PASSWORD_RESET_SUCCESS', {
      email: superAdmin.email,
      ip: clientIP,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    })
  } catch (error) {
    logger.error('Super admin reset password error', error as Error, { ip: clientIP })

    await logAuthEvent.error('SUPER_ADMIN_RESET_PASSWORD_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    return NextResponse.json(
      createErrorResponse(API_ERRORS.INTERNAL_ERROR, error, { ip: clientIP }),
      { status: 500 }
    )
  }
}
