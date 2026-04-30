import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/accounts-manager/audit-trail
 * Comprehensive audit trail merging cp_application_status_history
 * and partner_payout_status_history with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const userId = searchParams.get('user_id') || null
    const actionType = searchParams.get('action_type') || null
    const dateFrom = searchParams.get('date_from') || null
    const dateTo = searchParams.get('date_to') || null
    const search = searchParams.get('search') || null

    // Map action types to status values
    const actionStatusMap: Record<string, string[]> = {
      verification: ['ACCOUNTS_VERIFIED', 'ACCOUNTS_VERIFICATION'],
      rejection: ['REJECTED', 'SA_REJECTED'],
      escalation: ['ESCALATED', 'FINANCE_PROCESSING'],
      status_change: [], // all statuses
    }

    // Build CP history query
    const cpQuery = supabase
      .from('cp_application_status_history')
      .select('id, application_id, previous_status, new_status, changed_by, changed_by_name, changed_by_role, notes, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Build Partner history query
    const partnerQuery = supabase
      .from('partner_payout_status_history')
      .select('id, application_id, app_id, partner_type, previous_status, new_status, changed_by, changed_by_name, changed_by_role, notes, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply user filter
    if (userId) {
      cpQuery.eq('changed_by', userId)
      partnerQuery.eq('changed_by', userId)
    }

    // Apply action type filter
    if (actionType && actionStatusMap[actionType] && actionStatusMap[actionType].length > 0) {
      cpQuery.in('new_status', actionStatusMap[actionType])
      partnerQuery.in('new_status', actionStatusMap[actionType])
    }

    // Apply date filters
    if (dateFrom) {
      cpQuery.gte('created_at', `${dateFrom}T00:00:00+05:30`)
      partnerQuery.gte('created_at', `${dateFrom}T00:00:00+05:30`)
    }
    if (dateTo) {
      cpQuery.lte('created_at', `${dateTo}T23:59:59+05:30`)
      partnerQuery.lte('created_at', `${dateTo}T23:59:59+05:30`)
    }

    // Apply search filter on notes
    if (search) {
      cpQuery.or(`notes.ilike.%${search}%,application_id.ilike.%${search}%`)
      partnerQuery.or(`notes.ilike.%${search}%,app_id.ilike.%${search}%`)
    }

    // Fetch larger sets to merge and paginate in-memory
    const fetchLimit = 500
    cpQuery.limit(fetchLimit)
    partnerQuery.limit(fetchLimit)

    const [cpResult, partnerResult] = await Promise.all([cpQuery, partnerQuery])

    if (cpResult.error) {
      logger.error('Audit trail CP query error', cpResult.error)
    }
    if (partnerResult.error) {
      logger.error('Audit trail partner query error', partnerResult.error)
    }

    const cpEntries = (cpResult.data || []) as Array<{
      id: string; application_id: string; previous_status: string; new_status: string;
      changed_by: string; changed_by_name: string; changed_by_role: string;
      notes: string | null; created_at: string
    }>
    const partnerEntries = (partnerResult.data || []) as Array<{
      id: string; application_id: string; app_id: string; partner_type: string;
      previous_status: string; new_status: string; changed_by: string;
      changed_by_name: string; changed_by_role: string; notes: string | null;
      created_at: string
    }>

    // Determine action type from status
    function getActionType(newStatus: string): string {
      if (['ACCOUNTS_VERIFIED', 'ACCOUNTS_VERIFICATION'].includes(newStatus)) return 'verification'
      if (['REJECTED', 'SA_REJECTED'].includes(newStatus)) return 'rejection'
      if (['ESCALATED', 'FINANCE_PROCESSING'].includes(newStatus)) return 'escalation'
      return 'status_change'
    }

    // Normalize CP entries
    const normalizedCp = cpEntries.map(e => ({
      id: `cp_${e.id}`,
      timestamp: e.created_at,
      user_name: e.changed_by_name || 'System',
      user_id: e.changed_by,
      user_role: e.changed_by_role || 'UNKNOWN',
      action_type: getActionType(e.new_status),
      entity_type: 'CP' as const,
      entity_id: e.application_id,
      app_id: e.application_id,
      previous_value: e.previous_status || '',
      new_value: e.new_status,
      notes: e.notes || '',
      ip_address: null as string | null,
    }))

    // Normalize Partner entries
    const normalizedPartner = partnerEntries.map(e => ({
      id: `partner_${e.id}`,
      timestamp: e.created_at,
      user_name: e.changed_by_name || 'System',
      user_id: e.changed_by,
      user_role: e.changed_by_role || 'UNKNOWN',
      action_type: getActionType(e.new_status),
      entity_type: (e.partner_type || 'BA') as 'BA' | 'BP',
      entity_id: e.application_id,
      app_id: e.app_id || e.application_id,
      previous_value: e.previous_status || '',
      new_value: e.new_status,
      notes: e.notes || '',
      ip_address: null as string | null,
    }))

    // Merge and sort by timestamp descending
    const allEntries = [...normalizedCp, ...normalizedPartner]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const total = allEntries.length
    const startIndex = (page - 1) * limit
    const paginatedEntries = allEntries.slice(startIndex, startIndex + limit)

    return NextResponse.json({
      success: true,
      data: {
        entries: paginatedEntries,
        total,
        page,
        limit,
        hasMore: startIndex + limit < total,
      },
    })
  } catch (error) {
    logger.error('Audit trail API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
