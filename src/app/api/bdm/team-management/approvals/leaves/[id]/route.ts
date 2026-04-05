import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bdm/team-management/approvals/leaves/[id]
 * Approve or Reject a leave request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: leaveRequestId } = params
    const body = await request.json()
    const { action, comments } = body // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

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

    // Get the leave request
    const { data: leaveRequest, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*, users!leave_requests_user_id_fkey(full_name, manager_id)')
      .eq('id', leaveRequestId)
      .maybeSingle()

    if (leaveError || !leaveRequest) {
      return NextResponse.json({ success: false, error: 'Leave request not found' }, { status: 404 })
    }

    // Verify that the BDE reports to this BDM
    if (leaveRequest.users?.manager_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only approve leave requests for your team members' }, { status: 403 })
    }

    // Check if already processed
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Leave request already ${leaveRequest.status}` }, { status: 400 })
    }

    // Update leave request
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const { data: updatedLeave, error: updateError } = await supabase
      .from('leave_requests')
      .update({
        status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        manager_comments: comments || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaveRequestId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating leave request', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update leave request' }, { status: 500 })
    }

    // Log BDM action
    await supabase.from('bdm_assignment_actions').insert({
      bdm_user_id: user.id,
      action_type: action === 'approve' ? 'approve_leave' : 'reject_leave',
      target_bde_user_id: leaveRequest.user_id,
      old_value: { status: 'pending' },
      new_value: { status: newStatus },
      reason: comments || `${action === 'approve' ? 'Approved' : 'Rejected'} leave request`,
      action_timestamp: new Date().toISOString(),
    })

    // Send notification to BDE
    try {
      const { notifyLeaveApproval, notifyLeaveRejection } = await import('@/lib/utils/notifications')

      const leaveDetails = {
        startDate: leaveRequest.start_date,
        endDate: leaveRequest.end_date,
        leaveType: leaveRequest.leave_type,
        duration: leaveRequest.duration_days,
      }

      if (action === 'approve') {
        await notifyLeaveApproval(leaveRequest.user_id, leaveDetails)

        // If approved, update BDE assignment status to on_leave
        if (leaveRequest.start_date <= new Date().toISOString() && leaveRequest.end_date >= new Date().toISOString()) {
          await supabase
            .from('bde_assignment_settings')
            .update({
              assignment_status: 'on_leave',
              is_active_for_assignment: false,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', leaveRequest.user_id)
        }
      } else {
        await notifyLeaveRejection(leaveRequest.user_id, leaveDetails, comments || 'No reason provided')
      }
    } catch (notificationError) {
      apiLogger.error('Notification error', notificationError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: `Leave request ${newStatus} successfully`,
      leaveRequest: updatedLeave,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in leave approval API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
