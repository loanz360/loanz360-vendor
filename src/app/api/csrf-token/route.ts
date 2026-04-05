export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { generateCSRFToken, setCSRFCookie } from '@/lib/security/csrf'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * GET /api/csrf-token
 * Returns CSRF token for client-side requests
 * Sets the token in both JSON response and cookie
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const token = generateCSRFToken()

    const response = NextResponse.json({ token })

    // Set the CSRF token in a cookie for double-submit pattern
    setCSRFCookie(response, token)

    return response
  } catch (error) {
    logger.error(
      'Error generating CSRF token',
      error instanceof Error ? error : undefined,
      { endpoint: '/api/csrf-token' }
    )
    logApiError(error as Error, request, { action: 'getCSRFToken' })
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
