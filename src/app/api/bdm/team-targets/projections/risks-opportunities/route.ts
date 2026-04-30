/**
 * BDM Team Targets - Risks & Opportunities Analysis API
 * Identifies performance risks and improvement opportunities
 * Provides actionable insights for team management
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
    return await getRisksOpportunitiesHandler(req)
  })
}

async function getRisksOpportunitiesHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // Get team BDEs
    const { data: teamBDEs } = await supabase
      .from('users')
      .select('id, name, employee_code')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { risks: [], opportunities: [] },
        timestamp: new Date().toISOString(),
      })
    }

    const teamBDEIds = teamBDEs.map((b) => b.id)

    // Get achievements
    const { data: achievements } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    // Get targets
    const { data: targets } = await supabase
      .from('team_targets')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('month', month)
      .eq('year', year)
      .eq('target_type', 'BDE')

    const now = new Date()
    const currentDayOfMonth = now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : new Date(year, month, 0).getDate()
    const totalDaysInMonth = new Date(year, month, 0).getDate()
    const workingDays = Math.ceil(totalDaysInMonth * 0.7)

    const risks: unknown[] = []
    const opportunities: unknown[] = []

    // Analyze each BDE
    teamBDEs.forEach((bde) => {
      const bdeAchievements = achievements?.filter((a) => a.user_id === bde.id) || []
      const bdeTarget = targets?.find((t) => t.user_id === bde.id)

      const totalConversions = bdeAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)
      const totalLeads = bdeAchievements.reduce((sum, a) => sum + (a.leads_contacted || 0), 0)
      const activeDays = bdeAchievements.filter((a) => a.leads_contacted > 0).length

      const targetConversions = bdeTarget?.monthly_conversion_target || 0
      const achievementRate = targetConversions > 0 ? (totalConversions / targetConversions) * 100 : 0
      const expectedProgress = (currentDayOfMonth / totalDaysInMonth) * 100
      const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0

      // RISKS IDENTIFICATION

      // Risk 1: Significantly behind target
      if (achievementRate < expectedProgress - 20 && currentDayOfMonth > 7) {
        risks.push({
          type: 'performance_gap',
          severity: achievementRate < 50 ? 'critical' : 'high',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Significantly Behind Target',
          description: `Only ${achievementRate.toFixed(0)}% achieved vs ${expectedProgress.toFixed(0)}% expected`,
          impact: `May miss target by ${(targetConversions - totalConversions).toFixed(0)} conversions`,
          recommendation: 'Schedule immediate 1-on-1 coaching session. Review activity patterns and obstacles.',
          urgency: 'immediate',
        })
      }

      // Risk 2: Low activity consistency
      if (activeDays < workingDays * 0.6 && currentDayOfMonth > 10) {
        risks.push({
          type: 'low_activity',
          severity: 'high',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Inconsistent Daily Activity',
          description: `Only ${activeDays} active days out of ~${workingDays} working days`,
          impact: 'Low engagement leading to missed opportunities',
          recommendation: 'Set daily activity goals. Monitor daily check-ins.',
          urgency: 'high',
        })
      }

      // Risk 3: Low conversion rate
      if (conversionRate < 8 && totalLeads > 20) {
        risks.push({
          type: 'low_conversion',
          severity: 'medium',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Below-Average Conversion Rate',
          description: `${conversionRate.toFixed(1)}% conversion rate (below 8% threshold)`,
          impact: 'High lead volume but poor qualification or closing skills',
          recommendation: 'Sales skills training. Focus on lead quality over quantity.',
          urgency: 'medium',
        })
      }

      // Risk 4: Recent decline (last 7 days vs previous 7 days)
      const recentAchievements = bdeAchievements.slice(-7)
      const previousAchievements = bdeAchievements.slice(-14, -7)
      const recentConversions = recentAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)
      const previousConversions = previousAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)

      if (recentConversions < previousConversions * 0.7 && previousConversions > 5) {
        risks.push({
          type: 'performance_decline',
          severity: 'medium',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Recent Performance Decline',
          description: `30%+ drop in last 7 days (${previousConversions} → ${recentConversions})`,
          impact: 'Momentum loss - may indicate burnout or obstacles',
          recommendation: 'Investigate root cause. Check for blockers or personal issues.',
          urgency: 'medium',
        })
      }

      // OPPORTUNITIES IDENTIFICATION

      // Opportunity 1: Exceeding target
      if (achievementRate >= 100) {
        opportunities.push({
          type: 'high_achiever',
          potential: 'high',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Target Achieved - Stretch Goal Opportunity',
          description: `${achievementRate.toFixed(0)}% achieved - target already met`,
          action: `Set stretch goal: +${Math.round(targetConversions * 0.2)} conversions`,
          benefit: 'Maintain momentum. Recognize excellence.',
          recommendation: 'Celebrate success. Set optional stretch target. Share best practices with team.',
        })
      }

      // Opportunity 2: High conversion rate
      if (conversionRate >= 15 && totalLeads > 20) {
        opportunities.push({
          type: 'high_quality',
          potential: 'medium',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Excellent Lead Quality',
          description: `${conversionRate.toFixed(1)}% conversion rate - above average`,
          action: 'Increase lead volume while maintaining quality',
          benefit: 'Could achieve 150%+ of target with more leads',
          recommendation: 'Share lead qualification process with team. Increase lead allocation.',
        })
      }

      // Opportunity 3: Recent improvement trend
      if (recentConversions > previousConversions * 1.3 && recentConversions > 5) {
        opportunities.push({
          type: 'improvement_trend',
          potential: 'medium',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Strong Recent Improvement',
          description: `30%+ increase in last 7 days (${previousConversions} → ${recentConversions})`,
          action: 'Capitalize on momentum',
          benefit: 'Riding wave of confidence and improved skills',
          recommendation: 'Provide positive reinforcement. Explore what changed to replicate success.',
        })
      }

      // Opportunity 4: Nearing target (80-95%)
      if (achievementRate >= 80 && achievementRate < 95) {
        const gap = targetConversions - totalConversions
        const remainingDays = totalDaysInMonth - currentDayOfMonth
        const requiredDaily = remainingDays > 0 ? gap / remainingDays : 0

        opportunities.push({
          type: 'achievable_target',
          potential: 'high',
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
          title: 'Target Within Reach',
          description: `${achievementRate.toFixed(0)}% achieved - just ${gap} conversions away`,
          action: `Push for ${requiredDaily.toFixed(1)} conversions/day`,
          benefit: 'Can achieve target with focused effort',
          recommendation: `Small push needed: ${requiredDaily.toFixed(1)} conversions/day for remaining ${remainingDays} days`,
        })
      }
    })

    // Sort by severity/potential
    risks.sort((a, b) => {
      const severityOrder = { critical: 3, high: 2, medium: 1 }
      return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder]
    })

    opportunities.sort((a, b) => {
      const potentialOrder = { high: 2, medium: 1 }
      return potentialOrder[b.potential as keyof typeof potentialOrder] - potentialOrder[a.potential as keyof typeof potentialOrder]
    })

    // Summary
    const summary = {
      totalRisks: risks.length,
      criticalRisks: risks.filter((r) => r.severity === 'critical').length,
      highRisks: risks.filter((r) => r.severity === 'high').length,
      mediumRisks: risks.filter((r) => r.severity === 'medium').length,
      totalOpportunities: opportunities.length,
      highPotential: opportunities.filter((o) => o.potential === 'high').length,
      mediumPotential: opportunities.filter((o) => o.potential === 'medium').length,
      overallHealth:
        risks.filter((r) => r.severity === 'critical').length > 0
          ? 'critical'
          : risks.filter((r) => r.severity === 'high').length > 2
            ? 'needs_attention'
            : 'healthy',
    }

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        asOfDate: new Date().toISOString(),
        risks,
        opportunities,
        summary,
        actionPriorities: [
          ...risks.filter((r) => r.urgency === 'immediate').map((r) => ({ ...r, category: 'risk' })),
          ...opportunities.filter((o) => o.potential === 'high').slice(0, 3).map((o) => ({ ...o, category: 'opportunity' })),
        ].slice(0, 5),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getRisksOpportunitiesHandler', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
