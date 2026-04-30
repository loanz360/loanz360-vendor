import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

// Notification Tracking API
// POST: Track notification interactions (opens, clicks, dismissals)
// GET: Get tracking data for a notification

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const bodySchema = z.object({


      notification_id: z.string().uuid().optional(),


      action: z.string().optional(),


      timestamp: z.string().optional(),


      metadata: z.record(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      notification_id,
      action,
      timestamp,
      metadata
    } = body

    if (!notification_id || !action) {
      return NextResponse.json(
        { error: 'notification_id and action are required' },
        { status: 400 }
      )
    }

    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser()

    // Record tracking event
    const { error: trackingError } = await supabase
      .from('notification_tracking')
      .insert({
        notification_id,
        user_id: user?.id,
        action,
        timestamp: timestamp || new Date().toISOString(),
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })

    if (trackingError) {
      apiLogger.error('Tracking error', trackingError)
    }

    // Update notification status based on action
    if (action === 'opened' || action === 'clicked') {
      await supabase
        .from('notification_logs')
        .update({
          status: action === 'clicked' ? 'clicked' : 'opened',
          [`${action}_at`]: new Date().toISOString()
        })
        .eq('id', notification_id)

      await supabase
        .from('communication_delivery_logs')
        .update({
          status: action === 'clicked' ? 'clicked' : 'opened',
          [`${action}_at`]: new Date().toISOString()
        })
        .eq('id', notification_id)
    }

    // Update analytics counters
    await updateAnalytics(supabase, notification_id, action)

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Tracking error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notification_id = searchParams.get('notification_id')
    const campaign_id = searchParams.get('campaign_id')
    const from_date = searchParams.get('from')
    const to_date = searchParams.get('to')

    if (!notification_id && !campaign_id) {
      return NextResponse.json(
        { error: 'notification_id or campaign_id is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('notification_tracking')
      .select('*')
      .order('created_at', { ascending: false })

    if (notification_id) {
      query = query.eq('notification_id', notification_id)
    }

    if (from_date) {
      query = query.gte('created_at', from_date)
    }

    if (to_date) {
      query = query.lte('created_at', to_date)
    }

    const { data: events, error } = await query.limit(1000)

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Aggregate stats
    const stats = {
      total_events: events?.length || 0,
      opens: events?.filter(e => e.action === 'opened').length || 0,
      clicks: events?.filter(e => e.action === 'clicked').length || 0,
      dismissals: events?.filter(e => e.action === 'dismissed').length || 0,
      unique_users: new Set(events?.map(e => e.user_id).filter(Boolean)).size
    }

    return NextResponse.json({
      events: events || [],
      stats
    })
  } catch (error) {
    apiLogger.error('Tracking GET error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper to update analytics counters
async function updateAnalytics(supabase: Awaited<ReturnType<typeof createClient>>, notificationId: string, action: string) {
  try {
    const date = new Date().toISOString().split('T')[0]

    // Upsert daily analytics
    const { data: existing } = await supabase
      .from('notification_analytics_daily')
      .select('id, opens, clicks, dismissals')
      .eq('date', date)
      .maybeSingle()

    if (existing) {
      const updates: Record<string, number> = {}
      if (action === 'opened') updates.opens = (existing.opens || 0) + 1
      if (action === 'clicked') updates.clicks = (existing.clicks || 0) + 1
      if (action === 'dismissed') updates.dismissals = (existing.dismissals || 0) + 1

      await supabase
        .from('notification_analytics_daily')
        .update(updates)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('notification_analytics_daily')
        .insert({
          date,
          opens: action === 'opened' ? 1 : 0,
          clicks: action === 'clicked' ? 1 : 0,
          dismissals: action === 'dismissed' ? 1 : 0,
          sent: 0,
          delivered: 0,
          failed: 0
        })
    }
  } catch (error) {
    apiLogger.error('Analytics update error', error)
  }
}
