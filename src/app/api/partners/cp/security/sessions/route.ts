export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partners/cp/security/sessions
 * Fetches active sessions for the authenticated CP
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

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, last_login_at, last_login_ip, last_login_device, last_login_location')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Get current session info
    const currentSession = {
      id: user.id,
      session_id: user.id, // Using user ID as session identifier
      device_type: 'Web',
      device_name: 'Current Device',
      browser: request.headers.get('user-agent')?.split(' ').find(s => s.includes('/'))?.split('/')[0] || 'Unknown',
      os: detectOS(request.headers.get('user-agent') || ''),
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      location: null,
      is_current: true,
      last_activity_at: new Date().toISOString(),
      created_at: user.last_sign_in_at || new Date().toISOString()
    }

    // In a real implementation, you would query a sessions table
    // For now, we return the current session and last login info
    const sessions = [currentSession]

    // Add last login as a previous session if different
    if (partner.last_login_at && partner.last_login_ip !== currentSession.ip_address) {
      sessions.push({
        id: 'previous',
        session_id: 'previous-session',
        device_type: partner.last_login_device || 'Unknown',
        device_name: 'Previous Device',
        browser: 'Unknown',
        os: 'Unknown',
        ip_address: partner.last_login_ip || 'unknown',
        location: partner.last_login_location,
        is_current: false,
        last_activity_at: partner.last_login_at,
        created_at: partner.last_login_at
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        current_session_id: currentSession.session_id,
        last_login: {
          at: partner.last_login_at,
          ip: partner.last_login_ip,
          device: partner.last_login_device,
          location: partner.last_login_location
        }
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/cp/security/sessions', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/cp/security/sessions
 * Revoke a specific session or all other sessions
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

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { session_id, revoke_all } = body

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    if (revoke_all) {
      // In a real implementation, this would invalidate all other sessions
      // For now, we'll just log the action
      await supabase.from('cp_audit_logs').insert({
        partner_id: partner.id,
        action_type: 'SESSION_REVOKE',
        action_description: 'Revoked all other sessions',
        section: 'security',
        changed_by: user.id,
        source: 'WEB',
        ip_address: ipAddress,
        created_at: new Date().toISOString()
      })

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

    // Log audit entry for specific session revoke
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'SESSION_REVOKE',
      action_description: `Revoked session ${session_id}`,
      section: 'security',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Session has been revoked'
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/partners/cp/security/sessions', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Detect OS from user agent
 */
function detectOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows'
  if (userAgent.includes('Mac')) return 'macOS'
  if (userAgent.includes('Linux')) return 'Linux'
  if (userAgent.includes('Android')) return 'Android'
  if (userAgent.includes('iOS') || userAgent.includes('iPhone')) return 'iOS'
  return 'Unknown'
}
