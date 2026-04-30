
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
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month')
    const limit = parseInt(searchParams.get('limit') || '12')

    let query = supabase
      .from('tele_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (month) {
      query = query.eq('year', year).eq('month', parseInt(month))
    } else {
      query = query.limit(limit)
    }

    const { data: summaries, error } = await query

    if (error) {
      apiLogger.error('Error fetching monthly summary', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch monthly summary' }, { status: 500 })
    }

    // If single month requested, return single object
    if (month && summaries && summaries.length > 0) {
      return NextResponse.json(summaries[0])
    }

    return NextResponse.json(summaries || [])
  } catch (error) {
    apiLogger.error('Error fetching monthly summary', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch monthly summary' }, { status: 500 })
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
    const now = new Date()

    const { data, error } = await supabase
      .from('tele_sales_monthly_summary')
      .upsert({
        user_id: user.id,
        year: body.year || now.getFullYear(),
        month: body.month || now.getMonth() + 1,
        total_working_days: body.total_working_days || 0,
        days_worked: body.days_worked || 0,
        total_calls: body.total_calls || 0,
        total_connected: body.total_connected || 0,
        total_talk_time: body.total_talk_time || 0,
        total_conversions: body.total_conversions || 0,
        total_revenue: body.total_revenue || 0,
        average_quality_score: body.average_quality_score,
        calls_target_achieved: body.calls_target_achieved || 0,
        conversions_target_achieved: body.conversions_target_achieved || 0,
        revenue_target_achieved: body.revenue_target_achieved || 0,
        performance_score: body.performance_score || 0,
        performance_grade: body.performance_grade || 'N/A',
        company_rank: body.company_rank,
        team_rank: body.team_rank,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,year,month'
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error saving monthly summary', error)
      return NextResponse.json({ success: false, error: 'Failed to save monthly summary' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error saving monthly summary', error)
    return NextResponse.json({ success: false, error: 'Failed to save monthly summary' }, { status: 500 })
  }
}
