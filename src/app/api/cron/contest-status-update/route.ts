import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/cron/contest-status-update
 * Auto-update contest statuses based on dates
 * Cron Job: Runs daily at midnight
 *
 * This endpoint should be called by Vercel Cron or similar scheduling service
 * Moves contests from scheduled → active or active → expired based on dates
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron job attempt - invalid secret')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Call the database function to update statuses
    const { error: updateError } = await supabase.rpc('update_contest_status')

    if (updateError) {
      logger.error('Error updating contest statuses', updateError)
      throw updateError
    }

    // Get counts of updated contests
    const { data: activeContests } = await supabase
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    const { data: expiredContests } = await supabase
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'expired')

    logger.info('Contest status update completed', {
      active_count: activeContests || 0,
      expired_count: expiredContests || 0,
    })

    return NextResponse.json({
      success: true,
      message: 'Contest statuses updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error in GET /api/cron/contest-status-update', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to update contest statuses',
    }, { status: 500 })
  }
}

// Disable body parsing for cron routes
export const runtime = 'nodejs'
