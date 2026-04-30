import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CurrentMonthPerformance, DigitalSalesMonthlyTargets, DigitalSalesDailyMetrics, MetricCard } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/digital-sales/current-month
 * Returns current month performance data for Digital Sales
 */
export async function GET(request: NextRequest) {
  try {
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
      .select('id, full_name, sub_role, location')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      apiLogger.error('User profile not found', {
        userId: user.id,
        error: profileError?.message,
      })
      return NextResponse.json(
        {
          error: 'User profile not found. Please contact administrator.',
          details: 'Your user profile needs to be set up before accessing performance data.',
        },
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

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch monthly targets
    const { data: targets } = await supabase
      .from('digital_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // If no targets, create default ones
    const monthlyTargets: DigitalSalesMonthlyTargets = targets || {
      id: '',
      user_id: user.id,
      month: currentMonth,
      year: currentYear,
      website_leads_target: 100,
      social_media_leads_target: 80,
      email_campaign_leads_target: 60,
      total_digital_leads_target: 240,
      leads_converted_target: 25,
      digital_conversion_rate_target: 10.0,
      revenue_target: 1000000,
      average_deal_size_target: 40000,
      campaigns_launched_target: 15,
      email_open_rate_target: 25.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Fetch current month daily metrics
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

    const { data: dailyMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .lte('metric_date', lastDayOfMonth.toISOString().split('T')[0])

    // Aggregate daily metrics
    const currentMetrics = aggregateDigitalSalesMetrics(dailyMetrics || [])

    // Calculate metric cards
    const metricCards: MetricCard[] = [
      {
        label: 'Website Leads',
        value: currentMetrics.total_website_leads,
        target: monthlyTargets.website_leads_target,
        achievementPercentage: (currentMetrics.total_website_leads / monthlyTargets.website_leads_target) * 100,
        icon: 'globe',
        color: 'blue',
        category: 'lead',
        description: 'Leads from website',
      },
      {
        label: 'Social Media Leads',
        value: currentMetrics.total_social_media_leads,
        target: monthlyTargets.social_media_leads_target,
        achievementPercentage: (currentMetrics.total_social_media_leads / monthlyTargets.social_media_leads_target) * 100,
        icon: 'share',
        color: 'purple',
        category: 'lead',
        description: 'Leads from social platforms',
      },
      {
        label: 'Email Campaign Leads',
        value: currentMetrics.total_email_campaign_leads,
        target: monthlyTargets.email_campaign_leads_target,
        achievementPercentage: (currentMetrics.total_email_campaign_leads / monthlyTargets.email_campaign_leads_target) * 100,
        icon: 'mail',
        color: 'green',
        category: 'lead',
        description: 'Leads from email campaigns',
      },
      {
        label: 'Total Digital Leads',
        value: currentMetrics.total_digital_leads,
        target: monthlyTargets.total_digital_leads_target,
        achievementPercentage: (currentMetrics.total_digital_leads / monthlyTargets.total_digital_leads_target) * 100,
        icon: 'users',
        color: 'blue',
        category: 'lead',
        description: 'All digital leads combined',
      },
      {
        label: 'Conversions',
        value: currentMetrics.total_conversions,
        target: monthlyTargets.leads_converted_target,
        achievementPercentage: (currentMetrics.total_conversions / monthlyTargets.leads_converted_target) * 100,
        icon: 'check-circle',
        color: 'green',
        category: 'conversion',
        description: 'Deals closed',
      },
      {
        label: 'Conversion Rate',
        value: currentMetrics.digital_conversion_rate,
        target: monthlyTargets.digital_conversion_rate_target,
        unit: '%',
        achievementPercentage: (currentMetrics.digital_conversion_rate / monthlyTargets.digital_conversion_rate_target) * 100,
        icon: 'trending-up',
        color: 'blue',
        category: 'conversion',
        description: 'Lead to deal conversion',
      },
      {
        label: 'Revenue Generated',
        value: currentMetrics.total_revenue,
        target: monthlyTargets.revenue_target,
        unit: 'Rs',
        achievementPercentage: (currentMetrics.total_revenue / monthlyTargets.revenue_target) * 100,
        icon: 'dollar-sign',
        color: 'green',
        category: 'revenue',
        description: 'Total sales revenue',
      },
      {
        label: 'Average Deal Size',
        value: currentMetrics.average_deal_size,
        target: monthlyTargets.average_deal_size_target,
        unit: 'Rs',
        achievementPercentage: (currentMetrics.average_deal_size / monthlyTargets.average_deal_size_target) * 100,
        icon: 'bar-chart',
        color: 'purple',
        category: 'quality',
        description: 'Avg revenue per deal',
      },
      {
        label: 'Campaigns Launched',
        value: currentMetrics.total_campaigns_launched,
        target: monthlyTargets.campaigns_launched_target,
        achievementPercentage: (currentMetrics.total_campaigns_launched / monthlyTargets.campaigns_launched_target) * 100,
        icon: 'zap',
        color: 'orange',
        category: 'activity',
        description: 'Marketing campaigns',
      },
      {
        label: 'Email Open Rate',
        value: currentMetrics.average_email_open_rate,
        target: monthlyTargets.email_open_rate_target,
        unit: '%',
        achievementPercentage: (currentMetrics.average_email_open_rate / monthlyTargets.email_open_rate_target) * 100,
        icon: 'mail-open',
        color: 'blue',
        category: 'quality',
        description: 'Email engagement',
      },
    ]

    // Calculate overall performance score
    const overallScore = calculateDigitalSalesPerformanceScore(currentMetrics, monthlyTargets)

    // Fetch monthly summary for ranking
    const { data: monthlySummary } = await supabase
      .from('digital_sales_monthly_summary')
      .select('company_rank, total_employees, percentile, performance_grade')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Calculate target achievement
    const targetAchievement = calculateTargetAchievement(metricCards)

    const response: CurrentMonthPerformance<DigitalSalesMonthlyTargets, typeof currentMetrics, any> = {
      userId: user.id,
      userName: profile.full_name,
      userRole: 'DIGITAL_SALES',
      month: currentMonth,
      year: currentYear,
      summary: {
        overallScore,
        grade: monthlySummary?.performance_grade || calculateGrade(overallScore),
        rank: monthlySummary?.company_rank || 0,
        totalEmployees: monthlySummary?.total_employees || 1,
        percentile: monthlySummary?.percentile || 0,
        targetAchievement,
        trend: 'stable',
        changeFromLastMonth: 0,
      },
      metrics: metricCards,
      targets: monthlyTargets,
      currentMetrics,
      insights: [],
      graphData: {
        daily: [],
        comparison: {
          self: [],
          average: [],
        },
      },
      leaderboard: [],
      currentUserRank: monthlySummary?.company_rank || 0,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in Digital Sales performance API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to aggregate daily metrics
function aggregateDigitalSalesMetrics(dailyMetrics: unknown[]): unknown {
  if (dailyMetrics.length === 0) {
    return {
      total_website_leads: 0,
      total_social_media_leads: 0,
      total_email_campaign_leads: 0,
      total_digital_leads: 0,
      total_conversions: 0,
      digital_conversion_rate: 0,
      total_revenue: 0,
      total_deals_count: 0,
      average_deal_size: 0,
      total_campaigns_launched: 0,
      average_email_open_rate: 0,
    }
  }

  const totals = dailyMetrics.reduce(
    (acc, metric) => ({
      total_website_leads: acc.total_website_leads + (metric.website_leads || 0),
      total_social_media_leads: acc.total_social_media_leads + (metric.social_media_leads || 0),
      total_email_campaign_leads: acc.total_email_campaign_leads + (metric.email_campaign_leads || 0),
      total_digital_leads: acc.total_digital_leads + (metric.total_digital_leads || 0),
      total_conversions: acc.total_conversions + (metric.leads_converted || 0),
      total_revenue: acc.total_revenue + (metric.revenue_generated || 0),
      total_deals_count: acc.total_deals_count + (metric.deals_closed_count || 0),
      total_campaigns_launched: acc.total_campaigns_launched + (metric.campaigns_launched || 0),
      email_open_rate_sum: acc.email_open_rate_sum + (metric.email_open_rate || 0),
    }),
    {
      total_website_leads: 0,
      total_social_media_leads: 0,
      total_email_campaign_leads: 0,
      total_digital_leads: 0,
      total_conversions: 0,
      total_revenue: 0,
      total_deals_count: 0,
      total_campaigns_launched: 0,
      email_open_rate_sum: 0,
    }
  )

  // Calculate derived metrics
  const digital_conversion_rate = totals.total_digital_leads > 0
    ? (totals.total_conversions / totals.total_digital_leads) * 100
    : 0

  const average_deal_size = totals.total_deals_count > 0
    ? totals.total_revenue / totals.total_deals_count
    : 0

  const average_email_open_rate = dailyMetrics.length > 0
    ? totals.email_open_rate_sum / dailyMetrics.length
    : 0

  return {
    total_website_leads: totals.total_website_leads,
    total_social_media_leads: totals.total_social_media_leads,
    total_email_campaign_leads: totals.total_email_campaign_leads,
    total_digital_leads: totals.total_digital_leads,
    total_conversions: totals.total_conversions,
    digital_conversion_rate,
    total_revenue: totals.total_revenue,
    total_deals_count: totals.total_deals_count,
    average_deal_size,
    total_campaigns_launched: totals.total_campaigns_launched,
    average_email_open_rate,
  }
}

// Helper function to calculate performance score
function calculateDigitalSalesPerformanceScore(current: unknown, targets: DigitalSalesMonthlyTargets): number {
  const weights = {
    website_leads: 0.15,
    social_leads: 0.10,
    email_leads: 0.10,
    conversions: 0.15,
    conversion_rate: 0.15,
    revenue: 0.20,
    deal_size: 0.05,
    campaigns: 0.05,
    email_open_rate: 0.05,
  }

  const scores = {
    website_leads: Math.min((current.total_website_leads / targets.website_leads_target) * 100, 100),
    social_leads: Math.min((current.total_social_media_leads / targets.social_media_leads_target) * 100, 100),
    email_leads: Math.min((current.total_email_campaign_leads / targets.email_campaign_leads_target) * 100, 100),
    conversions: Math.min((current.total_conversions / targets.leads_converted_target) * 100, 100),
    conversion_rate: Math.min((current.digital_conversion_rate / targets.digital_conversion_rate_target) * 100, 100),
    revenue: Math.min((current.total_revenue / targets.revenue_target) * 100, 100),
    deal_size: Math.min((current.average_deal_size / targets.average_deal_size_target) * 100, 100),
    campaigns: Math.min((current.total_campaigns_launched / targets.campaigns_launched_target) * 100, 100),
    email_open_rate: Math.min((current.average_email_open_rate / targets.email_open_rate_target) * 100, 100),
  }

  const overallScore =
    scores.website_leads * weights.website_leads +
    scores.social_leads * weights.social_leads +
    scores.email_leads * weights.email_leads +
    scores.conversions * weights.conversions +
    scores.conversion_rate * weights.conversion_rate +
    scores.revenue * weights.revenue +
    scores.deal_size * weights.deal_size +
    scores.campaigns * weights.campaigns +
    scores.email_open_rate * weights.email_open_rate

  return Math.round(overallScore)
}

// Helper function to calculate grade
function calculateGrade(score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

// Helper function to calculate overall target achievement
function calculateTargetAchievement(metricCards: MetricCard[]): number {
  if (metricCards.length === 0) return 0

  const totalAchievement = metricCards.reduce((sum, card) => sum + card.achievementPercentage, 0)
  return totalAchievement / metricCards.length
}
