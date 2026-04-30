/**
 * BDM Team Targets - BDE AI Insights API
 * Returns AI-powered performance insights and recommendations
 * Analyzes strengths, weaknesses, and coaching suggestions
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
    return await getBDEInsightsHandler(req, params.bdeId)
  })
}

async function getBDEInsightsHandler(request: NextRequest, bdeId: string) {
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
      .select('id, name, manager_id, created_at')
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
    // 4. GATHER PERFORMANCE DATA
    // =====================================================

    // Get current month performance
    const { data: currentMonthData } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('user_id', bdeId)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    // Get target
    const { data: target } = await supabase
      .from('team_targets')
      .select('*')
      .eq('user_id', bdeId)
      .eq('month', month)
      .eq('year', year)
      .eq('target_type', 'BDE')
      .maybeSingle()

    // Get last 3 months for trend analysis
    const { data: historicalData } = await supabase.rpc('get_bdm_monthly_overview', {
      p_bdm_user_id: bdmUserId,
      p_month: month,
      p_year: year,
    })

    // =====================================================
    // 5. CALCULATE PERFORMANCE METRICS
    // =====================================================

    const totalLeads = currentMonthData?.reduce((sum, d) => sum + (d.leads_contacted || 0), 0) || 0
    const totalConversions = currentMonthData?.reduce((sum, d) => sum + (d.conversions || 0), 0) || 0
    const totalRevenue = currentMonthData?.reduce((sum, d) => sum + (d.revenue_generated || 0), 0) || 0

    const activeDays = currentMonthData?.filter((d) => d.leads_contacted > 0).length || 0
    const avgDailyConversions = activeDays > 0 ? totalConversions / activeDays : 0
    const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0

    const targetConversions = target?.monthly_conversion_target || 0
    const targetRevenue = target?.monthly_revenue_target || 0
    const achievementRate = targetConversions > 0 ? (totalConversions / targetConversions) * 100 : 0

    // =====================================================
    // 6. IDENTIFY STRENGTHS
    // =====================================================

    const strengths = []

    // High conversion rate
    if (conversionRate >= 15) {
      strengths.push({
        category: 'conversion_efficiency',
        title: 'Excellent Conversion Rate',
        description: `Converting ${conversionRate.toFixed(1)}% of leads - above average`,
        impact: 'high',
        icon: '🎯',
      })
    }

    // Consistent activity
    const daysInMonth = new Date(year, month, 0).getDate()
    const workingDays = Math.ceil(daysInMonth * 0.7) // Approx working days
    if (activeDays >= workingDays * 0.9) {
      strengths.push({
        category: 'consistency',
        title: 'Highly Consistent',
        description: `Active ${activeDays} out of ~${workingDays} working days`,
        impact: 'high',
        icon: '📊',
      })
    }

    // Meeting/exceeding targets
    if (achievementRate >= 100) {
      strengths.push({
        category: 'target_achievement',
        title: 'Target Achieved',
        description: `${achievementRate.toFixed(0)}% of monthly target completed`,
        impact: 'high',
        icon: '✅',
      })
    } else if (achievementRate >= 80) {
      strengths.push({
        category: 'target_achievement',
        title: 'On Track for Target',
        description: `${achievementRate.toFixed(0)}% achieved, trending well`,
        impact: 'medium',
        icon: '📈',
      })
    }

    // High activity levels
    const avgDailyLeads = activeDays > 0 ? totalLeads / activeDays : 0
    if (avgDailyLeads >= 30) {
      strengths.push({
        category: 'activity_volume',
        title: 'High Activity Volume',
        description: `Contacting avg ${avgDailyLeads.toFixed(0)} leads per day`,
        impact: 'medium',
        icon: '💪',
      })
    }

    // =====================================================
    // 7. IDENTIFY IMPROVEMENT AREAS
    // =====================================================

    const improvements = []

    // Low conversion rate
    if (conversionRate < 10 && totalLeads > 20) {
      improvements.push({
        category: 'conversion_efficiency',
        title: 'Improve Conversion Rate',
        description: `${conversionRate.toFixed(1)}% conversion needs improvement`,
        priority: 'high',
        suggestion: 'Focus on lead quality over quantity. Review qualification criteria.',
        icon: '⚠️',
      })
    }

    // Inconsistent activity
    if (activeDays < workingDays * 0.6) {
      improvements.push({
        category: 'consistency',
        title: 'Increase Activity Consistency',
        description: `Only ${activeDays} active days this month`,
        priority: 'high',
        suggestion: 'Set daily activity goals. Block dedicated prospecting time.',
        icon: '📅',
      })
    }

    // Behind on target
    const daysElapsed = new Date().getDate()
    const expectedProgress = (daysElapsed / daysInMonth) * 100
    if (achievementRate < expectedProgress - 20 && daysElapsed > 7) {
      improvements.push({
        category: 'target_achievement',
        title: 'Behind Target Pace',
        description: `Need to accelerate to meet ${targetConversions} conversions`,
        priority: 'critical',
        suggestion: `Increase daily target to ${Math.ceil((targetConversions - totalConversions) / (daysInMonth - daysElapsed))} conversions/day`,
        icon: '🚨',
      })
    }

    // Low activity volume
    if (avgDailyLeads < 15 && activeDays > 5) {
      improvements.push({
        category: 'activity_volume',
        title: 'Increase Lead Contact Volume',
        description: `Only ${avgDailyLeads.toFixed(0)} leads/day - below benchmark`,
        priority: 'medium',
        suggestion: 'Dedicate first 2 hours each day to prospecting.',
        icon: '📞',
      })
    }

    // =====================================================
    // 8. GENERATE RECOMMENDATIONS
    // =====================================================

    const recommendations = []

    // Based on performance status
    if (achievementRate >= 100) {
      recommendations.push({
        type: 'celebration',
        title: 'Celebrate & Share Success',
        description: 'Target achieved! Share best practices with team.',
        action: 'Schedule knowledge sharing session',
        priority: 'low',
      })
    } else if (achievementRate >= 80) {
      recommendations.push({
        type: 'maintain',
        title: 'Maintain Current Pace',
        description: 'On track - keep up the good work!',
        action: 'Continue current strategies',
        priority: 'low',
      })
    } else if (achievementRate < 50 && daysElapsed > 15) {
      recommendations.push({
        type: 'intervention',
        title: 'Immediate Coaching Session Needed',
        description: 'Significant gap in performance requires intervention',
        action: 'Schedule 1-on-1 coaching this week',
        priority: 'critical',
      })
    }

    // Activity-based recommendations
    if (conversionRate < 10) {
      recommendations.push({
        type: 'training',
        title: 'Sales Skills Training',
        description: 'Conversion rate suggests need for sales technique improvement',
        action: 'Enroll in objection handling workshop',
        priority: 'high',
      })
    }

    if (activeDays < workingDays * 0.7) {
      recommendations.push({
        type: 'coaching',
        title: 'Time Management Coaching',
        description: 'Inconsistent daily activity patterns detected',
        action: 'Review daily schedule and priorities',
        priority: 'high',
      })
    }

    // =====================================================
    // 9. PERFORMANCE PREDICTION
    // =====================================================

    const remainingDays = Math.max(0, daysInMonth - daysElapsed)
    const projectedConversions = totalConversions + avgDailyConversions * remainingDays
    const projectedAchievement = targetConversions > 0 ? (projectedConversions / targetConversions) * 100 : 0

    const prediction = {
      projectedMonthEndConversions: Math.round(projectedConversions),
      projectedAchievementRate: projectedAchievement,
      requiredDailyRate: remainingDays > 0 ? (targetConversions - totalConversions) / remainingDays : 0,
      onTrack: projectedAchievement >= 95,
      confidence: activeDays >= 10 ? 'high' : activeDays >= 5 ? 'medium' : 'low',
    }

    // =====================================================
    // 10. BUILD RESPONSE
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
        performanceSnapshot: {
          totalLeads,
          totalConversions,
          totalRevenue,
          conversionRate,
          achievementRate,
          activeDays,
          avgDailyConversions,
        },
        strengths,
        improvements,
        recommendations,
        prediction,
        overallScore: {
          score: Math.min(100, (achievementRate + conversionRate * 2 + (activeDays / workingDays) * 100) / 4),
          grade:
            achievementRate >= 100
              ? 'A+'
              : achievementRate >= 90
                ? 'A'
                : achievementRate >= 80
                  ? 'B+'
                  : achievementRate >= 70
                    ? 'B'
                    : achievementRate >= 60
                      ? 'C'
                      : 'D',
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getBDEInsightsHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
