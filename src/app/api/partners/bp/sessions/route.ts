export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BPSession } from '@/types/bp-profile'

/** Row shape returned from the user_sessions table */
interface SessionRow {
  id: string | null
  session_id: string | null
  device_type: string | null
  device_name: string | null
  browser: string | null
  os: string | null
  user_agent: string | null
  ip_address: string | null
  location: string | null
  created_at: string
  last_activity_at: string | null
  updated_at: string | null
}

/**
 * GET /api/partners/bp/sessions
 * Fetches all active sessions for the current BP
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current session info
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    // Fetch partner to verify they are a BP
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Fetch sessions from session tracking table
    const { data: sessions, error: sessionsError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false })

    if (sessionsError) {
      apiLogger.error('Error fetching sessions', sessionsError)
      // If session table doesn't exist, return current session only
      const headersList = await headers()
      const userAgent = headersList.get('user-agent') || 'Unknown'
      const clientIp = headersList.get('x-forwarded-for')?.split(',')[0] ||
                       headersList.get('x-real-ip') ||
                       'Unknown'

      const currentSessionData: BPSession = {
        session_id: currentSession?.access_token?.slice(-8) || 'current',
        device_type: parseDeviceType(userAgent),
        device_name: parseDeviceName(userAgent),
        browser: parseBrowser(userAgent),
        os: parseOS(userAgent),
        ip_address: clientIp,
        location: null,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        is_current: true
      }

      return NextResponse.json({
        success: true,
        data: [currentSessionData]
      })
    }

    // Parse sessions
    const parsedSessions: BPSession[] = (sessions || []).map((session: SessionRow) => ({
      session_id: session.id || session.session_id,
      device_type: session.device_type || parseDeviceType(session.user_agent),
      device_name: session.device_name || parseDeviceName(session.user_agent),
      browser: session.browser || parseBrowser(session.user_agent),
      os: session.os || parseOS(session.user_agent),
      ip_address: session.ip_address || 'Unknown',
      location: session.location,
      created_at: session.created_at,
      last_activity_at: session.last_activity_at || session.updated_at,
      is_current: session.id === currentSession?.access_token?.slice(-8) ||
                  session.session_id === currentSession?.access_token?.slice(-8)
    }))

    // If no sessions from DB, add current session
    if (parsedSessions.length === 0) {
      const headersList = await headers()
      const userAgent = headersList.get('user-agent') || 'Unknown'
      const clientIp = headersList.get('x-forwarded-for')?.split(',')[0] ||
                       headersList.get('x-real-ip') ||
                       'Unknown'

      parsedSessions.push({
        session_id: currentSession?.access_token?.slice(-8) || 'current',
        device_type: parseDeviceType(userAgent),
        device_name: parseDeviceName(userAgent),
        browser: parseBrowser(userAgent),
        os: parseOS(userAgent),
        ip_address: clientIp,
        location: null,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        is_current: true
      })
    }

    return NextResponse.json({
      success: true,
      data: parsedSessions
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/bp/sessions', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/bp/sessions
 * Revokes a specific session or all sessions except current
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current session
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    // Parse request body
    const body = await request.json()
    const { session_id, revoke_all } = body

    if (revoke_all) {
      // Revoke all sessions except current
      const { error: revokeError } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .neq('session_id', currentSession?.access_token?.slice(-8) || '')

      if (revokeError) {
        apiLogger.error('Error revoking all sessions', revokeError)
      }

      // Also use Supabase's built-in method to sign out other sessions
      // Note: This may not be available in all Supabase versions
      try {
        // Sign out from all devices except current
        await supabase.auth.signOut({ scope: 'others' })
      } catch (e: unknown) {
        apiLogger.debug('Supabase signOut others not available, using manual revocation')
      }

      // Log audit entry
      await logSessionAudit(supabase, user.id, 'REVOKE_ALL_SESSIONS', 'Revoked all sessions except current')

      return NextResponse.json({
        success: true,
        message: 'All other sessions have been revoked'
      })
    }

    if (!session_id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Check if trying to revoke current session
    const currentSessionId = currentSession?.access_token?.slice(-8)
    if (session_id === currentSessionId || session_id === 'current') {
      return NextResponse.json(
        { success: false, error: 'Cannot revoke current session. Use logout instead.' },
        { status: 400 }
      )
    }

    // Revoke specific session
    const { error: revokeError } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('session_id', session_id)

    if (revokeError) {
      apiLogger.error('Error revoking session', revokeError)
      return NextResponse.json(
        { success: false, error: 'Failed to revoke session' },
        { status: 500 }
      )
    }

    // Log audit entry
    await logSessionAudit(supabase, user.id, 'REVOKE_SESSION', `Revoked session ${session_id}`)

    return NextResponse.json({
      success: true,
      message: 'Session has been revoked'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/partners/bp/sessions', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions to parse user agent
function parseDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'Mobile'
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'Tablet'
  }
  return 'Desktop'
}

function parseDeviceName(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('iphone')) return 'iPhone'
  if (ua.includes('ipad')) return 'iPad'
  if (ua.includes('samsung')) return 'Samsung Device'
  if (ua.includes('pixel')) return 'Google Pixel'
  if (ua.includes('oneplus')) return 'OnePlus Device'
  if (ua.includes('xiaomi') || ua.includes('redmi')) return 'Xiaomi Device'
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac'
  if (ua.includes('windows')) return 'Windows PC'
  if (ua.includes('linux')) return 'Linux PC'
  if (ua.includes('android')) return 'Android Device'
  return 'Unknown Device'
}

function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('edg/')) return 'Microsoft Edge'
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Google Chrome'
  if (ua.includes('firefox')) return 'Mozilla Firefox'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera'
  if (ua.includes('brave')) return 'Brave'
  return 'Unknown Browser'
}

function parseOS(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('windows nt 10')) return 'Windows 10/11'
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac os x')) return 'macOS'
  if (ua.includes('iphone os') || ua.includes('ios')) return 'iOS'
  if (ua.includes('android')) {
    const match = ua.match(/android (\d+)/)
    return match ? `Android ${match[1]}` : 'Android'
  }
  if (ua.includes('linux')) return 'Linux'
  return 'Unknown OS'
}

// Helper to log session audit
async function logSessionAudit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  description: string
): Promise<void> {
  try {
    // First get partner_id
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', userId)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partner) {
      await supabase.from('partner_audit_logs').insert({
        partner_id: partner.id,
        action_type: action,
        action_description: description,
        changed_by: userId,
        source: 'WEB',
        created_at: new Date().toISOString()
      })
    }
  } catch (error: unknown) {
    apiLogger.error('Error logging session audit', error instanceof Error ? error : undefined)
  }
}
