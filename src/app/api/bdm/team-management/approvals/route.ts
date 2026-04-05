import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bdm/team-management/approvals
 * Fetch all pending approvals (leave requests + attendance regularization) for BDM's team
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Filters
    const type = searchParams.get('type') // 'leaves' or 'regularization' or 'all'
    const status = searchParams.get('status') || 'pending' // 'pending', 'approved', 'rejected'
    const bdeId = searchParams.get('bdeId') // Optional: filter by specific BDE

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Business Development Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied. BDM role required.' }, { status: 403 })
    }

    // Get team members (BDEs reporting to this BDM)
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, email, employee_id, avatar_url')
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        leaveRequests: [],
        regularizationRequests: [],
        summary: {
          totalPendingLeaves: 0,
          totalPendingRegularizations: 0,
          totalPending: 0,
        },
      })
    }

    let teamMemberIds = teamMembers.map((m) => m.id)

    // Filter by specific BDE if provided
    if (bdeId) {
      teamMemberIds = teamMemberIds.filter((id) => id === bdeId)
    }

    let leaveRequests: any[] = []
    let regularizationRequests: any[] = []

    // Fetch Leave Requests if type is 'leaves' or 'all'
    if (!type || type === 'all' || type === 'leaves') {
      const { data: leaves, error: leavesError } = await supabase
        .from('leave_requests')
        .select('*, users!leave_requests_user_id_fkey(full_name, email, employee_id, avatar_url)')
        .in('user_id', teamMemberIds)
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (leavesError) {
        apiLogger.error('Error fetching leave requests', leavesError)
      } else {
        leaveRequests = (leaves || []).map((leave: any) => ({
          id: leave.id,
          type: 'leave',
          bdeName: leave.users?.full_name || 'Unknown',
          bdeEmail: leave.users?.email,
          bdeEmployeeId: leave.users?.employee_id,
          bdeAvatarUrl: leave.users?.avatar_url,
          bdeId: leave.user_id,
          leaveType: leave.leave_type,
          startDate: leave.start_date,
          endDate: leave.end_date,
          totalDays: leave.total_days || calculateDays(leave.start_date, leave.end_date),
          reason: leave.reason,
          status: leave.status,
          appliedDate: leave.created_at,
          managerComments: leave.manager_comments,
          approvedAt: leave.approved_at,
          approvedBy: leave.approved_by,
        }))
      }
    }

    // Fetch Attendance Regularization Requests if type is 'regularization' or 'all'
    if (!type || type === 'all' || type === 'regularization') {
      const { data: regularizations, error: regError } = await supabase
        .from('attendance_regularization_requests')
        .select('*, users!attendance_regularization_requests_user_id_fkey(full_name, email, employee_id, avatar_url)')
        .in('user_id', teamMemberIds)
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (regError) {
        apiLogger.error('Error fetching regularization requests', regError)
      } else {
        regularizationRequests = (regularizations || []).map((reg: any) => ({
          id: reg.id,
          type: 'regularization',
          bdeName: reg.users?.full_name || 'Unknown',
          bdeEmail: reg.users?.email,
          bdeEmployeeId: reg.users?.employee_id,
          bdeAvatarUrl: reg.users?.avatar_url,
          bdeId: reg.user_id,
          date: reg.date,
          requestType: reg.request_type,
          proposedCheckIn: reg.proposed_check_in,
          proposedCheckOut: reg.proposed_check_out,
          proposedStatus: reg.proposed_status,
          originalCheckIn: reg.original_check_in,
          originalCheckOut: reg.original_check_out,
          originalStatus: reg.original_status,
          reason: reg.reason,
          supportingDocuments: reg.supporting_documents,
          status: reg.status,
          appliedDate: reg.created_at,
          approvedAt: reg.approved_at,
          approvedBy: reg.approved_by,
          rejectionReason: reg.rejection_reason,
        }))
      }
    }

    // Calculate summary
    const totalPendingLeaves = leaveRequests.filter((r) => r.status === 'pending').length
    const totalPendingRegularizations = regularizationRequests.filter((r) => r.status === 'pending').length

    return NextResponse.json({
      leaveRequests,
      regularizationRequests,
      summary: {
        totalPendingLeaves,
        totalPendingRegularizations,
        totalPending: totalPendingLeaves + totalPendingRegularizations,
        teamSize: teamMembers.length,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in approvals API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to calculate days between dates
function calculateDays(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}
