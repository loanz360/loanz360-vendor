
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * CRON Job: Update CPE Daily Metrics
 * Should be called daily via cron job or scheduled task
 *
 * Usage:
 * - Vercel Cron: Add to vercel.json
 * - Manual trigger: POST /api/cron/update-cpe-metrics with Authorization header
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-change-me'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get all CPE users
    const { data: cpeUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('sub_role', 'CHANNEL_PARTNER_EXECUTIVE')

    if (usersError) {
      apiLogger.error('Error fetching CPE users', usersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch CPE users' },
        { status: 500 }
      )
    }

    const results = []
    const today = new Date().toISOString().split('T')[0]

    // Update metrics for each CPE user
    for (const cpeUser of cpeUsers || []) {
      try {
        // Call the database function to update metrics
        const { data, error } = await supabase.rpc('update_cpe_daily_metrics', {
          p_user_id: cpeUser.id,
          p_date: today
        })

        if (error) {
          apiLogger.error(`Error updating metrics for ${cpeUser.full_name}:`, error)
          results.push({
            user_id: cpeUser.id,
            user_name: cpeUser.full_name,
            success: false,
            error: 'Internal server error'
          })
        } else {
          results.push({
            user_id: cpeUser.id,
            user_name: cpeUser.full_name,
            success: true
          })
        }
      } catch (err) {
        apiLogger.error(`Exception updating metrics for ${cpeUser.full_name}:`, err)
        results.push({
          user_id: cpeUser.id,
          user_name: cpeUser.full_name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Updated metrics for ${successCount} CPE users (${failCount} failed)`,
      date: today,
      total_users: cpeUsers?.length || 0,
      successful: successCount,
      failed: failCount,
      details: results
    })

  } catch (error) {
    apiLogger.error('Error in CPE metrics update cron', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// Allow GET for testing purposes
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'CPE Metrics Update Cron Job',
    description: 'This endpoint updates daily metrics for all Channel Partner Executives',
    usage: 'POST with Authorization: Bearer <CRON_SECRET>',
    note: 'Should be called daily via cron scheduler'
  })
}
