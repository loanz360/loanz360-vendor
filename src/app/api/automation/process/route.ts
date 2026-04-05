/**
 * API Route: Process Automation Rules
 * POST /api/automation/process
 *
 * This endpoint is designed to be called by a cron job (e.g., Vercel Cron)
 * It processes all active automation rules and sends follow-up reminders/escalations
 *
 * Recommended schedule: Every hour (0 * * * *)
 */

import { NextRequest, NextResponse } from 'next/server'
import { processFollowUpRules } from '@/lib/automation/lead-follow-up'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds max

interface ProcessResponse {
  success: boolean
  result?: {
    processed: number
    reminders_sent: number
    escalations: number
    errors: string[]
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a trusted source (cron job)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require authentication
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ProcessResponse,
        { status: 401 }
      )
    }


    const result = await processFollowUpRules()
    if (result.errors.length > 0) {
      apiLogger.error('[Automation] Errors', result.errors)
    }

    return NextResponse.json({
      success: result.success,
      result: {
        processed: result.processed,
        reminders_sent: result.reminders_sent,
        escalations: result.escalations,
        errors: result.errors
      }
    } as ProcessResponse)
  } catch (error) {
    apiLogger.error('[Automation] Fatal error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      } as ProcessResponse,
      { status: 500 }
    )
  }
}

// Also allow GET for easy testing in development
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Use POST in production' } as ProcessResponse,
      { status: 405 }
    )
  }

  return POST(request)
}
