import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bodySchema = z.object({


      request_id: z.string().uuid().optional(),


      action: z.string().optional(),


      reason: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { request_id, action, reason } = body

    if (!request_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['cancel', 'revoke'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "cancel" or "revoke"' },
        { status: 400 }
      )
    }

    // Get the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle()

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { success: false, error: 'Leave request not found' },
        { status: 404 }
      )
    }

    // Check authorization
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHR = profile && (profile.role === 'hr' || profile.role === 'superadmin')
    const isOwner = leaveRequest.user_id === user.id
    const isSuperior = leaveRequest.current_approver === user.id

    if (action === 'cancel') {
      // Check if date has expired
      const fromDate = new Date(leaveRequest.from_date)
      if (fromDate < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Cannot cancel leave request after start date has passed' },
          { status: 400 }
        )
      }

      // Employee can cancel own pending requests
      // Superior can cancel subordinate's pending/approved requests
      // HR can cancel any request
      if (!isOwner && !isSuperior && !isHR) {
        return NextResponse.json(
          { success: false, error: 'You are not authorized to cancel this request' },
          { status: 403 }
        )
      }

      // Cancel the request
      const { error: cancelError } = await supabase
        .from('leave_requests')
        .update({
          status: 'cancelled',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'Cancelled by user',
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)

      if (cancelError) throw cancelError

      // Return reserved leave balance
      await supabase.rpc('return_leave_balance', {
        p_user_id: leaveRequest.user_id,
        p_leave_type_id: leaveRequest.leave_type_id,
        p_days: leaveRequest.total_days,
        p_year: new Date(leaveRequest.from_date).getFullYear()
      })

      return NextResponse.json({
        success: true,
        message: 'Leave request cancelled successfully'
      })

    } else {
      // Revoke (un-cancel)
      // Only superior or HR can revoke
      if (!isSuperior && !isHR) {
        return NextResponse.json(
          { success: false, error: 'Only superior or HR can revoke cancelled requests' },
          { status: 403 }
        )
      }

      // Check if currently cancelled
      if (leaveRequest.status !== 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'Request is not cancelled' },
          { status: 400 }
        )
      }

      // Revoke and approve
      const { error: revokeError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          revoked_by: user.id,
          revoked_at: new Date().toISOString(),
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id)

      if (revokeError) throw revokeError

      return NextResponse.json({
        success: true,
        message: 'Leave request revoked and approved successfully'
      })
    }

  } catch (error) {
    apiLogger.error('Cancel/Revoke leave request error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
