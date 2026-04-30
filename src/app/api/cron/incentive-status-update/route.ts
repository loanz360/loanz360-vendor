
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/cron/incentive-status-update
 * Cron job to automatically update incentive statuses
 * Runs daily to expire incentives past their end_date
 *
 * Security: Protected by Vercel Cron Secret or Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Check if request is from Vercel Cron or has valid API key
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron job attempt')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Starting incentive status update cron job')

    const supabase = await createClient()

    // Call the auto-update function
    const { error: updateError } = await supabase.rpc('auto_update_incentive_status')

    if (updateError) {
      logger.error('Error updating incentive status', updateError)
      throw updateError
    }

    // Get counts for logging
    const { data: statusCounts } = await supabase
      .from('incentives')
      .select('status')

    const counts = {
      draft: statusCounts?.filter((i) => i.status === 'draft').length || 0,
      active: statusCounts?.filter((i) => i.status === 'active').length || 0,
      expired: statusCounts?.filter((i) => i.status === 'expired').length || 0,
      disabled: statusCounts?.filter((i) => i.status === 'disabled').length || 0,
    }

    logger.info('Incentive status update completed', counts)

    return NextResponse.json({
      success: true,
      message: 'Incentive statuses updated successfully',
      counts,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error in incentive status update cron', error instanceof Error ? error : undefined)
    return NextResponse.json(
      {
        error: 'Failed to update incentive statuses',
        },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/incentive-status-update
 * Manual trigger for status update (for testing)
 * Requires SuperAdmin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is SuperAdmin
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (employee?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: SuperAdmin access required' }, { status: 403 })
    }

    // Trigger the update
    return GET(request)
  } catch (error) {
    logger.error('Error in manual status update', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to trigger status update' }, { status: 500 })
  }
}
