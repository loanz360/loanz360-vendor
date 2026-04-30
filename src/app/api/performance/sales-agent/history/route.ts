import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 })
    }

    if (profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Sales Agents only.' },
        { status: 403 }
      )
    }

    const { data: summaries, error: summariesError } = await supabase
      .from('sales_agent_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)

    if (summariesError) {
      apiLogger.error('Error fetching monthly summaries', summariesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch performance history' }, { status: 500 })
    }

    const formattedHistory = (summaries || []).map((s: unknown) => ({
      month: s.month,
      year: s.year,
      period: new Date(s.year, s.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      overallScore: s.performance_score || 0,
      grade: s.performance_grade || 'N/A',
      rank: s.company_rank || 0,
      totalEmployees: s.total_employees || 0,
      percentile: s.percentile || 0,
      targetAchievement: s.target_achievement_percentage || 0,
      highlights: [
        `Revenue: ₹${(s.total_revenue || 0).toLocaleString('en-IN')}`,
        `Calls Made: ${s.total_calls || 0}`,
        `Leads Qualified: ${s.total_leads_qualified || 0}`,
        `Conversion Rate: ${(s.conversion_rate || 0).toFixed(1)}%`,
      ],
      metrics: {
        totalRevenue: s.total_revenue || 0,
        totalCalls: s.total_calls || 0,
        totalLeadsQualified: s.total_leads_qualified || 0,
        totalAppointmentsSet: s.total_appointments_set || 0,
        conversionRate: s.conversion_rate || 0,
      },
    }))

    return NextResponse.json({
      userId: user.id,
      userName: profile.full_name,
      history: formattedHistory,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Sales Agent history API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
