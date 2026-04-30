
/**
 * Super Admin 2FA Backup Codes Regeneration API
 * Regenerates backup codes for 2FA recovery
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { regenerateBackupCodes } from '@/lib/auth/two-factor-auth'
import { getSuperAdminFromRequest } from '@/lib/auth/super-admin-helpers'
import { logger } from '@/lib/utils/logger'
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'
import { z } from 'zod'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Force this route to use Node.js runtime
 * This route uses two-factor-auth.ts which requires Node.js crypto module
 */
export const runtime = 'nodejs'

const regenerateBackupCodesSchema = z.object({
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
})

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // SECURITY: Validate Content-Type header (prevents CSRF, content smuggling, XSS)
    const contentTypeValidation = validateJsonContentType(request)
    if (!contentTypeValidation.valid) {
      return createContentTypeErrorResponse(
        contentTypeValidation.error || 'Invalid Content-Type',
        contentTypeValidation.status
      )
    }

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
    const validation = regenerateBackupCodesSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { verificationCode } = validation.data

    // Regenerate backup codes
    const result = await regenerateBackupCodes(admin.id, verificationCode)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to regenerate backup codes', message: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      backupCodes: result.backupCodes,
    })
  } catch (error) {
    logger.error('Backup codes regeneration error:', error as Error)
    return NextResponse.json(
      { error: 'Regeneration failed', message: 'Failed to regenerate backup codes' },
      { status: 500 }
    )
  }
}
