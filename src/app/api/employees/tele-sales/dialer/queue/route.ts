import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get user's call queue
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

    const status = searchParams.get('status')
    const campaign_id = searchParams.get('campaign_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    let query = supabase
      .from('ts_call_queue')
      .select('*')
      .eq('sales_executive_id', user.id)
      .order('priority', { ascending: false })
      .order('queue_position', { ascending: true })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['QUEUED', 'DIALING', 'RESCHEDULED'])
    }

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id)
    }

    const { data: queue, error } = await query

    if (error) throw error

    // Get queue stats
    const { data: stats } = await supabase
      .from('ts_call_queue')
      .select('status')
      .eq('sales_executive_id', user.id)

    const statusCounts: Record<string, number> = {}
    stats?.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        queue: queue || [],
        stats: {
          total: stats?.length || 0,
          queued: statusCounts['QUEUED'] || 0,
          in_progress: (statusCounts['DIALING'] || 0) + (statusCounts['CONNECTED'] || 0) + (statusCounts['IN_CALL'] || 0),
          completed: statusCounts['COMPLETED'] || 0,
          by_status: statusCounts
        }
      }
    })
  } catch (error) {
    apiLogger.error('Get queue error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch call queue' },
      { status: 500 }
    )
  }
}

// POST - Add items to queue
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      items: z.array(z.unknown()).optional(),

      campaign_id: z.string().uuid().optional(),

      item_id: z.string().uuid(),

      action: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { items, campaign_id } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Items array is required'
      }, { status: 400 })
    }

    // Get current max queue position
    const { data: maxPos } = await supabase
      .from('ts_call_queue')
      .select('queue_position')
      .eq('sales_executive_id', user.id)
      .order('queue_position', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextPosition = (maxPos?.queue_position || 0) + 1

    // Normalize phone numbers and prepare items
    const queueItems = items.map((item: unknown, index: number) => {
      const phone = item.contact_phone?.replace(/\D/g, '') || ''
      let normalizedPhone = phone
      if (phone.length === 10) {
        normalizedPhone = `91${phone}`
      }

      return {
        sales_executive_id: user.id,
        campaign_id: campaign_id || item.campaign_id || null,
        lead_id: item.lead_id || null,
        contact_name: item.contact_name,
        contact_phone: item.contact_phone,
        contact_phone_normalized: normalizedPhone,
        contact_email: item.contact_email || null,
        queue_position: nextPosition + index,
        priority: item.priority || 50,
        priority_reason: item.priority_reason || null,
        lead_score: item.lead_score || null,
        lead_source: item.lead_source || null,
        loan_type: item.loan_type || null,
        loan_amount: item.loan_amount || null,
        assigned_script_id: item.script_id || null,
        custom_talking_points: item.talking_points || null,
        status: 'QUEUED'
      }
    })

    const { data: inserted, error: insertError } = await supabase
      .from('ts_call_queue')
      .insert(queueItems)
      .select()

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      data: {
        added: inserted?.length || 0,
        items: inserted
      }
    })
  } catch (error) {
    apiLogger.error('Add to queue error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add items to queue' },
      { status: 500 }
    )
  }
}

// PUT - Update queue item
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema2 = z.object({

      item_id: z.string().optional(),

      action: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { item_id, action, ...updates } = body

    if (!item_id) {
      return NextResponse.json({
        success: false,
        error: 'Item ID is required'
      }, { status: 400 })
    }

    let updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'START_DIAL':
        updateData.status = 'DIALING'
        updateData.locked_by = user.id
        updateData.locked_at = new Date().toISOString()
        updateData.lock_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString()
        break

      case 'CONNECTED':
        updateData.status = 'CONNECTED'
        updateData.attempt_count = supabase.sql`attempt_count + 1`
        updateData.last_attempt_at = new Date().toISOString()
        updateData.last_attempt_result = 'CONNECTED'
        break

      case 'IN_CALL':
        updateData.status = 'IN_CALL'
        break

      case 'COMPLETE':
        updateData.status = 'COMPLETED'
        updateData.final_disposition = updates.disposition || null
        updateData.last_attempt_result = updates.result || 'COMPLETED'
        break

      case 'NO_ANSWER':
        updateData.last_attempt_at = new Date().toISOString()
        updateData.last_attempt_result = 'NO_ANSWER'
        updateData.attempt_count = supabase.sql`attempt_count + 1`
        // Check if max attempts reached
        const { data: item } = await supabase
          .from('ts_call_queue')
          .select('attempt_count, max_attempts')
          .eq('id', item_id)
          .maybeSingle()

        if (item && (item.attempt_count + 1) >= item.max_attempts) {
          updateData.status = 'MAX_ATTEMPTS'
        } else {
          updateData.status = 'QUEUED'
          updateData.next_attempt_after = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
        updateData.locked_by = null
        updateData.locked_at = null
        break

      case 'SKIP':
        updateData.status = 'SKIPPED'
        updateData.removed_reason = updates.reason || 'Skipped by agent'
        updateData.locked_by = null
        break

      case 'RESCHEDULE':
        updateData.status = 'RESCHEDULED'
        updateData.next_attempt_after = updates.reschedule_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        updateData.locked_by = null
        break

      case 'REMOVE':
        updateData.status = 'REMOVED'
        updateData.removed_reason = updates.reason || 'Removed by agent'
        updateData.removed_at = new Date().toISOString()
        updateData.removed_by = user.id
        break

      case 'UPDATE_PRIORITY':
        updateData.priority = updates.priority
        updateData.priority_reason = updates.priority_reason
        break

      default:
        Object.assign(updateData, updates)
    }

    const { data, error } = await supabase
      .from('ts_call_queue')
      .update(updateData)
      .eq('id', item_id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    apiLogger.error('Update queue error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update queue item' },
      { status: 500 }
    )
  }
}

// DELETE - Remove items from queue
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const item_id = searchParams.get('id')
    const clear_completed = searchParams.get('clear_completed') === 'true'

    if (clear_completed) {
      const { error } = await supabase
        .from('ts_call_queue')
        .delete()
        .eq('sales_executive_id', user.id)
        .in('status', ['COMPLETED', 'REMOVED', 'MAX_ATTEMPTS'])

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Completed items cleared'
      })
    }

    if (!item_id) {
      return NextResponse.json({
        success: false,
        error: 'Item ID or clear_completed flag required'
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('ts_call_queue')
      .delete()
      .eq('id', item_id)
      .eq('sales_executive_id', user.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Item removed from queue'
    })
  } catch (error) {
    apiLogger.error('Delete queue error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove from queue' },
      { status: 500 }
    )
  }
}
