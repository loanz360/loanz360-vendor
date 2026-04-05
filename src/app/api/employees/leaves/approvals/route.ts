export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { z, ZodError } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for approval action
const approvalSchema = z.object({
  request_id: z.string().uuid({ message: 'Invalid request ID' }),
  action: z.enum(['approve', 'reject'], { errorMap: () => ({ message: 'Action must be approve or reject' }) }),
  comments: z.string().min(1, 'Comments are required').max(500, 'Comments too long').optional()
})

// Helper function to sanitize input
function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
}

// GET - Fetch pending approvals for current user (manager/HR)
// Note: Does not use checkHRAccess() — this endpoint serves both HR and direct managers/approvers
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const view = searchParams.get('view') || 'my_approvals' // 'my_approvals' or 'all_requests'

    // Get user's role to determine access
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = userData?.sub_role === 'hr_executive' || userData?.sub_role === 'hr_manager'
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN'

    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        leave_types (
          id,
          name,
          color,
          max_days_per_request
        ),
        users!leave_requests_user_id_fkey (
          id,
          full_name,
          email,
          sub_role,
          department
        )
      `)
      .order('applied_at', { ascending: false })

    if (view === 'my_approvals') {
      // Show only requests where current user is the approver
      query = query.eq('current_approver', user.id)
    } else if (view === 'all_requests') {
      // HR and Super Admin can see all requests
      if (!isHR && !isSuperAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions',
            errorCode: 'FORBIDDEN'
          },
          { status: 403 }
        )
      }
      // No filter - show all requests
    } else {
      // Default to my_approvals
      query = query.eq('current_approver', user.id)
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status)
    }

    const { data: requests, error } = await query

    if (error) {
      throw error
    }

    // Get summary counts
    const { count: pendingCount } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('current_approver', user.id)
      .eq('status', 'pending')

    const { count: approvedCount } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('current_approver', user.id)
      .eq('status', 'approved')

    const { count: rejectedCount } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('current_approver', user.id)
      .eq('status', 'rejected')

    return NextResponse.json({
      success: true,
      data: requests || [],
      summary: {
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        total: (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Fetch approvals error', error)
    logApiError(error as Error, request, { action: 'get_approvals' })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch approvals',
        errorCode: 'FETCH_FAILED'
      },
      { status: 500 }
    )
  }
}

// POST - Approve or reject a leave request
export async function POST(request: NextRequest) {
  try {
    // Apply CSRF protection
    const csrfResponse = await csrfProtection(request)
    if (csrfResponse) return csrfResponse

    // Apply rate limiting
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.DEFAULT,
    maxRequests: 30, // Max 30 approval actions per hour
    windowMs: 60 * 60 * 1000
  })
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate with Zod
    const validatedData = approvalSchema.parse(body)

    // Sanitize comments if provided
    const sanitizedComments = validatedData.comments
      ? sanitizeInput(validatedData.comments)
      : null

    // Fetch leave request details
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*, users!leave_requests_user_id_fkey(full_name, email, reports_to, department)')
      .eq('id', validatedData.request_id)
      .maybeSingle()

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Leave request not found',
          errorCode: 'NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // === VALIDATION 1: Check if user is authorized to approve ===
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = userData?.sub_role === 'hr_executive' || userData?.sub_role === 'hr_manager'
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN'
    const isCurrentApprover = leaveRequest.current_approver === user.id

    if (!isCurrentApprover && !isHR && !isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to approve this request',
          errorCode: 'NOT_AUTHORIZED'
        },
        { status: 403 }
      )
    }

    // === VALIDATION: Prevent self-approval ===
    if (leaveRequest.user_id === user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You cannot approve or reject your own leave request',
          errorCode: 'SELF_APPROVAL_DENIED'
        },
        { status: 403 }
      )
    }

    // === VALIDATION 2: Check if request is still pending ===
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `This request is already ${leaveRequest.status}`,
          errorCode: 'INVALID_STATUS'
        },
        { status: 400 }
      )
    }

    // === VALIDATION 3: If approving, verify leave balance is still available ===
    if (validatedData.action === 'approve') {
      const year = new Date(leaveRequest.from_date).getFullYear()

      const { data: balance } = await supabase
        .from('leave_balance')
        .select('available, reserved')
        .eq('user_id', leaveRequest.user_id)
        .eq('leave_type_id', leaveRequest.leave_type_id)
        .eq('year', year)
        .maybeSingle()

      if (!balance || parseFloat(balance.reserved) < leaveRequest.total_days) {
        return NextResponse.json(
          {
            success: false,
            error: 'Leave balance no longer available for approval',
            errorCode: 'BALANCE_UNAVAILABLE'
          },
          { status: 400 }
        )
      }
    }

    // === PERFORM APPROVAL/REJECTION ===
    const now = new Date().toISOString()
    const updateData: Record<string, string | null> = {
      status: validatedData.action === 'approve' ? 'approved' : 'rejected',
      approver_comments: sanitizedComments,
      approved_by: user.id,
      approved_at: now,
      updated_at: now,
      current_approver: null
    }

    // Update leave request
    const { data: updatedRequest, error: updateError } = await supabase
      .from('leave_requests')
      .update(updateData)
      .eq('id', validatedData.request_id)
      .select(`
        *,
        leave_types (
          name,
          color
        ),
        users!leave_requests_user_id_fkey (
          full_name,
          email
        )
      `)
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // === UPDATE LEAVE BALANCE ===
    if (validatedData.action === 'approve') {
      // Approve: Convert reserved to used
      const year = new Date(leaveRequest.from_date).getFullYear()

      try {
        await supabase.rpc('approve_leave_balance', {
          p_user_id: leaveRequest.user_id,
          p_leave_type_id: leaveRequest.leave_type_id,
          p_year: year,
          p_days: leaveRequest.total_days
        })
      } catch (rpcErr) {
        apiLogger.warn('RPC approve_leave_balance failed, attempting manual fallback', { error: rpcErr, requestId: validatedData.request_id })
        try {
          await supabase
            .from('leave_balance')
            .update({
              reserved: supabase.sql`GREATEST(0, reserved - ${leaveRequest.total_days})`,
              used: supabase.sql`used + ${leaveRequest.total_days}`,
              available: supabase.sql`total - (used + ${leaveRequest.total_days})`,
              updated_at: now
            })
            .eq('user_id', leaveRequest.user_id)
            .eq('leave_type_id', leaveRequest.leave_type_id)
            .eq('year', year)
          apiLogger.info('Manual balance update successful', { requestId: validatedData.request_id })
        } catch (fallbackErr) {
          apiLogger.error('Manual balance update also failed', { error: fallbackErr, requestId: validatedData.request_id, userId: leaveRequest.user_id })
        }
      }
    } else {
      // Reject: Return reserved balance
      await supabase.rpc('return_leave_balance', {
        p_leave_request_id: validatedData.request_id
      }).catch(err => {
        apiLogger.error('Failed to return balance on rejection', err)
      })
    }

    // Log action
    apiLogger.info(`Leave request ${validatedData.action}d`, { requestId: validatedData.request_id, approvedBy: user.id })

    // Send notification to employee about leave approval/rejection
    try {
      const actionLabel = validatedData.action === 'approve' ? 'approved' : 'rejected'
      const leaveTypeName = updatedRequest?.leave_types?.name || 'Leave'
      const employeeName = updatedRequest?.users?.full_name || 'Employee'

      await supabase
        .from('notifications')
        .insert({
          user_id: leaveRequest.user_id,
          type: `leave_${actionLabel}`,
          title: `Leave Request ${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}`,
          message: `Your ${leaveTypeName} request from ${leaveRequest.from_date} to ${leaveRequest.to_date} has been ${actionLabel}.${sanitizedComments ? ` Comments: ${sanitizedComments}` : ''}`,
          metadata: {
            leave_request_id: validatedData.request_id,
            action: validatedData.action,
            leave_type: leaveTypeName,
            from_date: leaveRequest.from_date,
            to_date: leaveRequest.to_date,
            approved_by: user.id,
            comments: sanitizedComments
          },
          is_read: false
        })
    } catch (notifError) {
      apiLogger.error('Failed to send leave notification', notifError)
      // Non-blocking: don't fail the approval if notification fails
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `Leave request ${validatedData.action}d successfully`
    }, { status: 200 })

  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          errorCode: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Approval action error', error)
    logApiError(error as Error, request, { action: 'approval_action' })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        errorCode: 'APPROVAL_FAILED'
      },
      { status: 500 }
    )
  }
}
