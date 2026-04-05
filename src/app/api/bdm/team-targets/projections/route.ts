export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const bdeUserId = request.nextUrl.searchParams.get('bdeUserId')
    const month = request.nextUrl.searchParams.get('month') || new Date().toISOString().split('T')[0]

    let query = supabase.from('performance_projections').select('*').gte('projection_month', month)
    if (bdeUserId) query = query.eq('bde_user_id', bdeUserId)

    const { data, error } = await query.order('projection_month', { ascending: false })
    if (error) throw error
    return NextResponse.json({ success: true, data: { projections: data || [] } })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { bdeUserId, projectionMonth, currentLeads, currentConversions, currentRevenue, projectedLeads, projectedConversions, projectedRevenue, confidenceScore, likelihood } = body

    const now = new Date()
    const monthStart = new Date(projectionMonth)
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const daysElapsed = now.getDate()
    const daysRemaining = monthEnd.getDate() - daysElapsed

    const { data, error } = await supabase
      .from('performance_projections')
      .upsert({
        bde_user_id: bdeUserId, projection_month: projectionMonth,
        current_leads: currentLeads, current_conversions: currentConversions, current_revenue: currentRevenue,
        projected_leads: projectedLeads, projected_conversions: projectedConversions, projected_revenue: projectedRevenue,
        confidence_score: confidenceScore, likelihood: likelihood || 'medium',
        days_elapsed: daysElapsed, days_remaining: daysRemaining,
        calculation_date: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'bde_user_id,projection_month' })
      .select().maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data, message: 'Projection saved' })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
