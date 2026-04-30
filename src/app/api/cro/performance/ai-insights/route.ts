import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  AIInsightsResponse,
  CROAIInsight,
  InsightType,
  InsightPriority
} from '@/lib/types/cro-performance.types'
import { apiLogger } from '@/lib/utils/logger'
import { requireCROAuth } from '@/lib/middleware/cro-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Get existing insights
    const { data: existingInsights } = await supabase
      .from('cro_ai_insights')
      .select('*')
      .eq('cro_id', user.id)
      .eq('is_dismissed', false)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(50)

    // Cooldown: only generate new insights if the most recent one is older than 1 hour
    let newInsights: Partial<CROAIInsight>[] = []
    const { data: latestInsight } = await supabase
      .from('cro_ai_insights')
      .select('created_at')
      .eq('cro_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const shouldGenerate = !latestInsight || latestInsight.created_at < oneHourAgo

    if (shouldGenerate) {
      // Generate new insights based on current performance
      newInsights = await generateAIInsights(supabase, user.id)

      // Merge with existing (avoid duplicates based on title)
      const existingTitles = new Set((existingInsights || []).map(i => i.title))
      const uniqueNewInsights = newInsights.filter(i => !existingTitles.has(i.title))

      // Insert new unique insights
      if (uniqueNewInsights.length > 0) {
        await supabase
          .from('cro_ai_insights')
          .insert(uniqueNewInsights.map(i => ({
            cro_id: user.id,
            insight_type: i.insight_type,
            priority: i.priority,
            title: i.title,
            description: i.description,
            metric_affected: i.metric_affected,
            current_value: i.current_value,
            target_value: i.target_value,
            improvement_percentage: i.improvement_percentage,
            action_items: i.action_items,
            valid_until: i.valid_until
          })))
      }

      newInsights = uniqueNewInsights
    }

    // Combine all insights
    const allInsights = [...(existingInsights || []), ...newInsights]

    // Categorize insights
    const strengths = allInsights.filter(i => i.insight_type === 'strength')
    const improvements = allInsights.filter(i => i.insight_type === 'improvement')
    const recommendations = allInsights.filter(i => i.insight_type === 'recommendation')
    const warnings = allInsights.filter(i => i.insight_type === 'warning')
    const achievements = allInsights.filter(i => i.insight_type === 'achievement')

    // Count high priority and action items
    const highPriority = allInsights.filter(i => i.priority === 'high').length
    const actionItemsCount = allInsights.reduce((sum, i) => {
      const items = Array.isArray(i.action_items) ? i.action_items : []
      return sum + items.length
    }, 0)

    const response: AIInsightsResponse = {
      success: true,
      data: {
        strengths,
        improvements,
        recommendations,
        warnings,
        achievements,
        summary: {
          total_insights: allInsights.length,
          high_priority: highPriority,
          action_items_count: actionItemsCount
        },
        last_analyzed: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    apiLogger.error('Error fetching AI insights', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI insights' },
      { status: 500 }
    )
  }
}

// Mark insight as read
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { insight_id, action } = body

    if (action === 'read') {
      await supabase
        .from('cro_ai_insights')
        .update({ is_read: true })
        .eq('id', insight_id)
        .eq('cro_id', user.id)
    } else if (action === 'dismiss') {
      await supabase
        .from('cro_ai_insights')
        .update({ is_dismissed: true })
        .eq('id', insight_id)
        .eq('cro_id', user.id)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    apiLogger.error('Error updating insight', error)
    return NextResponse.json({ success: false, error: 'Failed to update insight' }, { status: 500 })
  }
}

