export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/calendar/google-calendar-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * GET /api/calendar/auth/google
 * Initiate Google OAuth2 flow for calendar integration
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const state = searchParams.get('state')

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: user_id'
      }, { status: 400 })
    }

    const authUrl = await googleCalendarService.getAuthorizationURL(user_id, state || undefined)

    return NextResponse.json({
      success: true,
      data: {
        authorization_url: authUrl
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/calendar/auth/google', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
