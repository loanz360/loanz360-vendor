
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCROAuth } from '@/lib/middleware/cro-auth'
import { apiLogger } from '@/lib/utils/logger'

// =====================================================
// Coaching Tip Types
// =====================================================

type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
type SkillArea = 'call_skills' | 'lead_management' | 'deal_closing' | 'time_management'

interface CoachingTip {
  id: string
  area: SkillArea
  title: string
  description: string
  skill_level: SkillLevel
  actions: string[]
  metric_key?: string
  current_score?: number
  target_score?: number
}

interface TodayAction {
  id: string
  action: string
  area: SkillArea
  priority: 'high' | 'medium' | 'low'
  estimated_minutes: number
}

interface CoachingResponse {
  success: boolean
  data: {
    tips_by_area: Record<SkillArea, CoachingTip[]>
    today_actions: TodayAction[]
    weekly_focus: {
      area: SkillArea
      area_label: string
      reason: string
      improvement_needed: number
      tips: string[]
    }
    overall_skill_levels: Record<SkillArea, { level: SkillLevel; score: number }>
    generated_at: string
  }
}

// =====================================================
// Area Labels
// =====================================================

const AREA_LABELS: Record<SkillArea, string> = {
  call_skills: 'Call Skills',
  lead_management: 'Lead Management',
  deal_closing: 'Deal Closing',
  time_management: 'Time Management',
}

// =====================================================
// GET /api/cro/performance/coaching
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    // Fetch daily metrics for current month
    const { data: dailyMetrics } = await supabase
      .from('cro_daily_metrics')
      .select('*')
      .eq('cro_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', today)
      .order('date', { ascending: false })

    // Fetch targets
    const { data: targets } = await supabase
      .from('cro_targets')
      .select('*')
      .eq('cro_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle()

    // Fetch last 7 days for recent trends
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const recentMetrics = (dailyMetrics || []).filter(
      (d: Record<string, unknown>) => d.date >= sevenDaysAgo
    )

    // Calculate area scores
    const areaScores = calculateAreaScores(dailyMetrics || [], targets, recentMetrics)

    // Generate coaching tips per area
    const tipsByArea = generateCoachingTips(areaScores, dailyMetrics || [], targets)

    // Generate today's actions based on weakest areas
    const todayActions = generateTodayActions(areaScores, recentMetrics, targets)

    // Determine weekly focus (weakest area)
    const weakestArea = findWeakestArea(areaScores)

    const response: CoachingResponse = {
      success: true,
      data: {
        tips_by_area: tipsByArea,
        today_actions: todayActions,
        weekly_focus: {
          area: weakestArea.area,
          area_label: AREA_LABELS[weakestArea.area],
          reason: weakestArea.reason,
          improvement_needed: weakestArea.gap,
          tips: weakestArea.tips,
        },
        overall_skill_levels: {
          call_skills: {
            level: getSkillLevel(areaScores.call_skills),
            score: Math.round(areaScores.call_skills),
          },
          lead_management: {
            level: getSkillLevel(areaScores.lead_management),
            score: Math.round(areaScores.lead_management),
          },
          deal_closing: {
            level: getSkillLevel(areaScores.deal_closing),
            score: Math.round(areaScores.deal_closing),
          },
          time_management: {
            level: getSkillLevel(areaScores.time_management),
            score: Math.round(areaScores.time_management),
          },
        },
        generated_at: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error generating coaching tips', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate coaching tips' },
      { status: 500 }
    )
  }
}

// =====================================================
// Area Score Calculation
// =====================================================

interface AreaScores {
  call_skills: number
  lead_management: number
  deal_closing: number
  time_management: number
}

