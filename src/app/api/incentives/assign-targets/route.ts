
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import logger from '@/lib/monitoring/logger'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'

/**
 * POST /api/incentives/assign-targets
 * Assign targets to specific employees
 * Access: SuperAdmin, HR
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling (supports super_admin_session cookie)
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    // Check if user is SuperAdmin, HR, or Admin
    const isSuperAdmin = auth.role === 'SUPER_ADMIN'
    const isHR = auth.role === 'HR'
    const isAdmin = auth.role === 'ADMIN'

    if (!isSuperAdmin && !isHR && !isAdmin) {
      return NextResponse.json(
        { error: 'Only SuperAdmin, Admin, or HR can assign targets' },
        { status: 403 }
      )
    }

    // Use admin client for database operations
    const supabase = createSupabaseAdmin()

    const body = await request.json()
    const { incentive_id, employee_ids, target_value, custom_reward } = body

    if (!incentive_id) {
      return NextResponse.json(
        { error: 'incentive_id is required' },
        { status: 400 }
      )
    }

    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return NextResponse.json(
        { error: 'employee_ids array is required' },
        { status: 400 }
      )
    }

    // Verify incentive exists
    const { data: incentive, error: incentiveError } = await supabase
      .from('incentives')
      .select('*')
      .eq('id', incentive_id)
      .maybeSingle()

    if (incentiveError || !incentive) {
      return NextResponse.json(
        { error: 'Incentive not found' },
        { status: 404 }
      )
    }

    // Get target value from incentive if not provided
    const finalTargetValue = target_value ||
      incentive.performance_criteria?.target_value ||
      100

    // Prepare allocations
    const allocations = employee_ids.map((empId: string) => ({
      incentive_id,
      user_id: empId,
      is_eligible: true,
      eligibility_checked_at: new Date().toISOString(),
      allocation_status: 'eligible',
      progress_percentage: 0,
      earned_amount: 0,
      current_progress: {
        metric_value: 0,
        target_value: finalTargetValue,
        custom_target: target_value ? true : false,
        custom_reward: custom_reward || null
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Upsert allocations (update if exists, insert if not)
    const { data: result, error: upsertError } = await supabase
      .from('incentive_allocations')
      .upsert(allocations, {
        onConflict: 'incentive_id,user_id',
        ignoreDuplicates: false
      })
      .select()

    if (upsertError) {
      logger.error('Error assigning targets', { error: upsertError })
      return NextResponse.json(
        { error: 'Failed to assign targets' },
        { status: 500 }
      )
    }

    logger.info('Targets assigned successfully', {
      incentive_id,
      employee_count: employee_ids.length,
      assigned_by: auth.userId
    })

    return NextResponse.json({
      success: true,
      message: `Successfully assigned targets to ${employee_ids.length} employee(s)`,
      data: {
        allocated_count: employee_ids.length,
        incentive_id,
        target_value: finalTargetValue
      }
    })

  } catch (error) {
    logger.error('Error in POST /api/incentives/assign-targets', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to assign targets' },
      { status: 500 }
    )
  }
}
