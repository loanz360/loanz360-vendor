import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/digital-sales/history
 * Returns historical performance data for the last 6 months
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Verify user is Digital Sales
    if (profile.sub_role !== 'DIGITAL_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Digital Sales only.' },
        { status: 403 }
      )
    }

    // Get last 6 months of performance summaries
    const { data: summaries, error: summariesError } = await supabase
      .from('digital_sales_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)

    if (summariesError) {
      apiLogger.error('Error fetching monthly summaries', summariesError)
      return NextResponse.json(
        { error: 'Failed to fetch performance history' },
        { status: 500 }
      )
    }

    // Format historical data
    const formattedHistory = (summaries || []).map((s: unknown) => ({
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
        `Revenue: ₹${(s.total_revenue || 0).toLocaleString('en-IN')}`,
        `Conversions: ${s.total_conversions || 0}`,
        `Digital Leads: ${s.total_digital_leads || 0}`,
        `Conversion Rate: ${(s.digital_conversion_rate || 0).toFixed(1)}%`,
      ],
      metrics: {
        totalRevenue: s.total_revenue || 0,
        totalConversions: s.total_conversions || 0,
        totalDigitalLeads: s.total_digital_leads || 0,
        totalWebsiteLeads: s.total_website_leads || 0,
        totalSocialMediaLeads: s.total_social_media_leads || 0,
        totalEmailCampaignLeads: s.total_email_campaign_leads || 0,
        digitalConversionRate: s.digital_conversion_rate || 0,
        averageDealSize: s.average_deal_size || 0,
        totalCampaignsLaunched: s.total_campaigns_launched || 0,
        averageEmailOpenRate: s.average_email_open_rate || 0,
      },
    }))

    return NextResponse.json({
      userId: user.id,
      userName: profile.full_name,
      history: formattedHistory,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Digital Sales history API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
