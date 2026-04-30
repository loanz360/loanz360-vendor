/**
 * BDM Team Targets - Leaderboard by Category API
 * Returns rankings for specific performance categories
 * Shows top performers in each metric
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
    return await getLeaderboardByCategoryHandler(req)
  })
}

async function getLeaderboardByCategoryHandler(request: NextRequest) {
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
    // 3. GET TEAM MEMBERS
    // =====================================================

    const { data: teamBDEs, error: teamError } = await supabase
      .from('users')
      .select('id, name, email, employee_code')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (teamError || !teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          categories: [],
          message: 'No team members found',
        },
        timestamp: new Date().toISOString(),
      })
    }

    const teamBDEIds = teamBDEs.map((bde) => bde.id)

    // =====================================================
    // 4. FETCH PERFORMANCE DATA FOR ALL BDEs
    // =====================================================

    const { data: achievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    if (achievementsError) {
      apiLogger.error('Error fetching achievements', achievementsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch achievements',
        },
        { status: 500 }
      )
    }

    // Get targets for all BDEs
    const { data: targets } = await supabase
      .from('team_targets')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('month', month)
      .eq('year', year)
      .eq('target_type', 'BDE')

    // =====================================================
    // 5. AGGREGATE METRICS BY BDE
    // =====================================================

    const bdeMetrics = teamBDEs.map((bde) => {
      const bdeAchievements = achievements?.filter((a) => a.user_id === bde.id) || []
      const bdeTarget = targets?.find((t) => t.user_id === bde.id)

      const totalLeads = bdeAchievements.reduce((sum, a) => sum + (a.leads_contacted || 0), 0)
      const totalConversions = bdeAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)
      const totalRevenue = bdeAchievements.reduce((sum, a) => sum + (a.revenue_generated || 0), 0)
      const activeDays = bdeAchievements.filter((a) => a.leads_contacted > 0).length
      const targetMetDays = bdeAchievements.filter((a) => a.achievement_status === 'exceeded' || a.achievement_status === 'met').length

      const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0
      const avgDailyConversions = activeDays > 0 ? totalConversions / activeDays : 0
      const achievementRate = bdeTarget && bdeTarget.monthly_conversion_target > 0 ? (totalConversions / bdeTarget.monthly_conversion_target) * 100 : 0

      // Quality metrics
      const avgQualityScore = bdeAchievements.length > 0
        ? bdeAchievements.reduce((sum, a) => sum + ((a.quality_score as any)?.overall || 0), 0) / bdeAchievements.length
        : 0

      return {
        bdeId: bde.id,
        bdeName: bde.name,
        employeeCode: bde.employee_code,
        metrics: {
          totalLeads,
          totalConversions,
          totalRevenue,
          conversionRate,
          activeDays,
          targetMetDays,
          avgDailyConversions,
          achievementRate,
          avgQualityScore,
        },
      }
    })

    // =====================================================
    // 6. CREATE CATEGORY RANKINGS
    // =====================================================

    const categories = [
      {
        id: 'total_conversions',
        name: 'Total Conversions',
        description: 'Most conversions this month',
        icon: '🎯',
        rankings: [...bdeMetrics]
          .sort((a, b) => b.metrics.totalConversions - a.metrics.totalConversions)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.totalConversions,
            displayValue: bde.metrics.totalConversions.toString(),
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'conversion_rate',
        name: 'Conversion Rate',
        description: 'Highest lead-to-conversion rate',
        icon: '📊',
        rankings: [...bdeMetrics]
          .filter((bde) => bde.metrics.totalLeads >= 10) // Minimum 10 leads for fair comparison
          .sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.conversionRate,
            displayValue: `${bde.metrics.conversionRate.toFixed(1)}%`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'total_revenue',
        name: 'Total Revenue',
        description: 'Highest revenue generated',
        icon: '💰',
        rankings: [...bdeMetrics]
          .sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.totalRevenue,
            displayValue: `₹${(bde.metrics.totalRevenue / 100000).toFixed(2)}L`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'target_achievement',
        name: 'Target Achievement',
        description: 'Highest % of target achieved',
        icon: '✅',
        rankings: [...bdeMetrics]
          .filter((bde) => bde.metrics.achievementRate > 0)
          .sort((a, b) => b.metrics.achievementRate - a.metrics.achievementRate)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.achievementRate,
            displayValue: `${bde.metrics.achievementRate.toFixed(0)}%`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'consistency',
        name: 'Consistency',
        description: 'Most days meeting target',
        icon: '📅',
        rankings: [...bdeMetrics]
          .sort((a, b) => b.metrics.targetMetDays - a.metrics.targetMetDays)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.targetMetDays,
            displayValue: `${bde.metrics.targetMetDays} days`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'activity_level',
        name: 'Activity Level',
        description: 'Most active days',
        icon: '💪',
        rankings: [...bdeMetrics]
          .sort((a, b) => b.metrics.activeDays - a.metrics.activeDays)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.activeDays,
            displayValue: `${bde.metrics.activeDays} days`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'daily_average',
        name: 'Daily Average',
        description: 'Highest avg conversions per day',
        icon: '📈',
        rankings: [...bdeMetrics]
          .filter((bde) => bde.metrics.activeDays >= 5)
          .sort((a, b) => b.metrics.avgDailyConversions - a.metrics.avgDailyConversions)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.avgDailyConversions,
            displayValue: `${bde.metrics.avgDailyConversions.toFixed(1)}/day`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
      {
        id: 'quality_score',
        name: 'Quality Score',
        description: 'Highest quality metrics',
        icon: '⭐',
        rankings: [...bdeMetrics]
          .filter((bde) => bde.metrics.avgQualityScore > 0)
          .sort((a, b) => b.metrics.avgQualityScore - a.metrics.avgQualityScore)
          .slice(0, 10)
          .map((bde, index) => ({
            rank: index + 1,
            bdeId: bde.bdeId,
            bdeName: bde.bdeName,
            employeeCode: bde.employeeCode,
            value: bde.metrics.avgQualityScore,
            displayValue: `${bde.metrics.avgQualityScore.toFixed(0)}/100`,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '',
          })),
      },
    ]

    // =====================================================
    // 7. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        categories,
        summary: {
          totalBDEs: teamBDEs.length,
          categoriesCount: categories.length,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getLeaderboardByCategoryHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
