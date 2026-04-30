
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
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
        { success: false, error: 'Access denied. Only HR and Super Admin can view all employee attendance' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const date = searchParams.get('date')
    const search = searchParams.get('search')
    const department = searchParams.get('department')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100)

    // M3 fix: If search query provided, find matching employee user_ids first
    let matchingUserIds: string[] | null = null
    if (search || department) {
      let empQuery = adminClient
        .from('employee_profile')
        .select('user_id')
      if (search) {
        empQuery = empQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%`)
      }
      if (department) {
        empQuery = empQuery.eq('department', department)
      }
      const { data: matchedEmps } = await empQuery
      matchingUserIds = matchedEmps?.map(e => e.user_id) || []
    }

    const selectQuery = `
        *,
        employee_profile!attendance_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          department,
          designation
        )
      `

    // Build count query in parallel for pagination metadata
    let countQuery = adminClient
      .from('attendance')
      .select('id', { count: 'exact', head: true })

    let query = adminClient
      .from('attendance')
      .select(selectQuery)
      .order('date', { ascending: false })

    // Filter by employee
    if (employeeId) {
      query = query.eq('user_id', employeeId)
      countQuery = countQuery.eq('user_id', employeeId)
    }

    // M3 fix: Filter by search/department matched user_ids
    if (matchingUserIds !== null) {
      if (matchingUserIds.length === 0) {
        // No matching employees - return empty result early
        return NextResponse.json({
          success: true,
          data: [],
          meta: { page, page_size: pageSize, total: 0, total_pages: 0, stats: { totalEmployees: 0, presentToday: 0, absentToday: 0, onLeave: 0 } }
        })
      }
      query = query.in('user_id', matchingUserIds)
      countQuery = countQuery.in('user_id', matchingUserIds)
    }

    // Filter by specific date
    if (date) {
      query = query.eq('date', date)
      countQuery = countQuery.eq('date', date)
    }
    // Filter by month and year
    else if (month && year) {
      const monthNum = parseInt(month)
      const yearNum = parseInt(year)
      if (isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
        return NextResponse.json({ success: false, error: 'Invalid month. Must be 0-11.' }, { status: 400 })
      }
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return NextResponse.json({ success: false, error: 'Invalid year. Must be 2000-2100.' }, { status: 400 })
      }
      const startDate = new Date(yearNum, monthNum, 1).toISOString().split('T')[0]
      const endDate = new Date(yearNum, monthNum + 1, 0).toISOString().split('T')[0]
      query = query.gte('date', startDate).lte('date', endDate)
      countQuery = countQuery.gte('date', startDate).lte('date', endDate)
    }
    // Default to current month
    else {
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      query = query.gte('date', startDate).lte('date', endDate)
      countQuery = countQuery.gte('date', startDate).lte('date', endDate)
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    // Execute both queries in parallel
    const [{ data: attendance, error }, { count }] = await Promise.all([
      query,
      countQuery
    ])

    if (error) {
      throw error
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    // M4 fix: Compute stats from unfiltered data for the current month
    const today = new Date().toISOString().split('T')[0]
    const statsQueries = await Promise.all([
      adminClient.from('employee_profile').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
      adminClient.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'present'),
      adminClient.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'absent'),
      adminClient.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'leave'),
    ])

    const stats = {
      totalEmployees: statsQueries[0].count || 0,
      presentToday: statsQueries[1].count || 0,
      absentToday: statsQueries[2].count || 0,
      onLeave: statsQueries[3].count || 0,
    }

    return NextResponse.json({
      success: true,
      data: attendance || [],
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        stats
      }
    })

  } catch (error) {
    apiLogger.error('Fetch all employee attendance error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employee attendance' },
      { status: 500 }
    )
  }
}
