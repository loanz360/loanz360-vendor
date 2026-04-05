import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { z, ZodError } from 'zod'
import type { DealStage, DealStatus, ActivityType, InteractionWith, InteractionMode, UpdateSource, SupportedLanguage, PendingItem } from '@/types/ai-crm'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// Validation schema for deal update
const dealUpdateSchema = z.object({
  // Stage update (optional)
  new_stage: z.enum([
    'docs_collected', 'finalized_bank', 'login_complete', 'post_login_pending_cleared',
    'process_started_at_bank', 'case_assessed_by_banker', 'pd_complete',
    'sanctioned', 'disbursed', 'dropped'
  ] as const).optional(),
  new_status: z.enum(['in_progress', 'sanctioned', 'disbursed', 'dropped'] as const).optional(),

  // Notes (required)
  notes: z.string().min(1, 'Update notes are required'),
  original_language: z.enum(['en', 'hi', 'te', 'ta', 'kn', 'mr', 'gu', 'bn', 'ml'] as const).default('en'),
  translate_to: z.enum(['en', 'hi', 'te', 'ta', 'kn', 'mr', 'gu', 'bn', 'ml'] as const).optional(),
  notes_translated: z.string().optional(),

  // Activity details
  activity_type: z.enum([
    'customer_call', 'bank_visit', 'document_collection', 'document_submission',
    'internal_review', 'customer_meeting', 'banker_meeting', 'verification_call',
    'follow_up', 'status_check', 'other'
  ] as const).optional(),
  activity_description: z.string().optional(),

  // Interaction details
  interaction_with: z.enum(['customer', 'banker', 'internal', 'verifier', 'lawyer', 'other'] as const).optional(),
  interaction_mode: z.enum(['call', 'meeting', 'email', 'whatsapp', 'in_person', 'sms'] as const).optional(),
  interaction_summary: z.string().optional(),

  // Customer/Banker details
  customer_response: z.string().optional(),
  banker_feedback: z.string().optional(),

  // Pending items
  pending_items: z.array(z.object({
    id: z.string(),
    item: z.string(),
    priority: z.enum(['low', 'normal', 'high', 'critical'] as const),
    due_date: z.string().optional(),
    completed: z.boolean().default(false),
    completed_at: z.string().optional(),
    notes: z.string().optional()
  })).optional(),

  // Next action
  next_action: z.string().optional(),
  next_action_date: z.string().optional(),
  next_action_time: z.string().optional(),

  // Source
  update_source: z.enum(['manual', 'reminder_popup', 'scheduled', 'mobile_app'] as const).default('manual'),

  // Location
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  location_name: z.string().optional(),

  // Financial updates (for sanctioned/disbursed stages)
  sanctioned_amount: z.number().optional(),
  disbursed_amount: z.number().optional(),

  // Drop reason (if dropping)
  drop_reason: z.string().optional()
})

