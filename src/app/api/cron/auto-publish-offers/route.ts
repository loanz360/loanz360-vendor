
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * CRON ENDPOINT: Auto-publish scheduled offers
 *
 * This endpoint should be called every minute via a cron job
 * Schedule: Every 1 minute (cron: star-slash-1 * * * *)
 *
 * Options for scheduling:
 * 1. Vercel Cron Jobs (vercel.json)
 * 2. GitHub Actions (every minute)
 * 3. External cron service (cron-job.org, EasyCron, etc.)
 * 4. Supabase Edge Function with cron trigger
 *
 * Security: Uses Authorization header with secret token
 */

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Security check: Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      apiLogger.error('CRON_SECRET environment variable is not configured')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing authorization token' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Call the auto_publish_scheduled_offers function
    const { data, error } = await supabase.rpc('auto_publish_scheduled_offers')

    if (error) {
      apiLogger.error('Error auto-publishing offers', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          details: error
        },
        { status: 500 }
      )
    }

    // Extract results
    const publishedCount = data?.[0]?.published_count || 0
    const offerIds = data?.[0]?.offer_ids || []

    return NextResponse.json({
      success: true,
      published_count: publishedCount,
      offer_ids: offerIds,
      timestamp: new Date().toISOString(),
      message: publishedCount > 0
        ? `Successfully published ${publishedCount} scheduled offer(s)`
        : 'No offers ready for publishing'
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

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Allow GET requests without auth for testing (can be disabled in production)
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isDevelopment) {
      return NextResponse.json(
        { error: 'Method not allowed in production', message: 'Use POST method' },
        { status: 405 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get scheduled offers info
    const { data: scheduledOffers, error } = await supabase.rpc('get_scheduled_offers')

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      scheduled_offers: scheduledOffers || [],
      count: scheduledOffers?.length || 0,
      timestamp: new Date().toISOString(),
      message: 'Use POST method to trigger auto-publishing'
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
