
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'

/**
 * GET /api/incentives/[id]
 * Fetch a single incentive by ID
 * Access: SuperAdmin, HR, or eligible employees
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { id: incentiveId } = await params

    // Fetch incentive with all related data
    const { data: incentive, error } = await supabase
      .from('incentives')
      .select(`
        *,
        incentive_target_audience(
          id,
          subrole:incentive_employee_subroles(id, subrole_code, subrole_name)
        ),
        incentive_analytics(*)
      `)
      .eq('id', incentiveId)
      .maybeSingle()

    // Fetch created_by and updated_by user details separately to avoid FK issues
    if (incentive && incentive.created_by) {
      const { data: createdByUser } = await supabase
        .from('employees')
        .select('id, full_name, email')
        .eq('id', incentive.created_by)
        .maybeSingle()
      incentive.created_by_user = createdByUser
    }

    if (incentive && incentive.updated_by) {
      const { data: updatedByUser } = await supabase
        .from('employees')
        .select('id, full_name, email')
        .eq('id', incentive.updated_by)
        .maybeSingle()
      incentive.updated_by_user = updatedByUser
    }

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Incentive not found' }, { status: 404 })
      }
      throw error
    }

    // Check if user has permission to view
    const isSuperAdmin = auth.role === 'SUPER_ADMIN'
    const isHR = auth.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      // Get employee sub_role
      const { data: employee } = await supabase
        .from('employees')
        .select('sub_role')
        .eq('id', auth.userId)
        .maybeSingle()

      // Check if employee is eligible for this incentive
      const isEligible =
        incentive.target_all_employees ||
        incentive.incentive_target_audience.some(
          (ta: any) => ta.subrole?.subrole_code?.toLowerCase() === employee?.sub_role?.toLowerCase()
        )

      if (!isEligible) {
        return NextResponse.json({ success: false, error: 'Forbidden: You are not eligible for this incentive' }, { status: 403 })
      }

      // If employee, also fetch their allocation
      const { data: allocation } = await supabase
        .from('incentive_allocations')
        .select('*')
        .eq('incentive_id', incentiveId)
        .eq('user_id', auth.userId)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        data: {
          ...incentive,
          my_allocation: allocation,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: incentive,
    })
  } catch (error) {
    logger.error('Error in GET /api/incentives/[id]', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchIncentive', incentiveId: params.id })
    return NextResponse.json({ success: false, error: 'Failed to fetch incentive' }, { status: 500 })
  }
}

/**
 * PATCH /api/incentives/[id]
 * Update an existing incentive
 * Access: SuperAdmin, HR
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPDATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    // Check permissions
    const isSuperAdmin = auth.role === 'SUPER_ADMIN'
    const isHR = auth.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only SuperAdmin or HR can update incentives' }, { status: 403 })
    }

    const supabase = createSupabaseAdmin()
    const { id: incentiveId } = await params

    // Check if incentive exists and is not expired
    const { data: existingIncentive, error: fetchError } = await supabase
      .from('incentives')
      .select('status, end_date')
      .eq('id', incentiveId)
      .maybeSingle()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Incentive not found' }, { status: 404 })
      }
      throw fetchError
    }

    // Prevent editing expired incentives
    if (existingIncentive.status === 'expired') {
      return NextResponse.json({ success: false, error: 'Cannot edit expired incentives' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const {
      incentive_title,
      incentive_description,
      incentive_type,
      incentive_image_url,
      reward_amount,
      reward_currency,
      reward_details,
      start_date,
      end_date,
      target_all_employees,
      target_subroles,
      performance_criteria,
      status,
      display_order,
      notify_before_expiry_days,
      is_active,
    } = body

    // Validation for dates
    if (start_date && end_date && new Date(end_date) <= new Date(start_date)) {
      return NextResponse.json({ success: false, error: 'End date must be after start date' }, { status: 400 })
    }

    // Build update object (only include provided fields)
    const updateData: any = {
      updated_by: auth.userId,
    }

    if (incentive_title !== undefined) updateData.incentive_title = incentive_title
    if (incentive_description !== undefined) updateData.incentive_description = incentive_description
    if (incentive_type !== undefined) updateData.incentive_type = incentive_type
    if (incentive_image_url !== undefined) updateData.incentive_image_url = incentive_image_url
    if (reward_amount !== undefined) updateData.reward_amount = reward_amount
    if (reward_currency !== undefined) updateData.reward_currency = reward_currency
    if (reward_details !== undefined) updateData.reward_details = reward_details
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (target_all_employees !== undefined) updateData.target_all_employees = target_all_employees
    if (performance_criteria !== undefined) updateData.performance_criteria = performance_criteria
    if (status !== undefined) updateData.status = status
    if (display_order !== undefined) updateData.display_order = display_order
    if (notify_before_expiry_days !== undefined) updateData.notify_before_expiry_days = notify_before_expiry_days
    if (is_active !== undefined) updateData.is_active = is_active

    // Update incentive
    const { data: updatedIncentive, error: updateError } = await supabase
      .from('incentives')
      .update(updateData)
      .eq('id', incentiveId)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating incentive', updateError)
      throw updateError
    }

    // Update target audiences if provided
    if (target_subroles !== undefined && !target_all_employees) {
      // Delete existing target audiences
      await supabase
        .from('incentive_target_audience')
        .delete()
        .eq('incentive_id', incentiveId)

      // Insert new target audiences
      if (target_subroles.length > 0) {
        const targetAudiences = target_subroles.map((subrole_id: string) => ({
          incentive_id: incentiveId,
          subrole_id,
        }))

        const { error: audienceError } = await supabase
          .from('incentive_target_audience')
          .insert(targetAudiences)

        if (audienceError) {
          logger.error('Error updating target audiences', audienceError)
          throw audienceError
        }
      }
    }

    logger.info(`Incentive updated: ${incentiveId} by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      data: updatedIncentive,
      message: 'Incentive updated successfully',
    })
  } catch (error) {
    logger.error('Error in PATCH /api/incentives/[id]', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'updateIncentive' })
    return NextResponse.json({ success: false, error: 'Failed to update incentive' }, { status: 500 })
  }
}

/**
 * DELETE /api/incentives/[id]
 * Delete an incentive (soft delete by marking as disabled)
 * Access: SuperAdmin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DELETE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    // Check permissions - only SuperAdmin can delete
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Only SuperAdmin can delete incentives' }, { status: 403 })
    }

    const supabase = createSupabaseAdmin()
    const { id: incentiveId } = await params

    // Check if incentive has any claims
    const { data: claims, error: claimsError } = await supabase
      .from('incentive_claims')
      .select('id')
      .eq('incentive_id', incentiveId)
      .limit(1)

    if (claimsError) throw claimsError

    if (claims && claims.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete incentive with existing claims. Mark as disabled instead.' },
        { status: 400 }
      )
    }

    // Check if incentive has any allocations with progress
    const { data: allocations, error: allocError } = await supabase
      .from('incentive_allocations')
      .select('id')
      .eq('incentive_id', incentiveId)
      .gt('progress_percentage', 0)
      .limit(1)

    if (allocError) throw allocError

    if (allocations && allocations.length > 0) {
      // Soft delete: mark as disabled
      const { error: updateError } = await supabase
        .from('incentives')
        .update({ status: 'disabled', is_active: false, updated_by: auth.userId })
        .eq('id', incentiveId)

      if (updateError) throw updateError

      logger.info(`Incentive soft deleted (disabled): ${incentiveId} by ${auth.userId}`)

      return NextResponse.json({
        success: true,
        message: 'Incentive disabled successfully (has existing progress)',
      })
    }

    // Hard delete if no participation
    const { error: deleteError } = await supabase
      .from('incentives')
      .delete()
      .eq('id', incentiveId)

    if (deleteError) {
      logger.error('Error deleting incentive', deleteError)
      throw deleteError
    }

    logger.info(`Incentive hard deleted: ${incentiveId} by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      message: 'Incentive deleted successfully',
    })
  } catch (error) {
    logger.error('Error in DELETE /api/incentives/[id]', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'deleteIncentive' })
    return NextResponse.json({ success: false, error: 'Failed to delete incentive' }, { status: 500 })
  }
}
