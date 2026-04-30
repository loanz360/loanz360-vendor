import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


const feedbackSchema = z.object({
  meeting_id: z.string().uuid(),
  // CX-4: Customer NPS
  customer_rating: z.number().min(1).max(5).optional(),
  customer_nps: z.number().min(0).max(10).optional(),
  customer_feedback: z.string().optional().nullable(),
  was_knowledgeable: z.boolean().optional(),
  // AI-4: DSE self-assessment
  agenda_covered: z.boolean().optional(),
  lead_stage_advanced: z.boolean().optional(),
  follow_up_scheduled: z.boolean().optional(),
  actual_duration_minutes: z.number().optional(),
  documents_collected: z.number().optional(),
  products_discussed: z.array(z.string()).optional(),
  products_interested: z.array(z.string()).optional(),
  // Check-in data (MOB-2)
  check_in_latitude: z.number().optional(),
  check_in_longitude: z.number().optional(),
  check_out_latitude: z.number().optional(),
  check_out_longitude: z.number().optional(),
})

/**
 * POST /api/employees/dse/schedule/meeting-feedback
 * Record meeting feedback and calculate effectiveness score
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = feedbackSchema.parse(body)

    // Verify meeting exists and belongs to user
    const { data: meeting, error: meetingError } = await supabase
      .from('dse_meetings')
      .select('id, title, organizer_id, duration_minutes, meeting_purpose, status, outcome')
      .eq('id', validatedData.meeting_id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // AI-4: Calculate effectiveness score (0-100)
    let effectivenessScore = 0
    const scoreBreakdown: Record<string, number> = {}

    // Meeting was completed (not cancelled/no-show)
    if (meeting.status === 'Completed') {
      scoreBreakdown['meeting_completed'] = 20
      effectivenessScore += 20
    }

    // Positive outcome
    if (meeting.outcome?.startsWith('Successful')) {
      scoreBreakdown['positive_outcome'] = 25
      effectivenessScore += 25
    } else if (meeting.outcome === 'Needs Follow-up') {
      scoreBreakdown['needs_follow_up'] = 10
      effectivenessScore += 10
    }

    // Agenda covered
    if (validatedData.agenda_covered) {
      scoreBreakdown['agenda_covered'] = 15
      effectivenessScore += 15
    }

    // Lead stage advanced
    if (validatedData.lead_stage_advanced) {
      scoreBreakdown['lead_advanced'] = 20
      effectivenessScore += 20
    }

    // Follow-up scheduled
    if (validatedData.follow_up_scheduled) {
      scoreBreakdown['follow_up_set'] = 10
      effectivenessScore += 10
    }

    // Time efficiency (actual vs planned)
    if (validatedData.actual_duration_minutes && meeting.duration_minutes) {
      const ratio = validatedData.actual_duration_minutes / meeting.duration_minutes
      if (ratio >= 0.8 && ratio <= 1.3) {
        scoreBreakdown['time_efficient'] = 10
        effectivenessScore += 10
      } else if (ratio >= 0.5 && ratio <= 1.5) {
        scoreBreakdown['time_efficient'] = 5
        effectivenessScore += 5
      }
    }

    // Customer rating bonus
    if (validatedData.customer_rating) {
      const ratingBonus = Math.min(10, (validatedData.customer_rating - 1) * 2.5)
      scoreBreakdown['customer_rating'] = Math.round(ratingBonus)
      effectivenessScore += ratingBonus
    }

    effectivenessScore = Math.min(100, Math.round(effectivenessScore))

    // Update meeting with feedback data
    const updatePayload: Record<string, any> = {
      effectiveness_score: effectivenessScore,
      updated_at: new Date().toISOString(),
    }

    if (validatedData.customer_rating) updatePayload.customer_rating = validatedData.customer_rating
    if (validatedData.products_discussed) updatePayload.products_discussed = validatedData.products_discussed
    if (validatedData.products_interested) updatePayload.products_interested = validatedData.products_interested
    if (validatedData.check_in_latitude) updatePayload.check_in_latitude = validatedData.check_in_latitude
    if (validatedData.check_in_longitude) updatePayload.check_in_longitude = validatedData.check_in_longitude

    await supabase
      .from('dse_meetings')
      .update(updatePayload)
      .eq('id', validatedData.meeting_id)
      .eq('organizer_id', user.id)

    // Store detailed feedback as a note
    const feedbackNote = [
      `Meeting Effectiveness Score: ${effectivenessScore}/100`,
      validatedData.customer_rating ? `Customer Rating: ${validatedData.customer_rating}/5` : null,
      validatedData.customer_nps !== undefined ? `NPS Score: ${validatedData.customer_nps}/10` : null,
      validatedData.agenda_covered ? 'Agenda: All items covered' : 'Agenda: Not all items covered',
      validatedData.lead_stage_advanced ? 'Lead: Stage advanced' : null,
      validatedData.follow_up_scheduled ? 'Follow-up: Scheduled' : 'Follow-up: Not scheduled',
      validatedData.actual_duration_minutes ? `Actual Duration: ${validatedData.actual_duration_minutes} min` : null,
      validatedData.customer_feedback ? `Customer Feedback: ${validatedData.customer_feedback}` : null,
      validatedData.products_discussed?.length ? `Products Discussed: ${validatedData.products_discussed.join(', ')}` : null,
      validatedData.products_interested?.length ? `Products Interested: ${validatedData.products_interested.join(', ')}` : null,
    ].filter(Boolean).join('\n')

    await supabase.from('dse_notes').insert({
      meeting_id: validatedData.meeting_id,
      note_content: feedbackNote,
      note_type: 'Post-Meeting',
      note_title: 'Meeting Feedback & Effectiveness',
      created_by: user.id,
    })

    // Audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Meeting',
      entity_id: validatedData.meeting_id,
      action: 'FeedbackRecorded',
      new_values: {
        effectiveness_score: effectivenessScore,
        customer_rating: validatedData.customer_rating,
        customer_nps: validatedData.customer_nps,
      },
      user_id: user.id,
      changes_summary: `Meeting feedback recorded: ${effectivenessScore}/100 effectiveness`,
    })

    return NextResponse.json({
      success: true,
      data: {
        meeting_id: validatedData.meeting_id,
        effectiveness_score: effectivenessScore,
        score_breakdown: scoreBreakdown,
        customer_rating: validatedData.customer_rating || null,
        customer_nps: validatedData.customer_nps || null,
      },
      message: `Meeting feedback recorded. Effectiveness score: ${effectivenessScore}/100`,
    })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path.join('.'), message: err.message })),
      }, { status: 400 })
    }

    apiLogger.error('Error recording meeting feedback', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employees/dse/schedule/meeting-feedback?meeting_id=xxx
 * Get feedback data for a specific meeting
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meeting_id')

    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meeting_id is required' }, { status: 400 })
    }

    const { data: meeting } = await supabase
      .from('dse_meetings')
      .select('id, effectiveness_score, customer_rating, products_discussed, products_interested, check_in_latitude, check_in_longitude, check_in_time, check_out_time')
      .eq('id', meetingId)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (!meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Get feedback note
    const { data: feedbackNote } = await supabase
      .from('dse_notes')
      .select('note_content, created_at')
      .eq('meeting_id', meetingId)
      .eq('note_type', 'Post-Meeting')
      .eq('note_title', 'Meeting Feedback & Effectiveness')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        meeting_id: meetingId,
        effectiveness_score: meeting.effectiveness_score,
        customer_rating: meeting.customer_rating,
        products_discussed: meeting.products_discussed,
        products_interested: meeting.products_interested,
        check_in: meeting.check_in_latitude ? {
          latitude: meeting.check_in_latitude,
          longitude: meeting.check_in_longitude,
          time: meeting.check_in_time,
        } : null,
        check_out_time: meeting.check_out_time,
        feedback_note: feedbackNote?.note_content || null,
      },
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching meeting feedback', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
