import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AIInsight } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/cpe/ai-insights
 * Generates AI-powered insights based on performance data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch monthly summary
    const { data: summary } = await supabase
      .from('cpe_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Fetch targets
    const { data: targets } = await supabase
      .from('cpe_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Fetch existing insights from database
    const { data: existingInsights } = await supabase
      .from('cpe_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', new Date(currentYear, currentMonth - 1, 1).toISOString())
      .order('created_at', { ascending: false })

    if (existingInsights && existingInsights.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      const todayInsights = existingInsights.filter(
        (insight) => insight.created_at.split('T')[0] === today
      )

      if (todayInsights.length > 0) {
        return NextResponse.json({
          insights: todayInsights.map(formatInsight),
          generated: 'cached',
        })
      }
    }

    // Generate new insights
    const insights: AIInsight[] = []

    if (!summary || !targets) {
      return NextResponse.json({
        insights: [
          {
            id: 'no-data',
            type: 'recommendation',
            priority: 'medium',
            title: 'Start Building Your Partner Network',
            description: 'Begin onboarding partners and tracking their performance to unlock personalized insights.',
            actionItems: [
              'Identify potential channel partners',
              'Schedule partner onboarding meetings',
              'Set up partner performance tracking',
            ],
            isRead: false,
            isActioned: false,
            createdAt: new Date().toISOString(),
          },
        ],
        generated: 'placeholder',
      })
    }

    // Analyze performance
    const metrics = [
      { name: 'Partners Onboarded', current: summary.total_partners_onboarded, target: targets.partners_onboarded_target, weight: 0.15 },
      { name: 'Active Partners', current: summary.total_active_partners, target: targets.active_partners_target, weight: 0.10 },
      { name: 'Partner Revenue', current: summary.total_partner_revenue, target: targets.partner_revenue_target, weight: 0.20 },
      { name: 'Partner Leads', current: summary.total_partner_leads_generated, target: targets.partner_leads_generated_target, weight: 0.10 },
      { name: 'Partner Conversions', current: summary.total_partner_leads_converted, target: targets.partner_leads_converted_target, weight: 0.15 },
      { name: 'Conversion Rate', current: summary.partner_conversion_rate, target: targets.partner_conversion_rate_target, weight: 0.10 },
      { name: 'Network Size', current: summary.partner_network_size, target: targets.partner_network_size_target, weight: 0.05 },
      { name: 'Engagement Score', current: summary.average_partner_engagement_score, target: targets.partner_engagement_score_target, weight: 0.10 },
      { name: 'Commission', current: summary.total_commission_earned, target: targets.commission_earned_target, weight: 0.05 },
    ]

    // Identify strengths
    const strengths = metrics.filter((m) => (m.current / m.target) >= 1.0).sort((a, b) => b.current / b.target - a.current / a.target)

    strengths.slice(0, 2).forEach((strength, idx) => {
      const achievement = ((strength.current / strength.target) * 100).toFixed(0)
      insights.push({
        id: `strength-${idx}`,
        type: 'strength',
        priority: 'low',
        title: `Excellent ${strength.name} Performance`,
        description: `You've achieved ${achievement}% of your ${strength.name.toLowerCase()} target!`,
        actionItems: ['Maintain this momentum', 'Share best practices with team', 'Set stretch goals'],
        metricName: strength.name,
        currentValue: strength.current,
        targetValue: strength.target,
        variancePercentage: ((strength.current - strength.target) / strength.target) * 100,
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    })

    // Identify improvements
    const improvements = metrics.filter((m) => (m.current / m.target) < 0.8).sort((a, b) => a.current / a.target - b.current / b.target)

    improvements.slice(0, 3).forEach((improvement, idx) => {
      const achievement = ((improvement.current / improvement.target) * 100).toFixed(0)
      insights.push({
        id: `improvement-${idx}`,
        type: 'improvement',
        priority: achievement < '50' ? 'high' : 'medium',
        title: `Improve Your ${improvement.name}`,
        description: `Currently at ${achievement}% of target. Focus on accelerating ${improvement.name.toLowerCase()}.`,
        actionItems: [
          `Increase ${improvement.name.toLowerCase()} activities`,
          'Review and adjust your partner strategy',
          'Seek guidance from top performers',
        ],
        metricName: improvement.name,
        currentValue: improvement.current,
        targetValue: improvement.target,
        variancePercentage: ((improvement.current - improvement.target) / improvement.target) * 100,
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    })

    // Warnings
    const warnings = metrics.filter((m) => (m.current / m.target) < 0.5)

    warnings.forEach((warning, idx) => {
      insights.push({
        id: `warning-${idx}`,
        type: 'warning',
        priority: 'critical',
        title: `Urgent: ${warning.name} Below 50%`,
        description: `Your ${warning.name.toLowerCase()} is significantly below target. Immediate action required.`,
        actionItems: [
          'Schedule meeting with your manager',
          'Review and revise your partner strategy',
          'Request additional support or resources',
        ],
        metricName: warning.name,
        currentValue: warning.current,
        targetValue: warning.target,
        variancePercentage: ((warning.current - warning.target) / warning.target) * 100,
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    })

    // Achievements
    if (summary.performance_score >= 90) {
      insights.push({
        id: 'achievement-high-score',
        type: 'achievement',
        priority: 'low',
        title: '🎉 Outstanding Partner Performance!',
        description: `Congratulations! You've scored ${summary.performance_score}/100 this month.`,
        actionItems: ['Celebrate your success', 'Mentor junior team members', 'Aim for #1 rank next month'],
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      insights,
      generated: 'fresh',
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    apiLogger.error('Error in CPE AI insights API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to format database insight to API format
function formatInsight(dbInsight: any): AIInsight {
  return {
    id: dbInsight.id,
    type: dbInsight.insight_type,
    priority: dbInsight.priority,
    title: dbInsight.title,
    description: dbInsight.description,
    actionItems: dbInsight.action_items || [],
    metricName: dbInsight.metric_name,
    currentValue: dbInsight.current_value,
    targetValue: dbInsight.target_value,
    variancePercentage: dbInsight.variance_percentage,
    isRead: dbInsight.is_read,
    isActioned: dbInsight.is_actioned,
    createdAt: dbInsight.created_at,
    expiresAt: dbInsight.expires_at,
  }
}
