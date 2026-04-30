/**
 * BDM Team Targets - BDE Daily Performance Graph API
 * Returns day-by-day performance data for visualization
 * BDM access only (must be the BDE's manager)
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(
  request: NextRequest,
  { params }: { params: { bdeId: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getDailyGraphHandler(req, params.bdeId)
  })
}

async function getDailyGraphHandler(request: NextRequest, bdeId: string) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. VERIFY BDE IS IN BDM'S TEAM
    // =====================================================

    const { data: bdeData, error: bdeError } = await supabase
      .from('users')
      .select('id, name, manager_id')
      .eq('id', bdeId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (bdeError || !bdeData) {
      return NextResponse.json(
        {
          success: false,
          error: 'BDE not found or not in your team',
        },
        { status: 404 }
      )
    }

    // Verify the BDE reports to this BDM
    if (bdeData.manager_id !== bdmUserId && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: This BDE does not report to you',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 3. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // =====================================================
    // 4. GET MONTHLY TARGET
    // =====================================================

    const { data: target } = await supabase
      .from('team_targets')
      .select('*')
      .eq('user_id', bdeId)
      .eq('target_type', 'BDE')
      .eq('month', month)
      .eq('year', year)
      .eq('is_active', true)
      .maybeSingle()

    const dailyConversionTarget = target?.daily_conversion_target || 1
    const monthlyConversionTarget = target?.monthly_conversion_target || 20
    const monthlyRevenueTarget = target?.monthly_revenue_target || 5000000
    const dailyLeadsTarget = dailyConversionTarget * 5 // Assume 5 leads per conversion
    const dailyRevenueTarget = monthlyRevenueTarget / 30 // Average daily target

    // =====================================================
    // 5. GET ALL DAILY ACHIEVEMENTS FOR THE MONTH
    // =====================================================

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month, 0).getDate()
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data: dailyAchievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('bde_user_id', bdeId)
      .gte('achievement_date', startOfMonth)
      .lte('achievement_date', endOfMonth)
      .order('achievement_date', { ascending: true })

    if (achievementsError) {
      apiLogger.error('Error fetching achievements', achievementsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch achievement data',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 6. BUILD DAY-BY-DAY PERFORMANCE DATA
    // =====================================================

    // Create a map of achievements by date for quick lookup
    const achievementMap = new Map()
    dailyAchievements?.forEach((achievement) => {
      achievementMap.set(achievement.achievement_date, achievement)
    })

    const dailyData = []
    const trendLines = {
      leads: [] as number[],
      conversions: [] as number[],
      revenue: [] as number[],
      mtdLeads: [] as number[],
      mtdConversions: [] as number[],
      mtdRevenue: [] as number[],
    }

    // Generate data for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const achievement = achievementMap.get(dateStr)

      const dailyLeads = achievement?.leads_contacted || 0
      const dailyConversions = achievement?.conversions || 0
      const dailyRevenue = achievement?.revenue || 0

      const mtdLeads = achievement?.mtd_leads_contacted || 0
      const mtdConversions = achievement?.mtd_conversions || 0
      const mtdRevenue = achievement?.mtd_revenue || 0

      // Calculate daily achievement percentages
      const leadsAchievement = dailyLeadsTarget > 0 ? (dailyLeads / dailyLeadsTarget) * 100 : 0
      const conversionsAchievement = dailyConversionTarget > 0 ? (dailyConversions / dailyConversionTarget) * 100 : 0
      const revenueAchievement = dailyRevenueTarget > 0 ? (dailyRevenue / dailyRevenueTarget) * 100 : 0

      // Determine day status
      let dayStatus: 'exceeded' | 'met' | 'partial' | 'missed' | 'no_activity' = 'no_activity'
      if (achievement) {
        dayStatus = achievement.status || 'no_activity'
      }

      const dayData = {
        date: dateStr,
        day: day,
        dayOfWeek: new Date(dateStr).getDay(),
        daily: {
          leadsContacted: dailyLeads,
          conversions: dailyConversions,
          revenue: dailyRevenue,
          targets: {
            leads: dailyLeadsTarget,
            conversions: dailyConversionTarget,
            revenue: parseFloat(dailyRevenueTarget.toFixed(2)),
          },
          achievement: {
            leads: parseFloat(leadsAchievement.toFixed(2)),
            conversions: parseFloat(conversionsAchievement.toFixed(2)),
            revenue: parseFloat(revenueAchievement.toFixed(2)),
            overall: parseFloat(((leadsAchievement + conversionsAchievement + revenueAchievement) / 3).toFixed(2)),
          },
        },
        mtd: {
          leadsContacted: mtdLeads,
          conversions: mtdConversions,
          revenue: mtdRevenue,
          targets: {
            leads: dailyLeadsTarget * day,
            conversions: dailyConversionTarget * day,
            revenue: parseFloat((dailyRevenueTarget * day).toFixed(2)),
          },
          achievement: {
            leads: dailyLeadsTarget * day > 0 ? parseFloat(((mtdLeads / (dailyLeadsTarget * day)) * 100).toFixed(2)) : 0,
            conversions: dailyConversionTarget * day > 0 ? parseFloat(((mtdConversions / (dailyConversionTarget * day)) * 100).toFixed(2)) : 0,
            revenue: dailyRevenueTarget * day > 0 ? parseFloat(((mtdRevenue / (dailyRevenueTarget * day)) * 100).toFixed(2)) : 0,
          },
        },
        status: dayStatus,
        streak: achievement?.current_streak || 0,
      }

      dailyData.push(dayData)

      // Build trend line data
      trendLines.leads.push(dailyLeads)
      trendLines.conversions.push(dailyConversions)
      trendLines.revenue.push(dailyRevenue)
      trendLines.mtdLeads.push(mtdLeads)
      trendLines.mtdConversions.push(mtdConversions)
      trendLines.mtdRevenue.push(mtdRevenue)
    }

    // =====================================================
    // 7. CALCULATE SUMMARY STATISTICS
    // =====================================================

    const totalDays = daysInMonth
    const activeDays = dailyAchievements?.filter((a) => a.status !== 'no_activity').length || 0
    const exceededDays = dailyAchievements?.filter((a) => a.status === 'exceeded').length || 0
    const metDays = dailyAchievements?.filter((a) => a.status === 'met').length || 0

    const latestAchievement = dailyAchievements && dailyAchievements.length > 0
      ? dailyAchievements[dailyAchievements.length - 1]
      : null

    const currentMTD = {
      leadsContacted: latestAchievement?.mtd_leads_contacted || 0,
      conversions: latestAchievement?.mtd_conversions || 0,
      revenue: latestAchievement?.mtd_revenue || 0,
    }

    const monthlyTargets = {
      leads: dailyLeadsTarget * daysInMonth,
      conversions: monthlyConversionTarget,
      revenue: monthlyRevenueTarget,
    }

    const overallAchievement = {
      leads: monthlyTargets.leads > 0 ? parseFloat(((currentMTD.leadsContacted / monthlyTargets.leads) * 100).toFixed(2)) : 0,
      conversions: monthlyTargets.conversions > 0 ? parseFloat(((currentMTD.conversions / monthlyTargets.conversions) * 100).toFixed(2)) : 0,
      revenue: monthlyTargets.revenue > 0 ? parseFloat(((currentMTD.revenue / monthlyTargets.revenue) * 100).toFixed(2)) : 0,
    }

    // Calculate averages
    const avgDailyLeads = activeDays > 0 ? parseFloat((currentMTD.leadsContacted / activeDays).toFixed(2)) : 0
    const avgDailyConversions = activeDays > 0 ? parseFloat((currentMTD.conversions / activeDays).toFixed(2)) : 0
    const avgDailyRevenue = activeDays > 0 ? parseFloat((currentMTD.revenue / activeDays).toFixed(2)) : 0

    // =====================================================
    // 8. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        bde: {
          id: bdeData.id,
          name: bdeData.name,
        },
        period: {
          month,
          year,
          daysInMonth,
          currentDay: new Date().getDate(),
        },
        dailyData,
        trendLines,
        summary: {
          totalDays,
          activeDays,
          exceededDays,
          metDays,
          activityRate: parseFloat(((activeDays / totalDays) * 100).toFixed(2)),
          currentStreak: latestAchievement?.current_streak || 0,
        },
        current: {
          mtd: currentMTD,
          targets: monthlyTargets,
          achievement: overallAchievement,
          averages: {
            dailyLeads: avgDailyLeads,
            dailyConversions: avgDailyConversions,
            dailyRevenue: avgDailyRevenue,
          },
        },
        targets: {
          daily: {
            leads: dailyLeadsTarget,
            conversions: dailyConversionTarget,
            revenue: parseFloat(dailyRevenueTarget.toFixed(2)),
          },
          monthly: monthlyTargets,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getDailyGraphHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
