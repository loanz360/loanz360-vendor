export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { NextRequest, NextResponse } from 'next/server'
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

    // Check if user is HR or superadmin using shared access check
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can view all leave requests' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const status = searchParams.get('status')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const search = searchParams.get('search')
    const department = searchParams.get('department')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100)

    // M3 fix: If search query or department provided, find matching employee user_ids first
    let matchingUserIds: string[] | null = null
    if (search || department) {
      let empQuery = adminClient
        .from('employee_profile')
        .select('user_id')
      if (search) {
        // M30 fix: Escape special ILIKE characters to prevent search injection
        const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
        empQuery = empQuery.or(`first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,employee_id.ilike.%${escapedSearch}%`)
      }
      if (department) {
        empQuery = empQuery.eq('department', department)
      }
      const { data: matchedEmps } = await empQuery
      matchingUserIds = matchedEmps?.map(e => e.user_id) || []
    }

    let countQuery = adminClient
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })

    let query = adminClient
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
      .order('created_at', { ascending: false })

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
          meta: { page, page_size: pageSize, total: 0, total_pages: 0, pendingLeaveRequests: 0 }
        })
      }
      query = query.in('user_id', matchingUserIds)
      countQuery = countQuery.in('user_id', matchingUserIds)
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
      countQuery = countQuery.eq('status', status)
    }

    // Filter by month and year
    if (month && year) {
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
      // Use overlapping range: leave starts before month ends AND leave ends after month starts
      // This ensures leaves spanning month boundaries appear in both months
      query = query.lte('from_date', endDate).gte('to_date', startDate)
      countQuery = countQuery.lte('from_date', endDate).gte('to_date', startDate)
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const [{ data: requests, error }, { count }] = await Promise.all([
      query,
      countQuery
    ])

    if (error) {
      throw error
    }

    const total = count || 0

    // M4 fix: Get total pending leave requests count (unfiltered)
    const { count: pendingCount } = await adminClient
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    return NextResponse.json({
      success: true,
      data: requests || [],
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
        pendingLeaveRequests: pendingCount || 0
      }
    })

  } catch (error) {
    apiLogger.error('Fetch all leave requests error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leave requests' },
      { status: 500 }
    )
  }
}

// PATCH - Approve or reject a leave request
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // HR access check (using shared utility)
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      )
    }

    // Parse and validate body
    const body = await request.json()
    const { id, action, remarks } = body

    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: id and action (approve/reject) required' },
        { status: 400 }
      )
    }

    // First verify the leave request exists and is in 'pending' status
    const { data: existing, error: fetchError } = await adminClient
      .from('leave_requests')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found' },
        { status: 404 }
      )
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot ${action} a leave request that is already ${existing.status}` },
        { status: 400 }
      )
    }

    // Update leave request status (only if still pending to prevent race conditions)
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const { data: updated, error: updateError } = await adminClient
      .from('leave_requests')
      .update({
        status: newStatus,
        approved_by: user.id,
        reviewer_remarks: remarks || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*, leave_types(name)')
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Leave request update error', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update leave request' },
        { status: 500 }
      )
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Leave request was already processed by another user' },
        { status: 409 }
      )
    }

    // If approved, deduct from leave balance
    if (action === 'approve') {
      try {
        const totalDays = updated.total_days || 1
        const { error: rpcError } = await adminClient.rpc('deduct_leave_balance', {
          p_user_id: updated.user_id,
          p_leave_type_id: updated.leave_type_id,
          p_days: totalDays
        })
        if (rpcError) throw rpcError
      } catch (balanceErr) {
        // H7 fix: Balance deduction failed - revert approval back to pending
        apiLogger.error('CRITICAL: Leave balance deduction failed after approval, reverting to pending', {
          leaveRequestId: id,
          userId: updated.user_id,
          totalDays: updated.total_days,
          error: balanceErr
        })

        const { error: revertError } = await adminClient
          .from('leave_requests')
          .update({
            status: 'pending',
            approved_by: null,
            reviewer_remarks: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (revertError) {
          apiLogger.error('CRITICAL: Failed to revert leave approval after balance deduction failure', {
            leaveRequestId: id,
            revertError
          })
        } else {
          apiLogger.info('Leave approval reverted to pending after balance deduction failure', {
            leaveRequestId: id
          })
        }

        return NextResponse.json(
          { success: false, error: 'Failed to deduct leave balance. Approval has been reverted. Please try again.' },
          { status: 500 }
        )
      }
    }

    // Audit log - blocking for critical approve/reject operations
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: action.toUpperCase(),
        entity_type: 'leave_application',
        entity_id: id,
        description: `${action === 'approve' ? 'Approved' : 'Rejected'} leave request`,
      })
    } catch (auditErr) {
      apiLogger.error('Critical audit log failed for leave approval', { id, action, error: auditErr })
    }

    return NextResponse.json({
      success: true,
      message: `Leave request ${newStatus} successfully`,
      data: updated
    })
  } catch (error) {
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('Leave approval/rejection error', { errorId, error })
    logApiError(error as Error, request, { action: 'leave_approval' })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
