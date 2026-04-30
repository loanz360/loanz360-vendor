import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { parsePaginationParams, getSupabaseRange, createPaginatedResponse } from '@/lib/utils/pagination'

/**
 * GET /api/incentives/analytics
 * Fetch analytics for an incentive or all incentives
 * Access: SuperAdmin, HR
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

    // Check permissions
    // Check user role from users table (SUPER_ADMIN, ADMIN)
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = userData?.role === 'SUPER_ADMIN' || userData?.role === 'ADMIN'
    const isHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER'].includes(userData?.sub_role || '')

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only SuperAdmin or HR can access analytics' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const incentiveId = searchParams.get('incentive_id')

    if (incentiveId) {
      // Fetch analytics for a specific incentive
      const { data: analytics, error } = await supabase
        .from('incentive_analytics')
        .select(`
          *,
          incentive:incentives(
            id,
            incentive_title,
            incentive_type,
            reward_amount,
            start_date,
            end_date,
            status
          )
        `)
        .eq('incentive_id', incentiveId)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          // Analytics not found, calculate it
          await supabase.rpc('calculate_incentive_analytics', { incentive_uuid: incentiveId })

          // Fetch again
          const { data: newAnalytics, error: retryError } = await supabase
            .from('incentive_analytics')
            .select(`
              *,
              incentive:incentives(
                id,
                incentive_title,
                incentive_type,
                reward_amount,
                start_date,
                end_date,
                status
              )
            `)
            .eq('incentive_id', incentiveId)
            .maybeSingle()

          if (retryError) throw retryError

          return NextResponse.json({
            success: true,
            data: newAnalytics,
          })
        }
        throw error
      }

      // Fetch top performers for this incentive
      const { data: topPerformers, error: performersError } = await supabase
        .from('incentive_allocations')
        .select(`
          id,
          user_id,
          progress_percentage,
          earned_amount,
          allocation_status,
          user:employees!incentive_allocations_user_id_fkey(
            id,
            full_name,
            email,
            sub_role
          )
        `)
        .eq('incentive_id', incentiveId)
        .order('progress_percentage', { ascending: false })
        .limit(10)

      if (performersError) {
        logger.error('Error fetching top performers', performersError)
      }

      return NextResponse.json({
        success: true,
        data: {
          ...analytics,
          top_performers: topPerformers || [],
        },
      })
    } else {
      // Fetch analytics for all incentives (summary view) with pagination
      const { page, limit } = parsePaginationParams(searchParams)
      const [from, to] = getSupabaseRange(page, limit)

      const { data: allAnalytics, error, count } = await supabase
        .from('incentive_analytics')
        .select(`
          *,
          incentive:incentives(
            id,
            incentive_title,
            incentive_type,
            reward_amount,
            start_date,
            end_date,
            status
          )
        `, { count: 'exact' })
        .order('last_calculated_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      // For summary, fetch all records (not just the current page)
      const { data: allForSummary } = await supabase
        .from('incentive_analytics')
        .select('*')

      // Calculate overall summary
      const summary = {
        total_incentives: count || 0,
        total_eligible_users: allForSummary?.reduce((sum, a) => sum + a.total_eligible_users, 0) || 0,
        total_participating_users: allForSummary?.reduce((sum, a) => sum + a.total_participating_users, 0) || 0,
        total_allocated_amount: allForSummary?.reduce((sum, a) => sum + parseFloat(a.total_allocated_amount || 0), 0) || 0,
        total_earned_amount: allForSummary?.reduce((sum, a) => sum + parseFloat(a.total_earned_amount || 0), 0) || 0,
        total_claimed_amount: allForSummary?.reduce((sum, a) => sum + parseFloat(a.total_claimed_amount || 0), 0) || 0,
        total_paid_amount: allForSummary?.reduce((sum, a) => sum + parseFloat(a.total_paid_amount || 0), 0) || 0,
        avg_participation_rate:
          allForSummary && allForSummary.length > 0
            ? allForSummary.reduce((sum, a) => sum + parseFloat(a.participation_rate || 0), 0) / allForSummary.length
            : 0,
        avg_achievement_rate:
          allForSummary && allForSummary.length > 0
            ? allForSummary.reduce((sum, a) => sum + parseFloat(a.achievement_rate || 0), 0) / allForSummary.length
            : 0,
      }

      const response = createPaginatedResponse(allAnalytics || [], page, limit, count || 0)

      return NextResponse.json({
        ...response,
        summary,
      })
    }
  } catch (error) {
    logger.error('Error in GET /api/incentives/analytics', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchIncentiveAnalytics' })
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

/**
 * POST /api/incentives/analytics
 * Manually trigger analytics calculation for an incentive
 * Access: SuperAdmin, HR
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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

    // Check permissions
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
        { error: 'Forbidden: Only SuperAdmin or HR can trigger analytics calculation' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      incentive_id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { incentive_id } = body

    if (!incentive_id) {
      return NextResponse.json({ success: false, error: 'Missing required field: incentive_id' }, { status: 400 })
    }

    // Trigger analytics calculation
    const { error: calcError } = await supabase.rpc('calculate_incentive_analytics', {
      incentive_uuid: incentive_id,
    })

    if (calcError) {
      logger.error('Error calculating analytics', calcError)
      throw calcError
    }

    // Fetch the updated analytics
    const { data: analytics, error: fetchError } = await supabase
      .from('incentive_analytics')
      .select('*')
      .eq('incentive_id', incentive_id)
      .maybeSingle()

    if (fetchError) throw fetchError

    logger.info(`Analytics calculated for incentive ${incentive_id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      data: analytics,
      message: 'Analytics calculated successfully',
    })
  } catch (error) {
    logger.error('Error in POST /api/incentives/analytics', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'calculateIncentiveAnalytics' })
    return NextResponse.json({ success: false, error: 'Failed to calculate analytics' }, { status: 500 })
  }
}
