
/**
 * Super Admin 2FA Setup API
 * Generates 2FA setup data (QR code, backup codes)
 *
 * SECURITY FIX: Secret is NEVER sent to client
 * - Secret stored server-side in temporary session
 * - Client receives verification token instead
 * - Secret only used during verification on server
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { generateTwoFactorSetup } from '@/lib/auth/two-factor-auth'
import { getSuperAdminFromRequest } from '@/lib/auth/super-admin-helpers'
import { createSetupSession } from '@/lib/auth/two-factor-setup-session'
import { logger } from '@/lib/utils/logger'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Force this route to use Node.js runtime
 * This route uses two-factor-auth.ts which requires Node.js crypto module
 */
export const runtime = 'nodejs'

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

    // Generate 2FA setup
    const setup = await generateTwoFactorSetup(admin.email)

    // ✅ SECURITY FIX: Store secret server-side, not in client
    const verificationToken = createSetupSession(
      admin.id,
      setup.secret,
      setup.backupCodes
    )

    // ✅ SECURITY FIX: Do NOT send secret to client
    return NextResponse.json({
      success: true,
      setup: {
        qrCodeUrl: setup.qrCodeUrl,
        manualEntryKey: setup.manualEntryKey,
        backupCodes: setup.backupCodes,
        // ❌ REMOVED: secret (security vulnerability)
        // Secret is stored server-side and accessed via verificationToken
        verificationToken, // Client sends this when enabling 2FA
        expiresIn: 900, // 15 minutes
      },
    })
  } catch (error) {
    logger.error('2FA setup error:', error as Error)
    return NextResponse.json(
      { error: 'Setup failed', message: 'Failed to generate 2FA setup' },
      { status: 500 }
    )
  }
}
