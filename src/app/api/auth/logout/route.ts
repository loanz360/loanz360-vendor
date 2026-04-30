
/**
 * User Logout API
 * SECURITY: Invalidates Supabase session server-side before clearing cookies
 * Prevents token replay attacks after logout
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { logAuthEvent } from '@/lib/auth/secure-logger'
import { getClientIP } from '@/lib/utils/request-helpers'

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)

  try {
    const supabase = await createClient()

    // Get current session for logging
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    const email = session?.user?.email

    // SECURITY: Invalidate session server-side via Supabase Auth API
    // This revokes the refresh token so it cannot be replayed
    const { error } = await supabase.auth.signOut()

    if (error) {
      logger.warn('Logout signOut error (session may already be invalid)', {
        error: 'An unexpected error occurred',
        userId,
        ip: clientIP,
      })
    }

    await logAuthEvent.info('LOGOUT_SUCCESS', {
      userId,
      email,
      ip: clientIP,
    })

    // Build response that clears Supabase auth cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    // Clear Supabase auth cookies explicitly
    // Supabase sets these as HTTP-only cookies
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')
    // Project-specific cookie names (Supabase uses project ref in cookie name)
    // These cover common Supabase cookie naming patterns
    const cookieHeader = request.headers.get('cookie') || ''
    const sbCookies = cookieHeader.match(/sb-[a-zA-Z0-9-]+-auth-token[^;]*/g) || []
    sbCookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim()
      response.cookies.delete(cookieName)
    })

    return response
  } catch (error) {
    logger.error('Logout error', error as Error, { ip: clientIP })

    await logAuthEvent.error('LOGOUT_ERROR', {
      ip: clientIP,
      error: 'Internal server error',
    })

    // Even on error, return success to client and clear cookies
    // Don't leave user stuck on an error screen for logout
    const response = NextResponse.json({
      success: true,
      message: 'Logged out',
    })

    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')

    return response
  }
}
