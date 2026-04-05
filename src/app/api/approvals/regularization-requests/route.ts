export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// Get pending regularization approvals for current user
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

    const { data: requests, error } = await supabase
      .from('attendance_regularization_requests')
      .select(`
        *,
        employee_profile!attendance_regularization_requests_user_id_fkey (
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
    apiLogger.error('Fetch pending regularization approvals error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending approvals' },
      { status: 500 }
    )
  }
}

// Approve or reject regularization request
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
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const { data: regRequest, error: fetchError } = await supabase
      .from('attendance_regularization_requests')
      .select('*, approval_chain')
      .eq('id', request_id)
      .maybeSingle()

    if (fetchError || !regRequest) {
      return NextResponse.json(
        { success: false, error: 'Regularization request not found' },
        { status: 404 }
      )
    }

    if (regRequest.current_approver !== user.id) {
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
      const approvalChain = regRequest.approval_chain as any[]
      const currentLevel = regRequest.approval_level || 0

      if (approvalChain && approvalChain.length > 0) {
        const updatedChain = approvalChain.map((approver, index) => {
          if (index === currentLevel - 1) {
            return { ...approver, status: 'approved', approved_at: new Date().toISOString() }
          }
          return approver
        })

        if (currentLevel < approvalChain.length) {
          const nextApprover = approvalChain[currentLevel]

          const { error: updateError } = await supabase
            .from('attendance_regularization_requests')
            .update({
              current_approver: nextApprover.approver_id,
              approval_level: currentLevel + 1,
              approval_chain: updatedChain,
              updated_at: new Date().toISOString()
            })
            .eq('id', request_id)

          if (updateError) throw updateError

          return NextResponse.json({
            success: true,
            message: 'Request forwarded to next approver',
            next_approver: nextApprover.name
          })
        }
      }

      const { error: approveError } = await supabase
        .from('attendance_regularization_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)

      if (approveError) throw approveError

      return NextResponse.json({
        success: true,
        message: 'Regularization request approved successfully'
      })

    } else {
      if (!rejection_reason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required' },
          { status: 400 }
        )
      }

      const { error: rejectError } = await supabase
        .from('attendance_regularization_requests')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)

      if (rejectError) throw rejectError

      return NextResponse.json({
        success: true,
        message: 'Regularization request rejected'
      })
    }

  } catch (error) {
    apiLogger.error('Process regularization approval error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to process regularization request' },
      { status: 500 }
    )
  }
}
