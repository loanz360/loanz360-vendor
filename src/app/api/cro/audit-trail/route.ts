import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/cro/audit-trail?entityId=...&entityType=lead
 * Returns audit trail for a specific entity (who changed what, when).
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')
    const entityType = searchParams.get('entityType') || 'lead'
    const page = Number(searchParams.get('page') || '1')
    const limit = Math.min(Number(searchParams.get('limit') || '30'), 100)

    if (!entityId) {
      return NextResponse.json({ success: false, error: 'entityId is required' }, { status: 400 })
    }

    const offset = (page - 1) * limit

    const { data: logs, error, count } = await supabase
      .from('crm_audit_logs')
      .select('*', { count: 'exact' })
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
    }

    // Fetch user names for performed_by
    const userIds = [...new Set((logs || []).map(l => l.performed_by).filter(id => id && id !== 'system'))]
    let userMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('employee_profile')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds)

      userMap = new Map(
        (profiles || []).map(p => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
      )
    }

    const enrichedLogs = (logs || []).map(log => ({
      ...log,
      performed_by_name: log.performed_by === 'system' ? 'System' : userMap.get(log.performed_by) || 'Unknown',
      old_value_parsed: safeParseJSON(log.old_value),
      new_value_parsed: safeParseJSON(log.new_value),
    }))

    return NextResponse.json({
      success: true,
      data: enrichedLogs,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Audit trail GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function safeParseJSON(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
