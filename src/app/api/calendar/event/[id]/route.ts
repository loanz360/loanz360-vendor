import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/calendar/google-calendar-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * PUT /api/calendar/event/[id]
 * Update an existing calendar event
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const bodySchema = z.object({

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
      title,
      description,
      start_time,
      end_time,
      location,
      attendees,
      has_google_meet,
      status
    } = body

    const result = await googleCalendarService.updateEvent(id, {
      title,
      description,
      start_time,
      end_time,
      location,
      attendees,
      has_google_meet,
      status
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
    apiLogger.error('Error in PUT /api/calendar/event/[id]', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/calendar/event/[id]
 * Delete/cancel a calendar event
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const result = await googleCalendarService.deleteEvent(id)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/calendar/event/[id]', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