/**
 * POST - Create a new update for a deal
 * This is the main endpoint for BDE 3-hourly updates
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id: dealId } = await params
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = dealUpdateSchema.parse(body)

    // Fetch current deal and verify BDE ownership
    const { data: deal, error: fetchError } = await supabase
      .from('crm_deals')
      .select('*')
      .eq('id', dealId)
      .eq('bde_id', user.id)
      .maybeSingle()

    if (fetchError || !deal) {
      return NextResponse.json(
        { success: false, message: 'Deal not found or access denied' },
        { status: 404 }
      )
    }

    // Check if deal is still active
    if (deal.status === 'disbursed' || deal.status === 'dropped') {
      return NextResponse.json(
        { success: false, message: 'Cannot update a completed or dropped deal' },
        { status: 400 }
      )
    }

    // Calculate hours since last update
    const lastUpdateTime = deal.last_updated_by_bde_at
      ? new Date(deal.last_updated_by_bde_at)
      : new Date(deal.assigned_at || deal.created_at)
    const now = new Date()
    const hoursSinceLastUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60)
    const isOverdue = hoursSinceLastUpdate > 3

    // Determine new stage and status
    const newStage = validatedData.new_stage || deal.stage
    const stageChanged = newStage !== deal.stage
    let newStatus = validatedData.new_status || deal.status

    // Auto-update status based on stage
    if (stageChanged) {
      if (newStage === 'sanctioned') {
        newStatus = 'sanctioned'
      } else if (newStage === 'disbursed') {
        newStatus = 'disbursed'
      } else if (newStage === 'dropped') {
        newStatus = 'dropped'
      }
    }

    const statusChanged = newStatus !== deal.status

    // Create the update record in deal_updates table
    const updateRecord = {
      deal_id: dealId,
      bde_id: user.id,
      stage_at_update: deal.stage,
      status_at_update: deal.status,
      stage_changed_to: stageChanged ? newStage : null,
      status_changed_to: statusChanged ? newStatus : null,
      notes_original: validatedData.notes,
      notes_translated: validatedData.notes_translated || null,
      original_language: validatedData.original_language,
      target_language: validatedData.translate_to || null,
      activity_type: validatedData.activity_type || null,
      activity_description: validatedData.activity_description || null,
      interaction_with: validatedData.interaction_with || null,
      interaction_mode: validatedData.interaction_mode || null,
      interaction_summary: validatedData.interaction_summary || null,
      customer_response: validatedData.customer_response || null,
      banker_feedback: validatedData.banker_feedback || null,
      pending_items: validatedData.pending_items || [],
      next_action: validatedData.next_action || null,
      next_action_date: validatedData.next_action_date || null,
      next_action_time: validatedData.next_action_time || null,
      update_source: validatedData.update_source,
      is_overdue: isOverdue,
      hours_since_last_update: Math.round(hoursSinceLastUpdate * 100) / 100,
      update_latitude: validatedData.latitude || null,
      update_longitude: validatedData.longitude || null,
      update_location_name: validatedData.location_name || null,
      created_at: now.toISOString()
    }

    const { data: newUpdate, error: updateInsertError } = await supabase
      .from('deal_updates')
      .insert(updateRecord)
      .select()
      .maybeSingle()

    if (updateInsertError) {
      apiLogger.error('Error creating update record', updateInsertError)
      return NextResponse.json(
        { success: false, message: 'Failed to create update record' },
        { status: 500 }
      )
    }

    // Also update the legacy daily_updates array for backward compatibility
    const dailyUpdates = Array.isArray(deal.daily_updates) ? deal.daily_updates : []
    dailyUpdates.push({
      id: newUpdate.id,
      timestamp: now.toISOString(),
      stage: newStage,
      note: validatedData.notes,
      activity_type: validatedData.activity_type,
      update_source: validatedData.update_source
    })

    // Prepare deal update data
    const dealUpdateData: Record<string, any> = {
      daily_updates: dailyUpdates,
      last_updated_by_bde_at: now.toISOString(),
      updated_at: now.toISOString()
    }

    // Update stage if changed
    if (stageChanged) {
      dealUpdateData.stage = newStage
    }

    // Update status if changed
    if (statusChanged) {
      dealUpdateData.status = newStatus

      // Set timestamp based on status
      if (newStatus === 'sanctioned') {
        dealUpdateData.sanctioned_at = now.toISOString()
        if (validatedData.sanctioned_amount) {
          dealUpdateData.sanctioned_amount = validatedData.sanctioned_amount
        }
      } else if (newStatus === 'disbursed') {
        dealUpdateData.disbursed_at = now.toISOString()
        if (validatedData.disbursed_amount) {
          dealUpdateData.disbursed_amount = validatedData.disbursed_amount
        }
      } else if (newStatus === 'dropped') {
        dealUpdateData.dropped_at = now.toISOString()
        if (validatedData.drop_reason) {
          dealUpdateData.drop_reason = validatedData.drop_reason
        }
      }
    }

    // Update the deal
    const { error: dealUpdateError } = await supabase
      .from('crm_deals')
      .update(dealUpdateData)
      .eq('id', dealId)
      .eq('bde_id', user.id)

    if (dealUpdateError) {
      apiLogger.error('Error updating deal', dealUpdateError)
      return NextResponse.json(
        { success: false, message: 'Failed to update deal' },
        { status: 500 }
      )
    }

    // Mark any pending reminders as completed
    await supabase
      .from('deal_update_reminders')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
        update_id: newUpdate.id
      })
      .eq('deal_id', dealId)
      .eq('bde_id', user.id)
      .eq('status', 'pending')

    // Create next reminder if deal is still in progress
    if (newStatus === 'in_progress') {
      const nextReminderTime = new Date(now)
      nextReminderTime.setHours(nextReminderTime.getHours() + 3)

      await supabase
        .from('deal_update_reminders')
        .insert({
          deal_id: dealId,
          bde_id: user.id,
          reminder_type: '3_hour',
          scheduled_at: nextReminderTime.toISOString(),
          priority: 'normal',
          status: 'pending'
        })
    }

    // Create stage history entry if stage or status changed
    if (stageChanged || statusChanged) {
      await supabase
        .from('deal_stage_history')
        .insert({
          deal_id: dealId,
          from_stage: deal.stage,
          to_stage: newStage,
          from_status: deal.status,
          to_status: newStatus,
          changed_by: user.id,
          change_reason: validatedData.notes.substring(0, 500),
          update_id: newUpdate.id
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Deal updated successfully',
      data: {
        update_id: newUpdate.id,
        stage_changed: stageChanged,
        status_changed: statusChanged,
        new_stage: newStage,
        new_status: newStatus,
        was_overdue: isOverdue,
        hours_since_last_update: Math.round(hoursSinceLastUpdate * 100) / 100
      }
    })

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET - Get all updates for a specific deal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Verify BDE has access to this deal
    const { data: deal, error: dealError } = await supabase
      .from('crm_deals')
      .select('id, bde_id')
      .eq('id', dealId)
      .maybeSingle()

    if (dealError || !deal) {
      return NextResponse.json(
        { success: false, message: 'Deal not found' },
        { status: 404 }
      )
    }

    if (deal.bde_id !== user.id) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch all updates for this deal
    const { data: updates, error: updatesError } = await supabase
      .from('deal_updates')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (updatesError) {
      apiLogger.error('Error fetching updates', updatesError)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch updates' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        updates: updates || [],
        total: updates?.length || 0
      }
    })

  } catch (error) {
    apiLogger.error('Error fetching deal updates', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
