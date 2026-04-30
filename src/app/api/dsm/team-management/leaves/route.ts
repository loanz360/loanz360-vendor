import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Direct Sales Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'DIRECT_SALES_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get team members
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('reporting_manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    const teamMemberIds = teamMembers?.map((m) => m.id) || []

    // Fetch leave requests from the leave_requests table
    const { data: leaveRequests, error: leavesError } = await supabase
      .from('leave_requests')
      .select('*, users!leave_requests_user_id_fkey(full_name)')
      .in('user_id', teamMemberIds)
      .order('created_at', { ascending: false })

    if (leavesError) {
      apiLogger.error('Error fetching leave requests', leavesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch leave requests' }, { status: 500 })
    }

    // Transform the data
    const leaves = (leaveRequests || []).map((leave: unknown) => ({
      id: leave.id,
      employeeId: leave.user_id,
      employeeName: leave.users?.full_name || 'Unknown',
      leaveType: leave.leave_type || 'casual_leave',
      startDate: leave.start_date,
      endDate: leave.end_date,
      totalDays: leave.total_days || calculateDays(leave.start_date, leave.end_date),
      reason: leave.reason || 'No reason provided',
      status: leave.status || 'pending',
      appliedDate: leave.created_at,
      managerComments: leave.manager_comments,
    }))

    return NextResponse.json({ success: true, data: { leaves } })
  } catch (error: unknown) {
    apiLogger.error('Error in leaves API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function calculateDays(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

