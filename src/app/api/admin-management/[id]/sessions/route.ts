
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/sessions
 * Get all sessions for an admin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params
    const { searchParams } = new URL(request.url)

    const activeOnly = searchParams.get('active_only') === 'true'

    // Check if admin exists
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('admin_sessions')
      .select('*')
      .eq('admin_id', id)

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    query = query.order('last_activity_at', { ascending: false })

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) throw sessionsError

    // Get current session token from request
    const currentToken = request.headers.get('authorization')?.replace('Bearer ', '')

    // Add current session indicator
    const sessionsWithStatus = sessions?.map(session => ({
      ...session,
      is_current: session.session_token === currentToken,
      time_since_last_activity: Math.floor(
        (Date.now() - new Date(session.last_activity_at).getTime()) / 1000 / 60
      ), // minutes
      expires_in_hours: Math.ceil(
        (new Date(session.expires_at).getTime() - Date.now()) / 1000 / 60 / 60
      )
    }))

    // Get session summary
    const activeSessions = sessionsWithStatus?.filter(s => s.is_active) || []
    const suspiciousSessions = activeSessions.filter(s => s.is_suspicious)

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name,
          email: admin.email
        },
        sessions: sessionsWithStatus || [],
        summary: {
          total_sessions: sessions?.length || 0,
          active_sessions: activeSessions.length,
          suspicious_sessions: suspiciousSessions.length,
          unique_devices: new Set(activeSessions.map(s => s.device_fingerprint)).size,
          unique_ips: new Set(activeSessions.map(s => s.ip_address)).size
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Sessions API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin-management/[id]/sessions
 * Terminate sessions for an admin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params
    const { searchParams } = new URL(request.url)

    const sessionId = searchParams.get('session_id')
    const terminateAll = searchParams.get('terminate_all') === 'true'
    const exceptCurrent = searchParams.get('except_current') === 'true'
    const terminatedBy = searchParams.get('terminated_by')
    const reason = searchParams.get('reason') || 'Manual termination'

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    let terminatedCount = 0

    if (terminateAll) {
      // Get current session ID if except_current is true
      const currentToken = exceptCurrent ? request.headers.get('authorization')?.replace('Bearer ', '') : null
      let currentSessionId: string | null = null

      if (currentToken) {
        const { data: currentSession } = await supabase
          .from('admin_sessions')
          .select('id')
          .eq('session_token', currentToken)
          .maybeSingle()

        currentSessionId = currentSession?.id || null
      }

      // Terminate all sessions
      const { data, error: terminateError } = await supabase.rpc('terminate_all_admin_sessions', {
        p_admin_id: id,
        p_except_session_id: currentSessionId,
        p_terminated_by: terminatedBy,
        p_reason: reason
      })

      if (terminateError) throw terminateError

      terminatedCount = data || 0

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: 'security_sessions_terminated_all',
        p_action_description: `All sessions were terminated for admin ${admin.admin_unique_id}${exceptCurrent ? ' (except current)' : ''}`,
        p_changes: JSON.stringify({ sessions_terminated: terminatedCount, reason }),
        p_performed_by: terminatedBy,
        p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        p_user_agent: request.headers.get('user-agent') || 'unknown'
      })
    } else if (sessionId) {
      // Terminate specific session
      const { data, error: terminateError } = await supabase.rpc('terminate_admin_session', {
        p_session_id: sessionId,
        p_terminated_by: terminatedBy,
        p_reason: reason
      })

      if (terminateError) throw terminateError

      if (data) {
        terminatedCount = 1

        // Create audit log
        await supabase.rpc('create_admin_audit_log', {
          p_admin_id: id,
          p_action_type: 'security_session_terminated',
          p_action_description: `A session was terminated for admin ${admin.admin_unique_id}`,
          p_changes: JSON.stringify({ session_id: sessionId, reason }),
          p_performed_by: terminatedBy,
          p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          p_user_agent: request.headers.get('user-agent') || 'unknown'
        })
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Either session_id or terminate_all=true is required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: terminateAll
        ? `${terminatedCount} session(s) terminated successfully`
        : 'Session terminated successfully',
      data: {
        terminated_count: terminatedCount
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Terminate Sessions API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