// AI Insight Generation Logic
async function generateAIInsights(supabase: any, croId: string): Promise<Partial<CROAIInsight>[]> {
  const insights: Partial<CROAIInsight>[] = []

  // Get current month data
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  // Fetch current performance data
  const { data: dailyMetrics } = await supabase
    .from('cro_daily_metrics')
    .select('*')
    .eq('cro_id', croId)
    .gte('date', startOfMonth)
    .lte('date', today)
    .order('date', { ascending: false })

  // Fetch targets
  const { data: targets } = await supabase
    .from('cro_targets')
    .select('*')
    .eq('cro_id', croId)
    .eq('month', currentMonth)
    .maybeSingle()

  // Fetch company average for comparison
  const { data: companyAvg } = await supabase
    .from('cro_monthly_summary')
    .select('*')
    .eq('month', currentMonth)

  if (!dailyMetrics || dailyMetrics.length === 0) {
    insights.push({
      insight_type: 'warning',
      priority: 'high',
      title: 'No Activity Recorded',
      description: 'No performance data has been recorded for this month. Make sure to log your activities.',
      action_items: ['Log your daily calls', 'Update lead status regularly', 'Complete follow-ups on time']
    })
    return insights
  }

  // Aggregate metrics
  const totalCalls = dailyMetrics.reduce((sum: number, d: any) => sum + (d.calls_made || 0), 0)
  const totalConversions = dailyMetrics.reduce((sum: number, d: any) => sum + (d.leads_converted || 0), 0)
  const avgCallDuration = dailyMetrics.reduce((sum: number, d: any) => sum + (d.avg_call_duration_minutes || 0), 0) / dailyMetrics.length
  const totalLeadsGenerated = dailyMetrics.reduce((sum: number, d: any) => sum + (d.leads_generated || 0), 0)
  const avgResponseTime = dailyMetrics.reduce((sum: number, d: any) => sum + (d.avg_response_time_minutes || 0), 0) / dailyMetrics.length
  const totalFollowups = dailyMetrics.reduce((sum: number, d: any) => sum + (d.followups_completed || 0), 0)
  const totalDisbursed = dailyMetrics.reduce((sum: number, d: any) => sum + (d.cases_disbursed || 0), 0)

  const daysWorked = dailyMetrics.length
  const avgCallsPerDay = totalCalls / daysWorked

  // Calculate company averages
  const companyAvgCalls = companyAvg ? companyAvg.reduce((sum: number, c: any) => sum + (c.total_calls_made || 0), 0) / companyAvg.length : 0
  const companyAvgConversion = companyAvg ? companyAvg.reduce((sum: number, c: any) => sum + (c.conversion_rate || 0), 0) / companyAvg.length : 0

  // Analyze call patterns
  const recentDays = dailyMetrics.slice(0, 7)
  const avgRecentCalls = recentDays.reduce((sum: number, d: any) => sum + (d.calls_made || 0), 0) / recentDays.length

  // --- GENERATE INSIGHTS ---

  // 1. Call Volume Analysis
  if (targets && avgCallsPerDay < targets.target_calls_per_day * 0.7) {
    insights.push({
      insight_type: 'improvement',
      priority: 'high',
      title: 'Low Call Volume',
      description: `Your average of ${Math.round(avgCallsPerDay)} calls/day is below the target of ${targets.target_calls_per_day}. Increasing call volume can significantly improve conversions.`,
      metric_affected: 'calls_made',
      current_value: avgCallsPerDay,
      target_value: targets.target_calls_per_day,
      improvement_percentage: ((targets.target_calls_per_day - avgCallsPerDay) / targets.target_calls_per_day) * 100,
      action_items: [
        'Start your day 15 minutes early with calls',
        'Block 2-hour calling windows without interruptions',
        'Prepare call lists the night before',
        'Use speed dialing for efficiency'
      ]
    })
  } else if (avgCallsPerDay > (companyAvgCalls / daysWorked) * 1.2) {
    insights.push({
      insight_type: 'strength',
      priority: 'medium',
      title: 'Excellent Call Activity',
      description: `You're making 20% more calls than the company average. Your dedication to outreach is commendable!`,
      metric_affected: 'calls_made',
      current_value: avgCallsPerDay
    })
  }

  // 2. Call Duration Analysis
  if (avgCallDuration < 2) {
    insights.push({
      insight_type: 'recommendation',
      priority: 'medium',
      title: 'Improve Call Quality',
      description: `Your average call duration of ${avgCallDuration.toFixed(1)} minutes suggests calls may be too brief. Longer, quality conversations often lead to better conversions.`,
      metric_affected: 'call_duration',
      current_value: avgCallDuration,
      target_value: 3,
      action_items: [
        'Ask more open-ended questions',
        'Listen actively and take notes',
        'Discuss customer pain points thoroughly',
        'Explain benefits clearly before closing'
      ]
    })
  } else if (avgCallDuration > 5) {
    insights.push({
      insight_type: 'recommendation',
      priority: 'low',
      title: 'Optimize Call Efficiency',
      description: `Your calls average ${avgCallDuration.toFixed(1)} minutes. While quality is good, consider being more concise to increase daily call volume.`,
      metric_affected: 'call_duration',
      current_value: avgCallDuration,
      action_items: [
        'Create a call script with key points',
        'Set a mental timer for each call',
        'Qualify leads quickly at the start'
      ]
    })
  }

  // 3. Conversion Rate Analysis
  const conversionRate = totalLeadsGenerated > 0 ? (totalConversions / totalLeadsGenerated) * 100 : 0

  if (targets && conversionRate < targets.target_conversion_rate * 0.6) {
    insights.push({
      insight_type: 'improvement',
      priority: 'high',
      title: 'Conversion Rate Needs Attention',
      description: `Your conversion rate of ${conversionRate.toFixed(1)}% is significantly below the ${targets.target_conversion_rate}% target. Focus on lead qualification and follow-up timing.`,
      metric_affected: 'conversion_rate',
      current_value: conversionRate,
      target_value: targets.target_conversion_rate,
      action_items: [
        'Review and improve your pitch',
        'Focus on high-quality leads first',
        'Follow up within 24 hours of first contact',
        'Ask for referrals from converted customers',
        'Study successful conversion patterns'
      ]
    })
  } else if (conversionRate > companyAvgConversion * 1.3) {
    insights.push({
      insight_type: 'strength',
      priority: 'medium',
      title: 'Outstanding Conversion Rate',
      description: `Your ${conversionRate.toFixed(1)}% conversion rate is 30% above company average! Your closing skills are exceptional.`,
      metric_affected: 'conversion_rate',
      current_value: conversionRate
    })
  }

  // 4. Response Time Analysis
  if (targets && avgResponseTime > targets.target_response_time_minutes * 1.5) {
    insights.push({
      insight_type: 'warning',
      priority: 'high',
      title: 'Slow Response Time',
      description: `Average response time of ${avgResponseTime.toFixed(0)} minutes is too slow. Fast responses dramatically increase conversion chances.`,
      metric_affected: 'response_time',
      current_value: avgResponseTime,
      target_value: targets.target_response_time_minutes,
      action_items: [
        'Set up mobile notifications for new leads',
        'Check lead queue every 30 minutes',
        'Prioritize new leads over cold follow-ups',
        'Use quick response templates'
      ]
    })
  } else if (avgResponseTime < 15) {
    insights.push({
      insight_type: 'strength',
      priority: 'medium',
      title: 'Excellent Response Time',
      description: `Your average response time of ${avgResponseTime.toFixed(0)} minutes is outstanding! Quick responses lead to higher conversions.`,
      metric_affected: 'response_time',
      current_value: avgResponseTime
    })
  }

  // 5. Follow-up Completion Analysis
  const scheduledFollowups = dailyMetrics.reduce((sum: number, d: any) => sum + (d.followups_scheduled || 0), 0)
  const followupRate = scheduledFollowups > 0 ? (totalFollowups / scheduledFollowups) * 100 : 100

  if (followupRate < 70) {
    insights.push({
      insight_type: 'improvement',
      priority: 'medium',
      title: 'Missing Follow-ups',
      description: `You've completed only ${followupRate.toFixed(0)}% of scheduled follow-ups. Consistent follow-up is key to closing deals.`,
      metric_affected: 'followup_completion',
      current_value: followupRate,
      target_value: 90,
      action_items: [
        'Set calendar reminders for all follow-ups',
        'Batch follow-ups at specific times daily',
        'Use CRM automated reminders',
        'Never end the day with pending follow-ups'
      ]
    })
  }

  // 6. Recent Trend Analysis
  if (recentDays.length >= 5) {
    const firstHalf = recentDays.slice(Math.floor(recentDays.length / 2))
    const secondHalf = recentDays.slice(0, Math.floor(recentDays.length / 2))

    const firstHalfCalls = firstHalf.reduce((sum: number, d: any) => sum + (d.calls_made || 0), 0)
    const secondHalfCalls = secondHalf.reduce((sum: number, d: any) => sum + (d.calls_made || 0), 0)

    if (secondHalfCalls < firstHalfCalls * 0.7) {
      insights.push({
        insight_type: 'warning',
        priority: 'high',
        title: 'Declining Activity Trend',
        description: 'Your recent activity has dropped by 30%. Maintain consistency for best results.',
        action_items: [
          'Review your daily routine',
          'Set minimum daily activity goals',
          'Take short breaks to avoid burnout'
        ]
      })
    } else if (secondHalfCalls > firstHalfCalls * 1.3) {
      insights.push({
        insight_type: 'achievement',
        priority: 'medium',
        title: 'Great Momentum!',
        description: 'Your activity is trending upward! Keep this momentum going.'
      })
    }
  }

  // 7. Disbursement Achievement
  if (targets && totalDisbursed >= targets.target_cases_disbursed) {
    insights.push({
      insight_type: 'achievement',
      priority: 'high',
      title: 'Disbursement Target Achieved! 🎉',
      description: `Congratulations! You've achieved your monthly disbursement target of ${targets.target_cases_disbursed} cases.`,
      metric_affected: 'cases_disbursed',
      current_value: totalDisbursed,
      target_value: targets.target_cases_disbursed
    })
  }

  // 8. Best Performing Time - only add generic tip if fewer than 3 data-driven insights
  if (insights.length < 3) {
    insights.push({
      insight_type: 'recommendation',
      priority: 'low',
      title: 'Optimize Your Peak Hours',
      description: 'Based on industry patterns, 10 AM - 12 PM and 3 PM - 5 PM are typically best for outbound calls.',
      action_items: [
        'Schedule important calls during peak hours',
        'Use non-peak times for admin tasks',
        'Avoid calling during lunch hours (1-2 PM)'
      ]
    })
  }

  return insights
}
