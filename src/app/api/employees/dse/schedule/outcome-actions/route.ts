import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'

export const dynamic = 'force-dynamic'

/**
 * Outcome-to-Lead Stage Mapping
 * When a meeting outcome is recorded, automatically update the lead stage
 * and trigger follow-up actions
 */
const OUTCOME_ACTIONS: Record<string, {
  lead_stage?: string
  auto_action: string
  create_follow_up?: boolean
  follow_up_purpose?: string
  follow_up_days?: number
  priority?: string
}> = {
  'Successful - Deal Closed': {
    lead_stage: 'Won',
    auto_action: 'Deal closed - create disbursement task',
    priority: 'high',
  },
  'Successful - Documents Collected': {
    lead_stage: 'Documentation',
    auto_action: 'Documents collected - trigger verification',
    create_follow_up: true,
    follow_up_purpose: 'Review',
    follow_up_days: 3,
  },
  'Successful - Positive Response': {
    lead_stage: 'Proposal',
    auto_action: 'Positive response - advance to proposal',
    create_follow_up: true,
    follow_up_purpose: 'Proposal Discussion',
    follow_up_days: 2,
  },
  'Needs Follow-up': {
    auto_action: 'Follow-up required',
    create_follow_up: true,
    follow_up_purpose: 'Follow-up',
    follow_up_days: 3,
  },
  'Customer Not Interested': {
    lead_stage: 'Lost',
    auto_action: 'Customer not interested - mark as lost',
  },
  'Rescheduled by Customer': {
    auto_action: 'Customer rescheduled - create new meeting',
    create_follow_up: true,
    follow_up_purpose: 'Follow-up',
    follow_up_days: 7,
  },
  'Pricing Concern': {
    auto_action: 'Pricing concern - flag for manager review',
    create_follow_up: true,
    follow_up_purpose: 'Negotiation',
    follow_up_days: 2,
    priority: 'high',
  },
  'Competitor Comparison': {
    auto_action: 'Competitor comparison - prepare competitive analysis',
    create_follow_up: true,
    follow_up_purpose: 'Proposal Discussion',
    follow_up_days: 1,
    priority: 'high',
  },
}

const outcomeActionSchema = z.object({
  meeting_id: z.string().uuid(),
  outcome: z.string().min(1),
  outcome_notes: z.string().optional().nullable(),
  meeting_notes: z.string().optional().nullable(),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z.string().optional().nullable(),
  next_steps: z.string().optional().nullable(),
  // Allow overriding auto-actions
  skip_lead_update: z.boolean().default(false),
  skip_follow_up: z.boolean().default(false),
})

