import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/calendar/google-calendar-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/calendar/event
 * Create a new calendar event
 */
export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      provider_id: z.string().uuid().optional(),

      title: z.string().optional(),

      description: z.string().optional(),

      start_time: z.string().optional(),

      end_time: z.string().optional(),

      location: z.string().optional(),

      attendees: z.string().optional(),

      has_google_meet: z.string().optional(),

      status: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      provider_id,
      title,
      description,
      start_time,
      end_time,
      location,
      attendees,
      has_google_meet,
      status
    } = body

    if (!provider_id || !title || !start_time || !end_time) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: provider_id, title, start_time, end_time'
      }, { status: 400 })
    }

    const result = await googleCalendarService.createEvent(provider_id, {
      title,
      description,
      start_time,
      end_time,
      location,
      attendees: attendees || [],
      has_google_meet: has_google_meet || false,
      status: status || 'confirmed'
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        event: result.event
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/calendar/event', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
