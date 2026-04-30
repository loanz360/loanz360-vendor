import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET - Get all deals that require updates for the logged-in BDE
 * Returns deals that haven't been updated in the last 3 hours
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const hoursThreshold = parseInt(searchParams.get('hours') || '3')
    const includeAll = searchParams.get('include_all') === 'true'

    // Fetch all in-progress deals for this BDE
    const { data: deals, error: dealsError } = await supabase
      .from('crm_deals')
      .select(`
        id,
        customer_name,
        phone,
        email,
        location,
        loan_type,
        loan_amount,
        stage,
        status,
        assigned_at,
        last_updated_by_bde_at,
        created_at
      `)
      .eq('bde_id', user.id)
      .eq('status', 'in_progress')
      .order('last_updated_by_bde_at', { ascending: true, nullsFirst: true })

    if (dealsError) {
      apiLogger.error('Error fetching deals', dealsError)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch deals' },
        { status: 500 }
      )
    }

    const now = new Date()

    // Calculate which deals need updates
    const dealsWithUpdateStatus = deals?.map(deal => {
      const lastUpdateTime = deal.last_updated_by_bde_at
        ? new Date(deal.last_updated_by_bde_at)
        : new Date(deal.assigned_at || deal.created_at)

      const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60)
      const needsUpdate = hoursSinceUpdate >= hoursThreshold

      // Determine priority based on how overdue
      let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
      if (hoursSinceUpdate >= 12) {
        priority = 'critical'
      } else if (hoursSinceUpdate >= 6) {
        priority = 'high'
      } else if (hoursSinceUpdate >= 3) {
        priority = 'normal'
      } else {
        priority = 'low'
      }

      return {
        deal_id: deal.id,
        customer_name: deal.customer_name,
        phone: deal.phone,
        email: deal.email,
        location: deal.location,
        loan_type: deal.loan_type,
        loan_amount: deal.loan_amount,
        current_stage: deal.stage,
        current_status: deal.status,
        assigned_at: deal.assigned_at,
        last_update_at: deal.last_updated_by_bde_at,
        hours_since_update: Math.round(hoursSinceUpdate * 100) / 100,
        needs_update: needsUpdate,
        priority
      }
    }) || []

    // Filter to only deals needing updates unless include_all is true
    const filteredDeals = includeAll
      ? dealsWithUpdateStatus
      : dealsWithUpdateStatus.filter(d => d.needs_update)

    // Sort by priority (critical first) then by hours since update
    filteredDeals.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.hours_since_update - a.hours_since_update
    })

    // Calculate summary stats
    const stats = {
      total_in_progress: deals?.length || 0,
      needs_update: dealsWithUpdateStatus.filter(d => d.needs_update).length,
      critical: dealsWithUpdateStatus.filter(d => d.priority === 'critical').length,
      high: dealsWithUpdateStatus.filter(d => d.priority === 'high').length,
      normal: dealsWithUpdateStatus.filter(d => d.priority === 'normal' && d.needs_update).length
    }

    return NextResponse.json({
      success: true,
      data: {
        deals: filteredDeals,
        stats,
        threshold_hours: hoursThreshold
      }
    })

  } catch (error) {
    apiLogger.error('Error fetching pending updates', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Acknowledge/snooze reminders for deals
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      deal_ids: z.string().optional(),


      snooze_minutes: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action, deal_ids, snooze_minutes } = body

    if (!action || !deal_ids || !Array.isArray(deal_ids)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      )
    }

    const now = new Date()

    if (action === 'snooze') {
      // Snooze reminders for specified duration
      const snoozeUntil = new Date(now.getTime() + (snooze_minutes || 30) * 60 * 1000)

      const { error: snoozeError } = await supabase
        .from('deal_update_reminders')
        .update({
          status: 'snoozed',
          snoozed_until: snoozeUntil.toISOString(),
          snooze_count: supabase.sql`snooze_count + 1`
        })
        .in('deal_id', deal_ids)
        .eq('bde_id', user.id)
        .eq('status', 'pending')
        .lt('snooze_count', 2) // Max 2 snoozes

      if (snoozeError) {
        apiLogger.error('Error snoozing reminders', snoozeError)
        return NextResponse.json(
          { success: false, message: 'Failed to snooze reminders' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Reminders snoozed for ${snooze_minutes || 30} minutes`
      })

    } else if (action === 'acknowledge') {
      // Mark reminders as shown
      const { error: ackError } = await supabase
        .from('deal_update_reminders')
        .update({
          status: 'shown',
          shown_at: now.toISOString()
        })
        .in('deal_id', deal_ids)
        .eq('bde_id', user.id)
        .eq('status', 'pending')

      if (ackError) {
        apiLogger.error('Error acknowledging reminders', ackError)
        return NextResponse.json(
          { success: false, message: 'Failed to acknowledge reminders' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Reminders acknowledged'
      })

    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    apiLogger.error('Error processing reminder action', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