/**
 * POST /api/employees/dse/schedule/outcome-actions
 * Process meeting outcome and trigger automated actions
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

    const body = await request.json()
    const validatedData = outcomeActionSchema.parse(body)

    // Fetch the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('dse_meetings')
      .select('id, title, customer_id, lead_id, organizer_id, scheduled_date, start_time')
      .eq('id', validatedData.meeting_id)
      .eq('organizer_id', user.id)
      .maybeSingle()

    if (meetingError || !meeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    const actions_taken: string[] = []
    const outcomeConfig = OUTCOME_ACTIONS[validatedData.outcome]

    // 1. Update the meeting with outcome
    const { error: updateError } = await supabase
      .from('dse_meetings')
      .update({
        status: 'Completed',
        outcome: validatedData.outcome,
        outcome_notes: validatedData.outcome_notes || null,
        meeting_notes: validatedData.meeting_notes || null,
        follow_up_required: validatedData.follow_up_required || outcomeConfig?.create_follow_up || false,
        follow_up_date: validatedData.follow_up_date || null,
        next_steps: validatedData.next_steps || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validatedData.meeting_id)
      .eq('organizer_id', user.id)

    if (updateError) {
      throw updateError
    }
    actions_taken.push('Meeting marked as completed with outcome recorded')

    // 2. Auto-update lead stage if applicable
    if (outcomeConfig?.lead_stage && meeting.lead_id && !validatedData.skip_lead_update) {
      const { data: lead } = await supabase
        .from('dse_leads')
        .select('id, lead_stage')
        .eq('id', meeting.lead_id)
        .eq('dse_user_id', user.id)
        .maybeSingle()

      if (lead) {
        const previousStage = lead.lead_stage
        const { error: leadUpdateError } = await supabase
          .from('dse_leads')
          .update({
            lead_stage: outcomeConfig.lead_stage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meeting.lead_id)
          .eq('dse_user_id', user.id)

        if (!leadUpdateError) {
          actions_taken.push(`Lead stage updated: ${previousStage} -> ${outcomeConfig.lead_stage}`)

          // Audit log for lead stage change
          await supabase.from('dse_audit_log').insert({
            entity_type: 'Lead',
            entity_id: meeting.lead_id,
            action: 'StageChanged',
            old_values: { lead_stage: previousStage },
            new_values: { lead_stage: outcomeConfig.lead_stage },
            user_id: user.id,
            changes_summary: `Lead stage auto-updated from "${previousStage}" to "${outcomeConfig.lead_stage}" based on meeting outcome "${validatedData.outcome}"`,
          })
        }
      }
    }

    // 3. Create follow-up meeting if applicable
    if (outcomeConfig?.create_follow_up && !validatedData.skip_follow_up) {
      const followUpDays = outcomeConfig.follow_up_days || 3
      const followUpDate = new Date()
      followUpDate.setDate(followUpDate.getDate() + followUpDays)
      const followUpDateStr = followUpDate.toISOString().split('T')[0]

      const { data: followUpMeeting, error: followUpError } = await supabase
        .from('dse_meetings')
        .insert({
          organizer_id: user.id,
          customer_id: meeting.customer_id,
          lead_id: meeting.lead_id,
          title: `Follow-up: ${meeting.title}`,
          description: `Follow-up meeting from "${meeting.title}" (${validatedData.outcome}).\n\nPrevious meeting notes: ${validatedData.meeting_notes || 'N/A'}\nNext steps: ${validatedData.next_steps || 'N/A'}`,
          meeting_type: 'Phone Call',
          meeting_purpose: outcomeConfig.follow_up_purpose || 'Follow-up',
          scheduled_date: validatedData.follow_up_date || followUpDateStr,
          start_time: '10:00',
          end_time: '10:30',
          duration_minutes: 30,
          status: 'Scheduled',
        })
        .select('id, title, scheduled_date')
        .maybeSingle()

      if (!followUpError && followUpMeeting) {
        actions_taken.push(`Follow-up meeting created for ${followUpMeeting.scheduled_date}: "${followUpMeeting.title}"`)

        // Create reminder for follow-up
        const reminderTime = new Date(`${followUpMeeting.scheduled_date}T09:30:00`)
        await supabase.from('dse_reminders').insert({
          meeting_id: followUpMeeting.id,
          customer_id: meeting.customer_id,
          lead_id: meeting.lead_id,
          owner_id: user.id,
          created_by: user.id,
          title: `Follow-up: ${followUpMeeting.title}`,
          reminder_type: 'Meeting',
          reminder_datetime: reminderTime.toISOString(),
          reminder_date: followUpMeeting.scheduled_date,
          reminder_time: '09:30:00',
          priority: outcomeConfig.priority || 'Medium',
          notify_before_minutes: 30,
          status: 'Active',
        })
      }
    }

    // 4. Create manager alert for pricing/competitor concerns
    if (['Pricing Concern', 'Competitor Comparison'].includes(validatedData.outcome)) {
      actions_taken.push('Manager alert created for review')
      // Audit log as alert
      await supabase.from('dse_audit_log').insert({
        entity_type: 'Meeting',
        entity_id: validatedData.meeting_id,
        action: 'ManagerAlertCreated',
        new_values: {
          outcome: validatedData.outcome,
          outcome_notes: validatedData.outcome_notes,
          customer_id: meeting.customer_id,
          lead_id: meeting.lead_id,
        },
        user_id: user.id,
        changes_summary: `Manager alert: ${validatedData.outcome} - "${meeting.title}"`,
      })
    }

    // 5. Meeting audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Meeting',
      entity_id: validatedData.meeting_id,
      action: 'OutcomeRecorded',
      new_values: {
        outcome: validatedData.outcome,
        outcome_notes: validatedData.outcome_notes,
        actions_taken,
      },
      user_id: user.id,
      changes_summary: `Meeting "${meeting.title}" completed with outcome: ${validatedData.outcome}`,
    })

    return NextResponse.json({
      success: true,
      data: {
        meeting_id: validatedData.meeting_id,
        outcome: validatedData.outcome,
        actions_taken,
        auto_updates: {
          lead_stage_updated: outcomeConfig?.lead_stage && !validatedData.skip_lead_update ? outcomeConfig.lead_stage : null,
          follow_up_created: outcomeConfig?.create_follow_up && !validatedData.skip_follow_up,
          manager_alerted: ['Pricing Concern', 'Competitor Comparison'].includes(validatedData.outcome),
        },
      },
      message: `Meeting completed. ${actions_taken.length} action(s) taken automatically.`,
    })

  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path.join('.'), message: err.message })),
      }, { status: 400 })
    }

    apiLogger.error('Error processing meeting outcome', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employees/dse/schedule/outcome-actions
 * Get the outcome action configuration (for UI to show what will happen)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    return NextResponse.json({
      success: true,
      data: {
        outcomes: Object.entries(OUTCOME_ACTIONS).map(([outcome, config]) => ({
          outcome,
          ...config,
        })),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching outcome actions', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
