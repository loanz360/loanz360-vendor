import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { DSEPerformancePrediction, DailyTargetBreakdown, PredictionRecommendation, PaceIndicator } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/predictions
 * Returns AI-powered performance predictions for the current month.
 * Includes projected end-of-month numbers, pace indicators, and recommendations.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const currentDay = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()

    // Estimate working days (exclude Sundays)
    const totalWorkingDays = getWorkingDays(currentYear, currentMonth)
    const elapsedWorkingDays = getElapsedWorkingDays(currentYear, currentMonth, currentDay)
    const remainingWorkingDays = totalWorkingDays - elapsedWorkingDays

    // Fetch monthly summary (try both schemas)
    let summary: any = null
    const { data: s1 } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    if (s1) {
      summary = s1
    } else {
      const { data: s2 } = await adminClient
        .from('dse_monthly_summary')
        .select('*')
        .eq('dse_user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()
      summary = s2
    }

    // Fetch targets
    const { data: targets } = await adminClient
      .from('dse_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    if (!summary || !targets) {
      return NextResponse.json({
        prediction: null,
        message: 'Insufficient data for predictions. Start logging your daily activities.',
      })
    }

    // Calculate current performance metrics
    const currentRevenue = summary.total_revenue || summary.total_converted_revenue || 0
    const currentConversions = summary.total_conversions || summary.leads_converted || 0
    const currentVisits = summary.total_field_visits || summary.total_visits || 0
    const currentMeetings = summary.total_meetings_attended || summary.total_meetings || 0

    const revenueTarget = targets.revenue_target || 800000
    const conversionsTarget = targets.leads_converted_target || 15
    const visitsTarget = targets.field_visits_target || 120
    const meetingsTarget = targets.meetings_attended_target || 60

    // Calculate expected pace (what should be achieved by now)
    const paceMultiplier = elapsedWorkingDays / totalWorkingDays
    const expectedRevenue = revenueTarget * paceMultiplier
    const expectedConversions = conversionsTarget * paceMultiplier

    // Predict end-of-month based on current run rate
    const dailyRevenueRate = elapsedWorkingDays > 0 ? currentRevenue / elapsedWorkingDays : 0
    const dailyConversionRate = elapsedWorkingDays > 0 ? currentConversions / elapsedWorkingDays : 0

    const predictedRevenue = currentRevenue + (dailyRevenueRate * remainingWorkingDays)
    const predictedConversions = Math.round(currentConversions + (dailyConversionRate * remainingWorkingDays))

    // Calculate confidence based on days elapsed (more data = higher confidence)
    const dayRatio = elapsedWorkingDays / totalWorkingDays
    const baseConfidence = Math.min(dayRatio * 120, 95) // Max 95%
    const predictionConfidence = Number(baseConfidence.toFixed(1))

    // Revenue probability (likelihood of hitting target)
    const revenueAchievementProjected = (predictedRevenue / revenueTarget) * 100
    const revenueProbability = calculateTargetProbability(revenueAchievementProjected, dayRatio)

    // Conversion probability
    const conversionAchievementProjected = (predictedConversions / conversionsTarget) * 100
    const conversionProbability = calculateTargetProbability(conversionAchievementProjected, dayRatio)

    // Determine pace indicator
    const currentAchievement = (currentRevenue / revenueTarget) * 100
    const expectedAchievement = paceMultiplier * 100
    const paceDelta = currentAchievement - expectedAchievement

    let paceIndicator: PaceIndicator
    if (paceDelta >= 10) paceIndicator = 'ahead'
    else if (paceDelta >= -5) paceIndicator = 'on_track'
    else if (paceDelta >= -20) paceIndicator = 'behind'
    else paceIndicator = 'critical'

    // Daily targets needed to hit monthly goal
    const dailyTargets: DailyTargetBreakdown = {
      remaining_working_days: remainingWorkingDays,
      revenue_per_day_needed: remainingWorkingDays > 0
        ? Math.max(0, (revenueTarget - currentRevenue) / remainingWorkingDays)
        : 0,
      conversions_per_day_needed: remainingWorkingDays > 0
        ? Math.max(0, (conversionsTarget - currentConversions) / remainingWorkingDays)
        : 0,
      visits_per_day_needed: remainingWorkingDays > 0
        ? Math.max(0, (visitsTarget - currentVisits) / remainingWorkingDays)
        : 0,
      meetings_per_day_needed: remainingWorkingDays > 0
        ? Math.max(0, (meetingsTarget - currentMeetings) / remainingWorkingDays)
        : 0,
    }

    // Generate recommendations
    const recommendations: PredictionRecommendation[] = []

    if (paceIndicator === 'behind' || paceIndicator === 'critical') {
      recommendations.push({
        type: 'risk_alert',
        title: 'Revenue Behind Pace',
        description: `You need ₹${Math.round(dailyTargets.revenue_per_day_needed).toLocaleString('en-IN')}/day to hit target. Current rate: ₹${Math.round(dailyRevenueRate).toLocaleString('en-IN')}/day.`,
        impact_estimate: `Gap: ₹${Math.round(revenueTarget - predictedRevenue).toLocaleString('en-IN')}`,
        priority: paceIndicator === 'critical' ? 'high' : 'medium',
      })
    }

    if (paceIndicator === 'ahead') {
      recommendations.push({
        type: 'opportunity',
        title: 'On Track for Super Achiever',
        description: `At current pace, you'll hit ${revenueAchievementProjected.toFixed(0)}% of target. ${revenueAchievementProjected >= 150 ? 'Super Achiever bonus qualifies!' : `Need ${(150 - revenueAchievementProjected).toFixed(0)}% more for Super Achiever.`}`,
        impact_estimate: revenueAchievementProjected >= 150 ? 'Super Achiever bonus activated' : 'Close to bonus tier',
        priority: 'medium',
      })
    }

    if (dailyTargets.visits_per_day_needed > 8) {
      recommendations.push({
        type: 'focus_area',
        title: 'Increase Field Activity',
        description: `You need ${dailyTargets.visits_per_day_needed.toFixed(0)} visits/day but this is above typical capacity. Focus on high-value prospects.`,
        impact_estimate: 'Prioritize quality over quantity',
        priority: 'high',
      })
    }

    const conversionRate = summary.field_conversion_rate || summary.conversion_rate || 0
    if (conversionRate < 15 && currentVisits > 20) {
      recommendations.push({
        type: 'focus_area',
        title: 'Improve Conversion Rate',
        description: `Your conversion rate is ${conversionRate.toFixed(1)}%. Improving by 5% would add ~${Math.round(currentVisits * 0.05)} more conversions.`,
        impact_estimate: `+${Math.round(currentVisits * 0.05 * (currentRevenue / Math.max(currentConversions, 1)))} potential revenue`,
        priority: 'high',
      })
    }

    // Predict grade
    const predictedScore = revenueAchievementProjected * 0.4 + conversionAchievementProjected * 0.3 +
      ((currentVisits / visitsTarget) * 100) * 0.15 + ((currentMeetings / meetingsTarget) * 100) * 0.15
    let predictedGrade: string
    if (predictedScore >= 95) predictedGrade = 'A+'
    else if (predictedScore >= 85) predictedGrade = 'A'
    else if (predictedScore >= 75) predictedGrade = 'B+'
    else if (predictedScore >= 65) predictedGrade = 'B'
    else if (predictedScore >= 55) predictedGrade = 'C+'
    else if (predictedScore >= 45) predictedGrade = 'C'
    else if (predictedScore >= 35) predictedGrade = 'D'
    else predictedGrade = 'F'

    const prediction: DSEPerformancePrediction = {
      id: `pred-${currentYear}-${currentMonth}`,
      dse_user_id: user.id,
      month: currentMonth,
      year: currentYear,
      predicted_revenue: Number(predictedRevenue.toFixed(2)),
      predicted_conversions: predictedConversions,
      predicted_grade: predictedGrade,
      prediction_confidence: predictionConfidence,
      revenue_probability: Number(revenueProbability.toFixed(1)),
      conversion_probability: Number(conversionProbability.toFixed(1)),
      daily_target_to_achieve: dailyTargets,
      pace_indicator: paceIndicator,
      recommendations,
      model_version: 'v1-weighted-average',
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      prediction,
      current_metrics: {
        revenue: currentRevenue,
        conversions: currentConversions,
        visits: currentVisits,
        meetings: currentMeetings,
        day_of_month: currentDay,
        working_days_elapsed: elapsedWorkingDays,
        working_days_remaining: remainingWorkingDays,
        pace_delta_pct: Number(paceDelta.toFixed(1)),
      },
      targets: {
        revenue: revenueTarget,
        conversions: conversionsTarget,
        visits: visitsTarget,
        meetings: meetingsTarget,
      },
    })
  } catch (error) {
    apiLogger.error('Error in predictions API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Calculate probability of hitting target using projected achievement and time progress */
function calculateTargetProbability(projectedAchievement: number, dayRatio: number): number {
  if (projectedAchievement >= 100) return Math.min(90 + dayRatio * 10, 99)
  if (projectedAchievement >= 90) return 60 + (projectedAchievement - 90) * 3
  if (projectedAchievement >= 70) return 30 + (projectedAchievement - 70) * 1.5
  return Math.max(5, projectedAchievement * 0.4)
}

/** Count working days (Mon-Sat) in a month */
function getWorkingDays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let workingDays = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = new Date(year, month - 1, day).getDay()
    if (dayOfWeek !== 0) workingDays++ // Exclude Sundays
  }
  return workingDays
}

/** Count elapsed working days up to current date */
function getElapsedWorkingDays(year: number, month: number, currentDay: number): number {
  let workingDays = 0
  for (let day = 1; day <= currentDay; day++) {
    const dayOfWeek = new Date(year, month - 1, day).getDay()
    if (dayOfWeek !== 0) workingDays++
  }
  return workingDays
}
