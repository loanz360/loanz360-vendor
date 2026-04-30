import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    let query = supabase
      .from('ts_scheduled_activities')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scheduled_at', `${date}T00:00:00`)
      .lte('scheduled_at', `${date}T23:59:59`)
      .order('scheduled_at', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('activity_type', type)
    }

    const { data: activities, error } = await query

    if (error) {
      apiLogger.error('Error fetching activities', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 })
    }

    return NextResponse.json(activities || [])
  } catch (error) {
    apiLogger.error('Error fetching activities', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { data, error } = await supabase
      .from('ts_scheduled_activities')
      .insert({
        sales_executive_id: user.id,
        lead_id: body.lead_id,
        activity_type: body.activity_type,
        scheduled_at: body.scheduled_at,
        notes: body.notes,
        priority: body.priority || 'medium',
        status: 'scheduled'
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating activity', error)
      return NextResponse.json({ success: false, error: 'Failed to create activity' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error creating activity', error)
    return NextResponse.json({ success: false, error: 'Failed to create activity' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { id, status, outcome, notes } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Activity ID is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (outcome) updateData.outcome = outcome
    if (notes) updateData.notes = notes
    if (status === 'completed') updateData.completed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('ts_scheduled_activities')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating activity', error)
      return NextResponse.json({ success: false, error: 'Failed to update activity' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error updating activity', error)
    return NextResponse.json({ success: false, error: 'Failed to update activity' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Activity ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ts_scheduled_activities')
      .delete()
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) {
      apiLogger.error('Error deleting activity', error)
      return NextResponse.json({ success: false, error: 'Failed to delete activity' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error deleting activity', error)
    return NextResponse.json({ success: false, error: 'Failed to delete activity' }, { status: 500 })
  }
}
