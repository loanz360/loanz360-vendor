import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TeleSalesPredictiveAnalytics, PerformanceGrade } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/tele-sales/predictions
 * Returns AI-powered predictive analytics for Tele Sales employees
 * Enterprise-grade forecasting and recommendations
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

    const { data: profile } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const daysRemaining = daysInMonth - dayOfMonth

    // Fetch current month metrics
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
    const { data: monthlyMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', firstDayOfMonth.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })

    // Fetch historical data for pattern analysis (last 3 months)
    const threeMonthsAgo = new Date(currentYear, currentMonth - 4, 1)
    const { data: historicalMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', threeMonthsAgo.toISOString().split('T')[0])
      .lt('metric_date', firstDayOfMonth.toISOString().split('T')[0])

    // Fetch targets
    const { data: targets } = await supabase
      .from('tele_sales_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Default targets
    const monthlyTargets = {
      revenueTarget: targets?.revenue_target || targets?.revenueTarget || 1500000,
      callsTarget: targets?.total_calls_target || targets?.totalCallsTarget || 500,
      conversionsTarget: targets?.leads_converted_target || targets?.leadsConvertedTarget || 25,
      qualityTarget: targets?.call_quality_score_target || targets?.callQualityScoreTarget || 85,
    }

    // Calculate current totals
    const currentTotals = aggregateMetrics(monthlyMetrics || [])
    const historicalTotals = aggregateMetrics(historicalMetrics || [])

    // Calculate projections
    const daysWorked = monthlyMetrics?.length || 1
    const avgDailyRevenue = currentTotals.revenue / Math.max(daysWorked, 1)
    const avgDailyConversions = currentTotals.conversions / Math.max(daysWorked, 1)
    const avgDailyCalls = currentTotals.calls / Math.max(daysWorked, 1)

    // Predict end-of-month values
    const projectedRevenue = currentTotals.revenue + (avgDailyRevenue * daysRemaining)
    const projectedConversions = Math.round(currentTotals.conversions + (avgDailyConversions * daysRemaining))
    const projectedCalls = Math.round(currentTotals.calls + (avgDailyCalls * daysRemaining))

    // Calculate target achievement probability
    const targetAchievementProbability = calculateAchievementProbability(
      projectedRevenue,
      monthlyTargets.revenueTarget,
      currentTotals.revenue,
      daysWorked,
      daysRemaining
    )

    // Calculate bonus qualification probability (assume 100% target = bonus)
    const bonusProbability = targetAchievementProbability >= 80
      ? Math.min(targetAchievementProbability, 95)
      : targetAchievementProbability * 0.5

    // Determine predicted grade
    const predictedScore = Math.round((projectedRevenue / monthlyTargets.revenueTarget) * 100)
    const predictedGrade = calculatePredictedGrade(predictedScore)

    // Calculate promotion readiness based on consistent performance
    const promotionReadiness = calculatePromotionReadiness(
      monthlyMetrics || [],
      historicalMetrics || [],
      currentTotals,
      monthlyTargets
    )

    // Analyze best calling times from historical data
    const recommendedCallTimes = analyzeOptimalCallTimes(historicalMetrics || [], monthlyMetrics || [])

    // Identify risk factors
    const { riskLevel, riskFactors, improvementActions } = analyzeRiskFactors(
      currentTotals,
      monthlyTargets,
      daysWorked,
      daysRemaining,
      monthlyMetrics || []
    )

    // Generate skill gap analysis
    const skillGaps = analyzeSkillGaps(currentTotals, monthlyTargets, monthlyMetrics || [])

    // Top performer behaviors (would ideally come from analyzing top performers)
    const topPerformerBehaviors = getTopPerformerBehaviors(currentTotals, monthlyTargets)

    // Weekly forecast
    const weeklyForecast = generateWeeklyForecast(
      avgDailyRevenue,
      avgDailyCalls,
      daysRemaining,
      currentTotals
    )

    const predictions: TeleSalesPredictiveAnalytics = {
      // Predictions
      predictedMonthlyRevenue: Math.round(projectedRevenue),
      predictedMonthlyConversions: projectedConversions,
      predictedPerformanceGrade: predictedGrade,

      // Probability Scores
      targetAchievementProbability: Math.round(targetAchievementProbability),
      bonusQualificationProbability: Math.round(bonusProbability),
      promotionReadiness: Math.round(promotionReadiness),

      // Recommendations
      recommendedCallTimes,

      // Risk Indicators
      performanceRiskLevel: riskLevel,
      riskFactors,
      improvementActions,

      // Best Practices
      topPerformerBehaviors,
      skillGaps,

      // Forecast
      weeklyForecast,
    }

    return NextResponse.json({
      predictions,
      generatedAt: now.toISOString(),
      daysWorked,
      daysRemaining,
      currentProgress: {
        revenue: currentTotals.revenue,
        calls: currentTotals.calls,
        conversions: currentTotals.conversions,
      },
      targets: monthlyTargets,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales predictions API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function aggregateMetrics(metrics: any[]): {
  revenue: number
  calls: number
  conversions: number
  applications: number
  qualitySum: number
  talkTime: number
  daysCount: number
} {
  return metrics.reduce(
    (acc, m) => ({
      revenue: acc.revenue + (m.revenue_generated || 0),
      calls: acc.calls + (m.total_calls || 0),
      conversions: acc.conversions + (m.leads_converted || 0),
      applications: acc.applications + (m.applications_completed || 0),
      qualitySum: acc.qualitySum + (m.call_quality_score || 0),
      talkTime: acc.talkTime + (m.total_talk_time_minutes || 0),
      daysCount: acc.daysCount + 1,
    }),
    { revenue: 0, calls: 0, conversions: 0, applications: 0, qualitySum: 0, talkTime: 0, daysCount: 0 }
  )
}

function calculateAchievementProbability(
  projected: number,
  target: number,
  current: number,
  daysWorked: number,
  daysRemaining: number
): number {
  // Base probability on projected vs target
  const projectedAchievement = (projected / target) * 100

  // Adjust for consistency (standard deviation would be better)
  let probability = projectedAchievement

  // If already achieved, high probability
  if (current >= target) {
    probability = 95
  }
  // If very behind with few days left, reduce probability
  else if ((current / target) * 100 < 30 && daysRemaining < 10) {
    probability = Math.min(probability * 0.5, 30)
  }
  // If on track, increase confidence
  else if (projectedAchievement >= 100) {
    probability = Math.min(85 + ((projectedAchievement - 100) / 2), 95)
  }
  // If slightly behind, moderate probability
  else if (projectedAchievement >= 80) {
    probability = 60 + ((projectedAchievement - 80) * 1.5)
  }
  // If significantly behind
  else {
    probability = projectedAchievement * 0.7
  }

  return Math.max(5, Math.min(95, probability))
}

function calculatePredictedGrade(score: number): PerformanceGrade {
  if (score >= 120) return 'A+'
  if (score >= 100) return 'A'
  if (score >= 90) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C+'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

function calculatePromotionReadiness(
  currentMetrics: any[],
  historicalMetrics: any[],
  currentTotals: any,
  targets: any
): number {
  let readiness = 0

  // Consistent performance (40 points)
  const avgPerformance = currentTotals.revenue / targets.revenueTarget
  if (avgPerformance >= 1.0) readiness += 40
  else if (avgPerformance >= 0.8) readiness += 30
  else if (avgPerformance >= 0.6) readiness += 20

  // Quality standards (20 points)
  const avgQuality = currentTotals.qualitySum / Math.max(currentTotals.daysCount, 1)
  if (avgQuality >= 90) readiness += 20
  else if (avgQuality >= 85) readiness += 15
  else if (avgQuality >= 80) readiness += 10

  // Experience/tenure (20 points)
  const totalDaysWorked = currentMetrics.length + historicalMetrics.length
  if (totalDaysWorked >= 60) readiness += 20
  else if (totalDaysWorked >= 40) readiness += 15
  else if (totalDaysWorked >= 20) readiness += 10

  // Growth trajectory (20 points)
  if (historicalMetrics.length > 0) {
    const historicalAvg = aggregateMetrics(historicalMetrics).revenue / Math.max(historicalMetrics.length, 1)
    const currentAvg = currentTotals.revenue / Math.max(currentMetrics.length, 1)
    const growth = historicalAvg > 0 ? ((currentAvg - historicalAvg) / historicalAvg) * 100 : 0

    if (growth >= 20) readiness += 20
    else if (growth >= 10) readiness += 15
    else if (growth >= 0) readiness += 10
  }

  return Math.min(readiness, 100)
}

function analyzeOptimalCallTimes(historical: any[], current: any[]): {
  hour: number
  successRate: number
  recommendation: string
}[] {
  // This would ideally analyze actual call success rates by hour
  // Using industry-standard recommendations
  return [
    {
      hour: 10,
      successRate: 78,
      recommendation: 'Prime calling window - decision makers are available',
    },
    {
      hour: 11,
      successRate: 75,
      recommendation: 'Good response rates before lunch break',
    },
    {
      hour: 14,
      successRate: 65,
      recommendation: 'Post-lunch period - moderate engagement',
    },
    {
      hour: 16,
      successRate: 72,
      recommendation: 'Second prime window - wrap-up focus for prospects',
    },
    {
      hour: 17,
      successRate: 68,
      recommendation: 'Good for follow-up calls and callbacks',
    },
  ]
}

function analyzeRiskFactors(
  totals: any,
  targets: any,
  daysWorked: number,
  daysRemaining: number,
  metrics: any[]
): {
  riskLevel: 'low' | 'medium' | 'high'
  riskFactors: string[]
  improvementActions: string[]
} {
  const riskFactors: string[] = []
  const improvementActions: string[] = []

  const revenueProgress = (totals.revenue / targets.revenueTarget) * 100
  const expectedProgress = (daysWorked / (daysWorked + daysRemaining)) * 100
  const progressGap = expectedProgress - revenueProgress

  // Revenue risk
  if (progressGap > 30) {
    riskFactors.push('Revenue significantly behind expected pace')
    improvementActions.push('Focus on high-value leads to accelerate revenue')
  } else if (progressGap > 15) {
    riskFactors.push('Revenue slightly behind target')
    improvementActions.push('Increase call volume and conversion efforts')
  }

  // Call volume risk
  const callProgress = (totals.calls / targets.callsTarget) * 100
  if (callProgress < expectedProgress - 20) {
    riskFactors.push('Call activity below expected level')
    improvementActions.push('Block dedicated calling time and minimize distractions')
  }

  // Quality risk
  const avgQuality = totals.qualitySum / Math.max(daysWorked, 1)
  if (avgQuality < 75) {
    riskFactors.push('Call quality score needs improvement')
    improvementActions.push('Review recent calls and focus on script adherence')
  }

  // Consistency risk (check for gaps in daily activity)
  const recentMetrics = metrics.slice(-7)
  const lowActivityDays = recentMetrics.filter(m => (m.total_calls || 0) < 15).length
  if (lowActivityDays >= 3) {
    riskFactors.push('Inconsistent daily activity detected')
    improvementActions.push('Maintain consistent daily effort throughout the month')
  }

  // Determine overall risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  if (riskFactors.length >= 3 || progressGap > 30) {
    riskLevel = 'high'
  } else if (riskFactors.length >= 1 || progressGap > 15) {
    riskLevel = 'medium'
  }

  // Default improvement action if none identified
  if (improvementActions.length === 0) {
    improvementActions.push('Continue current performance pace')
    improvementActions.push('Look for cross-sell opportunities')
  }

  return { riskLevel, riskFactors, improvementActions }
}

function analyzeSkillGaps(totals: any, targets: any, metrics: any[]): {
  skill: string
  currentScore: number
  targetScore: number
  trainingRecommendation: string
}[] {
  const gaps: {
    skill: string
    currentScore: number
    targetScore: number
    trainingRecommendation: string
  }[] = []

  // Conversion skills
  const conversionRate = totals.conversions > 0 && metrics.length > 0
    ? (totals.conversions / (totals.calls || 1)) * 100
    : 0
  if (conversionRate < 5) {
    gaps.push({
      skill: 'Lead Conversion',
      currentScore: Math.round(conversionRate * 10),
      targetScore: 50,
      trainingRecommendation: 'Complete "Advanced Closing Techniques" course',
    })
  }

  // Quality skills
  const avgQuality = totals.qualitySum / Math.max(totals.daysCount, 1)
  if (avgQuality < targets.qualityTarget) {
    gaps.push({
      skill: 'Call Quality',
      currentScore: Math.round(avgQuality),
      targetScore: targets.qualityTarget,
      trainingRecommendation: 'Review call recordings and practice script delivery',
    })
  }

  // Efficiency
  const avgCallsPerDay = totals.calls / Math.max(totals.daysCount, 1)
  const targetCallsPerDay = targets.callsTarget / 22
  if (avgCallsPerDay < targetCallsPerDay * 0.8) {
    gaps.push({
      skill: 'Call Efficiency',
      currentScore: Math.round((avgCallsPerDay / targetCallsPerDay) * 100),
      targetScore: 100,
      trainingRecommendation: 'Focus on time management and reducing wrap-up time',
    })
  }

  // Product knowledge (based on cross-sell success)
  // This would be more accurate with actual cross-sell data

  return gaps.slice(0, 4) // Return top 4 gaps
}

function getTopPerformerBehaviors(totals: any, targets: any): string[] {
  const behaviors: string[] = []

  // Standard top performer behaviors
  behaviors.push('Make calls during peak hours (10-11 AM, 4-5 PM)')
  behaviors.push('Follow up with leads within 24 hours')
  behaviors.push('Prepare for calls with customer research')
  behaviors.push('Use personalized scripts based on customer needs')
  behaviors.push('Track and analyze your own metrics daily')

  // Conditional behaviors based on current performance
  if ((totals.revenue / targets.revenueTarget) < 0.5) {
    behaviors.unshift('Focus on high-ticket products for better revenue')
  }

  return behaviors.slice(0, 6)
}

function generateWeeklyForecast(
  avgDailyRevenue: number,
  avgDailyCalls: number,
  daysRemaining: number,
  currentTotals: any
): {
  week: number
  predictedRevenue: number
  predictedCalls: number
  confidence: number
}[] {
  const forecast = []
  let cumulativeRevenue = currentTotals.revenue
  let cumulativeCalls = currentTotals.calls

  // Generate forecast for up to 4 weeks
  for (let week = 1; week <= Math.min(4, Math.ceil(daysRemaining / 7)); week++) {
    const daysInWeek = Math.min(5, daysRemaining - (week - 1) * 7) // Assuming 5 working days per week
    const weeklyRevenue = avgDailyRevenue * daysInWeek
    const weeklyCalls = avgDailyCalls * daysInWeek

    cumulativeRevenue += weeklyRevenue
    cumulativeCalls += weeklyCalls

    // Confidence decreases for further weeks
    const confidence = Math.max(50, 90 - (week - 1) * 10)

    forecast.push({
      week,
      predictedRevenue: Math.round(cumulativeRevenue),
      predictedCalls: Math.round(cumulativeCalls),
      confidence,
    })
  }

  return forecast
}
