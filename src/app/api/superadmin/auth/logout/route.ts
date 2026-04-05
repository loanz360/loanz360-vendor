export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/utils/logger'
import { verifySessionToken } from '@/lib/auth/tokens'
import { blacklistToken, revokeSession } from '@/lib/auth/token-blacklist'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

/**
 * Force this route to use Node.js runtime
 * This route uses tokens.ts which requires Node.js crypto module
 */
export const runtime = 'nodejs'

/**
 * Super Admin Logout API
 * SECURITY: Invalidates session in database before clearing cookies
 * Prevents token replay attacks
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('super_admin_session')?.value

    // SECURITY: Invalidate token and session in database
    if (sessionToken) {
      const sessionData = verifySessionToken(sessionToken)
      if (sessionData) {
        // Blacklist both token and session to prevent replay attacks
        await Promise.all([
          blacklistToken(sessionToken, sessionData.userId, sessionData.sessionId, new Date(sessionData.expiresAt)),
          revokeSession(sessionData.sessionId, 'User logout')
        ])

        logger.info('Session invalidated', {
          sessionId: sessionData.sessionId.substring(0, 10) + '...',
          userId: sessionData.userId
        })
      }
    }

    // Clear Super Admin session cookies
    cookieStore.delete('super_admin_session')
    cookieStore.delete('super_admin_session.sig')

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    logger.error('Logout error:', error as Error)
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    )
  }
}
