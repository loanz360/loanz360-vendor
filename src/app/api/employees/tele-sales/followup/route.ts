import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get follow-up dashboard data
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // Get active follow-up instances
    let instancesQuery = supabase
      .from('ts_followup_instances')
      .select(`
        *,
        sequence:ts_followup_sequences(id, name, category, total_steps)
      `)
      .eq('sales_executive_id', user.id)
      .order('next_action_at', { ascending: true })
      .limit(limit)

    if (status) {
      instancesQuery = instancesQuery.eq('status', status)
    } else {
      instancesQuery = instancesQuery.in('status', ['ACTIVE', 'PAUSED'])
    }

    const { data: instances, error: instancesError } = await instancesQuery

    if (instancesError) throw instancesError

    // Get upcoming actions
    const { data: upcomingActions, error: actionsError } = await supabase
      .from('ts_followup_actions')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('status', 'PENDING')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10)

    if (actionsError) throw actionsError

    // Get stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const { data: stats } = await supabase
      .from('ts_followup_instances')
      .select('status, final_outcome')
      .eq('sales_executive_id', user.id)

    const activeCount = stats?.filter(s => s.status === 'ACTIVE').length || 0
    const completedToday = stats?.filter(s =>
      s.status === 'COMPLETED'
    ).length || 0

    const conversions = stats?.filter(s => s.final_outcome === 'CONVERTED').length || 0
    const totalCompleted = stats?.filter(s => s.status === 'COMPLETED').length || 0
    const conversionRate = totalCompleted > 0 ? (conversions / totalCompleted) * 100 : 0

    // Status distribution
    const statusDistribution: Record<string, number> = {}
    stats?.forEach(s => {
      statusDistribution[s.status] = (statusDistribution[s.status] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        instances: instances || [],
        upcoming_actions: upcomingActions || [],
        stats: {
          active_sequences: activeCount,
          pending_actions: upcomingActions?.length || 0,
          completed_today: completedToday,
          conversion_rate: Math.round(conversionRate * 10) / 10,
          sequences_by_status: statusDistribution
        }
      }
    })
  } catch (error) {
    apiLogger.error('Follow-up dashboard error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch follow-up data' },
      { status: 500 }
    )
  }
}

// POST - Start a new follow-up sequence
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      sequence_id: z.string().uuid().optional(),

      lead_id: z.string().uuid().optional(),

      customer_id: z.string().uuid().optional(),

      phone_number: z.string().min(10).optional(),

      contact_name: z.string().optional(),

      trigger_reason: z.string().optional(),

      instance_id: z.string().uuid().optional(),

      action: z.string().optional(),

      stop_reason: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const {
      sequence_id,
      lead_id,
      customer_id,
      phone_number,
      contact_name,
      trigger_reason
    } = body

    if (!sequence_id || !phone_number || !contact_name) {
      return NextResponse.json({
        success: false,
        error: 'Sequence ID, phone number, and contact name are required'
      }, { status: 400 })
    }

    // Get sequence details
    const { data: sequence, error: sequenceError } = await supabase
      .from('ts_followup_sequences')
      .select('*')
      .eq('id', sequence_id)
      .eq('is_active', true)
      .maybeSingle()

    if (sequenceError || !sequence) {
      return NextResponse.json({
        success: false,
        error: 'Sequence not found or inactive'
      }, { status: 404 })
    }

    // Check if active sequence already exists for this lead/phone
    const { data: existingInstance } = await supabase
      .from('ts_followup_instances')
      .select('id')
      .eq('sequence_id', sequence_id)
      .eq('phone_number', phone_number)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (existingInstance) {
      return NextResponse.json({
        success: false,
        error: 'An active sequence already exists for this contact'
      }, { status: 409 })
    }

    // Calculate first action time
    const steps = sequence.steps as unknown[]
    const firstStep = steps[0]
    const firstActionTime = new Date(Date.now() + (firstStep?.delay_hours || 2) * 60 * 60 * 1000)

    // Create instance
    const { data: instance, error: instanceError } = await supabase
      .from('ts_followup_instances')
      .insert({
        sequence_id,
        sales_executive_id: user.id,
        lead_id,
        customer_id,
        phone_number,
        contact_name,
        trigger_reason: trigger_reason || 'Manually started',
        total_steps: sequence.total_steps,
        next_action_at: firstActionTime.toISOString()
      })
      .select()
      .maybeSingle()

    if (instanceError) throw instanceError

    // Create follow-up actions for each step
    const actionsToInsert = steps.map((step, index) => {
      const scheduledAt = new Date(Date.now() + (step.delay_hours || 0) * 60 * 60 * 1000)
      return {
        instance_id: instance.id,
        sequence_id,
        sales_executive_id: user.id,
        step_number: index + 1,
        action_type: step.type,
        action_config: step,
        scheduled_at: scheduledAt.toISOString(),
        status: 'PENDING'
      }
    })

    const { error: actionsError } = await supabase
      .from('ts_followup_actions')
      .insert(actionsToInsert)

    if (actionsError) {
      apiLogger.error('Error creating actions', actionsError)
    }

    return NextResponse.json({
      success: true,
      data: instance
    })
  } catch (error) {
    apiLogger.error('Start sequence error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start follow-up sequence' },
      { status: 500 }
    )
  }
}

// PUT - Update follow-up instance (pause, stop, resume)
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema2 = z.object({

      instance_id: z.string().optional(),

      stop_reason: z.string().optional(),

      action: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { instance_id, action, stop_reason } = body

    if (!instance_id || !action) {
      return NextResponse.json({
        success: false,
        error: 'Instance ID and action are required'
      }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'PAUSE':
        updates.status = 'PAUSED'
        break
      case 'RESUME':
        updates.status = 'ACTIVE'
        break
      case 'STOP':
        updates.status = 'STOPPED'
        updates.stopped_at = new Date().toISOString()
        updates.stop_reason = stop_reason || 'Manually stopped'
        break
      case 'COMPLETE':
        updates.status = 'COMPLETED'
        updates.completed_at = new Date().toISOString()
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: PAUSE, RESUME, STOP, or COMPLETE'
        }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ts_followup_instances')
      .update(updates)
      .eq('id', instance_id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    apiLogger.error('Update instance error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update follow-up instance' },
      { status: 500 }
    )
  }
}
