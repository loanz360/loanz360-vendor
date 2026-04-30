import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/calendar/google-calendar-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/calendar/sync
 * Trigger manual sync with Google Calendar
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      provider_id: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { provider_id } = body

    if (!provider_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: provider_id'
      }, { status: 400 })
    }

    const result = await googleCalendarService.syncEvents(provider_id)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        synced_count: result.syncedCount
      },
      message: `Successfully synced ${result.syncedCount} events`
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/calendar/sync', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
