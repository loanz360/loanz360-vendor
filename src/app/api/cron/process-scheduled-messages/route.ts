export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { scheduledMessaging } from '@/lib/communication/scheduled-messaging'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Cron endpoint to process scheduled messages
 *
 * IMPORTANT: Vercel Free Plan does NOT support cron jobs.
 * You need a Pro plan ($20/month) or use an external service.
 *
 * Alternative Solutions for Free Plan:
 * 1. External Cron Service (FREE):
 *    - Use cron-job.org or EasyCron
 *    - Set up to call this endpoint every 5 minutes
 *    - URL: https://your-domain.com/api/cron/process-scheduled-messages?key=YOUR_CRON_SECRET
 *
 * 2. Manual Trigger:
 *    curl https://your-domain.com/api/cron/process-scheduled-messages?key=YOUR_CRON_SECRET
 *
 * 3. Vercel Pro Plan Setup (vercel.json):
 *    {
 *      "crons": [{
 *        "path": "/api/cron/process-scheduled-messages",
 *        "schedule": "every 5 minutes"
 *      }]
 *    }
 *
 * Required Environment Variables:
 *    CRON_SECRET=your-secret-key (MUST be set in Vercel Dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const providedKey = request.nextUrl.searchParams.get('key')

    // Debug logging (remove in production)
    // Check if CRON_SECRET is configured
    if (!cronSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'CRON_SECRET environment variable is not configured in Vercel'
        },
        { status: 500 }
      )
    }

    // Allow requests from Vercel Cron or with valid secret
    const isVercelCron = authHeader === `Bearer ${cronSecret}`
    const hasValidSecret = providedKey === cronSecret

    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - Invalid or missing API key'
        },
        { status: 401 }
      )
    }


    // Process scheduled messages
    const result = await scheduledMessaging.processScheduledMessages()

    if (!result.success) {
      apiLogger.error('[CRON] Failed to process messages', result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
    return NextResponse.json({
      success: true,
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    apiLogger.error('[CRON] Error processing scheduled messages', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
