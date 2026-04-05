export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can view late coming reports' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const employeeId = searchParams.get('employee_id')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = (page - 1) * limit

    // IST offset: UTC+5:30
    // When checking late detection times, we interpret check-in times in IST
    const IST_OFFSET_HOURS = 5.5

    // Build query for late coming summary
    let query = adminClient
      .from('late_coming_summary')
      .select('*')
      .order('total_late_days', { ascending: false })

    // Filter by month/year
    if (month && year) {
      // month is 0-indexed from frontend (JS Date convention)
      const monthDate = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`
      query = query.eq('month', monthDate)
    }

    // Filter by employee
    if (employeeId) {
      query = query.eq('user_id', employeeId)
    }

    const { data: summary, error: summaryError } = await query

    if (summaryError) throw summaryError

    // Get total count for details pagination
    let countQuery = adminClient
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('is_late', true)

    if (month && year) {
      const monthNum = parseInt(month)
      const yearNum = parseInt(year)
      const startDate = new Date(yearNum, monthNum, 1).toISOString().split('T')[0]
      const endDate = new Date(yearNum, monthNum + 1, 0).toISOString().split('T')[0]
      countQuery = countQuery.gte('date', startDate).lte('date', endDate)
    }

    if (employeeId) {
      countQuery = countQuery.eq('user_id', employeeId)
    }

    const { count: totalDetailCount } = await countQuery

    // Get detailed late coming records with pagination
    let detailQuery = adminClient
      .from('attendance')
      .select(`
        *,
        employee_profile!attendance_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          department,
          designation
        )
      `)
      .eq('is_late', true)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (month && year) {
      const monthNum = parseInt(month)
      const yearNum = parseInt(year)
      const startDate = new Date(yearNum, monthNum, 1).toISOString().split('T')[0]
      const endDate = new Date(yearNum, monthNum + 1, 0).toISOString().split('T')[0]
      detailQuery = detailQuery.gte('date', startDate).lte('date', endDate)
    }

    if (employeeId) {
      detailQuery = detailQuery.eq('user_id', employeeId)
    }

    const { data: details, error: detailError } = await detailQuery

    if (detailError) throw detailError

    // Convert check-in times to IST for display and add IST late detection info
    const detailsWithIST = (details || []).map((record: Record<string, unknown>) => {
      let checkInIST = null
      if (record.check_in_time && typeof record.check_in_time === 'string') {
        const utcDate = new Date(record.check_in_time)
        const istDate = new Date(utcDate.getTime() + IST_OFFSET_HOURS * 60 * 60 * 1000)
        checkInIST = istDate.toISOString().replace('Z', '+05:30')
      }
      return {
        ...record,
        check_in_time_ist: checkInIST,
        timezone: 'IST'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        summary: summary || [],
        details: detailsWithIST
      },
      meta: {
        page,
        limit,
        total: totalDetailCount ?? 0,
        totalPages: Math.ceil((totalDetailCount ?? 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Fetch late coming report error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch late coming report' },
      { status: 500 }
    )
  }
}
