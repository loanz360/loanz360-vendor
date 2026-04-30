import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { requireCROAuth } from '@/lib/middleware/cro-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Fetch personal goals for the authenticated CRO
    const { data: goals, error } = await supabase
      .from('cro_personal_goals')
      .select('*')
      .eq('cro_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table may not exist yet - return empty array gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, data: [] })
      }
      apiLogger.error('Error fetching personal goals', error)
      return NextResponse.json({ success: true, data: [] })
    }

    // Enrich goals with current metric values from cro_monthly_summary
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data: summary } = await supabase
      .from('cro_monthly_summary')
      .select('*')
      .eq('cro_id', user.id)
      .eq('month', currentMonth)
      .eq('year', now.getFullYear())
      .maybeSingle()

    // Map metric names to their current values from summary
    const metricValueMap: Record<string, number> = {
      calls_made: summary?.total_calls_made || 0,
      leads_converted: summary?.total_leads_converted || 0,
      revenue: summary?.total_revenue || 0,
      cases_disbursed: summary?.total_cases_disbursed || 0,
      customer_satisfaction: summary?.avg_customer_satisfaction || 0,
      conversion_rate: summary?.conversion_rate || 0,
    }

    const enrichedGoals = (goals || []).map(goal => ({
      ...goal,
      current_value: metricValueMap[goal.metric_name] ?? goal.current_value ?? 0,
    }))

    return NextResponse.json({ success: true, data: enrichedGoals })
  } catch (error) {
    apiLogger.error('Error in goals GET', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch goals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { metric_name, personal_target } = body

    if (!metric_name || personal_target === undefined || personal_target === null) {
      return NextResponse.json(
        { success: false, error: 'metric_name and personal_target are required' },
        { status: 400 }
      )
    }

    if (typeof personal_target !== 'number' || personal_target <= 0) {
      return NextResponse.json(
        { success: false, error: 'personal_target must be a positive number' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Calculate bonus multiplier based on how much above company target
    // Default: 1.0x at target, up to 2.0x at 2x target
    const bonusMultiplier = personal_target > 0 ? Math.min(2.0, Math.max(1.0, 1 + (personal_target / 100) * 0.5)) : 1.0

    // Upsert the goal (one goal per metric per CRO)
    const { data, error } = await supabase
      .from('cro_personal_goals')
      .upsert(
        {
          cro_id: user.id,
          metric_name,
          personal_target,
          bonus_multiplier: Math.round(bonusMultiplier * 10) / 10,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cro_id,metric_name' }
      )
      .select()
      .single()

    if (error) {
      // Table may not exist yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        apiLogger.warn('cro_personal_goals table does not exist yet')
        return NextResponse.json(
          { success: false, error: 'Goals feature not yet available. Migration pending.' },
          { status: 503 }
        )
      }
      apiLogger.error('Error saving personal goal', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save goal' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('Error in goals POST', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save goal' },
      { status: 500 }
    )
  }
}