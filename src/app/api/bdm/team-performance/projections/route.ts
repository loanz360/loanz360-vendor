
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  ProjectionsResponse,
  MonthEndProjection,
  BDEProjectionSummary,
  WhatIfScenario,
  RiskItem,
  OpportunityItem,
  SmartTargetRecommendation,
} from '@/types/bdm-team-performance'
import { apiLogger } from '@/lib/utils/logger'

/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - PROJECTIONS & PLANNING API
 * ============================================================================
 * GET /api/bdm/team-performance/projections
 *
 * Query params:
 * - month: number (1-12)
 * - year: number (4-digit year)
 *
 * Returns:
 * - Month-end projections for team metrics
 * - Individual BDE projections
 * - What-if scenarios
 * - Risk identification
 * - Opportunity analysis
 * - Smart target recommendations for next month
 * ============================================================================
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    // Validate parameters
    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json(
        { success: false, error: 'Invalid month or year' },
        { status: 400 }
      )
    }

    // Calculate current day and days remaining
    const now = new Date()
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
    const currentDay = isCurrentMonth ? now.getDate() : 1
    const daysInMonth = new Date(year, month, 0).getDate()
    const daysRemaining = isCurrentMonth ? daysInMonth - currentDay : daysInMonth

    // ========================================================================
    // FETCH TARGETS
    // ========================================================================

    const { data: teamTargets, error: targetsError } = await supabase
      .from('bdm_targets')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    if (targetsError || !teamTargets) {
      return NextResponse.json(
        { success: false, error: 'No targets set for this period' },
        { status: 404 }
      )
    }

    // ========================================================================
    // FETCH CURRENT PERFORMANCE
    // ========================================================================

    const { data: dailyAchievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('month', month)
      .eq('year', year)

    if (achievementsError) {
      throw new Error('Failed to fetch achievements')
    }

    // Aggregate current totals
    const totalConversions = dailyAchievements?.reduce((sum, a) => sum + a.conversions, 0) || 0
    const totalRevenue = dailyAchievements?.reduce((sum, a) => sum + a.revenue, 0) || 0
    const totalLeads = dailyAchievements?.reduce((sum, a) => sum + a.leads_generated, 0) || 0

    // ========================================================================
    // CALCULATE TEAM PROJECTIONS
    // ========================================================================

    const teamProjections: MonthEndProjection[] = []

    // Conversions projection
    const conversionsPerDay = totalConversions / Math.max(currentDay, 1)
    const projectedConversions = Math.round(conversionsPerDay * daysInMonth)
    const conversionsGap = teamTargets.conversion_target - projectedConversions
    const conversionsRequiredDaily = daysRemaining > 0 ? conversionsGap / daysRemaining : 0

    teamProjections.push({
      metric: 'conversions',
      current: {
        value: totalConversions,
        asOfDay: currentDay,
      },
      target: {
        value: teamTargets.conversion_target,
        dailyRequiredRate: teamTargets.conversion_target / daysInMonth,
      },
      projected: {
        mostLikely: projectedConversions,
        optimistic: Math.round(projectedConversions * 1.15),
        pessimistic: Math.round(projectedConversions * 0.85),
        confidence: totalConversions > 0 ? 85 : 50,
      },
      likelihood: {
        exceedTarget: projectedConversions > teamTargets.conversion_target ? 70 : 30,
        meetTarget: Math.abs(projectedConversions - teamTargets.conversion_target) / teamTargets.conversion_target < 0.1 ? 60 : 40,
        fallShort: projectedConversions < teamTargets.conversion_target ? 70 : 30,
      },
      gap: conversionsGap,
      currentPace: conversionsPerDay,
      requiredPace: teamTargets.conversion_target / daysInMonth,
      feasibility:
        conversionsRequiredDaily <= conversionsPerDay * 1.2
          ? 'very_feasible'
          : conversionsRequiredDaily <= conversionsPerDay * 1.5
          ? 'feasible'
          : conversionsRequiredDaily <= conversionsPerDay * 2
          ? 'challenging'
          : 'unlikely',
      reasoning:
        conversionsGap > 0
          ? `Need ${Math.round(conversionsRequiredDaily)} more conversions per day to meet target.`
          : `On track to exceed target by ${Math.abs(conversionsGap)} conversions.`,
    })

    // Revenue projection
    const revenuePerDay = totalRevenue / Math.max(currentDay, 1)
    const projectedRevenue = Math.round(revenuePerDay * daysInMonth)
    const revenueGap = teamTargets.revenue_target - projectedRevenue
    const revenueRequiredDaily = daysRemaining > 0 ? revenueGap / daysRemaining : 0

    teamProjections.push({
      metric: 'revenue',
      current: {
        value: totalRevenue,
        asOfDay: currentDay,
      },
      target: {
        value: teamTargets.revenue_target,
        dailyRequiredRate: teamTargets.revenue_target / daysInMonth,
      },
      projected: {
        mostLikely: projectedRevenue,
        optimistic: Math.round(projectedRevenue * 1.2),
        pessimistic: Math.round(projectedRevenue * 0.8),
        confidence: totalRevenue > 0 ? 80 : 50,
      },
      likelihood: {
        exceedTarget: projectedRevenue > teamTargets.revenue_target ? 65 : 35,
        meetTarget: Math.abs(projectedRevenue - teamTargets.revenue_target) / teamTargets.revenue_target < 0.1 ? 55 : 45,
        fallShort: projectedRevenue < teamTargets.revenue_target ? 65 : 35,
      },
      gap: revenueGap,
      currentPace: revenuePerDay,
      requiredPace: teamTargets.revenue_target / daysInMonth,
      feasibility:
        revenueRequiredDaily <= revenuePerDay * 1.2
          ? 'very_feasible'
          : revenueRequiredDaily <= revenuePerDay * 1.5
          ? 'feasible'
          : revenueRequiredDaily <= revenuePerDay * 2
          ? 'challenging'
          : 'unlikely',
      reasoning:
        revenueGap > 0
          ? `Need ₹${Math.round(revenueRequiredDaily / 1000)}K more revenue per day to meet target.`
          : `On track to exceed target by ₹${Math.abs(Math.round(revenueGap / 100000))}L.`,
    })

    // Leads projection
    const leadsPerDay = totalLeads / Math.max(currentDay, 1)
    const projectedLeads = Math.round(leadsPerDay * daysInMonth)
    const leadsTarget = teamTargets.conversion_target * 5 // Assume 20% conversion rate
    const leadsGap = leadsTarget - projectedLeads

    teamProjections.push({
      metric: 'leads',
      current: {
        value: totalLeads,
        asOfDay: currentDay,
      },
      target: {
        value: leadsTarget,
        dailyRequiredRate: leadsTarget / daysInMonth,
      },
      projected: {
        mostLikely: projectedLeads,
        optimistic: Math.round(projectedLeads * 1.1),
        pessimistic: Math.round(projectedLeads * 0.9),
        confidence: totalLeads > 0 ? 90 : 50,
      },
      likelihood: {
        exceedTarget: projectedLeads > leadsTarget ? 75 : 25,
        meetTarget: Math.abs(projectedLeads - leadsTarget) / leadsTarget < 0.1 ? 65 : 35,
        fallShort: projectedLeads < leadsTarget ? 75 : 25,
      },
      gap: leadsGap,
      currentPace: leadsPerDay,
      requiredPace: leadsTarget / daysInMonth,
      feasibility: 'feasible',
      reasoning: leadsGap > 0 ? `Need ${Math.round(leadsGap / daysRemaining)} more leads per day.` : `Lead generation on track.`,
    })

    // ========================================================================
    // CALCULATE BDE PROJECTIONS
    // ========================================================================

    const { data: bdes, error: bdesError } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('role', 'bde')
      .eq('is_active', true)

    if (bdesError) {
      throw new Error('Failed to fetch BDEs')
    }

    const bdeProjections: BDEProjectionSummary[] = (bdes || []).map((bde) => {
      const bdeAchievements = dailyAchievements?.filter((a) => a.bde_id === bde.id) || []
      const bdeConversions = bdeAchievements.reduce((sum, a) => sum + a.conversions, 0)
      const bdeRevenue = bdeAchievements.reduce((sum, a) => sum + a.revenue, 0)

      // Assume equal distribution of targets
      const bdeConversionTarget = Math.round(teamTargets.conversion_target / (bdes?.length || 1))
      const bdeRevenueTarget = Math.round(teamTargets.revenue_target / (bdes?.length || 1))

      // Simple projection (pace-based)
      const bdeConversionRate = bdeConversions / Math.max(currentDay, 1)
      const projectedBDEConversions = Math.round(bdeConversionRate * daysInMonth)
      const conversionGap = bdeConversionTarget - projectedBDEConversions

      const bdeRevenueRate = bdeRevenue / Math.max(currentDay, 1)
      const projectedBDERevenue = Math.round(bdeRevenueRate * daysInMonth)
      const revenueGap = bdeRevenueTarget - projectedBDERevenue

      // Determine likelihood
      const conversionLikelihood =
        conversionGap <= 0 ? 'very_likely' : conversionGap <= bdeConversionTarget * 0.1 ? 'likely' : conversionGap <= bdeConversionTarget * 0.3 ? 'possible' : 'unlikely'
      const revenueLikelihood =
        revenueGap <= 0 ? 'very_likely' : revenueGap <= bdeRevenueTarget * 0.1 ? 'likely' : revenueGap <= bdeRevenueTarget * 0.3 ? 'possible' : 'unlikely'

      // Determine status
      let status: 'on_track' | 'at_risk' | 'behind' = 'on_track'
      if (conversionGap > bdeConversionTarget * 0.2 || revenueGap > bdeRevenueTarget * 0.2) {
        status = 'behind'
      } else if (conversionGap > bdeConversionTarget * 0.1 || revenueGap > bdeRevenueTarget * 0.1) {
        status = 'at_risk'
      }

      return {
        bdeId: bde.id,
        bdeName: bde.full_name,
        conversionsProjection: {
          current: bdeConversions,
          target: bdeConversionTarget,
          projected: projectedBDEConversions,
          likelihood: conversionLikelihood,
          gap: conversionGap,
        },
        revenueProjection: {
          current: bdeRevenue,
          target: bdeRevenueTarget,
          projected: projectedBDERevenue,
          likelihood: revenueLikelihood,
          gap: revenueGap,
        },
        status,
        statusColor: status === 'on_track' ? 'green' : status === 'at_risk' ? 'yellow' : 'red',
      }
    })

    // ========================================================================
    // GENERATE WHAT-IF SCENARIOS
    // ========================================================================

    const whatIfScenarios: WhatIfScenario[] = [
      {
        scenarioId: '1',
        scenarioName: '10% Increase in Conversion Rate',
        scenarioDescription: 'What if the team improves lead-to-conversion rate by 10%?',
        assumptions: [
          {
            parameter: 'Conversion Rate',
            currentValue: totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) + '%' : '0%',
            adjustedValue: totalLeads > 0 ? ((totalConversions / totalLeads) * 1.1 * 100).toFixed(1) + '%' : '0%',
            change: '+10%',
          },
        ],
        projectedOutcome: {
          conversions: Math.round(projectedConversions * 1.1),
          revenue: Math.round(projectedRevenue * 1.1),
          conversionChange: 10,
          revenueChange: 10,
        },
        feasibility: 'medium',
        effort: 'medium',
        implementationSteps: [
          'Improve lead qualification process',
          'Enhance sales training on objection handling',
          'Implement better follow-up cadence',
        ],
      },
      {
        scenarioId: '2',
        scenarioName: 'Add 2 More BDEs',
        scenarioDescription: 'What if we hire 2 additional BDEs mid-month?',
        assumptions: [
          {
            parameter: 'Team Size',
            currentValue: bdes?.length || 0,
            adjustedValue: (bdes?.length || 0) + 2,
            change: '+2 BDEs',
          },
        ],
        projectedOutcome: {
          conversions: Math.round(projectedConversions * 1.25),
          revenue: Math.round(projectedRevenue * 1.25),
          conversionChange: 25,
          revenueChange: 25,
        },
        feasibility: 'low',
        effort: 'high',
        implementationSteps: [
          'Initiate hiring process',
          'Onboard and train new hires',
          'Ramp-up period required',
        ],
      },
      {
        scenarioId: '3',
        scenarioName: 'Increase Daily Activity by 20%',
        scenarioDescription: 'What if each BDE makes 20% more calls/outreach per day?',
        assumptions: [
          {
            parameter: 'Daily Activity',
            currentValue: '100%',
            adjustedValue: '120%',
            change: '+20%',
          },
        ],
        projectedOutcome: {
          conversions: Math.round(projectedConversions * 1.15),
          revenue: Math.round(projectedRevenue * 1.15),
          conversionChange: 15,
          revenueChange: 15,
        },
        feasibility: 'high',
        effort: 'low',
        implementationSteps: [
          'Set daily activity targets',
          'Monitor performance dashboards',
          'Incentivize increased activity',
        ],
      },
    ]

    // ========================================================================
    // IDENTIFY RISKS
    // ========================================================================

    const risks: RiskItem[] = []

    // Risk: Underperforming BDEs
    const behindBDEs = bdeProjections.filter((b) => b.status === 'behind')
    if (behindBDEs.length > 0) {
      risks.push({
        id: 'risk-1',
        category: 'performance_decline',
        severity: behindBDEs.length > (bdes?.length || 0) * 0.3 ? 'critical' : 'medium',
        probability: 75,
        title: `${behindBDEs.length} BDE(s) Significantly Behind Target`,
        description: `${behindBDEs.map((b) => b.bdeName).join(', ')} ${behindBDEs.length === 1 ? 'is' : 'are'} projected to miss targets.`,
        impact: {
          affectedBDEs: behindBDEs.map((b) => b.bdeId),
          potentialLoss: {
            conversions: behindBDEs.reduce((sum, b) => sum + Math.max(0, b.conversionsProjection.gap), 0),
            revenue: behindBDEs.reduce((sum, b) => sum + Math.max(0, b.revenueProjection.gap), 0),
          },
        },
        mitigation: {
          actions: [
            'Conduct one-on-one coaching sessions',
            'Provide additional training resources',
            'Review and adjust territory/lead allocation',
          ],
          owner: 'BDM',
          deadline: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(currentDay + 3, daysInMonth)).padStart(2, '0')}`,
          status: 'open',
        },
      })
    }

    // Risk: Revenue gap
    if (revenueGap > teamTargets.revenue_target * 0.15) {
      risks.push({
        id: 'risk-2',
        category: 'performance_decline',
        severity: 'high',
        probability: 80,
        title: 'Significant Revenue Shortfall Expected',
        description: `Team is projected to fall short of revenue target by ₹${Math.round(revenueGap / 100000)}L.`,
        impact: {
          affectedBDEs: (bdes || []).map((b) => b.id),
          potentialLoss: {
            conversions: 0,
            revenue: Math.round(revenueGap),
          },
        },
        mitigation: {
          actions: [
            'Focus on high-value deals',
            'Accelerate pipeline progression',
            'Increase average deal size',
          ],
          owner: 'BDM',
          deadline: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(currentDay + 5, daysInMonth)).padStart(2, '0')}`,
          status: 'open',
        },
      })
    }

    // ========================================================================
    // IDENTIFY OPPORTUNITIES
    // ========================================================================

    const opportunities: OpportunityItem[] = []

    // Opportunity: Top performers
    const topPerformers = bdeProjections.filter((b) => b.status === 'on_track').slice(0, 2)
    if (topPerformers.length > 0) {
      opportunities.push({
        id: 'opp-1',
        category: 'pipeline_acceleration',
        priority: 'high',
        effort: 'low',
        title: 'Leverage Top Performer Best Practices',
        description: `${topPerformers.map((b) => b.bdeName).join(' and ')} ${topPerformers.length === 1 ? 'is' : 'are'} on track. Share their strategies.`,
        potential: {
          additionalConversions: Math.round(teamTargets.conversion_target * 0.1),
          additionalRevenue: Math.round(teamTargets.revenue_target * 0.1),
          timeframe: '2 weeks',
        },
        requirements: [
          'Conduct knowledge sharing session',
          'Document successful strategies',
          'Implement team-wide training',
        ],
        action: {
          nextSteps: [
            'Schedule best practice sharing session',
            'Create playbook from top performer tactics',
            'Roll out to underperformers',
          ],
          owner: 'BDM',
          status: 'identified',
        },
      })
    }

    // Opportunity: Increase activity
    if (daysRemaining > 7) {
      opportunities.push({
        id: 'opp-2',
        category: 'quick_wins',
        priority: 'high',
        effort: 'low',
        title: 'Sprint Week - Increase Daily Outreach',
        description: 'Organize a focused sprint week with 30% more activity.',
        potential: {
          additionalConversions: Math.round(teamTargets.conversion_target * 0.08),
          additionalRevenue: Math.round(teamTargets.revenue_target * 0.08),
          timeframe: '1 week',
        },
        requirements: ['Team buy-in', 'Incentive structure', 'Daily monitoring'],
        action: {
          nextSteps: [
            'Set sprint week dates',
            'Define activity targets',
            'Create leaderboard for sprint',
          ],
          owner: 'BDM',
          status: 'identified',
        },
      })
    }

    // ========================================================================
    // GENERATE NEXT MONTH RECOMMENDATIONS
    // ========================================================================

    const nextMonthRecommendations: SmartTargetRecommendation[] = bdeProjections.map((bde) => {
      const adjustmentFactor =
        bde.status === 'on_track' ? 1.1 : bde.status === 'at_risk' ? 1.05 : 1.0

      return {
        bdeId: bde.bdeId,
        bdeName: bde.bdeName,
        lastMonthActual: {
          conversions: bde.conversionsProjection.projected,
          revenue: bde.revenueProjection.projected,
        },
        recommended: {
          conversions: Math.round(bde.conversionsProjection.target * adjustmentFactor),
          revenue: Math.round(bde.revenueProjection.target * adjustmentFactor),
        },
        rationale:
          bde.status === 'on_track'
            ? 'Performing well - recommend stretch target'
            : bde.status === 'at_risk'
            ? 'Slight increase to encourage improvement'
            : 'Maintain target to focus on fundamentals',
        adjustmentFactor,
        templateUsed: 'Performance-based',
      }
    })

    // ========================================================================
    // RETURN RESPONSE
    // ========================================================================

    const response: ProjectionsResponse = {
      success: true,
      data: {
        periodInfo: {
          month,
          year,
          currentDay,
          daysRemaining,
        },
        teamProjections,
        bdeProjections,
        whatIfScenarios,
        risks,
        opportunities,
        nextMonthRecommendations,
        lastUpdated: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Projections API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
