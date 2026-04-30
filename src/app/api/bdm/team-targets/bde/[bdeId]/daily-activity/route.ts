/**
 * BDM Team Targets - BDE Daily Activity API
 * Returns day-by-day activity breakdown for a specific BDE
 * Shows daily performance metrics in table format
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest, { params }: { params: { bdeId: string } }) {
  return readRateLimiter(request, async (req) => {
    return await getBDEDailyActivityHandler(req, params.bdeId)
  })
}

async function getBDEDailyActivityHandler(request: NextRequest, bdeId: string) {
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
    // 2. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // =====================================================
    // 3. VERIFY BDE IS IN BDM'S TEAM
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
          error: 'BDE not found',
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
    // 4. FETCH DAILY ACHIEVEMENTS
    // =====================================================

    const { data: dailyAchievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('user_id', bdeId)
      .eq('achievement_month', month)
      .eq('achievement_year', year)
      .order('activity_date', { ascending: true })

    if (achievementsError) {
      apiLogger.error('Error fetching daily achievements', achievementsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch daily achievements',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 5. GET TARGET FOR THIS MONTH
    // =====================================================

    const { data: target } = await supabase
      .from('team_targets')
      .select('*')
      .eq('user_id', bdeId)
      .eq('month', month)
      .eq('year', year)
      .eq('target_type', 'BDE')
      .maybeSingle()

    const dailyConversionTarget = target?.daily_conversion_target || 0
    const monthlyConversionTarget = target?.monthly_conversion_target || 0

    // =====================================================
    // 6. FORMAT DAILY ACTIVITY DATA
    // =====================================================

    const daysInMonth = new Date(year, month, 0).getDate()
    const dailyActivity = []

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dateStr = date.toISOString().split('T')[0]
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' })
      const isWeekend = date.getDay() === 0 || date.getDay() === 6
      const isFuture = date > new Date()

      // Find achievement record for this day
      const achievement = dailyAchievements?.find((a) => {
        const achievementDate = new Date(a.activity_date)
        return achievementDate.getDate() === day
      })

      if (achievement) {
        // Has activity data
        const targetMet = achievement.conversions >= dailyConversionTarget
        const conversionRate =
          achievement.leads_contacted > 0 ? (achievement.conversions / achievement.leads_contacted) * 100 : 0

        dailyActivity.push({
          date: dateStr,
          day,
          dayOfWeek,
          isWeekend,
          hasActivity: true,
          leadsContacted: achievement.leads_contacted,
          conversions: achievement.conversions,
          revenue: achievement.revenue_generated,
          conversionRate: conversionRate.toFixed(2),
          targetMet,
          status: achievement.achievement_status,
          mtdConversions: achievement.mtd_conversions,
          mtdRevenue: achievement.mtd_revenue,
          activityCounts: {
            notes: achievement.notes_added || 0,
            calls: achievement.calls_made || 0,
            meetings: achievement.meetings_held || 0,
            documents: achievement.documents_collected || 0,
          },
          qualityScore: achievement.quality_score,
        })
      } else if (!isFuture) {
        // No activity recorded
        dailyActivity.push({
          date: dateStr,
          day,
          dayOfWeek,
          isWeekend,
          hasActivity: false,
          leadsContacted: 0,
          conversions: 0,
          revenue: 0,
          conversionRate: '0.00',
          targetMet: false,
          status: isWeekend ? 'weekend' : 'no_activity',
          mtdConversions: 0,
          mtdRevenue: 0,
          activityCounts: {
            notes: 0,
            calls: 0,
            meetings: 0,
            documents: 0,
          },
          qualityScore: null,
        })
      } else {
        // Future date
        dailyActivity.push({
          date: dateStr,
          day,
          dayOfWeek,
          isWeekend,
          hasActivity: false,
          leadsContacted: 0,
          conversions: 0,
          revenue: 0,
          conversionRate: '0.00',
          targetMet: false,
          status: 'future',
          mtdConversions: 0,
          mtdRevenue: 0,
          activityCounts: {
            notes: 0,
            calls: 0,
            meetings: 0,
            documents: 0,
          },
          qualityScore: null,
        })
      }
    }

    // =====================================================
    // 7. CALCULATE SUMMARY STATISTICS
    // =====================================================

    const activeDays = dailyActivity.filter((d) => d.hasActivity && !d.isWeekend).length
    const targetMetDays = dailyActivity.filter((d) => d.targetMet).length
    const totalDays = dailyActivity.filter((d) => !d.isWeekend && d.status !== 'future').length

    const totalLeads = dailyActivity.reduce((sum, d) => sum + d.leadsContacted, 0)
    const totalConversions = dailyActivity.reduce((sum, d) => sum + d.conversions, 0)
    const totalRevenue = dailyActivity.reduce((sum, d) => sum + d.revenue, 0)

    const avgDailyLeads = activeDays > 0 ? totalLeads / activeDays : 0
    const avgDailyConversions = activeDays > 0 ? totalConversions / activeDays : 0
    const avgDailyRevenue = activeDays > 0 ? totalRevenue / activeDays : 0

    const summary = {
      activeDays,
      totalDays,
      activityRate: totalDays > 0 ? (activeDays / totalDays) * 100 : 0,
      targetMetDays,
      targetMetRate: totalDays > 0 ? (targetMetDays / totalDays) * 100 : 0,
      totalLeads,
      totalConversions,
      totalRevenue,
      avgDailyLeads,
      avgDailyConversions,
      avgDailyRevenue,
      overallConversionRate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
      progressToTarget: monthlyConversionTarget > 0 ? (totalConversions / monthlyConversionTarget) * 100 : 0,
    }

    // =====================================================
    // 8. IDENTIFY PATTERNS
    // =====================================================

    // Find best and worst days
    const activeDaysData = dailyActivity.filter((d) => d.hasActivity)
    const bestDay = activeDaysData.length > 0 ? activeDaysData.reduce((max, d) => (d.conversions > max.conversions ? d : max)) : null
    const worstDay = activeDaysData.length > 0 ? activeDaysData.reduce((min, d) => (d.conversions < min.conversions ? d : min)) : null

    // Check for consecutive no-activity days
    let currentStreak = 0
    let longestNoActivityStreak = 0
    dailyActivity.forEach((d) => {
      if (!d.hasActivity && !d.isWeekend && d.status !== 'future') {
        currentStreak++
        longestNoActivityStreak = Math.max(longestNoActivityStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    })

    const patterns = {
      bestDay: bestDay
        ? {
            date: bestDay.date,
            conversions: bestDay.conversions,
            revenue: bestDay.revenue,
          }
        : null,
      worstDay: worstDay
        ? {
            date: worstDay.date,
            conversions: worstDay.conversions,
            revenue: worstDay.revenue,
          }
        : null,
      longestNoActivityStreak,
      needsAttention: longestNoActivityStreak >= 3,
    }

    // =====================================================
    // 9. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        bde: {
          id: bdeData.id,
          name: bdeData.name,
        },
        month,
        year,
        target: {
          dailyConversionTarget,
          monthlyConversionTarget,
        },
        dailyActivity,
        summary,
        patterns,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getBDEDailyActivityHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
