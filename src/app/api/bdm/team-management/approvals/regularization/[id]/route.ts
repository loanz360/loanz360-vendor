import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/bdm/team-management/approvals/regularization/[id]
 * Approve or Reject an attendance regularization request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: regularizationId } = params
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action, rejectionReason } = body // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json({ success: false, error: 'Rejection reason is required when rejecting' }, { status: 400 })
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

    // Get the regularization request
    const { data: regRequest, error: regError } = await supabase
      .from('attendance_regularization_requests')
      .select('*, users!attendance_regularization_requests_user_id_fkey(full_name, manager_id)')
      .eq('id', regularizationId)
      .maybeSingle()

    if (regError || !regRequest) {
      return NextResponse.json({ success: false, error: 'Regularization request not found' }, { status: 404 })
    }

    // Verify that the BDE reports to this BDM
    if (regRequest.users?.manager_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only approve regularization requests for your team members' }, { status: 403 })
    }

    // Check if already processed
    if (regRequest.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Regularization request already ${regRequest.status}` }, { status: 400 })
    }

    // Update regularization request
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const { data: updatedReg, error: updateError } = await supabase
      .from('attendance_regularization_requests')
      .update({
        status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? rejectionReason : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', regularizationId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating regularization request', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update regularization request' }, { status: 500 })
    }

    // Log BDM action
    await supabase.from('bdm_assignment_actions').insert({
      bdm_user_id: user.id,
      action_type: action === 'approve' ? 'approve_regularization' : 'reject_regularization',
      target_bde_user_id: regRequest.user_id,
      old_value: { status: 'pending' },
      new_value: { status: newStatus },
      reason: action === 'reject' ? rejectionReason : 'Approved attendance regularization',
      action_timestamp: new Date().toISOString(),
    })

    // Note: The actual attendance update will be handled by the trigger function
    // defined in the migration script (apply_approved_regularization)

    // Send notification to BDE
    try {
      const { notifyRegularizationApproval, notifyRegularizationRejection } = await import('@/lib/utils/notifications')

      const regularizationDetails = {
        date: regularizationRequest.date,
        reason: regularizationRequest.reason,
        originalStatus: regularizationRequest.attendance_status_on_day,
      }

      if (action === 'approve') {
        await notifyRegularizationApproval(regularizationRequest.user_id, regularizationDetails)
      } else {
        await notifyRegularizationRejection(regularizationRequest.user_id, regularizationDetails, comments || 'No reason provided')
      }
    } catch (notificationError) {
      apiLogger.error('Notification error', notificationError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: `Regularization request ${newStatus} successfully`,
      regularizationRequest: updatedReg,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in regularization approval API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
