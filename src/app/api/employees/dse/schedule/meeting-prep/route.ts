import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'


/**
 * GET /api/employees/dse/schedule/meeting-prep?meeting_id=xxx
 * Generates a meeting preparation brief with context from previous interactions
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

    const authResult = await verifyDSEAuth(supabase, user.id, { allowDSM: true })
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get('meeting_id')

    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meeting_id is required' }, { status: 400 })
    }

    // Fetch the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('dse_meetings')
      .select(`
        *,
        dse_customers(id, full_name, company_name, designation, primary_mobile, email, customer_status, priority, address, city, created_at),
        dse_leads(id, customer_name, company_name, mobile, email, lead_type, lead_stage, estimated_value, loan_type, loan_amount, source, created_at)
      `)
      .eq('id', meetingId)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Fetch previous meetings with same customer/lead (last 5)
    const previousMeetingsQuery = supabase
      .from('dse_meetings')
      .select('id, title, scheduled_date, status, outcome, outcome_notes, meeting_notes, meeting_type, meeting_purpose')
      .eq('organizer_id', user.id)
      .neq('id', meetingId)
      .in('status', ['Completed', 'Cancelled', 'No Show', 'Rescheduled'])
      .order('scheduled_date', { ascending: false })
      .limit(5)

    if (meeting.customer_id) {
      previousMeetingsQuery.eq('customer_id', meeting.customer_id)
    } else if (meeting.lead_id) {
      previousMeetingsQuery.eq('lead_id', meeting.lead_id)
    }

    const { data: previousMeetings } = await previousMeetingsQuery

    // Fetch notes from previous meetings
    let previousNotes: unknown[] = []
    if (previousMeetings && previousMeetings.length > 0) {
      const meetingIds = previousMeetings.map(m => m.id)
      const { data: notes } = await supabase
        .from('dse_notes')
        .select('note_content, note_type, meeting_id, created_at')
        .in('meeting_id', meetingIds)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      previousNotes = notes || []
    }

    // Fetch pending reminders
    const { data: reminders } = await supabase
      .from('dse_reminders')
      .select('title, description, reminder_datetime, status')
      .eq('meeting_id', meetingId)
      .eq('owner_id', user.id)

    // Build preparation brief
    const participant = meeting.dse_customers || meeting.dse_leads
    const participantType = meeting.dse_customers ? 'customer' : meeting.dse_leads ? 'lead' : null

    // Key talking points based on meeting purpose
    const talkingPoints: string[] = []
    const meetingPurpose = meeting.meeting_purpose || 'General'

    switch (meetingPurpose) {
      case 'Introduction':
        talkingPoints.push(
          'Introduce yourself and LOANZ360 services',
          'Understand customer\'s financial needs and goals',
          'Discuss available loan products that match their profile',
          'Collect basic eligibility information',
          'Set expectations for the process and timeline'
        )
        break
      case 'Product Demo':
        talkingPoints.push(
          'Recap previous discussion and requirements',
          'Present matching loan products with comparison',
          'Explain interest rates, tenure options, and EMI calculations',
          'Address any concerns from previous meeting',
          'Discuss documentation requirements'
        )
        break
      case 'Proposal Discussion':
        talkingPoints.push(
          'Present the proposal with detailed terms',
          'Compare with competitor offers if applicable',
          'Discuss processing fees and hidden charges',
          'Address pricing concerns proactively',
          'Get commitment on next steps'
        )
        break
      case 'Document Collection':
        talkingPoints.push(
          'Review document checklist with customer',
          'Verify submitted documents for completeness',
          'Collect missing documents',
          'Explain next steps after document submission',
          'Set timeline expectations for processing'
        )
        break
      case 'Negotiation':
        talkingPoints.push(
          'Understand customer\'s key concerns',
          'Present best available terms',
          'Be prepared with counter-offers',
          'Focus on value, not just price',
          'Work toward a win-win outcome'
        )
        break
      case 'Contract Signing':
        talkingPoints.push(
          'Review all terms one final time',
          'Ensure all documents are in order',
          'Walk through the agreement clauses',
          'Get signatures on all required documents',
          'Explain post-signing process and disbursement timeline'
        )
        break
      default:
        talkingPoints.push(
          'Review previous interactions',
          'Address any open items',
          'Discuss next steps',
          'Confirm follow-up plan'
        )
    }

    // Risk flags based on history
    const riskFlags: string[] = []
    if (previousMeetings) {
      const noShows = previousMeetings.filter(m => m.status === 'No Show').length
      const cancellations = previousMeetings.filter(m => m.status === 'Cancelled').length
      const rescheduled = previousMeetings.filter(m => m.status === 'Rescheduled').length
      const pricingConcerns = previousMeetings.filter(m => m.outcome === 'Pricing Concern').length
      const competitorMentions = previousMeetings.filter(m => m.outcome === 'Competitor Comparison').length

      if (noShows > 0) riskFlags.push(`${noShows} previous no-show(s) - confirm attendance 2 hours before`)
      if (cancellations > 1) riskFlags.push(`${cancellations} previous cancellations - high risk of rescheduling`)
      if (rescheduled > 1) riskFlags.push(`Meeting has been rescheduled ${rescheduled} time(s)`)
      if (pricingConcerns > 0) riskFlags.push('Customer has expressed pricing concerns - prepare competitive offers')
      if (competitorMentions > 0) riskFlags.push('Customer is comparing with competitors - prepare differentiation pitch')
    }

    const prepBrief = {
      meeting: {
        id: meeting.id,
        title: meeting.title,
        type: meeting.meeting_type,
        purpose: meetingPurpose,
        date: meeting.scheduled_date,
        time: meeting.start_time,
        duration: meeting.duration_minutes,
        location: meeting.location_address || meeting.virtual_meeting_link || 'Not specified',
      },
      participant: participant ? {
        name: participant.full_name || participant.customer_name,
        company: participant.company_name,
        contact: participant.primary_mobile || participant.mobile,
        email: participant.email,
        type: participantType,
        status: participant.customer_status || participant.lead_stage,
        priority: participant.priority || null,
        estimated_value: participant.estimated_value || null,
        loan_type: participant.loan_type || null,
        since: participant.created_at,
      } : null,
      previous_interactions: {
        total_meetings: previousMeetings?.length || 0,
        meetings: (previousMeetings || []).map(m => ({
          date: m.scheduled_date,
          purpose: m.meeting_purpose,
          status: m.status,
          outcome: m.outcome,
          key_notes: m.outcome_notes || m.meeting_notes || null,
        })),
        recent_notes: previousNotes.map(n => ({
          content: n.note_content,
          type: n.note_type,
          date: n.created_at,
        })),
      },
      preparation: {
        talking_points: talkingPoints,
        risk_flags: riskFlags,
        reminders: (reminders || []).map(r => ({
          title: r.title,
          time: r.reminder_datetime,
          status: r.status,
        })),
      },
      description: meeting.description || null,
    }

    return NextResponse.json({
      success: true,
      data: prepBrief,
    })

  } catch (error: unknown) {
    apiLogger.error('Error generating meeting prep brief', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
