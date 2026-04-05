export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'

/**
 * POST /api/incentives/update-status
 * Manually trigger status update for expired incentives
 * This endpoint calls the auto_update_incentive_status() function
 * Access: SuperAdmin, HR
 *
 * Note: This is typically called by a cron job but can be manually triggered
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
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = employee?.role === 'super_admin'
    const isHR = employee?.role === 'hr'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden: Only SuperAdmin or HR can update incentive status' },
        { status: 403 }
      )
    }

    // Call the database function to auto-update expired incentives
    const { error: updateError } = await supabase.rpc('auto_update_incentive_status')

    if (updateError) {
      logger.error('Error calling auto_update_incentive_status', updateError)
      throw updateError
    }

    // Fetch updated counts
    const { data: statusCounts, error: countError } = await supabase
      .from('incentives')
      .select('status')

    if (countError) {
      logger.error('Error fetching status counts', countError)
    }

    const counts = {
      draft: statusCounts?.filter((i) => i.status === 'draft').length || 0,
      active: statusCounts?.filter((i) => i.status === 'active').length || 0,
      expired: statusCounts?.filter((i) => i.status === 'expired').length || 0,
      disabled: statusCounts?.filter((i) => i.status === 'disabled').length || 0,
    }

    logger.info(`Incentive status updated by ${user.id}. Counts:`, counts)

    return NextResponse.json({
      success: true,
      message: 'Incentive statuses updated successfully',
      data: counts,
    })
  } catch (error) {
    logger.error('Error in POST /api/incentives/update-status', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'updateIncentiveStatus' })
    return NextResponse.json({ success: false, error: 'Failed to update incentive status' }, { status: 500 })
  }
}