function calculateAreaScores(
  dailyMetrics: unknown[],
  targets: unknown,
  recentMetrics: unknown[]
): AreaScores {
  if (dailyMetrics.length === 0) {
    return { call_skills: 0, lead_management: 0, deal_closing: 0, time_management: 0 }
  }

  const days = dailyMetrics.length

  // --- Call Skills Score ---
  const totalCalls = dailyMetrics.reduce((s: number, d: unknown) => s + (d.calls_made || 0), 0)
  const totalConnected = dailyMetrics.reduce((s: number, d: unknown) => s + (d.calls_connected || 0), 0)
  const avgCallDuration = dailyMetrics.reduce((s: number, d: unknown) => s + (d.avg_call_duration_minutes || 0), 0) / days
  const avgCallsPerDay = totalCalls / days

  const targetCallsPerDay = targets?.target_calls_per_day || 50
  const targetCallDuration = targets?.target_call_duration_minutes || 3

  const callVolumeScore = Math.min((avgCallsPerDay / targetCallsPerDay) * 100, 100)
  const connectRate = totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0
  const durationScore = Math.min((avgCallDuration / targetCallDuration) * 100, 100)
  const callSkillsScore = callVolumeScore * 0.4 + connectRate * 0.3 + durationScore * 0.3

  // --- Lead Management Score ---
  const totalLeadsGenerated = dailyMetrics.reduce((s: number, d: unknown) => s + (d.leads_generated || 0), 0)
  const totalLeadsConverted = dailyMetrics.reduce((s: number, d: unknown) => s + (d.leads_converted || 0), 0)
  const totalFollowupsCompleted = dailyMetrics.reduce((s: number, d: unknown) => s + (d.followups_completed || 0), 0)
  const totalFollowupsScheduled = dailyMetrics.reduce((s: number, d: unknown) => s + (d.followups_scheduled || 0), 0)
  const avgResponseTime = dailyMetrics.reduce((s: number, d: unknown) => s + (d.avg_response_time_minutes || 0), 0) / days

  const targetLeadsGenerated = targets?.target_leads_generated || 100
  const targetConversionRate = targets?.target_conversion_rate || 20
  const targetResponseTime = targets?.target_response_time_minutes || 30

  const leadGenScore = Math.min((totalLeadsGenerated / targetLeadsGenerated) * 100, 100)
  const conversionRate = totalLeadsGenerated > 0 ? (totalLeadsConverted / totalLeadsGenerated) * 100 : 0
  const conversionScore = Math.min((conversionRate / targetConversionRate) * 100, 100)
  const followupRate = totalFollowupsScheduled > 0 ? (totalFollowupsCompleted / totalFollowupsScheduled) * 100 : 100
  const responseScore = targetResponseTime > 0 ? Math.min((targetResponseTime / Math.max(avgResponseTime, 1)) * 100, 100) : 50

  const leadManagementScore = leadGenScore * 0.25 + conversionScore * 0.35 + followupRate * 0.2 + responseScore * 0.2

  // --- Deal Closing Score ---
  const totalCasesSanctioned = dailyMetrics.reduce((s: number, d: unknown) => s + (d.cases_sanctioned || 0), 0)
  const totalCasesDisbursed = dailyMetrics.reduce((s: number, d: unknown) => s + (d.cases_disbursed || 0), 0)
  const totalRevenue = dailyMetrics.reduce((s: number, d: unknown) => s + (d.revenue_generated || 0), 0)

  const targetCasesSanctioned = targets?.target_cases_sanctioned || 15
  const targetCasesDisbursed = targets?.target_cases_disbursed || 10
  const targetRevenue = targets?.target_revenue || 500000

  const sanctionScore = Math.min((totalCasesSanctioned / targetCasesSanctioned) * 100, 100)
  const disbursedScore = Math.min((totalCasesDisbursed / targetCasesDisbursed) * 100, 100)
  const revenueScore = Math.min((totalRevenue / targetRevenue) * 100, 100)
  // Sanction-to-disburse speed (higher is better)
  const sanctionToDisburse = totalCasesSanctioned > 0 ? (totalCasesDisbursed / totalCasesSanctioned) * 100 : 0

  const dealClosingScore = sanctionScore * 0.25 + disbursedScore * 0.3 + revenueScore * 0.25 + Math.min(sanctionToDisburse, 100) * 0.2

  // --- Time Management Score ---
  const recentDays = recentMetrics.length
  const avgActiveHours = recentDays > 0
    ? recentMetrics.reduce((s: number, d: unknown) => s + (d.active_hours || 0), 0) / recentDays
    : 0

  // Consistency: how many of last 7 days had activity
  const activeDaysCount = recentMetrics.filter((d: Record<string, unknown>) => (d.calls_made || 0) > 0).length
  const consistencyScore = recentDays > 0 ? (activeDaysCount / Math.min(recentDays, 5)) * 100 : 0

  // Active hours score (target ~8 hours)
  const activeHoursScore = Math.min((avgActiveHours / 8) * 100, 100)

  // Follow-up timing (completing follow-ups on schedule)
  const followupTimingScore = followupRate

  const timeManagementScore = consistencyScore * 0.35 + activeHoursScore * 0.3 + followupTimingScore * 0.35

  return {
    call_skills: Math.round(callSkillsScore * 100) / 100,
    lead_management: Math.round(leadManagementScore * 100) / 100,
    deal_closing: Math.round(dealClosingScore * 100) / 100,
    time_management: Math.round(timeManagementScore * 100) / 100,
  }
}

