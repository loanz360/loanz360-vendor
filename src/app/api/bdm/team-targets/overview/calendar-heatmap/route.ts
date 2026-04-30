/**
 * BDM Team Targets - Calendar Heatmap API
 * Returns calendar heatmap data showing daily performance across the month
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getCalendarHeatmapHandler(req)
  })
}

async function getCalendarHeatmapHandler(request: NextRequest) {
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
    // 3. GET TEAM BDEs
    // =====================================================

    const { data: teamBDEs, error: bdeError } = await supabase
      .from('users')
      .select('id, name')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (bdeError) {
      apiLogger.error('Error fetching BDEs', bdeError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch team data',
        },
        { status: 500 }
      )
    }

    const bdeIds = teamBDEs?.map((bde) => bde.id) || []

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          days: [],
          stats: {
            totalDays: 0,
            activeDays: 0,
            exceededDays: 0,
            metDays: 0,
            partialDays: 0,
            missedDays: 0,
          },
        },
        timestamp: new Date().toISOString(),
      })
    }

    // =====================================================
    // 4. GET DAILY ACHIEVEMENTS FOR THE MONTH
    // =====================================================

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month, 0).getDate()
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data: dailyAchievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('bde_user_id', bdeIds)
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
    // 5. PROCESS CALENDAR DATA
    // =====================================================

    // Group achievements by date
    const achievementsByDate = new Map()
    dailyAchievements?.forEach((achievement) => {
      const date = achievement.achievement_date
      if (!achievementsByDate.has(date)) {
        achievementsByDate.set(date, [])
      }
      achievementsByDate.get(date).push(achievement)
    })

    // Build calendar days
    const days = []
    let totalDays = 0
    let activeDays = 0
    let exceededDays = 0
    let metDays = 0
    let partialDays = 0
    let missedDays = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayAchievements = achievementsByDate.get(dateStr) || []

      // Aggregate metrics for the day
      let totalLeads = 0
      let totalConversions = 0
      let totalRevenue = 0
      let activeCount = 0
      let exceededCount = 0
      let metCount = 0
      let partialCount = 0
      let missedCount = 0

      dayAchievements.forEach((ach: any) => {
        totalLeads += ach.leads_contacted || 0
        totalConversions += ach.conversions || 0
        totalRevenue += ach.revenue || 0

        if (ach.status === 'exceeded') exceededCount++
        else if (ach.status === 'met') metCount++
        else if (ach.status === 'partial') partialCount++
        else if (ach.status === 'missed') missedCount++

        if (ach.status !== 'no_activity') activeCount++
      })

      const totalBDEs = bdeIds.length
      const achievementRate = totalBDEs > 0 ? (activeCount / totalBDEs) * 100 : 0

      // Determine overall status for the day
      let dayStatus: 'exceeded' | 'met' | 'partial' | 'missed' | 'no_activity' = 'no_activity'
      if (exceededCount > totalBDEs / 2) dayStatus = 'exceeded'
      else if (metCount + exceededCount > totalBDEs / 2) dayStatus = 'met'
      else if (activeCount > 0) dayStatus = 'partial'
      else if (dayAchievements.length > 0) dayStatus = 'missed'

      // Determine intensity (0-100)
      const intensity = Math.min(100, achievementRate)

      const dayData = {
        date: dateStr,
        day: day,
        dayOfWeek: new Date(dateStr).getDay(),
        status: dayStatus,
        intensity: Math.round(intensity),
        metrics: {
          leadsContacted: totalLeads,
          conversions: totalConversions,
          revenue: totalRevenue,
          activeBDEs: activeCount,
          totalBDEs: totalBDEs,
          achievementRate: Math.round(achievementRate),
        },
        breakdown: {
          exceeded: exceededCount,
          met: metCount,
          partial: partialCount,
          missed: missedCount,
          noActivity: totalBDEs - activeCount,
        },
      }

      days.push(dayData)

      // Update stats
      totalDays++
      if (activeCount > 0) activeDays++
      if (dayStatus === 'exceeded') exceededDays++
      if (dayStatus === 'met') metDays++
      if (dayStatus === 'partial') partialDays++
      if (dayStatus === 'missed') missedDays++
    }

    // =====================================================
    // 6. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        days,
        stats: {
          totalDays,
          activeDays,
          exceededDays,
          metDays,
          partialDays,
          missedDays,
          activityRate: totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0,
        },
        month,
        year,
        daysInMonth,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getCalendarHeatmapHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
