
/**
 * WorkDrive Admin Audit Logs API
 * GET - Get audit logs
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFullAuditLogs, exportAuditLogs, isAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/workdrive/admin/audit
 * Get audit logs
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const userId = searchParams.get('user_id')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resource_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const search = searchParams.get('search')
    const exportFormat = searchParams.get('export')

    // Export as CSV
    if (exportFormat === 'csv') {
      const result = await exportAuditLogs({
        userId: userId || undefined,
        action: action || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })

      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      return new NextResponse(result.csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="workdrive-audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    const result = await getFullAuditLogs({
      page,
      limit,
      userId: userId || undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
      page,
      limit,
    })
  } catch (error) {
    apiLogger.error('Get audit logs error', error)
    return NextResponse.json(
      { error: 'Failed to get audit logs' },
      { status: 500 }
    )
  }
}
