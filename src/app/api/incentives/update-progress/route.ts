import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'

/**
 * POST /api/incentives/update-progress
 * Update progress for a user's incentive allocation
 * This endpoint is designed to be called by external systems (CRM, Sales tracking, etc.)
 *
 * Access: System (with API key) or SuperAdmin/HR
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPDATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Check API key authentication (for external systems)
    const apiKey = request.headers.get('x-api-key')
    const isSystemRequest = apiKey === process.env.INCENTIVE_API_KEY

    // If not system request, check user authentication
    if (!isSystemRequest) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user is SuperAdmin or HR
      // Check user role from users table (SUPER_ADMIN, ADMIN)
      const { data: userData } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      const isSuperAdmin = userData?.role === 'SUPER_ADMIN' || userData?.role === 'ADMIN'
      const isHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER'].includes(userData?.sub_role || '')

      if (!isSuperAdmin && !isHR) {
        return NextResponse.json(
          { error: 'Forbidden: Only SuperAdmin, HR, or system can update progress' },
          { status: 403 }
        )
      }
    }

    const bodySchema = z.object({


      user_id: z.string().uuid().optional(),


      incentive_id: z.string().uuid().optional(),


      metric_name: z.string().optional(),


      metric_value: z.string().optional(),


      notes: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { user_id, incentive_id, metric_name, metric_value, notes } = body

    // Validation
    if (!user_id || !incentive_id || !metric_name || metric_value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, incentive_id, metric_name, metric_value' },
        { status: 400 }
      )
    }

    // Get the incentive to check performance criteria
    const { data: incentive, error: incentiveError } = await supabase
      .from('incentives')
      .select('id, performance_criteria, reward_amount, reward_details')
      .eq('id', incentive_id)
      .maybeSingle()

    if (incentiveError || !incentive) {
      return NextResponse.json({ success: false, error: 'Incentive not found' }, { status: 404 })
    }

    // Get or create allocation
    let { data: allocation, error: allocError } = await supabase
      .from('incentive_allocations')
      .select('*')
      .eq('user_id', user_id)
      .eq('incentive_id', incentive_id)
      .maybeSingle()

    if (allocError && allocError.code === 'PGRST116') {
      // Allocation doesn't exist, create it
      const { data: newAllocation, error: createError } = await supabase
        .from('incentive_allocations')
        .insert({
          user_id,
          incentive_id,
          is_eligible: true,
          allocation_status: 'eligible',
          progress_percentage: 0,
          earned_amount: 0,
        })
        .select()
        .maybeSingle()

      if (createError) {
        logger.error('Error creating allocation', createError)
        throw createError
      }
      allocation = newAllocation
    } else if (allocError) {
      logger.error('Error fetching allocation', allocError)
      throw allocError
    }

    // Calculate progress percentage
    const criteria = incentive.performance_criteria as unknown
    const targetValue = criteria.target_value || 100
    const progressPercentage = Math.min((metric_value / targetValue) * 100, 100)

    // Determine allocation status
    let allocationStatus = allocation.allocation_status
    if (progressPercentage === 0) {
      allocationStatus = 'eligible'
    } else if (progressPercentage >= 100) {
      allocationStatus = 'achieved'
    } else if (progressPercentage >= 50) {
      allocationStatus = 'in_progress'
    } else if (progressPercentage < 50 && progressPercentage > 0) {
      allocationStatus = 'in_progress'
    }

    // Calculate earned amount based on reward structure
    let earnedAmount = 0
    if (progressPercentage >= 100) {
      // Check if tiered rewards
      const rewardDetails = incentive.reward_details as unknown
      if (rewardDetails?.type === 'tiered' && rewardDetails?.slabs) {
        // Find matching slab
        const slab = rewardDetails.slabs.find(
          (s: unknown) => metric_value >= s.min && metric_value <= s.max
        )
        earnedAmount = slab?.amount || incentive.reward_amount || 0
      } else {
        earnedAmount = incentive.reward_amount || 0
      }
    }

    // Update allocation
    const { data: updatedAllocation, error: updateError } = await supabase
      .from('incentive_allocations')
      .update({
        current_progress: {
          [metric_name]: metric_value,
          percentage: progressPercentage,
          last_updated: new Date().toISOString(),
          notes,
        },
        progress_percentage: progressPercentage,
        allocation_status: allocationStatus,
        earned_amount: earnedAmount,
        achieved_at: progressPercentage >= 100 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', allocation.id)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating allocation', updateError)
      throw updateError
    }

    // Insert progress record
    const { error: progressError } = await supabase
      .from('incentive_progress')
      .insert({
        allocation_id: allocation.id,
        user_id,
        incentive_id,
        metric_name,
        metric_value,
        target_value: targetValue,
        progress_percentage: progressPercentage,
        milestone_reached:
          progressPercentage >= 100
            ? '100%'
            : progressPercentage >= 75
              ? '75%'
              : progressPercentage >= 50
                ? '50%'
                : progressPercentage >= 25
                  ? '25%'
                  : null,
        milestone_reward: progressPercentage >= 100 ? earnedAmount : null,
      })

    if (progressError) {
      logger.error('Error inserting progress record', progressError)
      // Don't throw - progress history is not critical
    }

    // Recalculate analytics
    await supabase.rpc('calculate_incentive_analytics', { incentive_uuid: incentive_id })

    logger.info(
      `Progress updated for user ${user_id} on incentive ${incentive_id}: ${progressPercentage}%`
    )

    return NextResponse.json({
      success: true,
      data: {
        allocation: updatedAllocation,
        progress_percentage: progressPercentage,
        allocation_status: allocationStatus,
        earned_amount: earnedAmount,
        milestone_reached:
          progressPercentage >= 100
            ? '100%'
            : progressPercentage >= 75
              ? '75%'
              : progressPercentage >= 50
                ? '50%'
                : progressPercentage >= 25
                  ? '25%'
                  : null,
      },
      message: `Progress updated successfully: ${progressPercentage.toFixed(1)}%`,
    })
  } catch (error) {
    logger.error('Error in POST /api/incentives/update-progress', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'updateProgress' })
    return NextResponse.json({ success: false, error: 'Failed to update progress' }, { status: 500 })
  }
}

/**
 * GET /api/incentives/update-progress
 * Get progress history for a user's allocation
 * Access: User (own data), SuperAdmin/HR (all data)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const incentiveId = searchParams.get('incentive_id')

    // Check permissions
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = employee?.role === 'super_admin'
    const isHR = employee?.role === 'hr'

    // If not admin, can only view own data
    const targetUserId = isSuperAdmin || isHR ? userId || user.id : user.id

    let query = supabase
      .from('incentive_progress')
      .select(
        `
        *,
        incentive:incentives(id, incentive_title, incentive_type),
        allocation:incentive_allocations(id, progress_percentage, allocation_status)
      `
      )
      .eq('user_id', targetUserId)
      .order('recorded_at', { ascending: false })

    if (incentiveId) {
      query = query.eq('incentive_id', incentiveId)
    }

    const { data: progressHistory, error } = await query

    if (error) {
      logger.error('Error fetching progress history', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: progressHistory,
    })
  } catch (error) {
    logger.error('Error in GET /api/incentives/update-progress', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchProgressHistory' })
    return NextResponse.json({ success: false, error: 'Failed to fetch progress history' }, { status: 500 })
  }
}
