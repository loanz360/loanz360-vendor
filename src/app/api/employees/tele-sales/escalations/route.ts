import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get escalations
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
    const type = searchParams.get('type')
    const view = searchParams.get('view') || 'my' // my, assigned, all

    let query = supabase
      .from('ts_escalations')
      .select('*')
      .order('created_at', { ascending: false })

    // Filter by view
    if (view === 'my') {
      query = query.eq('escalated_by', user.id)
    } else if (view === 'assigned') {
      query = query.eq('escalated_to', user.id)
    }
    // 'all' shows everything user has access to (handled by RLS)

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_CUSTOMER'])
    }

    if (type) {
      query = query.eq('escalation_type', type)
    }

    const { data: escalations, error } = await query

    if (error) throw error

    // Get stats
    const openCount = escalations?.filter(e => e.status === 'OPEN').length || 0
    const criticalCount = escalations?.filter(e => e.severity === 'CRITICAL' && e.status !== 'RESOLVED').length || 0
    const overdueCount = escalations?.filter(e => {
      if (e.resolution_due_by && !['RESOLVED', 'CLOSED'].includes(e.status)) {
        return new Date(e.resolution_due_by) < new Date()
      }
      return false
    }).length || 0

    return NextResponse.json({
      success: true,
      data: {
        escalations: escalations || [],
        stats: {
          total: escalations?.length || 0,
          open: openCount,
          critical: criticalCount,
          overdue: overdueCount
        }
      }
    })
  } catch (error) {
    apiLogger.error('Get escalations error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch escalations' },
      { status: 500 }
    )
  }
}

// POST - Create escalation
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      call_id: z.string().uuid().optional(),

      task_id: z.string().uuid().optional(),

      lead_id: z.string().uuid().optional(),

      escalation_type: z.string().optional(),

      severity: z.string().optional().default('MEDIUM'),

      reason: z.string().optional(),

      description: z.string().optional(),

      escalated_to: z.string().optional(),

      customer_name: z.string().optional(),

      customer_phone: z.string().optional(),

      customer_sentiment: z.string().optional(),

      escalation_id: z.string().uuid(),

      action: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const {
      call_id,
      task_id,
      lead_id,
      escalation_type,
      severity = 'MEDIUM',
      reason,
      description,
      escalated_to,
      customer_name,
      customer_phone,
      customer_sentiment
    } = body

    if (!escalation_type || !reason) {
      return NextResponse.json({
        success: false,
        error: 'Escalation type and reason are required'
      }, { status: 400 })
    }

    // Calculate SLA times based on severity
    const now = new Date()
    let responseDueBy: Date
    let resolutionDueBy: Date

    switch (severity) {
      case 'CRITICAL':
        responseDueBy = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes
        resolutionDueBy = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours
        break
      case 'HIGH':
        responseDueBy = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes
        resolutionDueBy = new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4 hours
        break
      case 'MEDIUM':
        responseDueBy = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour
        resolutionDueBy = new Date(now.getTime() + 8 * 60 * 60 * 1000) // 8 hours
        break
      default: // LOW
        responseDueBy = new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4 hours
        resolutionDueBy = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours
    }

    const { data: escalation, error } = await supabase
      .from('ts_escalations')
      .insert({
        call_id,
        task_id,
        lead_id,
        escalation_type,
        severity,
        reason,
        description,
        escalated_by: user.id,
        escalated_from: user.id,
        escalated_to,
        response_due_by: responseDueBy.toISOString(),
        resolution_due_by: resolutionDueBy.toISOString(),
        customer_name,
        customer_phone,
        customer_sentiment,
        status: 'OPEN'
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: escalation
    })
  } catch (error) {
    apiLogger.error('Create escalation error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create escalation' },
      { status: 500 }
    )
  }
}

// PUT - Update escalation
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema2 = z.object({

      escalation_id: z.string().optional(),

      action: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { escalation_id, action, ...updates } = body

    if (!escalation_id) {
      return NextResponse.json({
        success: false,
        error: 'Escalation ID is required'
      }, { status: 400 })
    }

    const now = new Date()
    let updateData: any = { updated_at: now.toISOString() }

    switch (action) {
      case 'ACKNOWLEDGE':
        updateData.status = 'ACKNOWLEDGED'
        updateData.acknowledged_at = now.toISOString()
        updateData.acknowledged_by = user.id
        break

      case 'START_WORK':
        updateData.status = 'IN_PROGRESS'
        break

      case 'PENDING_CUSTOMER':
        updateData.status = 'PENDING_CUSTOMER'
        break

      case 'RESOLVE':
        updateData.status = 'RESOLVED'
        updateData.resolved_at = now.toISOString()
        updateData.resolved_by = user.id
        updateData.resolution_notes = updates.resolution_notes
        updateData.resolution_type = updates.resolution_type
        updateData.root_cause_category = updates.root_cause_category
        updateData.root_cause_details = updates.root_cause_details
        updateData.preventive_action = updates.preventive_action
        break

      case 'CLOSE':
        updateData.status = 'CLOSED'
        break

      case 'REOPEN':
        updateData.status = 'REOPENED'
        updateData.resolved_at = null
        updateData.resolved_by = null
        break

      case 'REASSIGN':
        updateData.escalated_to = updates.escalated_to
        break

      case 'UPDATE_COMPENSATION':
        updateData.compensation_offered = updates.compensation_offered
        updateData.compensation_approved = updates.compensation_approved
        break

      default:
        Object.assign(updateData, updates)
    }

    const { data: escalation, error } = await supabase
      .from('ts_escalations')
      .update(updateData)
      .eq('id', escalation_id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: escalation
    })
  } catch (error) {
    apiLogger.error('Update escalation error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update escalation' },
      { status: 500 }
    )
  }
}
