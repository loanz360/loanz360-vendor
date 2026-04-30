
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * CRON ENDPOINT: Refresh Analytics Materialized Views
 *
 * This endpoint refreshes all analytics materialized views for lightning-fast queries
 * Schedule: Every 15 minutes (cron: star-slash-15 * * * *)
 *
 * Materialized Views Refreshed:
 * 1. mv_offer_summary_stats - Overall statistics
 * 2. mv_bank_performance - Bank-wise metrics
 * 3. mv_top_performing_offers - Top offers by views
 * 4. mv_statewise_distribution - State-wise distribution
 * 5. mv_daily_view_trends - 90-day view history
 *
 * Performance: Each refresh takes <100ms with CONCURRENTLY option
 * Impact: Analytics queries become 100-1000x faster
 *
 * Security: Uses Authorization header with secret token
 */

export async function POST(request: NextRequest) {
  try {
    // Security check: Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secure-cron-secret-here'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing authorization token' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Call the refresh function
    const startTime = Date.now()
    const { data, error } = await supabase.rpc('refresh_offer_analytics_views')
    const duration = Date.now() - startTime

    if (error) {
      apiLogger.error('Error refreshing analytics views', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          details: error
        },
        { status: 500 }
      )
    }

    // Log results
    return NextResponse.json({
      success: true,
      views_refreshed: data?.length || 0,
      refresh_duration_ms: duration,
      details: data,
      timestamp: new Date().toISOString(),
      message: 'Analytics materialized views refreshed successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Cron job error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// GET — used by Vercel cron scheduler (cron always calls GET)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secure-cron-secret-here'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing authorization token' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    const startTime = Date.now()
    const { data, error } = await supabase.rpc('refresh_offer_analytics_views')
    const duration = Date.now() - startTime

    if (error) {
      apiLogger.error('Error refreshing analytics views', error)
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      views_refreshed: data?.length || 0,
      refresh_duration_ms: duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    apiLogger.error('Cron job error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
