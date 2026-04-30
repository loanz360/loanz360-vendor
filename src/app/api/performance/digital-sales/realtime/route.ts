import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/digital-sales/realtime
 * Returns real-time performance metrics for Digital Sales
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

    // Get today's date
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Fetch today's metrics
    const { data: todayMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('metric_date', today)
      .maybeSingle()

    // Fetch yesterday's metrics for comparison
    const { data: yesterdayMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('metric_date', yesterday)
      .maybeSingle()

    // Fetch last 30 days for average calculation
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const { data: last30Days } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', thirtyDaysAgo)
      .lt('metric_date', today)

    // Calculate averages
    const avgLeads = last30Days && last30Days.length > 0
      ? last30Days.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) / last30Days.length
      : 0

    const avgRevenue = last30Days && last30Days.length > 0
      ? last30Days.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) / last30Days.length
      : 0

    // Get current values
    const todayLeads = todayMetrics?.total_digital_leads || todayMetrics?.total_leads || 0
    const todayRevenue = todayMetrics?.revenue_generated || 0
    const todayConversions = todayMetrics?.leads_converted || 0

    const yesterdayLeads = yesterdayMetrics?.total_digital_leads || yesterdayMetrics?.total_leads || 0
    const yesterdayRevenue = yesterdayMetrics?.revenue_generated || 0

    // Calculate percentage changes
    const vsYesterdayLeads = yesterdayLeads > 0
      ? ((todayLeads - yesterdayLeads) / yesterdayLeads) * 100
      : 0

    const vsYesterdayRevenue = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : 0

    const vsAvgLeads = avgLeads > 0
      ? ((todayLeads - avgLeads) / avgLeads) * 100
      : 0

    const vsAvgRevenue = avgRevenue > 0
      ? ((todayRevenue - avgRevenue) / avgRevenue) * 100
      : 0

    // Get current daily rank
    const { data: todayAllMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('user_id, revenue_generated')
      .eq('metric_date', today)
      .order('revenue_generated', { ascending: false })

    let currentRank = 1
    if (todayAllMetrics) {
      const userIndex = todayAllMetrics.findIndex(m => m.user_id === user.id)
      currentRank = userIndex >= 0 ? userIndex + 1 : todayAllMetrics.length + 1
    }

    // Get current month progress
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const monthProgress = (dayOfMonth / daysInMonth) * 100

    // Get monthly targets
    const { data: targets } = await supabase
      .from('digital_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear())
      .maybeSingle()

    // Get month-to-date metrics
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const { data: mtdMetrics } = await supabase
      .from('digital_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth)

    const mtdLeads = mtdMetrics?.reduce((sum, d) => sum + (d.total_digital_leads || d.total_leads || 0), 0) || 0
    const mtdRevenue = mtdMetrics?.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) || 0
    const mtdConversions = mtdMetrics?.reduce((sum, d) => sum + (d.leads_converted || 0), 0) || 0

    const leadTarget = targets?.website_leads_target + targets?.social_leads_target + targets?.email_leads_target || 240
    const revenueTarget = targets?.revenue_target || 1000000

    // Calculate projected end-of-month values
    const projectedLeads = dayOfMonth > 0 ? Math.round((mtdLeads / dayOfMonth) * daysInMonth) : 0
    const projectedRevenue = dayOfMonth > 0 ? Math.round((mtdRevenue / dayOfMonth) * daysInMonth) : 0

    // Calculate required daily pace to meet targets
    const remainingDays = daysInMonth - dayOfMonth
    const requiredDailyLeads = remainingDays > 0 ? Math.ceil((leadTarget - mtdLeads) / remainingDays) : 0
    const requiredDailyRevenue = remainingDays > 0 ? Math.ceil((revenueTarget - mtdRevenue) / remainingDays) : 0

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: profile.full_name,

      // Today's real-time metrics
      today: {
        leads: todayLeads,
        conversions: todayConversions,
        revenue: todayRevenue,
        conversionRate: todayLeads > 0 ? (todayConversions / todayLeads) * 100 : 0,
      },

      // Comparisons
      comparisons: {
        vsYesterday: {
          leads: vsYesterdayLeads,
          revenue: vsYesterdayRevenue,
        },
        vsAverage: {
          leads: vsAvgLeads,
          revenue: vsAvgRevenue,
        },
      },

      // Current rank
      ranking: {
        currentDailyRank: currentRank,
        totalParticipants: todayAllMetrics?.length || 1,
      },

      // Month progress
      monthProgress: {
        dayOfMonth,
        daysInMonth,
        percentComplete: monthProgress,
        remainingDays,
      },

      // MTD Performance
      monthToDate: {
        leads: mtdLeads,
        conversions: mtdConversions,
        revenue: mtdRevenue,
        leadsTarget: leadTarget,
        revenueTarget: revenueTarget,
        leadsAchievement: (mtdLeads / leadTarget) * 100,
        revenueAchievement: (mtdRevenue / revenueTarget) * 100,
      },

      // Projections
      projections: {
        projectedLeads,
        projectedRevenue,
        willMeetLeadTarget: projectedLeads >= leadTarget,
        willMeetRevenueTarget: projectedRevenue >= revenueTarget,
        requiredDailyLeads: Math.max(0, requiredDailyLeads),
        requiredDailyRevenue: Math.max(0, requiredDailyRevenue),
      },

      // Averages for reference
      averages: {
        dailyLeads: Math.round(avgLeads),
        dailyRevenue: Math.round(avgRevenue),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in realtime API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
