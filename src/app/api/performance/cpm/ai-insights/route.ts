import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AIInsight } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpm/ai-insights
 * Returns AI-generated insights for Channel Partner Manager
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

    // Try to fetch existing insights - handle gracefully if table doesn't exist
    let existingInsights: unknown[] = []
    try {
      const { data, error } = await supabase
        .from('cpm_ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        existingInsights = data
      }
    } catch (e) {
      // Table might not exist
    }

    if (existingInsights.length > 0) {
      return NextResponse.json({ insights: existingInsights })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Try to fetch targets and daily metrics
    let targets = null
    let dailyMetrics: unknown[] = []

    try {
      const { data, error } = await supabase
        .from('cpm_targets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle()

      if (!error) targets = data
    } catch (e) {
      // Table doesn't exist
    }

    try {
      const { data, error } = await supabase
        .from('cpm_daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('metric_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lt('metric_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

      if (!error && data) dailyMetrics = data
    } catch (e) {
      // Table doesn't exist
    }

    // Return default insights if no data
    if (!targets && dailyMetrics.length === 0) {
      const defaultInsights = [
        {
          insight_type: 'recommendation',
          priority: 'medium',
          title: 'Welcome to Your Performance Dashboard',
          description: 'Start tracking your partner performance metrics to receive AI-powered insights.',
          action_items: [
            'Set up your monthly targets',
            'Begin logging daily partner activities',
            'Monitor partner engagement regularly',
          ],
        }
      ]
      return NextResponse.json({ insights: defaultInsights })
    }

    const insights: Partial<AIInsight>[] = []

    // Use default targets if none found
    const effectiveTargets = targets || {
      partner_revenue_target: 3000000,
      new_partners_onboarded_target: 5,
      partner_training_sessions_target: 10,
      partner_retention_rate_target: 90,
    }

    const totalRevenue = dailyMetrics.reduce((sum, d) => sum + (d.partner_revenue_generated || 0), 0)
    const totalNewPartners = dailyMetrics.reduce((sum, d) => sum + (d.new_partners_onboarded || 0), 0)
    const totalTraining = dailyMetrics.reduce((sum, d) => sum + (d.training_sessions_conducted || 0), 0)
    const latestMetric = dailyMetrics.length > 0 ? dailyMetrics[dailyMetrics.length - 1] : null

    const revenueAchievement = effectiveTargets.partner_revenue_target > 0
      ? (totalRevenue / effectiveTargets.partner_revenue_target) * 100
      : 0

    const partnersAchievement = effectiveTargets.new_partners_onboarded_target > 0
      ? (totalNewPartners / effectiveTargets.new_partners_onboarded_target) * 100
      : 0

    const trainingAchievement = effectiveTargets.partner_training_sessions_target > 0
      ? (totalTraining / effectiveTargets.partner_training_sessions_target) * 100
      : 0

    if (revenueAchievement > 90) {
      insights.push({
        insight_type: 'strength',
        priority: 'high',
        title: 'Exceptional Partner Revenue Performance',
        description: `Partner network has generated ${revenueAchievement.toFixed(1)}% of revenue target! Outstanding management.`,
        metric_name: 'Partner Revenue',
        current_value: totalRevenue,
        target_value: effectiveTargets.partner_revenue_target,
        variance_percentage: revenueAchievement - 100,
      })
    } else if (revenueAchievement < 50) {
      insights.push({
        insight_type: 'warning',
        priority: 'critical',
        title: 'Partner Revenue Below Target',
        description: `Partner revenue is at ${revenueAchievement.toFixed(1)}%. Focus on activating partners and driving performance.`,
        action_items: [
          'Conduct partner performance reviews',
          'Provide additional training and support',
          'Identify and address partner challenges',
        ],
        metric_name: 'Partner Revenue',
        current_value: totalRevenue,
        target_value: effectiveTargets.partner_revenue_target,
        variance_percentage: revenueAchievement - 100,
      })
    }

    if (partnersAchievement > 100) {
      insights.push({
        insight_type: 'achievement',
        priority: 'high',
        title: 'Partner Onboarding Excellence',
        description: `You've onboarded ${totalNewPartners} new partners, exceeding target by ${(partnersAchievement - 100).toFixed(1)}%!`,
        metric_name: 'New Partners',
        current_value: totalNewPartners,
        target_value: effectiveTargets.new_partners_onboarded_target,
        variance_percentage: partnersAchievement - 100,
      })
    }

    if (trainingAchievement < 60) {
      insights.push({
        insight_type: 'improvement',
        priority: 'medium',
        title: 'Increase Partner Training',
        description: `Training sessions are at ${trainingAchievement.toFixed(1)}%. Schedule more training to improve partner performance.`,
        action_items: [
          'Plan weekly training sessions',
          'Create product knowledge materials',
          'Conduct skill development workshops',
        ],
        metric_name: 'Training Sessions',
        current_value: totalTraining,
        target_value: effectiveTargets.partner_training_sessions_target,
        variance_percentage: trainingAchievement - 100,
      })
    }

    const retentionRate = latestMetric?.retention_rate || 0
    if (retentionRate >= 90) {
      insights.push({
        insight_type: 'strength',
        priority: 'medium',
        title: 'Excellent Partner Retention',
        description: `Your partner retention rate of ${retentionRate.toFixed(1)}% shows strong relationship management.`,
        metric_name: 'Retention Rate',
        current_value: retentionRate,
        target_value: effectiveTargets.partner_retention_rate_target,
      })
    }

    if (insights.length === 0) {
      insights.push({
        insight_type: 'recommendation',
        priority: 'medium',
        title: 'Keep Building Your Partner Network',
        description: 'Continue focusing on partner engagement and performance improvement.',
        action_items: [
          'Regular partner communication',
          'Monitor partner performance metrics',
          'Provide ongoing support and resources',
        ],
      })
    }

    for (const insight of insights) {
      await supabase.from('cpm_ai_insights').insert({
        user_id: user.id,
        ...insight,
      })
    }

    const { data: savedInsights } = await supabase
      .from('cpm_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ insights: savedInsights || [] })
  } catch (error) {
    apiLogger.error('CPM AI insights error', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
