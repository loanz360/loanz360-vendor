import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/emi-inquiries/[inquiryId]/follow-up
 * Add a follow-up activity for an inquiry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inquiryId } = params
    const bodySchema = z.object({

      follow_up_type: z.string(),

      contact_method: z.string().optional(),

      call_duration_seconds: z.string().optional(),

      conversation_summary: z.string().optional(),

      customer_response: z.string().optional(),

      customer_interest_level: z.string().optional(),

      customer_concerns: z.string().optional(),

      action_taken: z.string().optional(),

      next_action_required: z.string().optional(),

      next_follow_up_scheduled_at: z.string().optional(),

      outcome: z.string().optional(),

      competitor_mentioned: z.string().optional(),

      reminder_set: z.boolean().optional().default(false),

      competitor_rate_offered: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      follow_up_type,
      contact_method,
      call_duration_seconds,
      conversation_summary,
      customer_response,
      customer_interest_level,
      customer_concerns,
      action_taken,
      next_action_required,
      next_follow_up_scheduled_at,
      outcome,
      competitor_mentioned,
      reminder_set = false
    } = body

    // Validate required fields
    if (!follow_up_type) {
      return NextResponse.json(
        { error: 'follow_up_type is required' },
        { status: 400 }
      )
    }

    // Verify the inquiry exists and belongs to the user
    const { data: inquiry, error: fetchError } = await supabase
      .from('customer_emi_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .eq('created_by_employee_id', user.id)
      .maybeSingle()

    if (fetchError || !inquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found or access denied' },
        { status: 404 }
      )
    }

    // Create the follow-up record
    const { data: followUp, error: insertError } = await supabase
      .from('inquiry_follow_ups')
      .insert({
        inquiry_id: inquiryId,
        followed_up_by_employee_id: user.id,
        follow_up_type,
        contact_method,
        call_duration_seconds,
        conversation_summary,
        customer_response,
        customer_interest_level,
        customer_concerns,
        action_taken,
        next_action_required,
        next_follow_up_scheduled_at,
        outcome,
        competitor_mentioned,
        reminder_set
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating follow-up', insertError)
      return NextResponse.json(
        { error: 'Failed to create follow-up' },
        { status: 500 }
      )
    }

    // Update the inquiry with latest information
    const inquiryUpdates: Record<string, unknown> = {
      last_activity_at: new Date().toISOString()
    }

    if (customer_concerns) {
      inquiryUpdates.customer_concerns = customer_concerns
    }

    if (customer_interest_level) {
      inquiryUpdates.customer_feedback = customer_interest_level
    }

    if (next_follow_up_scheduled_at) {
      inquiryUpdates.next_follow_up_date = next_follow_up_scheduled_at.split('T')[0]
    }

    // Update status based on outcome
    if (outcome === 'converted') {
      inquiryUpdates.status = 'lead_created'
    } else if (outcome === 'positive' && inquiry.status === 'shared') {
      inquiryUpdates.status = 'interested'
    } else if (outcome === 'negative') {
      inquiryUpdates.status = 'lost'
      if (competitor_mentioned) {
        inquiryUpdates.competitor_name = competitor_mentioned
      }
    }

    // Update competitor information if mentioned
    if (competitor_mentioned && body.competitor_rate_offered) {
      inquiryUpdates.competitor_rate_offered = body.competitor_rate_offered
      inquiryUpdates.competitor_name = competitor_mentioned
    }

    await supabase
      .from('customer_emi_inquiries')
      .update(inquiryUpdates)
      .eq('id', inquiryId)

    // Log audit trail
    await supabase
      .from('inquiry_audit_log')
      .insert({
        inquiry_id: inquiryId,
        action_type: 'follow_up_added',
        action_by_employee_id: user.id,
        action_metadata: {
          follow_up_type,
          outcome,
          customer_interest_level
        }
      })

    return NextResponse.json({
      success: true,
      follow_up: followUp,
      message: 'Follow-up recorded successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in POST /api/emi-inquiries/[inquiryId]/follow-up', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/emi-inquiries/[inquiryId]/follow-up
 * Get all follow-ups for an inquiry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inquiryId } = params

    // Verify the inquiry exists and belongs to the user
    const { data: inquiry, error: fetchError } = await supabase
      .from('customer_emi_inquiries')
      .select('id')
      .eq('id', inquiryId)
      .eq('created_by_employee_id', user.id)
      .maybeSingle()

    if (fetchError || !inquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found or access denied' },
        { status: 404 }
      )
    }

    // Get all follow-ups
    const { data: followUps, error: followUpError } = await supabase
      .from('inquiry_follow_ups')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: false })

    if (followUpError) {
      apiLogger.error('Error fetching follow-ups', followUpError)
      return NextResponse.json(
        { error: 'Failed to fetch follow-ups' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      follow_ups: followUps || []
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/emi-inquiries/[inquiryId]/follow-up', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
