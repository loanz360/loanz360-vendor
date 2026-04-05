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
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    const { data: targets, error } = await supabase
      .from('tele_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      apiLogger.error('Error fetching targets', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch targets' }, { status: 500 })
    }

    // Return default targets if none exist
    return NextResponse.json(targets || {
      calls_target: 50,
      connected_calls_target: 25,
      conversions_target: 10,
      revenue_target: 500000,
      quality_target: 4.0,
      talk_time_target: 180
    })
  } catch (error) {
    apiLogger.error('Error fetching targets', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch targets' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, month, ...targetData } = body

    const { data, error } = await supabase
      .from('tele_sales_targets')
      .upsert({
        user_id: user.id,
        year: year || new Date().getFullYear(),
        month: month || new Date().getMonth() + 1,
        ...targetData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,year,month'
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating targets', error)
      return NextResponse.json({ success: false, error: 'Failed to update targets' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    apiLogger.error('Error updating targets', error)
    return NextResponse.json({ success: false, error: 'Failed to update targets' }, { status: 500 })
  }
}
