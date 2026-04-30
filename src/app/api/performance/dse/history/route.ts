import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dse/history
 * Returns historical performance data for the last 6 months
 *
 * DB table: dse_monthly_summary
 *   Old schema (20251123): user_id, total_field_visits, total_conversions, total_revenue,
 *     field_conversion_rate, total_meetings_attended, total_leads_generated, average_deal_size,
 *     territory_coverage_percentage, performance_score, performance_grade, company_rank,
 *     total_employees, percentile, target_achievement_percentage
 *   New schema (20251201): dse_user_id, total_visits, leads_converted, total_converted_revenue,
 *     conversion_rate, total_meetings, leads_generated, average_deal_size,
 *     performance_score, performance_grade, company_rank, team_rank, percentile,
 *     target_achievement_percentage
 *
 * Uses admin client to bypass RLS after auth.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to verify DSE role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 })
    }

    if (profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales Executives only.' },
        { status: 403 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient = createSupabaseAdmin()

    // Try user_id first (old schema from 20251123), then dse_user_id (new schema from 20251201)
    let summaries: unknown[] = []

    const { data: s1, error: s1Err } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)

    if (!s1Err && s1 && s1.length > 0) {
      summaries = s1
    } else {
      const { data: s2 } = await adminClient
        .from('dse_monthly_summary')
        .select('*')
        .eq('dse_user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(6)
      summaries = s2 || []
    }

    // Format historical data — handle both old and new column names
    const formattedHistory = summaries.map((s: unknown) => ({
      month: s.month,
      year: s.year,
      period: new Date(s.year, s.month - 1).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
      overallScore: s.performance_score || 0,
      grade: s.performance_grade || 'N/A',
      rank: s.company_rank || 0,
      totalEmployees: s.total_employees || 0,
      percentile: s.percentile || 0,
      targetAchievement: s.target_achievement_percentage || 0,
      highlights: [
        `Revenue: ₹${(Number(s.total_revenue || s.total_converted_revenue) || 0).toLocaleString('en-IN')}`,
        `Conversions: ${s.total_conversions || s.leads_converted || 0}`,
        `Field Visits: ${s.total_field_visits || s.total_visits || 0}`,
        `Conversion Rate: ${(Number(s.field_conversion_rate || s.conversion_rate) || 0).toFixed(1)}%`,
      ],
      metrics: {
        totalRevenue: Number(s.total_revenue || s.total_converted_revenue) || 0,
        totalConversions: s.total_conversions || s.leads_converted || 0,
        totalFieldVisits: s.total_field_visits || s.total_visits || 0,
        totalMeetingsAttended: s.total_meetings_attended || s.total_meetings || 0,
        totalLeadsGenerated: s.total_leads_generated || s.leads_generated || 0,
        fieldConversionRate: Number(s.field_conversion_rate || s.conversion_rate) || 0,
        averageDealSize: Number(s.average_deal_size) || 0,
        territoryCoverage: Number(s.territory_coverage_percentage) || 0,
      },
    }))

    return NextResponse.json({
      userId: user.id,
      userName: profile.full_name,
      history: formattedHistory,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DSE history API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
