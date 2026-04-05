export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/** Sanitize search input to prevent injection */
function sanitizeInput(input: string, maxLen = 100): string {
  return input.replace(/[%_\\'"();]/g, '').trim().slice(0, maxLen)
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) return NextResponse.json({ success: false, error: 'HR access required' }, { status: 403 })

    const searchParams = request.nextUrl.searchParams
    const module = searchParams.get('module') || ''
    const employeeSearch = searchParams.get('employee_search') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('page_size') || '20')))
    const offset = (page - 1) * pageSize

    // ── Build query with server-side filtering (fixes C7) ──
    let query = adminClient
      .from('employee_activity_logs')
      .select(`
        id,
        actor_id:performed_by,
        action:action_type,
        module:module_name,
        target_id:target_employee_id,
        details:metadata,
        description,
        created_at,
        actor_profile:employee_profile!employee_activity_logs_performed_by_fkey(user_id, full_name, first_name, last_name),
        target_profile:employee_profile!employee_activity_logs_target_employee_id_fkey(user_id, full_name, first_name, last_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Module filter (server-side)
    if (module) {
      const safeModule = sanitizeInput(module)
      if (safeModule) {
        query = query.ilike('module_name', `%${safeModule}%`)
      }
    }

    // Date range filter (server-side)
    if (from) query = query.gte('created_at', `${from}T00:00:00`)
    if (to) query = query.lte('created_at', `${to}T23:59:59.999`)

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1)

    let { data: rawLogs, error: logError, count } = await query

    // ── Fallback: try hr_audit_log table ──
    if (logError) {
      apiLogger.warn('employee_activity_logs query failed, trying hr_audit_log', { error: logError.message })
      let altQuery = adminClient
        .from('hr_audit_log')
        .select('id, user_id, action, module, target_id, description, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (module) {
        const safeModule = sanitizeInput(module)
        if (safeModule) altQuery = altQuery.ilike('module', `%${safeModule}%`)
      }
      if (from) altQuery = altQuery.gte('created_at', `${from}T00:00:00`)
      if (to) altQuery = altQuery.lte('created_at', `${to}T23:59:59.999`)

      altQuery = altQuery.range(offset, offset + pageSize - 1)

      const { data: altLogs, error: altError, count: altCount } = await altQuery

      if (!altError && altLogs) {
        rawLogs = altLogs.map((l: Record<string, unknown>) => ({
          ...l, actor_id: l.user_id, actor_profile: null, target_profile: null, details: l.description
        }))
        count = altCount
        logError = null
      }
    }

    // ── Second fallback: return empty gracefully ──
    if (logError || !rawLogs) {
      return NextResponse.json({ success: true, data: [], meta: { total: 0, page, page_size: pageSize }, stats: { actionsToday: 0, actionsThisMonth: 0, mostActiveModule: '—', mostRecentAction: '—' } })
    }

    // ── Normalize log shape ──
    interface ProfileShape { user_id?: string; full_name?: string; first_name?: string; last_name?: string }
    const data = rawLogs.map((log: Record<string, unknown>) => {
      // Handle relationship errors: if join fails, profile may be an error object or null
      const rawActor = log.actor_profile
      const rawTarget = log.target_profile
      const actorProfile: ProfileShape | null = rawActor && typeof rawActor === 'object' && !('error' in (rawActor as Record<string, unknown>))
        ? (Array.isArray(rawActor) ? (rawActor as ProfileShape[])[0] : (rawActor as ProfileShape | null))
        : null
      const targetProfile: ProfileShape | null = rawTarget && typeof rawTarget === 'object' && !('error' in (rawTarget as Record<string, unknown>))
        ? (Array.isArray(rawTarget) ? (rawTarget as ProfileShape[])[0] : (rawTarget as ProfileShape | null))
        : null
      const actorName = actorProfile
        ? (actorProfile.full_name || `${actorProfile.first_name || ''} ${actorProfile.last_name || ''}`.trim())
        : (log.actor_name || 'System')
      const targetName = targetProfile
        ? (targetProfile.full_name || `${targetProfile.first_name || ''} ${targetProfile.last_name || ''}`.trim())
        : (log.target_name || null)
      return {
        id: log.id as string,
        actor_id: log.actor_id as string,
        actor_name: actorName as string,
        action: (String(log.action || 'UPDATE')).toUpperCase(),
        module: String(log.module || log.module_name || 'System'),
        target_id: log.target_id as string | null,
        target_name: targetName as string | null,
        details: (log.details || log.description || log.metadata || null) as string | Record<string, unknown> | null,
        created_at: log.created_at as string,
      }
    })

    // ── Employee search: filter on resolved actor/target names ──
    let filtered = data
    if (employeeSearch) {
      const searchLower = employeeSearch.toLowerCase()
      filtered = data.filter(l =>
        (l.actor_name && l.actor_name.toLowerCase().includes(searchLower)) ||
        (l.target_name && l.target_name.toLowerCase().includes(searchLower))
      )
      // Adjust count to reflect filtered results
      count = filtered.length
    }

    // ── Compute real stats (fixes H9) ──
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const monthStr = now.toISOString().slice(0, 7)

    // Get today's count from DB for accurate stats
    let actionsToday = 0
    let actionsThisMonth = 0
    try {
      const { count: todayCount } = await adminClient
        .from('employee_activity_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${todayStr}T00:00:00`)
        .lte('created_at', `${todayStr}T23:59:59.999`)
      actionsToday = todayCount || 0

      const { count: monthCount } = await adminClient
        .from('employee_activity_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${monthStr}-01T00:00:00`)
      actionsThisMonth = monthCount || 0
    } catch {
      // Fall back to local computation
      actionsToday = data.filter(l => l.created_at && l.created_at.startsWith(todayStr)).length
      actionsThisMonth = data.filter(l => l.created_at && l.created_at.startsWith(monthStr)).length
    }

    // Most active module from current page data
    const moduleCounts: Record<string, number> = {}
    data.forEach(l => { moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1 })
    const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    return NextResponse.json({
      success: true,
      data: filtered,
      meta: {
        total: count || 0,
        page,
        page_size: pageSize,
      },
      stats: {
        actionsToday,
        actionsThisMonth,
        mostActiveModule: topModule,
        mostRecentAction: data[0]?.action || '—',
      }
    })
  } catch (error) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('GET /api/hr/audit-logs', { errorId, error })
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      error_id: errorId,
      data: [],
      meta: { total: 0, page: 1, page_size: 20 },
      stats: { actionsToday: 0, actionsThisMonth: 0, mostActiveModule: '—', mostRecentAction: '—' }
    }, { status: 500 })
  }
}
