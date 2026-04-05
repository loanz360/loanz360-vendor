export const dynamic = 'force-dynamic'

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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const date = searchParams.get('date')

    let query = supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .order('metric_date', { ascending: false })

    if (date) {
      query = query.eq('metric_date', date)
    } else if (startDate && endDate) {
      query = query.gte('metric_date', startDate).lte('metric_date', endDate)
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      query = query.gte('metric_date', thirtyDaysAgo.toISOString().split('T')[0])
    }

    const { data: metrics, error } = await query.limit(30)

    if (error) {
      apiLogger.error('Error fetching daily metrics', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch daily metrics' }, { status: 500 })
    }

    return NextResponse.json(metrics || [])
  } catch (error) {
    apiLogger.error('Error fetching daily metrics', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch daily metrics' }, { status: 500 })
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

    const body = await request.json()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('tele_sales_daily_metrics')
      .upsert({
        user_id: user.id,
        metric_date: body.metric_date || today,
        total_calls: body.total_calls || 0,
        connected_calls: body.connected_calls || 0,
        missed_calls: body.missed_calls || 0,
        voicemail_left: body.voicemail_left || 0,
        callbacks_scheduled: body.callbacks_scheduled || 0,
        callbacks_completed: body.callbacks_completed || 0,
        total_talk_time: body.total_talk_time || 0,
        average_call_duration: body.average_call_duration || 0,
        longest_call: body.longest_call || 0,
        conversions: body.conversions || 0,
        leads_qualified: body.leads_qualified || 0,
        leads_rejected: body.leads_rejected || 0,
        revenue_generated: body.revenue_generated || 0,
        quality_score: body.quality_score,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,metric_date'
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error saving daily metrics', error)
      return NextResponse.json({ success: false, error: 'Failed to save daily metrics' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error saving daily metrics', error)
    return NextResponse.json({ success: false, error: 'Failed to save daily metrics' }, { status: 500 })
  }
}