// =====================================================
// Skill Level Determination
// =====================================================

function getSkillLevel(score: number): SkillLevel {
  if (score >= 75) return 'advanced'
  if (score >= 40) return 'intermediate'
  return 'beginner'
}

// =====================================================
// Coaching Tips Generation
// =====================================================

function generateCoachingTips(
  areaScores: AreaScores,
  dailyMetrics: unknown[],
  targets: unknown): Record<SkillArea, CoachingTip[]> {
  const tips: Record<SkillArea, CoachingTip[]> = {
    call_skills: [],
    lead_management: [],
    deal_closing: [],
    time_management: [],
  }

  if (dailyMetrics.length === 0) {
    // No data: provide starter tips
    tips.call_skills.push({
      id: 'cs-start',
      area: 'call_skills',
      title: 'Start Logging Your Calls',
      description: 'No call data recorded yet. Begin by logging your daily call activity to receive personalized coaching.',
      skill_level: 'beginner',
      actions: ['Log at least 10 calls today', 'Track call outcomes (connected, voicemail, no answer)', 'Note call duration for each conversation'],
    })
    return tips
  }

  const days = dailyMetrics.length
  const totalCalls = dailyMetrics.reduce((s: number, d: unknown) => s + (d.calls_made || 0), 0)
  const totalConnected = dailyMetrics.reduce((s: number, d: unknown) => s + (d.calls_connected || 0), 0)
  const avgCallDuration = dailyMetrics.reduce((s: number, d: unknown) => s + (d.avg_call_duration_minutes || 0), 0) / days
  const avgCallsPerDay = totalCalls / days
  const connectRate = totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0

  const totalLeadsGenerated = dailyMetrics.reduce((s: number, d: unknown) => s + (d.leads_generated || 0), 0)
  const totalLeadsConverted = dailyMetrics.reduce((s: number, d: unknown) => s + (d.leads_converted || 0), 0)
  const totalFollowupsCompleted = dailyMetrics.reduce((s: number, d: unknown) => s + (d.followups_completed || 0), 0)
  const totalFollowupsScheduled = dailyMetrics.reduce((s: number, d: unknown) => s + (d.followups_scheduled || 0), 0)
  const avgResponseTime = dailyMetrics.reduce((s: number, d: unknown) => s + (d.avg_response_time_minutes || 0), 0) / days
  const conversionRate = totalLeadsGenerated > 0 ? (totalLeadsConverted / totalLeadsGenerated) * 100 : 0
  const followupRate = totalFollowupsScheduled > 0 ? (totalFollowupsCompleted / totalFollowupsScheduled) * 100 : 100

  const totalCasesSanctioned = dailyMetrics.reduce((s: number, d: unknown) => s + (d.cases_sanctioned || 0), 0)
  const totalCasesDisbursed = dailyMetrics.reduce((s: number, d: unknown) => s + (d.cases_disbursed || 0), 0)
  const totalRevenue = dailyMetrics.reduce((s: number, d: unknown) => s + (d.revenue_generated || 0), 0)

  const targetCallsPerDay = targets?.target_calls_per_day || 50
  const targetConversionRate = targets?.target_conversion_rate || 20
  const targetResponseTime = targets?.target_response_time_minutes || 30
  const targetCasesDisbursed = targets?.target_cases_disbursed || 10
  const targetRevenue = targets?.target_revenue || 500000

  const callLevel = getSkillLevel(areaScores.call_skills)
  const leadLevel = getSkillLevel(areaScores.lead_management)
  const dealLevel = getSkillLevel(areaScores.deal_closing)
  const timeLevel = getSkillLevel(areaScores.time_management)

  // --- Call Skills Tips ---
  if (avgCallsPerDay < targetCallsPerDay * 0.6) {
    tips.call_skills.push({
      id: 'cs-volume-low',
      area: 'call_skills',
      title: 'Increase Daily Call Volume',
      description: `You're averaging ${Math.round(avgCallsPerDay)} calls/day against a target of ${targetCallsPerDay}. Building consistent call volume is the foundation of strong CRO performance.`,
      skill_level: callLevel,
      actions: [
        `Aim for at least ${Math.round(targetCallsPerDay * 0.8)} calls today`,
        'Block two 90-minute calling sessions (morning and afternoon)',
        'Pre-dial your list before each session to minimize downtime',
        'Use the auto-dialer feature if available',
      ],
      metric_key: 'calls_made',
      current_score: avgCallsPerDay,
      target_score: targetCallsPerDay,
    })
  } else if (avgCallsPerDay >= targetCallsPerDay) {
    tips.call_skills.push({
      id: 'cs-volume-great',
      area: 'call_skills',
      title: 'Maintain Your Call Momentum',
      description: `Excellent! Your ${Math.round(avgCallsPerDay)} calls/day meets the target. Focus on maintaining this consistency while improving quality.`,
      skill_level: callLevel,
      actions: [
        'Track your best-performing time slots and double down',
        'Share your calling routine with junior CROs',
        'Focus on improving connect rate alongside volume',
      ],
      metric_key: 'calls_made',
      current_score: avgCallsPerDay,
      target_score: targetCallsPerDay,
    })
  }

  if (connectRate < 40) {
    tips.call_skills.push({
      id: 'cs-connect-rate',
      area: 'call_skills',
      title: 'Improve Call Connect Rate',
      description: `Only ${connectRate.toFixed(1)}% of your calls are connecting. Improving when and how you call can dramatically increase connections.`,
      skill_level: callLevel,
      actions: [
        'Call between 10-12 AM and 3-5 PM (peak connect hours)',
        'Retry missed calls after 2-3 hours',
        'Verify phone numbers before calling',
        'Leave brief voicemails to prompt callbacks',
      ],
      metric_key: 'connect_rate',
      current_score: connectRate,
      target_score: 60,
    })
  }

  if (avgCallDuration < 2) {
    tips.call_skills.push({
      id: 'cs-duration-short',
      area: 'call_skills',
      title: 'Deepen Your Conversations',
      description: `Average call duration of ${avgCallDuration.toFixed(1)} min suggests conversations end too quickly. Longer, meaningful calls convert better.`,
      skill_level: callLevel,
      actions: [
        'Open with a strong hook: mention a specific benefit relevant to the customer',
        'Ask at least 3 qualifying questions before pitching',
        'Handle objections with empathy: acknowledge, then redirect',
        'Always confirm next steps before hanging up',
      ],
      metric_key: 'call_duration',
      current_score: avgCallDuration,
      target_score: 3,
    })
  } else if (avgCallDuration > 6) {
    tips.call_skills.push({
      id: 'cs-duration-long',
      area: 'call_skills',
      title: 'Tighten Your Call Structure',
      description: `Calls averaging ${avgCallDuration.toFixed(1)} min may be too long. Aim for efficient, structured conversations to handle more leads.`,
      skill_level: callLevel,
      actions: [
        'Create a 3-minute call framework: qualify, pitch, close',
        'Identify time-wasting patterns (small talk, repetition)',
        'Set a mental 4-minute marker and steer towards closing',
      ],
      metric_key: 'call_duration',
      current_score: avgCallDuration,
      target_score: 4,
    })
  }

  // --- Lead Management Tips ---
  if (conversionRate < targetConversionRate * 0.5) {
    tips.lead_management.push({
      id: 'lm-conversion-low',
      area: 'lead_management',
      title: 'Improve Lead Qualification',
      description: `Your ${conversionRate.toFixed(1)}% conversion rate is well below the ${targetConversionRate}% target. Better qualification upfront saves time and improves outcomes.`,
      skill_level: leadLevel,
      actions: [
        'Use the BANT framework: Budget, Authority, Need, Timeline',
        'Score leads before investing time: prioritize hot leads',
        'Disqualify poor-fit leads early rather than nurturing indefinitely',
        'Review your top 5 converted leads and identify common traits',
      ],
      metric_key: 'conversion_rate',
      current_score: conversionRate,
      target_score: targetConversionRate,
    })
  } else if (conversionRate >= targetConversionRate) {
    tips.lead_management.push({
      id: 'lm-conversion-great',
      area: 'lead_management',
      title: 'Scale Your Conversion Success',
      description: `Outstanding ${conversionRate.toFixed(1)}% conversion rate! Document your winning approach and apply it to more leads.`,
      skill_level: leadLevel,
      actions: [
        'Document your qualification checklist for consistency',
        'Increase lead volume to maximize your strong conversion skills',
        'Mentor peers on your lead qualification approach',
      ],
      metric_key: 'conversion_rate',
      current_score: conversionRate,
      target_score: targetConversionRate,
    })
  }

  if (followupRate < 80) {
    tips.lead_management.push({
      id: 'lm-followup',
      area: 'lead_management',
      title: 'Strengthen Follow-up Discipline',
      description: `Only ${followupRate.toFixed(0)}% of scheduled follow-ups completed. Each missed follow-up is a potential lost deal.`,
      skill_level: leadLevel,
      actions: [
        'Set CRM reminders for every follow-up immediately after scheduling',
        'Batch follow-ups into dedicated 30-minute blocks',
        'Start each day by reviewing pending follow-ups',
        'Never leave the office with incomplete follow-ups',
      ],
      metric_key: 'followup_completion',
      current_score: followupRate,
      target_score: 90,
    })
  }

  if (avgResponseTime > targetResponseTime) {
    tips.lead_management.push({
      id: 'lm-response-time',
      area: 'lead_management',
      title: 'Speed Up Lead Response',
      description: `Average response time of ${Math.round(avgResponseTime)} min exceeds the ${targetResponseTime} min target. Speed is the number one factor in lead conversion.`,
      skill_level: leadLevel,
      actions: [
        'Enable push notifications for new lead assignments',
        'Respond to new leads within 15 minutes during work hours',
        'Use quick-response templates for initial outreach',
        'Check your lead queue every 30 minutes',
      ],
      metric_key: 'response_time',
      current_score: avgResponseTime,
      target_score: targetResponseTime,
    })
  }

  // --- Deal Closing Tips ---
  const sanctionToDisburse = totalCasesSanctioned > 0
    ? (totalCasesDisbursed / totalCasesSanctioned) * 100
    : 0

  if (totalCasesDisbursed < targetCasesDisbursed * 0.5) {
    tips.deal_closing.push({
      id: 'dc-disbursement-low',
      area: 'deal_closing',
      title: 'Accelerate Disbursements',
      description: `${totalCasesDisbursed} of ${targetCasesDisbursed} target cases disbursed. Focus on moving sanctioned cases through to disbursement faster.`,
      skill_level: dealLevel,
      actions: [
        'Follow up on sanctioned-but-not-disbursed cases daily',
        'Ensure all documentation is complete before sanction',
        'Build relationships with bank processing teams for faster turnaround',
        'Identify and remove bottlenecks in the documentation chain',
      ],
      metric_key: 'cases_disbursed',
      current_score: totalCasesDisbursed,
      target_score: targetCasesDisbursed,
    })
  }

  if (sanctionToDisburse < 60 && totalCasesSanctioned > 0) {
    tips.deal_closing.push({
      id: 'dc-sanction-convert',
      area: 'deal_closing',
      title: 'Improve Sanction-to-Disbursement Rate',
      description: `Only ${sanctionToDisburse.toFixed(0)}% of sanctioned cases have been disbursed. Cases are getting stuck after approval.`,
      skill_level: dealLevel,
      actions: [
        'Track each sanctioned case with a dedicated checklist',
        'Proactively collect all post-sanction documents',
        'Set up a daily sanction-to-disburse pipeline review',
        'Coordinate with the operations team on pending cases',
      ],
    })
  }

  if (totalRevenue < targetRevenue * 0.4) {
    tips.deal_closing.push({
      id: 'dc-revenue-low',
      area: 'deal_closing',
      title: 'Focus on Higher-Value Cases',
      description: `Revenue at ${((totalRevenue / targetRevenue) * 100).toFixed(0)}% of target. Consider focusing on higher-ticket loan products to close the gap.`,
      skill_level: dealLevel,
      actions: [
        'Prioritize leads with larger loan requirements',
        'Cross-sell additional products to existing customers',
        'Explore home loan and LAP products which have higher ticket sizes',
        'Negotiate better terms to retain borderline customers',
      ],
      metric_key: 'revenue_generated',
      current_score: totalRevenue,
      target_score: targetRevenue,
    })
  }

  // --- Time Management Tips ---
  const recentDays = dailyMetrics.slice(0, 7)
  const activeDays = recentDays.filter((d: Record<string, unknown>) => (d.calls_made || 0) > 0).length
  const avgActiveHours = recentDays.length > 0
    ? recentDays.reduce((s: number, d: unknown) => s + (d.active_hours || 0), 0) / recentDays.length
    : 0

  if (activeDays < 4 && recentDays.length >= 5) {
    tips.time_management.push({
      id: 'tm-consistency',
      area: 'time_management',
      title: 'Build Daily Consistency',
      description: `Only ${activeDays} active days out of the last ${Math.min(recentDays.length, 7)}. Consistent daily effort outperforms sporadic bursts.`,
      skill_level: timeLevel,
      actions: [
        'Set a non-negotiable morning routine: check leads, plan calls',
        'Log at least minimal activity every working day',
        'Create a daily scorecard with minimum thresholds',
        'Review your weekly pattern every Friday evening',
      ],
    })
  }

  if (avgActiveHours < 5 && recentDays.length > 0) {
    tips.time_management.push({
      id: 'tm-active-hours',
      area: 'time_management',
      title: 'Increase Productive Hours',
      description: `Averaging ${avgActiveHours.toFixed(1)} active hours/day. Aim for 7-8 hours of productive CRM activity.`,
      skill_level: timeLevel,
      actions: [
        'Start work at a fixed time daily and log in immediately',
        'Minimize non-productive activities during peak hours',
        'Use the Pomodoro technique: 25 min work, 5 min break',
        'Keep a time log for one week to identify time leaks',
      ],
    })
  }

  if (followupRate < 70) {
    tips.time_management.push({
      id: 'tm-followup-priority',
      area: 'time_management',
      title: 'Prioritize Follow-ups in Your Schedule',
      description: `${followupRate.toFixed(0)}% follow-up completion suggests scheduling issues. Dedicated time blocks make follow-ups automatic.`,
      skill_level: timeLevel,
      actions: [
        'Block 9:30-10:00 AM daily for follow-up calls',
        'Block 4:00-4:30 PM for end-of-day follow-up catch-up',
        'Use priority labels: today, tomorrow, this week',
        'Never push a follow-up more than once',
      ],
    })
  }

  // Ensure at least one tip per area
  if (tips.call_skills.length === 0) {
    tips.call_skills.push({
      id: 'cs-maintain',
      area: 'call_skills',
      title: 'Refine Your Pitch',
      description: 'Your call metrics are solid. Take it to the next level by refining your pitch and testing variations.',
      skill_level: callLevel,
      actions: [
        'A/B test two different opening lines this week',
        'Record and review one call per day for self-improvement',
        'Ask converted customers what convinced them',
      ],
    })
  }

  if (tips.lead_management.length === 0) {
    tips.lead_management.push({
      id: 'lm-nurture',
      area: 'lead_management',
      title: 'Nurture Cold Leads',
      description: 'Your active lead management is strong. Now extract value from older leads that went cold.',
      skill_level: leadLevel,
      actions: [
        'Review leads older than 30 days for re-engagement',
        'Send a personalized follow-up to 5 cold leads this week',
        'Segment cold leads by reason for stalling',
      ],
    })
  }

  if (tips.deal_closing.length === 0) {
    tips.deal_closing.push({
      id: 'dc-optimize',
      area: 'deal_closing',
      title: 'Optimize Your Closing Process',
      description: 'Deal closing is on track. Look for ways to shorten the cycle and increase average deal size.',
      skill_level: dealLevel,
      actions: [
        'Map your average deal timeline and identify delays',
        'Pre-prepare document checklists for customers',
        'Explore upselling opportunities at the closing stage',
      ],
    })
  }

  if (tips.time_management.length === 0) {
    tips.time_management.push({
      id: 'tm-optimize',
      area: 'time_management',
      title: 'Optimize Your Peak Performance Hours',
      description: 'Your time management is effective. Fine-tune your schedule to maximize high-value activities during peak hours.',
      skill_level: timeLevel,
      actions: [
        'Track which hours yield the most conversions',
        'Reserve peak hours exclusively for calling and closing',
        'Batch administrative tasks into a single afternoon block',
      ],
    })
  }

  return tips
}

