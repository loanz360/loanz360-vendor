
import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/calendar/google-calendar-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * GET /api/calendar/auth/google/callback
 * Handle Google OAuth2 callback and exchange code for tokens
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.json({
        success: false,
        error: `OAuth error: ${error}`
      }, { status: 400 })
    }

    if (!code || !state) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: code and state'
      }, { status: 400 })
    }

    // State contains the user_id
    const user_id = state

    const result = await googleCalendarService.exchangeCodeForTokens(user_id, code)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    // Redirect to calendar page on success
    return NextResponse.redirect(new URL('/calendar?connected=true', request.url))
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/calendar/auth/google/callback', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
