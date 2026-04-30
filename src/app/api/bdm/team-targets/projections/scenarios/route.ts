import { parseBody } from '@/lib/utils/parse-body'
/**
 * BDM Team Targets - What-If Scenario Modeling API
 * Simulates different performance scenarios to predict outcomes
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getScenarioProjectionsHandler(req)
  })
}

async function getScenarioProjectionsHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // Parse request body for scenario parameters
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { month, year, bdeId, scenarioType, parameters } = body

    if (!month || !year || !bdeId || !scenarioType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Month, year, bdeId, and scenarioType are required',
        },
        { status: 400 }
      )
    }

    // Verify BDE is in team
    const { data: bdeData } = await supabase
      .from('users')
      .select('id, name, employee_code, manager_id')
      .eq('id', bdeId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!bdeData || (bdeData.manager_id !== bdmUserId && !auth.isSuperAdmin)) {
      return NextResponse.json(
        {
          success: false,
          error: 'BDE not found or not in your team',
        },
        { status: 404 }
      )
    }

    // Get current achievements
    const { data: achievements } = await supabase
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

    const now = new Date()
    const currentDayOfMonth = now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : new Date(year, month, 0).getDate()
    const totalDaysInMonth = new Date(year, month, 0).getDate()
    const remainingDays = Math.max(0, totalDaysInMonth - currentDayOfMonth)

    // Calculate current performance
    const totalConversions = achievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0
    const totalRevenue = achievements?.reduce((sum, a) => sum + (a.revenue_generated || 0), 0) || 0
    const totalLeads = achievements?.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) || 0
    const activeDays = achievements?.filter((a) => a.leads_contacted > 0).length || 0

    const avgDailyConversions = activeDays > 0 ? totalConversions / activeDays : 0
    const avgDailyRevenue = activeDays > 0 ? totalRevenue / activeDays : 0
    const currentConversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0

    const targetConversions = target?.monthly_conversion_target || 0
    const targetRevenue = target?.monthly_revenue_target || 0

    // Define scenario models
    const scenarios: Record<string, any> = {}

    // Baseline scenario - maintain current pace
    scenarios.baseline = {
      name: 'Baseline (Current Pace)',
      description: 'Continue at current average daily rate',
      assumptions: {
        dailyConversions: avgDailyConversions,
        dailyRevenue: avgDailyRevenue,
      },
      projection: {
        conversions: totalConversions + avgDailyConversions * remainingDays,
        revenue: totalRevenue + avgDailyRevenue * remainingDays,
      },
    }

    // Optimistic scenario - 20% increase
    const optimisticMultiplier = parameters?.optimisticMultiplier || 1.2
    scenarios.optimistic = {
      name: 'Optimistic (+20%)',
      description: '20% increase in daily performance',
      assumptions: {
        dailyConversions: avgDailyConversions * optimisticMultiplier,
        dailyRevenue: avgDailyRevenue * optimisticMultiplier,
      },
      projection: {
        conversions: totalConversions + avgDailyConversions * optimisticMultiplier * remainingDays,
        revenue: totalRevenue + avgDailyRevenue * optimisticMultiplier * remainingDays,
      },
    }

    // Pessimistic scenario - 20% decrease
    const pessimisticMultiplier = parameters?.pessimisticMultiplier || 0.8
    scenarios.pessimistic = {
      name: 'Pessimistic (-20%)',
      description: '20% decrease in daily performance',
      assumptions: {
        dailyConversions: avgDailyConversions * pessimisticMultiplier,
        dailyRevenue: avgDailyRevenue * pessimisticMultiplier,
      },
      projection: {
        conversions: totalConversions + avgDailyConversions * pessimisticMultiplier * remainingDays,
        revenue: totalRevenue + avgDailyRevenue * pessimisticMultiplier * remainingDays,
      },
    }

    // Target-driven scenario
    const requiredDailyConversions = remainingDays > 0 ? (targetConversions - totalConversions) / remainingDays : 0
    scenarios.target_driven = {
      name: 'Target Achievement',
      description: 'Required daily rate to meet target',
      assumptions: {
        dailyConversions: requiredDailyConversions,
        dailyRevenue: (targetRevenue - totalRevenue) / remainingDays,
      },
      projection: {
        conversions: targetConversions,
        revenue: targetRevenue,
      },
      feasibility:
        requiredDailyConversions <= avgDailyConversions * 1.5
          ? 'achievable'
          : requiredDailyConversions <= avgDailyConversions * 2
            ? 'challenging'
            : 'unlikely',
    }

    // Custom scenario (if provided)
    if (parameters?.customDailyConversions) {
      scenarios.custom = {
        name: 'Custom Scenario',
        description: `Custom daily rate: ${parameters.customDailyConversions} conversions/day`,
        assumptions: {
          dailyConversions: parameters.customDailyConversions,
          dailyRevenue: parameters.customDailyRevenue || avgDailyRevenue,
        },
        projection: {
          conversions: totalConversions + parameters.customDailyConversions * remainingDays,
          revenue: totalRevenue + (parameters.customDailyRevenue || avgDailyRevenue) * remainingDays,
        },
      }
    }

    // Calculate achievement rates for all scenarios
    Object.keys(scenarios).forEach((key) => {
      scenarios[key].achievementRate = {
        conversions:
          targetConversions > 0 ? (scenarios[key].projection.conversions / targetConversions) * 100 : 0,
        revenue: targetRevenue > 0 ? (scenarios[key].projection.revenue / targetRevenue) * 100 : 0,
      }
      scenarios[key].gap = {
        conversions: scenarios[key].projection.conversions - targetConversions,
        revenue: scenarios[key].projection.revenue - targetRevenue,
      }
    })

    // Return selected scenario or all
    const selectedScenario = scenarioType === 'all' ? null : scenarios[scenarioType]

    return NextResponse.json({
      success: true,
      data: {
        bde: {
          id: bdeData.id,
          name: bdeData.name,
          employeeCode: bdeData.employee_code,
        },
        month,
        year,
        current: {
          conversions: totalConversions,
          revenue: totalRevenue,
          leads: totalLeads,
          activeDays,
          avgDailyConversions,
          avgDailyRevenue,
          conversionRate: currentConversionRate,
        },
        target: {
          conversions: targetConversions,
          revenue: targetRevenue,
        },
        remainingDays,
        scenario: selectedScenario || scenarios,
        recommendation:
          scenarios.target_driven.feasibility === 'achievable'
            ? 'Target is achievable with focused effort'
            : scenarios.target_driven.feasibility === 'challenging'
              ? 'Meeting target will require significant improvement'
              : 'Target unlikely - consider revised expectations or intervention',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getScenarioProjectionsHandler', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