// =====================================================
// Today's Actions Generation
// =====================================================

function generateTodayActions(
  areaScores: AreaScores,
  recentMetrics: unknown[],
  targets: unknown): TodayAction[] {
  const actions: TodayAction[] = []
  let actionId = 0

  // Sort areas by score (weakest first)
  const sortedAreas = (Object.entries(areaScores) as [SkillArea, number][])
    .sort((a, b) => a[1] - b[1])

  const yesterday = recentMetrics.length > 0 ? recentMetrics[0] : null

  // Generate 4-6 actionable items for today
  for (const [area, score] of sortedAreas) {
    if (actions.length >= 6) break

    if (area === 'call_skills') {
      const targetCalls = targets?.target_calls_per_day || 50
      actions.push({
        id: `today-${actionId++}`,
        action: `Make at least ${targetCalls} calls today${score < 50 ? ' (focus on quality conversations)' : ''}`,
        area: 'call_skills',
        priority: score < 40 ? 'high' : 'medium',
        estimated_minutes: 240,
      })
      if (score < 50) {
        actions.push({
          id: `today-${actionId++}`,
          action: 'Practice your opening pitch on the first 5 calls and note what works',
          area: 'call_skills',
          priority: 'medium',
          estimated_minutes: 15,
        })
      }
    }

    if (area === 'lead_management') {
      const pendingFollowups = yesterday?.followups_scheduled
        ? yesterday.followups_scheduled - (yesterday.followups_completed || 0)
        : 0
      if (pendingFollowups > 0) {
        actions.push({
          id: `today-${actionId++}`,
          action: `Complete ${pendingFollowups} pending follow-ups from yesterday before making new calls`,
          area: 'lead_management',
          priority: 'high',
          estimated_minutes: pendingFollowups * 5,
        })
      }
      actions.push({
        id: `today-${actionId++}`,
        action: 'Respond to all new leads within 15 minutes of assignment',
        area: 'lead_management',
        priority: score < 40 ? 'high' : 'medium',
        estimated_minutes: 30,
      })
    }

    if (area === 'deal_closing') {
      actions.push({
        id: `today-${actionId++}`,
        action: 'Review all sanctioned cases and push pending documentation forward',
        area: 'deal_closing',
        priority: score < 40 ? 'high' : 'low',
        estimated_minutes: 45,
      })
    }

    if (area === 'time_management') {
      actions.push({
        id: `today-${actionId++}`,
        action: 'Plan your day in the first 10 minutes: prioritize calls, follow-ups, and closings',
        area: 'time_management',
        priority: score < 40 ? 'high' : 'low',
        estimated_minutes: 10,
      })
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return actions.slice(0, 6)
}

// =====================================================
// Weakest Area Finder
// =====================================================

function findWeakestArea(areaScores: AreaScores): {
  area: SkillArea
  reason: string
  gap: number
  tips: string[]
} {
  const entries = Object.entries(areaScores) as [SkillArea, number][]
  entries.sort((a, b) => a[1] - b[1])

  const [weakest, score] = entries[0]
  const gap = Math.round(100 - score)

  const reasonMap: Record<SkillArea, string> = {
    call_skills: `Your call skills score is ${Math.round(score)}%. Improving call volume, connect rate, or conversation quality will have the biggest impact.`,
    lead_management: `Your lead management score is ${Math.round(score)}%. Better qualification, faster response, and consistent follow-ups will boost your results.`,
    deal_closing: `Your deal closing score is ${Math.round(score)}%. Focus on moving sanctioned cases to disbursement and increasing deal value.`,
    time_management: `Your time management score is ${Math.round(score)}%. Building daily consistency and maximizing active hours will improve all other areas.`,
  }

  const tipsMap: Record<SkillArea, string[]> = {
    call_skills: [
      'Dedicate mornings (10-12 PM) exclusively to outbound calls',
      'Track connect rate daily and aim for 50%+',
      'Keep calls between 3-5 minutes for optimal results',
    ],
    lead_management: [
      'Respond to new leads within 15 minutes',
      'Complete all scheduled follow-ups before end of day',
      'Review and re-prioritize your lead pipeline every morning',
    ],
    deal_closing: [
      'Follow up on sanctioned cases every 48 hours',
      'Ensure all documents are collected before bank submission',
      'Track each deal stage and identify common bottlenecks',
    ],
    time_management: [
      'Start your day at the same time every day',
      'Use time blocks: calls, follow-ups, documentation, breaks',
      'Review your weekly performance every Friday',
    ],
  }

  return {
    area: weakest,
    reason: reasonMap[weakest],
    gap,
    tips: tipsMap[weakest],
  }
}
