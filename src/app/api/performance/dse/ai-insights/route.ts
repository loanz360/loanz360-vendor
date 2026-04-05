import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import type { AIInsight } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/dse/ai-insights
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

    // Verify user is a DSE
    const adminClient = createSupabaseAdmin()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userProfile || userProfile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales Executives only.' },
        { status: 403 }
      )
    }

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch monthly summary
    const { data: summary } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Fetch targets
    const { data: targets } = await adminClient
      .from('dse_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Fetch existing insights from database
    const { data: existingInsights } = await adminClient
      .from('dse_ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', new Date(currentYear, currentMonth - 1, 1).toISOString())
      .order('created_at', { ascending: false })

    if (existingInsights && existingInsights.length > 0) {
      // Return existing insights if generated today
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
      // Not enough data to generate insights
      return NextResponse.json({
        insights: [
          {
            id: 'no-data',
            type: 'recommendation',
            priority: 'medium',
            title: 'Start Tracking Your Performance',
            description: 'Begin logging your field visits, meetings, and conversions to unlock personalized insights.',
            actionItems: [
              'Record your daily field activities',
              'Update your sales pipeline regularly',
              'Set monthly targets with your manager',
            ],
            isRead: false,
            isActioned: false,
            createdAt: new Date().toISOString(),
          },
        ],
        generated: 'placeholder',
      })
    }

    // Analyze performance and generate insights
    const metrics = [
      {
        name: 'Field Visits',
        current: summary.total_field_visits,
        target: targets.field_visits_target,
        weight: 0.10,
      },
      {
        name: 'Meetings Attended',
        current: summary.total_meetings_attended,
        target: targets.meetings_attended_target,
        weight: 0.10,
      },
      {
        name: 'Leads Generated',
        current: summary.total_leads_generated,
        target: targets.leads_generated_target,
        weight: 0.15,
      },
      {
        name: 'Conversions',
        current: summary.total_conversions,
        target: targets.leads_converted_target,
        weight: 0.15,
      },
      {
        name: 'Conversion Rate',
        current: summary.field_conversion_rate,
        target: targets.field_conversion_rate_target,
        weight: 0.15,
      },
      {
        name: 'Revenue',
        current: summary.total_revenue,
        target: targets.revenue_target,
        weight: 0.20,
      },
      {
        name: 'Territory Coverage',
        current: summary.territory_coverage_percentage,
        target: targets.territory_coverage_target,
        weight: 0.10,
      },
    ]

    // Identify strengths (>100% achievement)
    const strengths = metrics.filter((m) => (m.current / m.target) >= 1.0).sort((a, b) => b.current / b.target - a.current / a.target)

    strengths.slice(0, 2).forEach((strength, idx) => {
      const achievement = ((strength.current / strength.target) * 100).toFixed(0)
      insights.push({
        id: `strength-${idx}`,
        type: 'strength',
        priority: 'low',
        title: `Excellent ${strength.name} Performance`,
        description: `You've achieved ${achievement}% of your ${strength.name.toLowerCase()} target! Keep up the great work.`,
        actionItems: ['Maintain this momentum', 'Share best practices with team', 'Set stretch goals for next month'],
        metricName: strength.name,
        currentValue: strength.current,
        targetValue: strength.target,
        variancePercentage: ((strength.current - strength.target) / strength.target) * 100,
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    })

    // Identify improvement areas (<80% achievement)
    const improvements = metrics.filter((m) => (m.current / m.target) < 0.8).sort((a, b) => a.current / a.target - b.current / b.target)

    improvements.slice(0, 3).forEach((improvement, idx) => {
      const achievement = ((improvement.current / improvement.target) * 100).toFixed(0)
      const gap = improvement.target - improvement.current

      let actionItems = []
      let description = ''

      if (improvement.name === 'Field Visits') {
        description = `You're at ${achievement}% of your field visit target. ${gap.toFixed(0)} more visits needed to meet your goal.`
        actionItems = [
          'Plan your route efficiently to maximize visits',
          'Schedule visits in advance',
          'Target high-potential prospects',
        ]
      } else if (improvement.name === 'Conversions') {
        description = `You need ${gap.toFixed(0)} more conversions to hit your target. Focus on closing deals.`
        actionItems = [
          'Follow up with warm leads immediately',
          'Practice handling objections',
          'Offer limited-time promotions',
        ]
      } else if (improvement.name === 'Revenue') {
        description = `₹${gap.toLocaleString('en-IN')} gap to target. Focus on high-value deals.`
        actionItems = [
          'Upsell to existing customers',
          'Target enterprise clients',
          'Bundle products for higher deal value',
        ]
      } else {
        description = `Currently at ${achievement}% of ${improvement.name.toLowerCase()} target.`
        actionItems = [
          `Increase ${improvement.name.toLowerCase()} activities`,
          'Review and adjust your strategy',
          'Seek guidance from top performers',
        ]
      }

      insights.push({
        id: `improvement-${idx}`,
        type: 'improvement',
        priority: Number(achievement) < 50 ? 'high' : 'medium',
        title: `Improve Your ${improvement.name}`,
        description,
        actionItems,
        metricName: improvement.name,
        currentValue: improvement.current,
        targetValue: improvement.target,
        variancePercentage: ((improvement.current - improvement.target) / improvement.target) * 100,
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    })

    // Warnings for critical metrics (<50%)
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
          'Review and revise your strategy',
          'Request additional support or training',
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

    // General recommendations
    if (summary.field_conversion_rate < 15) {
      insights.push({
        id: 'rec-conversion',
        type: 'recommendation',
        priority: 'medium',
        title: 'Boost Your Conversion Rate',
        description: `Your conversion rate of ${summary.field_conversion_rate.toFixed(1)}% has room for improvement. Focus on lead quality and follow-ups.`,
        actionItems: [
          'Qualify leads before meetings',
          'Send follow-up emails within 24 hours',
          'Build rapport and trust with prospects',
        ],
        metricName: 'Conversion Rate',
        currentValue: summary.field_conversion_rate,
        targetValue: targets.field_conversion_rate_target,
        variancePercentage: ((summary.field_conversion_rate - targets.field_conversion_rate_target) / targets.field_conversion_rate_target) * 100,
        isRead: false,
        isActioned: false,
        createdAt: new Date().toISOString(),
      })
    }

    // Achievements
    if (summary.performance_score >= 90) {
      insights.push({
        id: 'achievement-high-score',
        type: 'achievement',
        priority: 'low',
        title: '🎉 Outstanding Performance!',
        description: `Congratulations! You've scored ${summary.performance_score}/100 this month. You're in the top tier of performers!`,
        actionItems: [
          'Celebrate your success',
          'Mentor junior team members',
          'Aim for #1 rank next month',
        ],
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
    apiLogger.error('Error in DSE AI insights API', error)
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
