import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * API Routes for Incentive Progress Tracking
 *
 * GET    /api/incentives/progress?userId={id} - Get progress for user
 * POST   /api/incentives/progress              - Manual progress update
 * POST   /api/incentives/progress/sync         - Trigger sync from leads
 * POST   /api/incentives/progress/bulk         - Bulk progress updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  updateProgress,
  syncProgressFromLeads,
  bulkUpdateProgress,
  type ProgressUpdate
} from '@/lib/incentives/progress-tracking'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/incentives/progress
 * Get progress history and current status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || user.id
    const allocationId = searchParams.get('allocationId')
    const includeHistory = searchParams.get('includeHistory') === 'true'

    // Check if user can view this data
    // Check both profiles table (for SUPER_ADMIN) and employees table (for HR roles)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: employeeData } = await supabase
      .from('employees')
      .select('sub_role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isSuperAdmin = profileData?.role === 'SUPER_ADMIN'
    const isHRStaff = employeeData?.sub_role === 'HR_MANAGER' || employeeData?.sub_role === 'HR_EXECUTIVE'
    const canViewOthers = isSuperAdmin || isHRStaff

    if (userId !== user.id && !canViewOthers) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get allocations with progress
    let query = supabase
      .from('incentive_allocations')
      .select(`
        *,
        incentive:incentives (
          id,
          name,
          description,
          type,
          status,
          reward_amount,
          reward_type,
          performance_criteria,
          start_date,
          end_date
        )
      `)
      .eq('user_id', userId)

    if (allocationId) {
      query = query.eq('id', allocationId)
    }

    const { data: allocations, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Get progress history if requested
    let history = null
    if (includeHistory) {
      const allocationIds = allocations.map((a) => a.id)
      const { data: historyData } = await supabase
        .from('progress_history')
        .select('*')
        .in('allocation_id', allocationIds)
        .order('updated_at', { ascending: false })
        .limit(100)

      history = historyData
    }

    return NextResponse.json({
      success: true,
      allocations,
      history
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching progress', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/incentives/progress
 * Manual progress update
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      userId: z.string().uuid().optional(),


      incentiveId: z.string().uuid().optional(),


      metricType: z.string().optional(),


      currentValue: z.string().optional(),


      targetValue: z.string().optional(),


      metadata: z.record(z.unknown()).optional(),


      reason: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { userId, incentiveId, metricType, currentValue, targetValue, metadata } = body

    // Validate required fields
    if (!userId || !incentiveId || !metricType || currentValue === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, incentiveId, metricType, currentValue' },
        { status: 400 }
      )
    }

    // Check if user can update this data
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: employeeData } = await supabase
      .from('employees')
      .select('sub_role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isSuperAdmin = profileData?.role === 'SUPER_ADMIN'
    const isHRStaff = employeeData?.sub_role === 'HR_MANAGER' || employeeData?.sub_role === 'HR_EXECUTIVE'
    const canUpdateOthers = isSuperAdmin || isHRStaff

    if (userId !== user.id && !canUpdateOthers) {
      return NextResponse.json({ success: false, error: 'Forbidden - cannot update progress for other users' }, { status: 403 })
    }

    // Update progress
    const progressUpdate: ProgressUpdate = {
      userId,
      incentiveId,
      metricType,
      currentValue: parseFloat(currentValue),
      targetValue: parseFloat(targetValue),
      source: 'manual',
      timestamp: new Date(),
      metadata: {
        ...metadata,
        updated_by: user.id,
        update_reason: body.reason || 'Manual update'
      }
    }

    await updateProgress(progressUpdate)

    // Get updated allocation
    const { data: updatedAllocation } = await supabase
      .from('incentive_allocations')
      .select(`
        *,
        incentive:incentives (
          name,
          reward_amount,
          performance_criteria
        )
      `)
      .eq('incentive_id', incentiveId)
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: 'Progress updated successfully',
      allocation: updatedAllocation
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating progress', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
