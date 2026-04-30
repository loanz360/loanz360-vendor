
/**
 * Super Admin 2FA Enable API
 * Enables 2FA after verifying setup code
 *
 * SECURITY FIX: Secret retrieved from server-side session
 * - Client sends verification token, not secret
 * - Secret never exposed to client
 * - Session deleted after successful enablement
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { enableTwoFactorAuth } from '@/lib/auth/two-factor-auth'
import { getSuperAdminFromRequest } from '@/lib/auth/super-admin-helpers'
import { getSetupSession, deleteSetupSession, verifySetupSession } from '@/lib/auth/two-factor-setup-session'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Force this route to use Node.js runtime
 * This route uses two-factor-auth.ts which requires Node.js crypto module
 */
export const runtime = 'nodejs'

// ✅ SECURITY FIX: No longer accepts secret/backupCodes from client
const enableTwoFactorSchema = z.object({
  verificationToken: z.string().min(1, 'Verification token is required'),
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
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
    // Get authenticated super admin
    const adminResult = await getSuperAdminFromRequest(request)

    if (!adminResult.authenticated || !adminResult.admin) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Super admin authentication required' },
        { status: 401 }
      )
    }

    const { admin } = adminResult

    // Parse and validate request body
    const body = await request.json()
    const validation = enableTwoFactorSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { verificationToken, verificationCode } = validation.data

    // ✅ SECURITY FIX: Retrieve secret from server-side session
    const session = getSetupSession(verificationToken)

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token', message: 'Setup session not found or expired' },
        { status: 400 }
      )
    }

    // Verify session belongs to this admin
    if (!verifySetupSession(verificationToken, admin.id)) {
      return NextResponse.json(
        { error: 'Invalid verification token', message: 'Token does not belong to this admin' },
        { status: 403 }
      )
    }

    // Enable 2FA using server-side secret
    const result = await enableTwoFactorAuth(
      admin.id,
      session.secret, // ✅ Secret from server session, not client
      session.backupCodes, // ✅ Backup codes from server session, not client
      verificationCode
    )

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to enable 2FA', message: result.error },
        { status: 400 }
      )
    }

    // ✅ SECURITY: Delete session after successful enablement
    deleteSetupSession(verificationToken)

    return NextResponse.json({
      success: true,
      message: '2FA enabled successfully',
    })
  } catch (error) {
    logger.error('2FA enable error:', error as Error)
    return NextResponse.json(
      { error: 'Enable failed', message: 'Failed to enable 2FA' },
      { status: 500 }
    )
  }
}
