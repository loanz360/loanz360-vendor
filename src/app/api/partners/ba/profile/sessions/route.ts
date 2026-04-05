export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BASession, BASessionsResponse } from '@/types/ba-profile'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partners/ba/profile/sessions
 * Fetches active sessions for the BA partner
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner ID
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (!partner) {
      // Return current session only if no partner record
      const currentSession: BASession = {
        session_id: 'current',
        device_type: 'Desktop',
        device_name: 'Current Device',
        browser: request.headers.get('user-agent')?.split(' ').pop() || 'Unknown',
        os: 'Unknown',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown',
        location: null,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        is_current: true,
      }

      return NextResponse.json({
        success: true,
        data: [currentSession],
      } as BASessionsResponse)
    }

    // Fetch sessions from database
    const { data: sessions, error } = await supabase
      .from('partner_sessions')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching sessions', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // Get current session ID from request if available
    const currentSessionId = request.headers.get('x-session-id')

    const formattedSessions: BASession[] = (sessions || []).map(session => ({
      session_id: session.id,
      device_type: session.device_type || 'Unknown',
      device_name: session.device_name || 'Unknown Device',
      browser: session.browser || 'Unknown',
      os: session.os || 'Unknown',
      ip_address: session.ip_address || 'Unknown',
      location: session.location,
      created_at: session.created_at,
      last_activity_at: session.last_activity_at,
      is_current: session.id === currentSessionId,
    }))

    // If no sessions found, create a default current session
    if (formattedSessions.length === 0) {
      formattedSessions.push({
        session_id: 'current',
        device_type: 'Desktop',
        device_name: 'Current Device',
        browser: parseUserAgent(request.headers.get('user-agent')).browser,
        os: parseUserAgent(request.headers.get('user-agent')).os,
        ip_address: request.headers.get('x-forwarded-for') || 'Unknown',
        location: null,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        is_current: true,
      })
    }

    return NextResponse.json({
      success: true,
      data: formattedSessions,
    } as BASessionsResponse)
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/ba/profile/sessions', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/ba/profile/sessions
 * Revoke a session or all other sessions
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const revokeAll = searchParams.get('revoke_all') === 'true'

    // Get partner ID
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    const currentSessionId = request.headers.get('x-session-id')

    if (revokeAll) {
      // Revoke all sessions except current
      const { error } = await supabase
        .from('partner_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('partner_id', partner.id)
        .neq('id', currentSessionId || '')

      if (error) {
        apiLogger.error('Error revoking sessions', error)
        return NextResponse.json(
          { success: false, error: 'Failed to revoke sessions' },
          { status: 500 }
        )
      }

      // Log audit entry
      await supabase.from('partner_audit_logs').insert({
        partner_id: partner.id,
        action_type: 'LOGOUT',
        action_description: 'Revoked all other sessions',
        changed_by: 'SELF',
        source: 'WEB',
        approval_status: 'AUTO_APPROVED',
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: 'All other sessions revoked successfully',
      })
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Prevent revoking current session
    if (sessionId === currentSessionId) {
      return NextResponse.json(
        { success: false, error: 'Cannot revoke current session' },
        { status: 400 }
      )
    }

    // Revoke specific session
    const { error } = await supabase
      .from('partner_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('partner_id', partner.id)

    if (error) {
      apiLogger.error('Error revoking session', error)
      return NextResponse.json(
        { success: false, error: 'Failed to revoke session' },
        { status: 500 }
      )
    }

    // Log audit entry
    await supabase.from('partner_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'LOGOUT',
      action_description: `Revoked session ${sessionId}`,
      changed_by: 'SELF',
      source: 'WEB',
      approval_status: 'AUTO_APPROVED',
      metadata: { session_id: sessionId },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/partners/ba/profile/sessions', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper to parse user agent
function parseUserAgent(userAgent: string | null): { browser: string; os: string } {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown' }

  let browser = 'Unknown'
  let os = 'Unknown'

  // Detect browser
  if (userAgent.includes('Chrome')) browser = 'Chrome'
  else if (userAgent.includes('Firefox')) browser = 'Firefox'
  else if (userAgent.includes('Safari')) browser = 'Safari'
  else if (userAgent.includes('Edge')) browser = 'Edge'
  else if (userAgent.includes('Opera')) browser = 'Opera'

  // Detect OS
  if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iOS')) os = 'iOS'

  return { browser, os }
}
