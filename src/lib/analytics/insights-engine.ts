/**
 * AI-Powered Business Insights Engine
 * Automated anomaly detection, trend analysis, and actionable recommendations
 */

import { createClient } from '@/lib/supabase/server'
import type {
  BusinessInsight,
  InsightType,
  InsightCategory,
  InsightSeverity,
  ImplementationEffort,
  VisualizationConfig,
} from './analytics-types'

// ============================================================================
// DATA COLLECTION
// ============================================================================

interface MetricSnapshot {
  metric_name: string
  current_value: number
  previous_value: number
  change_percentage: number
  timestamp: string
}

/**
 * Collect current business metrics for analysis
 */
async function collectMetrics(): Promise<MetricSnapshot[]> {
  const supabase = await createClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const metrics: MetricSnapshot[] = []

  // Revenue metrics
  const { data: currentRevenue } = await supabase
    .from('leads')
    .select('loan_amount')
    .eq('status', 'won')
    .gte('updated_at', weekAgo.toISOString())

  const { data: previousRevenue } = await supabase
    .from('leads')
    .select('loan_amount')
    .eq('status', 'won')
    .gte('updated_at', twoWeeksAgo.toISOString())
    .lt('updated_at', weekAgo.toISOString())

  const currentRevenueTotal = currentRevenue?.reduce((sum, l) => sum + (l.loan_amount || 0), 0) || 0
  const previousRevenueTotal = previousRevenue?.reduce((sum, l) => sum + (l.loan_amount || 0), 0) || 0

  metrics.push({
    metric_name: 'weekly_revenue',
    current_value: currentRevenueTotal,
    previous_value: previousRevenueTotal,
    change_percentage: previousRevenueTotal > 0
      ? ((currentRevenueTotal - previousRevenueTotal) / previousRevenueTotal) * 100
      : 0,
    timestamp: now.toISOString(),
  })

  // Lead volume metrics
  const { data: currentLeads } = await supabase
    .from('leads')
    .select('id')
    .gte('created_at', weekAgo.toISOString())

  const { data: previousLeads } = await supabase
    .from('leads')
    .select('id')
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', weekAgo.toISOString())

  const currentLeadCount = currentLeads?.length || 0
  const previousLeadCount = previousLeads?.length || 0

  metrics.push({
    metric_name: 'weekly_leads',
    current_value: currentLeadCount,
    previous_value: previousLeadCount,
    change_percentage: previousLeadCount > 0
      ? ((currentLeadCount - previousLeadCount) / previousLeadCount) * 100
      : 0,
    timestamp: now.toISOString(),
  })

  // Conversion rate metrics
  const { data: currentWon } = await supabase
    .from('leads')
    .select('id')
    .eq('status', 'won')
    .gte('updated_at', weekAgo.toISOString())

  const currentConversionRate = currentLeadCount > 0
    ? ((currentWon?.length || 0) / currentLeadCount) * 100
    : 0

  const { data: previousWon } = await supabase
    .from('leads')
    .select('id')
    .eq('status', 'won')
    .gte('updated_at', twoWeeksAgo.toISOString())
    .lt('updated_at', weekAgo.toISOString())

  const previousConversionRate = previousLeadCount > 0
    ? ((previousWon?.length || 0) / previousLeadCount) * 100
    : 0

  metrics.push({
    metric_name: 'conversion_rate',
    current_value: currentConversionRate,
    previous_value: previousConversionRate,
    change_percentage: previousConversionRate > 0
      ? ((currentConversionRate - previousConversionRate) / previousConversionRate) * 100
      : 0,
    timestamp: now.toISOString(),
  })

  return metrics
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Detect anomalies in metric changes
 */
function detectAnomalies(metrics: MetricSnapshot[]): BusinessInsight[] {
  const insights: BusinessInsight[] = []

  metrics.forEach(metric => {
    const absChange = Math.abs(metric.change_percentage)

    // Significant spike (>50% increase)
    if (metric.change_percentage > 50) {
      insights.push(createInsight({
        type: 'anomaly',
        category: getCategoryForMetric(metric.metric_name),
        severity: absChange > 100 ? 'high' : 'medium',
        title: `Significant ${metric.metric_name.replace(/_/g, ' ')} spike detected`,
        description: `${metric.metric_name.replace(/_/g, ' ')} increased by ${metric.change_percentage.toFixed(1)}% this week (from ${formatMetricValue(metric.previous_value, metric.metric_name)} to ${formatMetricValue(metric.current_value, metric.metric_name)}).`,
        insight_data: { metric, trend: 'up' },
        recommendations: [
          'Investigate the root cause of this spike',
          'Analyze which channels or sources contributed most',
          'Ensure systems can handle increased load',
          'Capitalize on positive momentum',
        ],
        estimated_impact: 'High - requires immediate attention',
        implementation_effort: 'low',
      }))
    }

    // Significant drop (>30% decrease)
    if (metric.change_percentage < -30) {
      insights.push(createInsight({
        type: 'anomaly',
        category: getCategoryForMetric(metric.metric_name),
        severity: absChange > 50 ? 'critical' : 'high',
        title: `${metric.metric_name.replace(/_/g, ' ')} drop detected`,
        description: `${metric.metric_name.replace(/_/g, ' ')} decreased by ${Math.abs(metric.change_percentage).toFixed(1)}% this week (from ${formatMetricValue(metric.previous_value, metric.metric_name)} to ${formatMetricValue(metric.current_value, metric.metric_name)}).`,
        insight_data: { metric, trend: 'down' },
        recommendations: [
          'Immediately investigate the cause of the drop',
          'Check if any marketing campaigns ended',
          'Review operational changes that may have impacted performance',
          'Implement recovery plan',
        ],
        estimated_impact: 'Critical - immediate action required',
        implementation_effort: 'medium',
      }))
    }
  })

  return insights
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Analyze trends over time
 */
async function analyzeTrends(): Promise<BusinessInsight[]> {
  const supabase = await createClient()
  const insights: BusinessInsight[] = []

  // Get lead data for past 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentLeads } = await supabase
    .from('leads')
    .select('created_at, status, source')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (!recentLeads || recentLeads.length === 0) return insights

  // Analyze source performance
  const sourcePerformance: Record<string, { count: number; won: number }> = {}
  recentLeads.forEach(lead => {
    const source = lead.source || 'unknown'
    if (!sourcePerformance[source]) {
      sourcePerformance[source] = { count: 0, won: 0 }
    }
    sourcePerformance[source].count++
    if (lead.status === 'won') sourcePerformance[source].won++
  })

  // Find best and worst performing sources
  const sources = Object.entries(sourcePerformance).map(([source, stats]) => ({
    source,
    count: stats.count,
    conversion_rate: stats.count > 0 ? (stats.won / stats.count) * 100 : 0,
  }))

  sources.sort((a, b) => b.conversion_rate - a.conversion_rate)

  if (sources.length > 0 && sources[0].count >= 5) {
    const bestSource = sources[0]
    insights.push(createInsight({
      type: 'trend',
      category: 'leads',
      severity: 'info',
      title: `${bestSource.source} is your highest-converting lead source`,
      description: `Over the past 30 days, ${bestSource.source} has a ${bestSource.conversion_rate.toFixed(1)}% conversion rate (${bestSource.count} leads).`,
      insight_data: { source_performance: sources },
      recommendations: [
        `Increase investment in ${bestSource.source}`,
        'Analyze what makes these leads high-quality',
        'Replicate successful tactics from this channel',
        'Consider allocating more budget to this source',
      ],
      estimated_impact: `+${(bestSource.conversion_rate * 0.2).toFixed(1)}% overall conversion`,
      implementation_effort: 'medium',
      visualization_config: {
        chart_type: 'bar',
        x_axis: 'source',
        y_axis: 'conversion_rate',
      },
    }))
  }

  if (sources.length > 1 && sources[sources.length - 1].count >= 5) {
    const worstSource = sources[sources.length - 1]
    if (worstSource.conversion_rate < 20) {
      insights.push(createInsight({
        type: 'trend',
        category: 'leads',
        severity: 'medium',
        title: `${worstSource.source} has low conversion rate`,
        description: `${worstSource.source} only converts at ${worstSource.conversion_rate.toFixed(1)}% (${worstSource.count} leads).`,
        insight_data: { source_performance: sources },
        recommendations: [
          `Review lead quality from ${worstSource.source}`,
          'Consider pausing or reducing this channel',
          'Improve qualification process for these leads',
          'Test different messaging or targeting',
        ],
        estimated_impact: `Save ₹${(worstSource.count * 5000).toLocaleString()}/month in wasted effort`,
        implementation_effort: 'low',
      }))
    }
  }

  return insights
}

// ============================================================================
// CORRELATION ANALYSIS
// ============================================================================

/**
 * Find correlations between different metrics
 */
async function analyzeCorrelations(): Promise<BusinessInsight[]> {
  const insights: BusinessInsight[] = []

  // Placeholder for correlation analysis
  // Would analyze: lead volume vs revenue, response time vs conversion, etc.

  return insights
}

// ============================================================================
// RECOMMENDATIONS ENGINE
// ============================================================================

/**
 * Generate proactive recommendations based on current state
 */
async function generateRecommendations(): Promise<BusinessInsight[]> {
  const supabase = await createClient()
  const insights: BusinessInsight[] = []

  // Check for stale leads
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: staleLeads } = await supabase
    .from('leads')
    .select('id')
    .in('status', ['new', 'contacted'])
    .lt('updated_at', sevenDaysAgo.toISOString())

  if (staleLeads && staleLeads.length > 10) {
    insights.push(createInsight({
      type: 'recommendation',
      category: 'operations',
      severity: 'medium',
      title: `${staleLeads.length} leads have not been updated in over 7 days`,
      description: `You have ${staleLeads.length} leads in early stages that haven't been touched in a week. These leads may be going cold.`,
      insight_data: { stale_lead_count: staleLeads.length },
      recommendations: [
        'Run a re-engagement campaign for these leads',
        'Assign to CROs for immediate follow-up',
        'Set up automated nurture sequences',
        'Review lead assignment rules',
      ],
      estimated_impact: `Recover ${Math.round(staleLeads.length * 0.15)} potential conversions`,
      implementation_effort: 'medium',
    }))
  }

  // Check for unassigned leads
  const { data: unassignedLeads } = await supabase
    .from('leads')
    .select('id')
    .is('assigned_to', null)
    .neq('status', 'won')
    .neq('status', 'lost')

  if (unassignedLeads && unassignedLeads.length > 5) {
    insights.push(createInsight({
      type: 'recommendation',
      category: 'operations',
      severity: 'high',
      title: `${unassignedLeads.length} leads are unassigned`,
      description: `You have ${unassignedLeads.length} active leads without a CRO assigned. These leads are at risk of being neglected.`,
      insight_data: { unassigned_count: unassignedLeads.length },
      recommendations: [
        'Enable auto-assignment to distribute leads automatically',
        'Manually assign these leads to available CROs',
        'Review team capacity and hiring needs',
        'Set up assignment alerts',
      ],
      estimated_impact: `+20% faster lead response time`,
      implementation_effort: 'low',
    }))
  }

  return insights
}

// ============================================================================
// OPPORTUNITY DETECTION
// ============================================================================

/**
 * Identify business opportunities
 */
async function detectOpportunities(): Promise<BusinessInsight[]> {
  const supabase = await createClient()
  const insights: BusinessInsight[] = []

  // Check for high-value leads in pipeline
  const { data: highValueLeads } = await supabase
    .from('leads')
    .select('id, loan_amount')
    .gte('loan_amount', 1000000) // ₹10 lakh+
    .in('status', ['qualified', 'proposal', 'negotiation'])

  if (highValueLeads && highValueLeads.length > 0) {
    const totalValue = highValueLeads.reduce((sum, l) => sum + (l.loan_amount || 0), 0)

    insights.push(createInsight({
      type: 'opportunity',
      category: 'revenue',
      severity: 'high',
      title: `₹${(totalValue / 100000).toFixed(1)}L in high-value deals nearing close`,
      description: `You have ${highValueLeads.length} leads worth over ₹10L each in advanced stages. Total potential: ₹${(totalValue / 100000).toFixed(1)}L.`,
      insight_data: {
        deal_count: highValueLeads.length,
        total_value: totalValue,
      },
      recommendations: [
        'Prioritize these high-value leads for CEO/senior involvement',
        'Accelerate proposal and negotiation timelines',
        'Provide white-glove service to these clients',
        'Remove any blockers in the sales process',
      ],
      estimated_impact: `₹${(totalValue * 0.7 / 100000).toFixed(1)}L potential revenue`,
      implementation_effort: 'high',
    }))
  }

  return insights
}

// ============================================================================
// MAIN INSIGHTS GENERATION
// ============================================================================

/**
 * Run all insight detection engines and save to database
 */
export async function generateInsights(): Promise<BusinessInsight[]> {
  // Collect metrics
  const metrics = await collectMetrics()

  // Run all detection engines in parallel
  const [
    anomalies,
    trends,
    correlations,
    recommendations,
    opportunities,
  ] = await Promise.all([
    detectAnomalies(metrics),
    analyzeTrends(),
    analyzeCorrelations(),
    generateRecommendations(),
    detectOpportunities(),
  ])

  // Combine all insights
  const allInsights = [
    ...anomalies,
    ...trends,
    ...correlations,
    ...recommendations,
    ...opportunities,
  ]

  // Save to database
  const supabase = await createClient()
  const savedInsights: BusinessInsight[] = []

  for (const insight of allInsights) {
    const { data, error } = await supabase
      .from('business_insights')
      .insert(insight)
      .select()
      .maybeSingle()

    if (!error && data) {
      savedInsights.push(data as BusinessInsight)
    }
  }

  return savedInsights
}

// ============================================================================
// INSIGHT RETRIEVAL
// ============================================================================

/**
 * Get unread insights
 */
export async function getUnreadInsights(limit: number = 10): Promise<BusinessInsight[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('business_insights')
    .select('*')
    .eq('is_read', false)
    .eq('is_dismissed', false)
    .order('severity', { ascending: false })
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data as BusinessInsight[]
}

/**
 * Get insights by category
 */
export async function getInsightsByCategory(
  category: InsightCategory,
  limit: number = 20
): Promise<BusinessInsight[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('business_insights')
    .select('*')
    .eq('category', category)
    .eq('is_dismissed', false)
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data as BusinessInsight[]
}

/**
 * Mark insight as read
 */
export async function markInsightAsRead(insightId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('business_insights')
    .update({ is_read: true })
    .eq('id', insightId)
}

/**
 * Dismiss insight
 */
export async function dismissInsight(insightId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('business_insights')
    .update({ is_dismissed: true })
    .eq('id', insightId)
}

/**
 * Mark insight as actioned
 */
export async function markInsightAsActioned(
  insightId: string,
  actionTaken: string,
  actionedBy: string
): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('business_insights')
    .update({
      is_actioned: true,
      action_taken: actionTaken,
      actioned_by: actionedBy,
      actioned_at: new Date().toISOString(),
    })
    .eq('id', insightId)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createInsight(params: {
  type: InsightType
  category: InsightCategory
  severity: InsightSeverity
  title: string
  description: string
  insight_data: Record<string, unknown>
  recommendations: string[]
  estimated_impact: string
  implementation_effort: ImplementationEffort
  visualization_config?: VisualizationConfig
}): Omit<BusinessInsight, 'id' | 'created_at' | 'updated_at' | 'detected_at'> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // Insights expire after 30 days

  return {
    insight_type: params.type,
    category: params.category,
    severity: params.severity,
    title: params.title,
    description: params.description,
    insight_data: params.insight_data,
    visualization_config: params.visualization_config,
    recommendations: params.recommendations,
    estimated_impact: params.estimated_impact,
    implementation_effort: params.implementation_effort,
    is_read: false,
    is_dismissed: false,
    is_actioned: false,
    expires_at: expiresAt.toISOString(),
  }
}

function getCategoryForMetric(metricName: string): InsightCategory {
  if (metricName.includes('revenue')) return 'revenue'
  if (metricName.includes('lead')) return 'leads'
  if (metricName.includes('conversion')) return 'performance'
  return 'operations'
}

function formatMetricValue(value: number, metricName: string): string {
  if (metricName.includes('revenue')) {
    return `₹${(value / 100000).toFixed(1)}L`
  }
  if (metricName.includes('rate')) {
    return `${value.toFixed(1)}%`
  }
  return value.toFixed(0)
}
