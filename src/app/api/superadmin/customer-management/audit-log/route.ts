export const dynamic = 'force-dynamic'

/**
 * Configuration Audit Log API
 * SuperAdmin endpoint for viewing configuration change history
 *
 * GET - Fetch audit log entries with filters and pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const querySchema = z.object({
  action: z.enum(['all', 'CREATE', 'UPDATE', 'DELETE', 'ENABLE', 'DISABLE', 'RESTORE']).optional(),
  entity_type: z.enum([
    'all', 'INCOME_CATEGORY', 'INCOME_PROFILE', 'ENTITY_TYPE',
    'DOCUMENT_REQUIREMENT', 'CUSTOMER_SEGMENT', 'PROFILE_FIELD'
  ]).optional(),
  date_filter: z.enum(['all', 'today', 'week', 'month']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
})

/**
 * GET /api/superadmin/customer-management/audit-log
 * Fetch configuration audit log entries
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      action: searchParams.get('action') || 'all',
      entity_type: searchParams.get('entity_type') || 'all',
      date_filter: searchParams.get('date_filter') || 'all',
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      sort_order: searchParams.get('sort_order') || 'desc',
    })

    // Build query
    let query = supabaseAdmin
      .from('config_audit_log')
      .select('*', { count: 'exact' })

    // Apply action filter
    if (params.action && params.action !== 'all') {
      query = query.eq('action', params.action)
    }

    // Apply entity type filter
    if (params.entity_type && params.entity_type !== 'all') {
      query = query.eq('entity_type', params.entity_type)
    }

    // Apply date filter
    if (params.date_filter && params.date_filter !== 'all') {
      const now = new Date()
      let dateFrom: Date

      switch (params.date_filter) {
        case 'today':
          dateFrom = new Date(now.setHours(0, 0, 0, 0))
          break
        case 'week':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          dateFrom = new Date(0)
      }

      query = query.gte('created_at', dateFrom.toISOString())
    }

    // Apply search filter
    if (params.search) {
      query = query.or(`entity_name.ilike.%${params.search}%,changed_by_email.ilike.%${params.search}%`)
    }

    // Apply sorting
    query = query.order('created_at', { ascending: params.sort_order === 'asc' })

    // Apply pagination
    const from = (params.page - 1) * params.limit
    const to = from + params.limit - 1
    query = query.range(from, to)

    const { data: logs, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching audit logs', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Get statistics
    const { data: allLogs } = await supabaseAdmin
      .from('config_audit_log')
      .select('action, entity_type, created_at')

    const now = new Date()
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const statistics = {
      total_changes: allLogs?.length || 0,
      changes_today: allLogs?.filter(l => new Date(l.created_at) >= todayStart).length || 0,
      changes_this_week: allLogs?.filter(l => new Date(l.created_at) >= weekAgo).length || 0,
      changes_this_month: allLogs?.filter(l => new Date(l.created_at) >= monthAgo).length || 0,
      top_action: getTopItem(allLogs?.map(l => l.action) || []),
      top_entity_type: getTopItem(allLogs?.map(l => l.entity_type) || []),
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      pagination: {
        total: count || 0,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil((count || 0) / params.limit),
      },
      statistics,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    apiLogger.error('Audit Log GET error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to get most common item in an array
function getTopItem(items: string[]): string {
  if (items.length === 0) return ''

  const counts: Record<string, number> = {}
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1
  })

  let topItem = ''
  let maxCount = 0

  Object.entries(counts).forEach(([item, count]) => {
    if (count > maxCount) {
      maxCount = count
      topItem = item
    }
  })

  return topItem
}
