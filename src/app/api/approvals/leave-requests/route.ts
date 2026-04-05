export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// Get pending approvals for current user (manager or HR)
export async function GET(request: Request) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get leave requests where current user is the approver
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        leave_types (name, color),
        employee_profile!leave_requests_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          department,
          designation
        )
      `)
      .eq('current_approver', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: requests || []
    })

  } catch (error) {
    apiLogger.error('Fetch pending leave approvals error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending approvals' },
      { status: 500 }
    )
  }
}

// Approve or reject leave request
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { request_id, action, rejection_reason } = body

    if (!request_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Get the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*, approval_chain')
      .eq('id', request_id)
      .maybeSingle()

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found' },
        { status: 404 }
      )
    }

    // Check if current user is authorized to approve/reject
    if (leaveRequest.current_approver !== user.id) {
      // Check if user is HR or superadmin (can override)
      const { data: profile } = await supabase
        .from('employee_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
        return NextResponse.json(
          { success: false, error: 'You are not authorized to process this request' },
          { status: 403 }
        )
      }
    }

    if (action === 'approve') {
      // Superior is the final approver - no chain forwarding
      // Direct approval
      const { error: approveError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)

      if (approveError) throw approveError

      // Send email notification to employee
      try {
        const { data: employeeData } = await supabase
          .from('employee_profile')
          .select('first_name, last_name, user:user_id(email)')
          .eq('user_id', leaveRequest.user_id)
          .maybeSingle()

        const { data: approverData } = await supabase
          .from('employee_profile')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle()

        const { data: leaveTypeData } = await supabase
          .from('leave_types')
          .select('name')
          .eq('id', leaveRequest.leave_type_id)
          .maybeSingle()

        if (employeeData?.user?.email) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'leave-notification',
              data: {
                to: employeeData.user.email,
                employeeName: `${employeeData.first_name} ${employeeData.last_name}`,
                leaveType: leaveTypeData?.name || 'Leave',
                fromDate: new Date(leaveRequest.from_date).toLocaleDateString(),
                toDate: new Date(leaveRequest.to_date).toLocaleDateString(),
                totalDays: leaveRequest.total_days,
                status: 'approved',
                approverName: `${approverData?.first_name} ${approverData?.last_name}`,
                actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/employees/attendance`
              }
            })
          }).catch(err => apiLogger.error('Failed to send email', err))
        }
      } catch (emailError) {
        apiLogger.error('Email notification error', emailError)
    logApiError(error as Error, request, { action: 'get' })
        // Continue even if email fails
      }

      return NextResponse.json({
        success: true,
        message: 'Leave request approved successfully'
      })

    } else {
      // Reject
      if (!rejection_reason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required' },
          { status: 400 }
        )
      }

      const { error: rejectError } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)

      if (rejectError) throw rejectError

      // Send email notification to employee
      try {
        const { data: employeeData } = await supabase
          .from('employee_profile')
          .select('first_name, last_name, user:user_id(email)')
          .eq('user_id', leaveRequest.user_id)
          .maybeSingle()

        const { data: approverData } = await supabase
          .from('employee_profile')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle()

        const { data: leaveTypeData } = await supabase
          .from('leave_types')
          .select('name')
          .eq('id', leaveRequest.leave_type_id)
          .maybeSingle()

        if (employeeData?.user?.email) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'leave-notification',
              data: {
                to: employeeData.user.email,
                employeeName: `${employeeData.first_name} ${employeeData.last_name}`,
                leaveType: leaveTypeData?.name || 'Leave',
                fromDate: new Date(leaveRequest.from_date).toLocaleDateString(),
                toDate: new Date(leaveRequest.to_date).toLocaleDateString(),
                totalDays: leaveRequest.total_days,
                status: 'rejected',
                approverName: `${approverData?.first_name} ${approverData?.last_name}`,
                rejectionReason: rejection_reason,
                actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/employees/attendance`
              }
            })
          }).catch(err => apiLogger.error('Failed to send email', err))
        }
      } catch (emailError) {
        apiLogger.error('Email notification error', emailError)
    logApiError(error as Error, request, { action: 'get' })
        // Continue even if email fails
      }

      return NextResponse.json({
        success: true,
        message: 'Leave request rejected'
      })
    }

  } catch (error) {
    apiLogger.error('Process leave approval error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to process leave request' },
      { status: 500 }
    )
  }
}
