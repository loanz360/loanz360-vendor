/**
 * API Route: Customer Login Activity
 * GET /api/customers/login-activity
 *
 * Returns recent login sessions for the authenticated customer.
 * Enables customers to review device/IP history and revoke sessions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get customer profile
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const customerId = profile?.id || user.id

    const adminClient = createAdminClient()

    // Fetch recent sessions from customer_sessions table
    const { data: sessions, error: sessionsError } = await adminClient
      .from('customer_sessions')
      .select('id, ip_address, user_agent, is_active, created_at, expires_at, revoked_at, revoked_reason')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (sessionsError) {
      apiLogger.error('Login activity fetch error', sessionsError)
    }

    // Fetch security events related to this customer's logins
    const { data: securityEvents } = await adminClient
      .from('security_logs')
      .select('id, event_type, severity, ip_address, user_agent, created_at, metadata')
      .eq('user_id', customerId)
      .in('event_type', [
        'CUSTOMER_LOGIN_SUCCESS',
        'CUSTOMER_LOGIN_INVALID_PASSWORD',
        'CUSTOMER_LOGIN_ACCOUNT_LOCKED',
        'CUSTOMER_LOGIN_RATE_LIMIT_EXCEEDED',
      ])
      .order('created_at', { ascending: false })
      .limit(30)

    // Parse user agent into device info
    const parsedSessions = (sessions || []).map((s) => ({
      id: s.id,
      ip_address: s.ip_address ? maskIP(s.ip_address) : 'Unknown',
      device: parseUserAgent(s.user_agent || ''),
      is_active: s.is_active && (!s.expires_at || new Date(s.expires_at) > new Date()),
      login_at: s.created_at,
      expires_at: s.expires_at,
      revoked: !!s.revoked_at,
    }))

    // Parse security events
    const loginEvents = (securityEvents || []).map((e) => ({
      id: e.id,
      event: e.event_type,
      severity: e.severity,
      ip_address: e.ip_address ? maskIP(e.ip_address) : 'Unknown',
      device: parseUserAgent(e.user_agent || ''),
      timestamp: e.created_at,
      success: e.event_type === 'CUSTOMER_LOGIN_SUCCESS',
    }))

    return NextResponse.json({
      success: true,
      data: {
        sessions: parsedSessions,
        recent_events: loginEvents,
        active_sessions_count: parsedSessions.filter((s) => s.is_active).length,
      },
    })
  } catch (error) {
    apiLogger.error('Login activity API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/** Mask IP for customer display (show first two octets only) */
function maskIP(ip: string): string {
  if (!ip || ip === 'unknown') return 'Unknown'
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`
  }
  // IPv6 or other format — show first segment
  return ip.split(':').slice(0, 2).join(':') + ':***'
}

/** Extract device/browser info from user agent string */
function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown Device'
  const lowerUA = ua.toLowerCase()

  let browser = 'Unknown Browser'
  if (lowerUA.includes('edg/')) browser = 'Edge'
  else if (lowerUA.includes('chrome/') && !lowerUA.includes('edg/')) browser = 'Chrome'
  else if (lowerUA.includes('firefox/')) browser = 'Firefox'
  else if (lowerUA.includes('safari/') && !lowerUA.includes('chrome/')) browser = 'Safari'
  else if (lowerUA.includes('opera') || lowerUA.includes('opr/')) browser = 'Opera'

  let os = 'Unknown OS'
  if (lowerUA.includes('windows')) os = 'Windows'
  else if (lowerUA.includes('mac os') || lowerUA.includes('macintosh')) os = 'macOS'
  else if (lowerUA.includes('android')) os = 'Android'
  else if (lowerUA.includes('iphone') || lowerUA.includes('ipad')) os = 'iOS'
  else if (lowerUA.includes('linux')) os = 'Linux'

  let device = 'Desktop'
  if (lowerUA.includes('mobile') || lowerUA.includes('android') || lowerUA.includes('iphone')) {
    device = 'Mobile'
  } else if (lowerUA.includes('ipad') || lowerUA.includes('tablet')) {
    device = 'Tablet'
  }

  return `${browser} on ${os} (${device})`
}
