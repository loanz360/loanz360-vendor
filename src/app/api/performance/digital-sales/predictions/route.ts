import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/digital-sales/predictions
 * Returns AI-powered predictions and forecasts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIGITAL_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Digital Sales only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const remainingDays = daysInMonth - dayOfMonth

    // Get last 90 days of daily metrics for trend analysis
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const { data: historicalMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', ninetyDaysAgo)
      .order('metric_date', { ascending: true })

    // Get current month metrics
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
    const { data: mtdMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth)

    // Get targets
    const { data: targets } = await supabase
      .from('digital_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const leadTarget = (targets?.website_leads_target || 100) +
                       (targets?.social_leads_target || 80) +
                       (targets?.email_leads_target || 60)
    const revenueTarget = targets?.revenue_target || 1000000
    const conversionTarget = targets?.conversion_rate_target || 10

    // Calculate MTD totals
    const mtdLeads = mtdMetrics?.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) || 0
    const mtdRevenue = mtdMetrics?.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) || 0
    const mtdConversions = mtdMetrics?.reduce((sum, d) => sum + (d.leads_converted || 0), 0) || 0

    // Calculate daily averages from historical data
    const last30Days = historicalMetrics?.slice(-30) || []
    const avgDailyLeads = last30Days.length > 0
      ? last30Days.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) / last30Days.length
      : 0
    const avgDailyRevenue = last30Days.length > 0
      ? last30Days.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) / last30Days.length
      : 0

    // Calculate trend (comparing last 15 days to previous 15 days)
    const recent15 = last30Days.slice(-15)
    const previous15 = last30Days.slice(0, 15)

    const recentAvgLeads = recent15.length > 0
      ? recent15.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) / recent15.length
      : 0
    const previousAvgLeads = previous15.length > 0
      ? previous15.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) / previous15.length
      : 0
    const leadsTrend = previousAvgLeads > 0 ? ((recentAvgLeads - previousAvgLeads) / previousAvgLeads) * 100 : 0

    const recentAvgRevenue = recent15.length > 0
      ? recent15.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) / recent15.length
      : 0
    const previousAvgRevenue = previous15.length > 0
      ? previous15.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) / previous15.length
      : 0
    const revenueTrend = previousAvgRevenue > 0 ? ((recentAvgRevenue - previousAvgRevenue) / previousAvgRevenue) * 100 : 0

    // Project end-of-month values using weighted average (recent performance weighted more)
    const weightedDailyLeads = (recentAvgLeads * 0.7 + avgDailyLeads * 0.3)
    const weightedDailyRevenue = (recentAvgRevenue * 0.7 + avgDailyRevenue * 0.3)

    const predictedLeads = Math.round(mtdLeads + (weightedDailyLeads * remainingDays))
    const predictedRevenue = Math.round(mtdRevenue + (weightedDailyRevenue * remainingDays))
    const predictedConversionRate = predictedLeads > 0
      ? (mtdConversions + Math.round(weightedDailyLeads * remainingDays * 0.12)) / predictedLeads * 100
      : 0

    // Calculate confidence based on data consistency
    const stdDevLeads = calculateStdDev(last30Days.map(d => d.total_digital_leads || d.total_leads || 0))
    const cvLeads = avgDailyLeads > 0 ? (stdDevLeads / avgDailyLeads) * 100 : 100
    const leadsConfidence = Math.max(50, Math.min(95, 100 - cvLeads))

    const stdDevRevenue = calculateStdDev(last30Days.map(d => d.revenue_generated || 0))
    const cvRevenue = avgDailyRevenue > 0 ? (stdDevRevenue / avgDailyRevenue) * 100 : 100
    const revenueConfidence = Math.max(50, Math.min(95, 100 - cvRevenue))

    // Predict grade based on target achievement
    const predictedLeadsAchievement = (predictedLeads / leadTarget) * 100
    const predictedRevenueAchievement = (predictedRevenue / revenueTarget) * 100
    const overallAchievement = (predictedLeadsAchievement * 0.4 + predictedRevenueAchievement * 0.6)

    const predictedGrade = overallAchievement >= 95 ? 'A+' :
                          overallAchievement >= 90 ? 'A' :
                          overallAchievement >= 85 ? 'B+' :
                          overallAchievement >= 80 ? 'B' :
                          overallAchievement >= 75 ? 'C+' :
                          overallAchievement >= 70 ? 'C' :
                          overallAchievement >= 60 ? 'D' : 'F'

    // Calculate required daily performance to meet targets
    const requiredDailyLeads = remainingDays > 0 ? Math.ceil((leadTarget - mtdLeads) / remainingDays) : 0
    const requiredDailyRevenue = remainingDays > 0 ? Math.ceil((revenueTarget - mtdRevenue) / remainingDays) : 0

    // Generate recommendations
    const recommendations = []

    if (predictedLeads < leadTarget) {
      const gap = leadTarget - predictedLeads
      recommendations.push({
        type: 'leads',
        priority: gap > leadTarget * 0.2 ? 'high' : 'medium',
        title: 'Lead Generation Gap',
        message: `You're projected to be ${gap} leads short of target. Increase daily lead generation by ${Math.ceil(gap / remainingDays)} leads.`,
        actions: [
          'Increase ad spend on high-converting channels',
          'Launch targeted email campaigns',
          'Optimize landing page conversions',
        ],
      })
    }

    if (predictedRevenue < revenueTarget) {
      const gap = revenueTarget - predictedRevenue
      recommendations.push({
        type: 'revenue',
        priority: gap > revenueTarget * 0.2 ? 'high' : 'medium',
        title: 'Revenue Target Alert',
        message: `You're projected to be ₹${Math.round(gap).toLocaleString('en-IN')} short. Focus on high-value conversions.`,
        actions: [
          'Prioritize leads with higher deal potential',
          'Upsell to existing pipeline',
          'Reduce discount offers',
        ],
      })
    }

    if (leadsTrend < -10) {
      recommendations.push({
        type: 'trend',
        priority: 'high',
        title: 'Declining Lead Trend',
        message: `Your lead generation has dropped ${Math.abs(Math.round(leadsTrend))}% in the last 15 days.`,
        actions: [
          'Review recent campaign performance',
          'Check for technical issues on landing pages',
          'Analyze competitor activity',
        ],
      })
    }

    // Best and worst days analysis
    const dayOfWeekStats = analyzeDayOfWeekPerformance(historicalMetrics || [])

    // Month-over-month comparison
    const prevMonthStart = new Date(currentYear, currentMonth - 2, 1).toISOString().split('T')[0]
    const prevMonthEnd = new Date(currentYear, currentMonth - 1, 0).toISOString().split('T')[0]
    const { data: prevMonthMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', prevMonthStart)
      .lte('metric_date', prevMonthEnd)

    const prevMonthLeads = prevMonthMetrics?.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) || 0
    const prevMonthRevenue = prevMonthMetrics?.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) || 0

    // Pace to match previous month
    const paceToMatchLeads = dayOfMonth > 0 ? (prevMonthLeads / daysInMonth) * dayOfMonth : 0
    const paceToMatchRevenue = dayOfMonth > 0 ? (prevMonthRevenue / daysInMonth) * dayOfMonth : 0

    return NextResponse.json({
      userId: user.id,
      userName: profile.full_name,
      generatedAt: new Date().toISOString(),

      // Current progress
      currentProgress: {
        dayOfMonth,
        daysInMonth,
        remainingDays,
        percentComplete: (dayOfMonth / daysInMonth) * 100,
        mtdLeads,
        mtdRevenue,
        mtdConversions,
      },

      // Targets
      targets: {
        leads: leadTarget,
        revenue: revenueTarget,
        conversionRate: conversionTarget,
      },

      // Predictions
      predictions: {
        leads: {
          predicted: predictedLeads,
          target: leadTarget,
          achievement: predictedLeadsAchievement,
          willMeetTarget: predictedLeads >= leadTarget,
          confidence: Math.round(leadsConfidence),
          trend: leadsTrend,
        },
        revenue: {
          predicted: predictedRevenue,
          target: revenueTarget,
          achievement: predictedRevenueAchievement,
          willMeetTarget: predictedRevenue >= revenueTarget,
          confidence: Math.round(revenueConfidence),
          trend: revenueTrend,
        },
        conversionRate: {
          predicted: Math.round(predictedConversionRate * 10) / 10,
          target: conversionTarget,
        },
        grade: {
          predicted: predictedGrade,
          overallAchievement: Math.round(overallAchievement),
        },
      },

      // Required pace to meet targets
      requiredPace: {
        dailyLeads: Math.max(0, requiredDailyLeads),
        dailyRevenue: Math.max(0, requiredDailyRevenue),
        feasibility: {
          leads: requiredDailyLeads <= avgDailyLeads * 1.5 ? 'achievable' : requiredDailyLeads <= avgDailyLeads * 2 ? 'challenging' : 'unlikely',
          revenue: requiredDailyRevenue <= avgDailyRevenue * 1.5 ? 'achievable' : requiredDailyRevenue <= avgDailyRevenue * 2 ? 'challenging' : 'unlikely',
        },
      },

      // Day of week analysis
      dayOfWeekAnalysis: dayOfWeekStats,

      // Month-over-month comparison
      monthComparison: {
        previousMonth: {
          leads: prevMonthLeads,
          revenue: prevMonthRevenue,
        },
        paceComparison: {
          leadsOnPace: mtdLeads >= paceToMatchLeads,
          revenueOnPace: mtdRevenue >= paceToMatchRevenue,
          leadsDiff: mtdLeads - paceToMatchLeads,
          revenueDiff: mtdRevenue - paceToMatchRevenue,
        },
      },

      // AI Recommendations
      recommendations,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in predictions API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length
  return Math.sqrt(avgSquaredDiff)
}

// Helper function to analyze performance by day of week
function analyzeDayOfWeekPerformance(metrics: any[]): any {
  const dayStats: Record<number, { leads: number[], revenue: number[] }> = {
    0: { leads: [], revenue: [] }, // Sunday
    1: { leads: [], revenue: [] }, // Monday
    2: { leads: [], revenue: [] }, // Tuesday
    3: { leads: [], revenue: [] }, // Wednesday
    4: { leads: [], revenue: [] }, // Thursday
    5: { leads: [], revenue: [] }, // Friday
    6: { leads: [], revenue: [] }, // Saturday
  }

  metrics.forEach(m => {
    const date = new Date(m.metric_date)
    const day = date.getDay()
    dayStats[day].leads.push(m.total_digital_leads || m.total_leads || 0)
    dayStats[day].revenue.push(m.revenue_generated || 0)
  })

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const analysis = Object.entries(dayStats).map(([day, stats]) => ({
    day: dayNames[parseInt(day)],
    dayNumber: parseInt(day),
    avgLeads: stats.leads.length > 0 ? Math.round(stats.leads.reduce((a, b) => a + b, 0) / stats.leads.length) : 0,
    avgRevenue: stats.revenue.length > 0 ? Math.round(stats.revenue.reduce((a, b) => a + b, 0) / stats.revenue.length) : 0,
    sampleSize: stats.leads.length,
  })).filter(d => d.sampleSize > 0)

  const bestDay = analysis.reduce((best, current) =>
    current.avgRevenue > best.avgRevenue ? current : best, analysis[0])

  const worstDay = analysis.reduce((worst, current) =>
    current.avgRevenue < worst.avgRevenue ? current : worst, analysis[0])

  return {
    byDay: analysis,
    bestDay: bestDay?.day || 'N/A',
    worstDay: worstDay?.day || 'N/A',
    recommendation: bestDay && worstDay
      ? `Focus high-value activities on ${bestDay.day}. Consider lighter tasks on ${worstDay.day}.`
      : 'More data needed for recommendations.',
  }
}
