import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AIInsight } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/bdm/ai-insights
 * Returns AI-generated insights for Business Development Manager
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

    const { data: existingInsights } = await supabase
      .from('bdm_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (existingInsights && existingInsights.length > 0) {
      return NextResponse.json({ insights: existingInsights })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const { data: targets } = await supabase
      .from('bdm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const { data: dailyMetrics } = await supabase
      .from('bdm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
      .lt('metric_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

    if (!targets || !dailyMetrics) {
      return NextResponse.json({ insights: [] })
    }

    const insights: Partial<AIInsight>[] = []

    const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.revenue_generated || 0), 0)
    const totalLeadsConverted = dailyMetrics.reduce((sum, d) => sum + (d.leads_converted || 0), 0)
    const totalClients = dailyMetrics.reduce((sum, d) => sum + (d.new_clients_acquired || 0), 0)
    const totalMeetings = dailyMetrics.reduce((sum, d) => sum + (d.client_meetings_held || 0), 0)

    const revenueAchievement = targets.revenue_target > 0
      ? (totalRevenue / targets.revenue_target) * 100
      : 0

    const leadsConversionAchievement = targets.leads_converted_target > 0
      ? (totalLeadsConverted / targets.leads_converted_target) * 100
      : 0

    const clientsAchievement = targets.new_clients_target > 0
      ? (totalClients / targets.new_clients_target) * 100
      : 0

    if (revenueAchievement > 90) {
      insights.push({
        insight_type: 'strength',
        priority: 'high',
        title: 'Outstanding Revenue Performance',
        description: `You've achieved ${revenueAchievement.toFixed(1)}% of your revenue target! Keep up the excellent work.`,
        metric_name: 'Revenue',
        current_value: totalRevenue,
        target_value: targets.revenue_target,
        variance_percentage: revenueAchievement - 100,
      })
    } else if (revenueAchievement < 50) {
      insights.push({
        insight_type: 'warning',
        priority: 'critical',
        title: 'Revenue Below Target',
        description: `Revenue is at ${revenueAchievement.toFixed(1)}% of target. Focus on closing high-value deals.`,
        action_items: [
          'Review pipeline for quick wins',
          'Schedule follow-ups with hot leads',
          'Focus on high-value opportunities',
        ],
        metric_name: 'Revenue',
        current_value: totalRevenue,
        target_value: targets.revenue_target,
        variance_percentage: revenueAchievement - 100,
      })
    }

    if (leadsConversionAchievement > 100) {
      insights.push({
        insight_type: 'achievement',
        priority: 'high',
        title: 'Lead Conversion Excellence',
        description: `You've exceeded your lead conversion target by ${(leadsConversionAchievement - 100).toFixed(1)}%!`,
        metric_name: 'Leads Converted',
        current_value: totalLeadsConverted,
        target_value: targets.leads_converted_target,
        variance_percentage: leadsConversionAchievement - 100,
      })
    }

    if (clientsAchievement < 60) {
      insights.push({
        insight_type: 'improvement',
        priority: 'medium',
        title: 'Client Acquisition Needs Attention',
        description: `New client acquisition is at ${clientsAchievement.toFixed(1)}%. Increase prospecting activities.`,
        action_items: [
          'Attend more networking events',
          'Leverage referrals from existing clients',
          'Explore new market segments',
        ],
        metric_name: 'New Clients',
        current_value: totalClients,
        target_value: targets.new_clients_target,
        variance_percentage: clientsAchievement - 100,
      })
    }

    const meetingsAchievement = targets.client_meetings_target > 0
      ? (totalMeetings / targets.client_meetings_target) * 100
      : 0

    if (meetingsAchievement > 100) {
      insights.push({
        insight_type: 'strength',
        priority: 'medium',
        title: 'Strong Client Engagement',
        description: `You're exceeding your meeting target with ${meetingsAchievement.toFixed(1)}% achievement.`,
        metric_name: 'Client Meetings',
        current_value: totalMeetings,
        target_value: targets.client_meetings_target,
        variance_percentage: meetingsAchievement - 100,
      })
    }

    if (insights.length === 0) {
      insights.push({
        insight_type: 'recommendation',
        priority: 'medium',
        title: 'Stay Focused on Your Goals',
        description: 'Continue your current efforts to meet all targets this month.',
        action_items: [
          'Maintain daily activity levels',
          'Track progress regularly',
          'Stay proactive with follow-ups',
        ],
      })
    }

    for (const insight of insights) {
      await supabase.from('bdm_ai_insights').insert({
        user_id: user.id,
        ...insight,
      })
    }

    const { data: savedInsights } = await supabase
      .from('bdm_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ insights: savedInsights || [] })
  } catch (error) {
    apiLogger.error('BDM AI insights error', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
