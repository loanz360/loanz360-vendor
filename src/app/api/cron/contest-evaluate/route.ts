import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/cron/contest-evaluate
 * Auto-evaluate active contests and update rankings
 * Cron Job: Runs every 6 hours
 *
 * This endpoint should be called by Vercel Cron or similar scheduling service
 * Evaluates all active contests with auto_evaluate enabled
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron job attempt - invalid secret')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Get all active contests with auto_evaluate enabled
    const { data: contests, error: fetchError } = await supabase
      .from('contests')
      .select('id, contest_title, evaluation_frequency')
      .eq('status', 'active')
      .eq('auto_evaluate', true)
      .eq('is_active', true)

    if (fetchError) {
      logger.error('Error fetching active contests for evaluation', fetchError)
      throw fetchError
    }

    if (!contests || contests.length === 0) {
      logger.info('No active contests to evaluate')
      return NextResponse.json({
        success: true,
        message: 'No active contests to evaluate',
        evaluated_count: 0,
      })
    }

    const evaluationResults = []

    // Evaluate each contest
    for (const contest of contests) {
      try {
        logger.info(`Evaluating contest: ${contest.id} (${contest.contest_title})`)

        // Update leaderboard
        const { error: leaderboardError } = await supabase.rpc('update_contest_leaderboard', {
          p_contest_id: contest.id,
        })

        if (leaderboardError) {
          logger.error(`Error updating leaderboard for contest ${contest.id}`, leaderboardError)
          evaluationResults.push({
            contest_id: contest.id,
            contest_title: contest.contest_title,
            success: false,
            error: leaderboardError.message,
          })
          continue
        }

        // Recalculate analytics
        const { error: analyticsError } = await supabase.rpc('calculate_contest_analytics', {
          p_contest_id: contest.id,
        })

        if (analyticsError) {
          logger.error(`Error calculating analytics for contest ${contest.id}`, analyticsError)
        }

        evaluationResults.push({
          contest_id: contest.id,
          contest_title: contest.contest_title,
          success: true,
        })

        logger.info(`Successfully evaluated contest: ${contest.id}`)
      } catch (error) {
        logger.error(`Error evaluating contest ${contest.id}`, error instanceof Error ? error : undefined)
        evaluationResults.push({
          contest_id: contest.id,
          contest_title: contest.contest_title,
          success: false,
          error: 'Internal server error',
        })
      }
    }

    const successCount = evaluationResults.filter((r) => r.success).length

    logger.info(`Contest evaluation completed: ${successCount}/${contests.length} successful`)

    return NextResponse.json({
      success: true,
      message: 'Contest evaluation completed',
      evaluated_count: successCount,
      total_contests: contests.length,
      results: evaluationResults,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error in GET /api/cron/contest-evaluate', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to evaluate contests',
    }, { status: 500 })
  }
}

// Disable body parsing for cron routes
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
