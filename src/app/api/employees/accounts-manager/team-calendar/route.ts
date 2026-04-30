import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/accounts-manager/team-calendar
 * Returns team leave data, holidays, and team members for a given month/year.
 * Query params: month (0-11), year (e.g. 2026)
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

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    const now = new Date()
    const month = monthParam !== null ? parseInt(monthParam, 10) : now.getMonth() // 0-11
    const year = yearParam !== null ? parseInt(yearParam, 10) : now.getFullYear()

    if (isNaN(month) || isNaN(year) || month < 0 || month > 11) {
      return NextResponse.json({ success: false, error: 'Invalid month or year parameter' }, { status: 400 })
    }

    // Calculate date range for the month
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Run all queries in parallel
    const [teamMembersResult, leavesResult, holidaysResult] = await Promise.all([
      // Get team members in accounts department
      supabase
        .from('users')
        .select('id, full_name, sub_role, status')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
        .eq('status', 'active')
        .order('full_name'),

      // Get approved leave requests that overlap with the month
      supabase
        .from('leave_requests')
        .select(`
          id,
          user_id,
          from_date,
          to_date,
          total_days,
          status,
          leave_type_id,
          leave_types ( name, color )
        `)
        .eq('status', 'approved')
        .lte('from_date', monthEnd)
        .gte('to_date', monthStart)
        .in('user_id',
          // We'll filter by team member IDs after fetching them
          // For now fetch all and filter client-side for simplicity
          []
        ),

      // Get holidays for the month
      supabase
        .from('holidays')
        .select('id, name, date, type, is_mandatory')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date'),
    ])

    // Get team member IDs for leave query
    const teamMembers = teamMembersResult.data || []
    const teamMemberIds = teamMembers.map(m => m.id)

    // Re-fetch leaves with correct team member IDs
    let teamLeaves: typeof leavesResult.data = []
    if (teamMemberIds.length > 0) {
      const { data: leavesData, error: leavesError } = await supabase
        .from('leave_requests')
        .select(`
          id,
          user_id,
          from_date,
          to_date,
          total_days,
          status,
          leave_type_id,
          leave_types ( name, color )
        `)
        .eq('status', 'approved')
        .lte('from_date', monthEnd)
        .gte('to_date', monthStart)
        .in('user_id', teamMemberIds)

      if (leavesError) {
        logger.error('Error fetching team leaves', { error: leavesError })
      }
      teamLeaves = leavesData || []
    }

    if (teamMembersResult.error) {
      logger.error('Error fetching team members', { error: teamMembersResult.error })
    }
    if (holidaysResult.error) {
      logger.error('Error fetching holidays', { error: holidaysResult.error })
    }

    return NextResponse.json({
      success: true,
      data: {
        teamLeaves,
        holidays: holidaysResult.data || [],
        teamMembers: teamMembers.map(m => ({
          id: m.id,
          full_name: m.full_name,
          sub_role: m.sub_role,
        })),
        month,
        year,
      },
    })
  } catch (error) {
    logger.error('Team calendar API error', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
