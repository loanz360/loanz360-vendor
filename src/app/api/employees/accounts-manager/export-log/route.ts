import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

const DAILY_EXPORT_LIMIT = 10

/** Get IST date string (YYYY-MM-DD) */
function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

/**
 * GET /api/employees/accounts-manager/export-log
 * Returns recent export activity and daily usage for the authenticated user.
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

    // Verify user is ACCOUNTS_MANAGER or SUPER_ADMIN
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const isSuperAdmin = userData.role === 'SUPER_ADMIN'
    const isAccountsManager =
      userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER'

    if (!isSuperAdmin && !isAccountsManager) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Accounts Manager only.' },
        { status: 403 }
      )
    }

    const todayIST = getISTDate()
    let exports: Array<{
      id: string
      user_id: string
      user_name: string
      export_type: string
      file_name: string
      record_count: number
      exported_at: string
    }> = []
    let dailyUsed = 0

    try {
      // Fetch recent exports (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: exportData, error: exportError } = await supabase
        .from('export_logs')
        .select('id, user_id, export_type, file_name, record_count, exported_at, users!inner(full_name)')
        .eq('user_id', user.id)
        .gte('exported_at', thirtyDaysAgo.toISOString())
        .order('exported_at', { ascending: false })
        .limit(50)

      if (!exportError && exportData) {
        exports = exportData.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          user_id: row.user_id as string,
          user_name: (row.users as Record<string, unknown>)?.full_name as string || userData.full_name || 'Unknown',
          export_type: row.export_type as string,
          file_name: row.file_name as string,
          record_count: row.record_count as number,
          exported_at: row.exported_at as string,
        }))
      }

      // Count today's exports
      const { count, error: countError } = await supabase
        .from('export_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('exported_at', `${todayIST}T00:00:00+05:30`)

      if (!countError && count !== null) {
        dailyUsed = count
      }
    } catch {
      // Table may not exist yet - return empty data
      apiLogger.info('export_logs table not found, returning empty data')
    }

    return NextResponse.json({
      success: true,
      data: {
        exports,
        daily_limit: isSuperAdmin ? 999 : DAILY_EXPORT_LIMIT,
        daily_used: dailyUsed,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Fetch export log error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch export logs' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/accounts-manager/export-log
 * Log an export event and enforce daily export limit.
 */
export async function POST(request: NextRequest) {
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

    // Verify user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const isSuperAdmin = userData.role === 'SUPER_ADMIN'
    const isAccountsManager =
      userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER'

    if (!isSuperAdmin && !isAccountsManager) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Accounts Manager only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { export_type, file_name, record_count } = body

    // Validate required fields
    if (!export_type || typeof export_type !== 'string') {
      return NextResponse.json(
        { success: false, error: 'export_type is required and must be a string' },
        { status: 400 }
      )
    }

    if (!file_name || typeof file_name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'file_name is required and must be a string' },
        { status: 400 }
      )
    }

    if (record_count === undefined || typeof record_count !== 'number' || record_count < 0) {
      return NextResponse.json(
        { success: false, error: 'record_count is required and must be a non-negative number' },
        { status: 400 }
      )
    }

    const todayIST = getISTDate()
    const effectiveLimit = isSuperAdmin ? 999 : DAILY_EXPORT_LIMIT

    // Check daily export limit
    let dailyUsed = 0
    try {
      const { count, error: countError } = await supabase
        .from('export_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('exported_at', `${todayIST}T00:00:00+05:30`)

      if (!countError && count !== null) {
        dailyUsed = count
      }

      if (dailyUsed >= effectiveLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily export limit reached (${effectiveLimit} exports per day). Try again tomorrow.`,
            code: 'EXPORT_LIMIT_EXCEEDED',
            data: { daily_limit: effectiveLimit, daily_used: dailyUsed, remaining: 0 },
          },
          { status: 429 }
        )
      }

      // Insert the export log record
      const { error: insertError } = await supabase
        .from('export_logs')
        .insert({
          user_id: user.id,
          export_type,
          file_name,
          record_count,
          exported_at: new Date().toISOString(),
        })

      if (insertError) {
        // If table doesn't exist, log but don't block the export
        if (insertError.code === '42P01') {
          apiLogger.info('export_logs table not found, skipping log insert')
          return NextResponse.json({
            success: true,
            data: { remaining: effectiveLimit - dailyUsed - 1 },
            message: 'Export logged (table not yet created)',
          })
        }
        throw insertError
      }
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError)
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: { remaining: effectiveLimit },
          message: 'Export logged (table not yet created)',
        })
      }
      throw dbError
    }

    return NextResponse.json({
      success: true,
      data: { remaining: effectiveLimit - dailyUsed - 1 },
      message: 'Export logged successfully',
    })
  } catch (error: unknown) {
    apiLogger.error('Log export error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to log export' },
      { status: 500 }
    )
  }
}
