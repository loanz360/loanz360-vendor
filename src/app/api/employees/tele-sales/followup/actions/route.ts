import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get actions for an instance or upcoming actions
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const instance_id = searchParams.get('instance_id')
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    let query = supabase
      .from('ts_followup_actions')
      .select(`
        *,
        instance:ts_followup_instances(id, contact_name, phone_number, status)
      `)
      .eq('sales_executive_id', user.id)
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (instance_id) {
      query = query.eq('instance_id', instance_id)
    }

    if (upcoming) {
      query = query
        .eq('status', 'PENDING')
        .gte('scheduled_at', new Date().toISOString())
    }

    const { data: actions, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: actions || []
    })
  } catch (error) {
    apiLogger.error('Get actions error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch actions' },
      { status: 500 }
    )
  }
}

// PUT - Execute or update an action
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { action_id, action_status, outcome, outcome_notes, related_call_id, related_task_id } = body

    if (!action_id || !action_status) {
      return NextResponse.json({
        success: false,
        error: 'Action ID and status are required'
      }, { status: 400 })
    }

    // Get the action first
    const { data: existingAction, error: fetchError } = await supabase
      .from('ts_followup_actions')
      .select('*, instance:ts_followup_instances(*)')
      .eq('id', action_id)
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    if (fetchError || !existingAction) {
      return NextResponse.json({
        success: false,
        error: 'Action not found'
      }, { status: 404 })
    }

    // Update the action
    const updates: any = {
      status: action_status,
      updated_at: new Date().toISOString()
    }

    if (action_status === 'EXECUTED') {
      updates.executed_at = new Date().toISOString()
      updates.outcome = outcome
      updates.outcome_notes = outcome_notes
    }

    if (related_call_id) updates.related_call_id = related_call_id
    if (related_task_id) updates.related_task_id = related_task_id

    const { data: updatedAction, error: updateError } = await supabase
      .from('ts_followup_actions')
      .update(updates)
      .eq('id', action_id)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    // Update instance progress
    if (action_status === 'EXECUTED') {
      const instance = existingAction.instance as any

      // Get next pending action
      const { data: nextAction } = await supabase
        .from('ts_followup_actions')
        .select('scheduled_at')
        .eq('instance_id', instance.id)
        .eq('status', 'PENDING')
        .order('step_number', { ascending: true })
        .limit(1)
        .maybeSingle()

      const instanceUpdates: any = {
        current_step: existingAction.step_number,
        total_attempts: (instance.total_attempts || 0) + 1,
        updated_at: new Date().toISOString()
      }

      // Update next action time
      if (nextAction) {
        instanceUpdates.next_action_at = nextAction.scheduled_at
      }

      // Check if sequence is complete
      if (!nextAction || existingAction.step_number >= instance.total_steps) {
        instanceUpdates.status = 'COMPLETED'
        instanceUpdates.completed_at = new Date().toISOString()

        // Determine final outcome based on last action outcome
        if (outcome === 'CONVERTED' || outcome === 'INTERESTED') {
          instanceUpdates.final_outcome = 'CONVERTED'
          instanceUpdates.successful_contacts = (instance.successful_contacts || 0) + 1
        } else if (outcome === 'OPT_OUT' || outcome === 'NOT_INTERESTED') {
          instanceUpdates.final_outcome = 'OPTED_OUT'
        } else {
          instanceUpdates.final_outcome = 'NO_RESPONSE'
        }
      }

      // Track successful contacts
      if (['COMPLETED', 'CONNECTED', 'CONVERTED', 'INTERESTED'].includes(outcome || '')) {
        instanceUpdates.successful_contacts = (instance.successful_contacts || 0) + 1
      }

      await supabase
        .from('ts_followup_instances')
        .update(instanceUpdates)
        .eq('id', instance.id)
    }

    return NextResponse.json({
      success: true,
      data: updatedAction
    })
  } catch (error) {
    apiLogger.error('Update action error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update action' },
      { status: 500 }
    )
  }
}
