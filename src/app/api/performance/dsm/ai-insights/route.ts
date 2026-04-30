import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AIInsight } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dsm/ai-insights
 * Returns AI-generated insights for Direct Sales Manager
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingInsights } = await supabase
      .from('dsm_ai_insights')
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
      .from('dsm_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    const { data: dailyMetrics } = await supabase
      .from('dsm_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('metric_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
      .lt('metric_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)

    if (!targets || !dailyMetrics) {
      return NextResponse.json({ insights: [] })
    }

    const insights: Partial<AIInsight>[] = []

    const totalTeamRevenue = dailyMetrics.reduce((sum, d) => sum + (d.team_revenue_generated || 0), 0)
    const individualRevenue = dailyMetrics.reduce((sum, d) => sum + (d.individual_revenue_generated || 0), 0)
    const totalTeamLeads = dailyMetrics.reduce((sum, d) => sum + (d.team_leads_generated || 0), 0)
    const latestMetric = dailyMetrics[dailyMetrics.length - 1]

    const teamRevenueAchievement = targets.team_revenue_target > 0
      ? (totalTeamRevenue / targets.team_revenue_target) * 100
      : 0

    const individualRevenueAchievement = targets.individual_revenue_target > 0
      ? (individualRevenue / targets.individual_revenue_target) * 100
      : 0

    const teamLeadsAchievement = targets.team_leads_target > 0
      ? (totalTeamLeads / targets.team_leads_target) * 100
      : 0

    if (teamRevenueAchievement > 90) {
      insights.push({
        insight_type: 'strength',
        priority: 'high',
        title: 'Outstanding Team Revenue Performance',
        description: `Your team has achieved ${teamRevenueAchievement.toFixed(1)}% of revenue target! Excellent team management.`,
        metric_name: 'Team Revenue',
        current_value: totalTeamRevenue,
        target_value: targets.team_revenue_target,
        variance_percentage: teamRevenueAchievement - 100,
      })
    } else if (teamRevenueAchievement < 50) {
      insights.push({
        insight_type: 'warning',
        priority: 'critical',
        title: 'Team Revenue Below Target',
        description: `Team revenue is at ${teamRevenueAchievement.toFixed(1)}%. Focus on coaching and supporting underperformers.`,
        action_items: [
          'Conduct individual performance reviews',
          'Provide additional training to struggling team members',
          'Review and optimize sales processes',
        ],
        metric_name: 'Team Revenue',
        current_value: totalTeamRevenue,
        target_value: targets.team_revenue_target,
        variance_percentage: teamRevenueAchievement - 100,
      })
    }

    if (individualRevenueAchievement > 100) {
      insights.push({
        insight_type: 'achievement',
        priority: 'high',
        title: 'Personal Revenue Excellence',
        description: `You've exceeded your individual revenue target by ${(individualRevenueAchievement - 100).toFixed(1)}%!`,
        metric_name: 'Individual Revenue',
        current_value: individualRevenue,
        target_value: targets.individual_revenue_target,
        variance_percentage: individualRevenueAchievement - 100,
      })
    }

    if (teamLeadsAchievement < 60) {
      insights.push({
        insight_type: 'improvement',
        priority: 'medium',
        title: 'Team Lead Generation Needs Boost',
        description: `Team lead generation is at ${teamLeadsAchievement.toFixed(1)}%. Implement lead generation strategies.`,
        action_items: [
          'Organize team prospecting sessions',
          'Share best practices from top performers',
          'Review lead quality and sources',
        ],
        metric_name: 'Team Leads',
        current_value: totalTeamLeads,
        target_value: targets.team_leads_target,
        variance_percentage: teamLeadsAchievement - 100,
      })
    }

    const teamAttendance = latestMetric?.team_attendance_rate || 0
    if (teamAttendance < 90) {
      insights.push({
        insight_type: 'warning',
        priority: 'high',
        title: 'Team Attendance Needs Attention',
        description: `Team attendance is at ${teamAttendance.toFixed(1)}%. Address attendance issues promptly.`,
        action_items: [
          'Meet with team members with low attendance',
          'Review team engagement and morale',
          'Implement attendance improvement plan',
        ],
        metric_name: 'Team Attendance',
        current_value: teamAttendance,
        target_value: targets.team_attendance_rate_target,
      })
    }

    const teamAttrition = latestMetric?.team_attrition_rate || 0
    if (teamAttrition > 10) {
      insights.push({
        insight_type: 'warning',
        priority: 'critical',
        title: 'High Team Attrition Alert',
        description: `Team attrition is at ${teamAttrition.toFixed(1)}%. Focus on retention strategies immediately.`,
        action_items: [
          'Conduct exit interviews',
          'Address team satisfaction concerns',
          'Review compensation and growth opportunities',
        ],
        metric_name: 'Team Attrition',
        current_value: teamAttrition,
        target_value: targets.team_attrition_rate_target,
      })
    }

    if (insights.length === 0) {
      insights.push({
        insight_type: 'recommendation',
        priority: 'medium',
        title: 'Keep Driving Team Excellence',
        description: 'Continue focusing on team development and performance optimization.',
        action_items: [
          'Maintain regular 1-on-1s with team members',
          'Share wins and celebrate successes',
          'Identify and develop future leaders',
        ],
      })
    }

    for (const insight of insights) {
      await supabase.from('dsm_ai_insights').insert({
        user_id: user.id,
        ...insight,
      })
    }

    const { data: savedInsights } = await supabase
      .from('dsm_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ insights: savedInsights || [] })
  } catch (error) {
    apiLogger.error('DSM AI insights error', error)
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
