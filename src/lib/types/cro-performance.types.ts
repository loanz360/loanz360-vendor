/**
 * CRO Performance Management System - TypeScript Type Definitions
 * Complete type definitions for CRO performance tracking, targets, and AI insights
 */

// =====================================================
// ENUM TYPES
// =====================================================

export type TargetStatus = 'active' | 'completed' | 'expired'
export type InsightType = 'strength' | 'improvement' | 'recommendation' | 'warning' | 'achievement'
export type InsightPriority = 'high' | 'medium' | 'low'
export type MetricTrend = 'up' | 'down' | 'stable'
export type PerformanceGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

// =====================================================
// CRO TARGETS - Assigned by Super Admin
// =====================================================

export interface CROTarget {
  id: string
  cro_id: string
  assigned_by: string // Super admin user ID
  month: string // Format: YYYY-MM
  year: number

  // Call Targets
  target_calls_per_day: number
  target_call_duration_minutes: number
  target_logins_per_day: number

  // Lead Targets
  target_leads_generated: number
  target_leads_converted: number
  target_conversion_rate: number

  // Revenue Targets
  target_revenue: number
  target_volume: number

  // Deal Targets
  target_deals_per_day: number
  target_deals_per_month: number
  target_cases_sanctioned: number
  target_cases_disbursed: number

  // Quality Targets
  target_response_time_minutes: number
  target_followup_completion_rate: number
  target_customer_satisfaction: number
  target_lead_closing_days: number

  status: TargetStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface CROTargetInsert {
  cro_id: string
  assigned_by: string
  month: string
  year: number
  target_calls_per_day?: number
  target_call_duration_minutes?: number
  target_logins_per_day?: number
  target_leads_generated?: number
  target_leads_converted?: number
  target_conversion_rate?: number
  target_revenue?: number
  target_volume?: number
  target_deals_per_day?: number
  target_deals_per_month?: number
  target_cases_sanctioned?: number
  target_cases_disbursed?: number
  target_response_time_minutes?: number
  target_followup_completion_rate?: number
  target_customer_satisfaction?: number
  target_lead_closing_days?: number
  status?: TargetStatus
  notes?: string
}

// =====================================================
// CRO DAILY METRICS - Auto-tracked daily performance
// =====================================================

export interface CRODailyMetrics {
  id: string
  cro_id: string
  date: string // Format: YYYY-MM-DD

  // Login Metrics
  login_count: number
  active_hours: number
  first_login_time?: string
  last_logout_time?: string

  // Call Metrics
  calls_made: number
  calls_connected: number
  calls_missed: number
  total_call_duration_minutes: number
  avg_call_duration_minutes: number

  // Lead Metrics
  leads_assigned: number
  leads_generated: number
  leads_contacted: number
  leads_converted: number
  leads_dropped: number

  // Deal Metrics
  deals_created: number
  deals_won: number
  deals_lost: number

  // Follow-up Metrics
  followups_scheduled: number
  followups_completed: number
  followups_missed: number

  // Response Metrics
  avg_response_time_minutes: number
  first_response_time_minutes: number

  // Revenue Metrics
  revenue_generated: number
  volume_generated: number

  // Quality Metrics
  customer_satisfaction_score: number
  positive_feedback_count: number
  negative_feedback_count: number

  // Case Metrics
  cases_sanctioned: number
  cases_disbursed: number
  disbursement_amount: number

  created_at: string
  updated_at: string
}

export interface CRODailyMetricsInsert {
  cro_id: string
  date: string
  login_count?: number
  active_hours?: number
  first_login_time?: string
  last_logout_time?: string
  calls_made?: number
  calls_connected?: number
  calls_missed?: number
  total_call_duration_minutes?: number
  avg_call_duration_minutes?: number
  leads_assigned?: number
  leads_generated?: number
  leads_contacted?: number
  leads_converted?: number
  leads_dropped?: number
  deals_created?: number
  deals_won?: number
  deals_lost?: number
  followups_scheduled?: number
  followups_completed?: number
  followups_missed?: number
  avg_response_time_minutes?: number
  first_response_time_minutes?: number
  revenue_generated?: number
  volume_generated?: number
  customer_satisfaction_score?: number
  positive_feedback_count?: number
  negative_feedback_count?: number
  cases_sanctioned?: number
  cases_disbursed?: number
  disbursement_amount?: number
}

// =====================================================
// CRO MONTHLY SUMMARY - Aggregated monthly performance
// =====================================================

export interface CROMonthlyPerformance {
  id: string
  cro_id: string
  month: string // Format: YYYY-MM
  year: number

  // Aggregated Metrics
  total_logins: number
  total_active_hours: number
  total_calls_made: number
  total_calls_connected: number
  total_call_duration_minutes: number
  avg_call_duration_minutes: number

  total_leads_assigned: number
  total_leads_generated: number
  total_leads_converted: number
  total_leads_dropped: number
  conversion_rate: number
  lead_drop_rate: number

  total_deals_created: number
  total_deals_won: number
  total_deals_lost: number
  deal_win_rate: number

  total_followups_completed: number
  followup_completion_rate: number

  avg_response_time_minutes: number
  avg_lead_closing_days: number

  total_revenue: number
  total_volume: number

  avg_customer_satisfaction: number

  total_cases_sanctioned: number
  total_cases_disbursed: number
  total_disbursement_amount: number

  // Comparison & Ranking
  company_rank: number
  team_rank: number
  performance_score: number
  performance_grade: PerformanceGrade

  // Target Achievement
  target_achievement_percentage: number

  created_at: string
  updated_at: string
}

// =====================================================
// CRO AI INSIGHTS - AI-generated guidance
// =====================================================

export interface CROAIInsight {
  id: string
  cro_id: string
  insight_type: InsightType
  priority: InsightPriority
  title: string
  description: string
  metric_affected?: string
  current_value?: number
  target_value?: number
  improvement_percentage?: number
  action_items?: string[]
  is_read: boolean
  is_dismissed: boolean
  valid_until?: string
  created_at: string
  updated_at: string
}

export interface CROAIInsightInsert {
  cro_id: string
  insight_type: InsightType
  priority: InsightPriority
  title: string
  description: string
  metric_affected?: string
  current_value?: number
  target_value?: number
  improvement_percentage?: number
  action_items?: string[]
  is_read?: boolean
  is_dismissed?: boolean
  valid_until?: string
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface PerformanceMetricWithTarget {
  metric_name: string
  display_name: string
  current_value: number
  target_value: number
  achievement_percentage: number
  trend: MetricTrend
  trend_percentage: number
  unit: string
  category: 'calls' | 'leads' | 'deals' | 'revenue' | 'quality'
}

export interface CurrentMonthPerformanceResponse {
  success: boolean
  data: {
    cro_id: string
    employee_id: string
    month: string
    metrics: PerformanceMetricWithTarget[]
    overall_score: number
    overall_grade: PerformanceGrade
    target_achievement: number
    days_remaining: number
    last_updated: string
  }
}

export interface CROComparisonData {
  employee_id: string
  display_name?: string
  rank: number
  performance_score: number
  calls_made: number
  leads_converted: number
  revenue_generated: number
  cases_disbursed: number
  is_current_user: boolean
}

export interface LeaderboardResponse {
  success: boolean
  data: {
    company_leaderboard: CROComparisonData[]
    team_leaderboard: CROComparisonData[]
    current_user_rank: {
      company: number
      team: number
      total_cros: number
      team_size: number
    }
  }
}

export interface PerformanceHistoryResponse {
  success: boolean
  data: {
    monthly_performance: CROMonthlyPerformance[]
    joining_date: string
    total_months: number
    best_month: {
      month: string
      score: number
    }
    average_score: number
    trend: MetricTrend
  }
}

export interface GraphDataPoint {
  date: string
  calls_made: number
  leads_converted: number
  cases_sanctioned: number
  cases_disbursed: number
  revenue: number
}

export interface GraphDataResponse {
  success: boolean
  data: {
    daily_data: GraphDataPoint[]
    cro_comparison: {
      employee_id: string
      data: GraphDataPoint[]
    }[]
    period: {
      start_date: string
      end_date: string
    }
  }
}

export interface AIInsightsResponse {
  success: boolean
  data: {
    strengths: CROAIInsight[]
    improvements: CROAIInsight[]
    recommendations: CROAIInsight[]
    warnings: CROAIInsight[]
    achievements: CROAIInsight[]
    summary: {
      total_insights: number
      high_priority: number
      action_items_count: number
    }
    last_analyzed: string
  }
}

// =====================================================
// EXPORT TYPES
// =====================================================

export interface ExportRequest {
  cro_id: string
  format: 'excel' | 'pdf'
  date_range: {
    start_date: string
    end_date: string
  }
  include_sections: {
    summary: boolean
    daily_metrics: boolean
    monthly_comparison: boolean
    leaderboard: boolean
    ai_insights: boolean
  }
}

export interface ExportResponse {
  success: boolean
  file_url: string
  file_name: string
  file_size: number
  generated_at: string
}

// =====================================================
// COMPONENT PROPS
// =====================================================

export interface PerformanceKPICardProps {
  metric: PerformanceMetricWithTarget
  showTrend?: boolean
  compact?: boolean
}

export interface PerformanceGraphProps {
  data: GraphDataPoint[]
  comparisonData?: {
    employee_id: string
    data: GraphDataPoint[]
  }[]
  metrics: ('calls_made' | 'leads_converted' | 'cases_sanctioned' | 'cases_disbursed')[]
  height?: number
}

export interface LeaderboardTableProps {
  data: CROComparisonData[]
  title: string
  showRank?: boolean
  highlightCurrentUser?: boolean
}

export interface AIInsightCardProps {
  insight: CROAIInsight
  onDismiss?: (id: string) => void
  onMarkRead?: (id: string) => void
  compact?: boolean
}

export interface PerformanceHistoryTableProps {
  data: CROMonthlyPerformance[]
  onExport?: (month: string) => void
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface MetricDefinition {
  key: string
  display_name: string
  description: string
  unit: string
  category: 'calls' | 'leads' | 'deals' | 'revenue' | 'quality'
  higher_is_better: boolean
  format: 'number' | 'percentage' | 'currency' | 'duration' | 'days'
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Call Metrics
  { key: 'calls_made', display_name: 'Calls Made', description: 'Total calls made', unit: 'calls', category: 'calls', higher_is_better: true, format: 'number' },
  { key: 'call_duration', display_name: 'Avg Call Duration', description: 'Average call duration', unit: 'min', category: 'calls', higher_is_better: true, format: 'duration' },
  { key: 'logins', display_name: 'Login Count', description: 'Number of daily logins', unit: 'logins', category: 'calls', higher_is_better: true, format: 'number' },

  // Lead Metrics
  { key: 'leads_generated', display_name: 'Leads Generated', description: 'New leads created', unit: 'leads', category: 'leads', higher_is_better: true, format: 'number' },
  { key: 'leads_converted', display_name: 'Leads Converted', description: 'Leads converted to deals', unit: 'leads', category: 'leads', higher_is_better: true, format: 'number' },
  { key: 'conversion_rate', display_name: 'Conversion Rate', description: 'Lead to deal conversion rate', unit: '%', category: 'leads', higher_is_better: true, format: 'percentage' },
  { key: 'lead_drop_rate', display_name: 'Lead Drop Rate', description: 'Percentage of dropped leads', unit: '%', category: 'leads', higher_is_better: false, format: 'percentage' },

  // Deal Metrics
  { key: 'deals_created', display_name: 'Deals Created', description: 'New deals opened', unit: 'deals', category: 'deals', higher_is_better: true, format: 'number' },
  { key: 'cases_sanctioned', display_name: 'Cases Sanctioned', description: 'Loan cases sanctioned', unit: 'cases', category: 'deals', higher_is_better: true, format: 'number' },
  { key: 'cases_disbursed', display_name: 'Cases Disbursed', description: 'Loan cases disbursed', unit: 'cases', category: 'deals', higher_is_better: true, format: 'number' },

  // Revenue Metrics
  { key: 'revenue_generated', display_name: 'Revenue Generated', description: 'Total revenue generated', unit: '₹', category: 'revenue', higher_is_better: true, format: 'currency' },
  { key: 'volume_generated', display_name: 'Volume Generated', description: 'Total loan volume', unit: '₹', category: 'revenue', higher_is_better: true, format: 'currency' },
  { key: 'disbursement_amount', display_name: 'Disbursement Amount', description: 'Total disbursed amount', unit: '₹', category: 'revenue', higher_is_better: true, format: 'currency' },

  // Quality Metrics
  { key: 'response_time', display_name: 'Avg Response Time', description: 'Average response time to leads', unit: 'min', category: 'quality', higher_is_better: false, format: 'duration' },
  { key: 'followup_completion', display_name: 'Follow-up Completion', description: 'Follow-up completion rate', unit: '%', category: 'quality', higher_is_better: true, format: 'percentage' },
  { key: 'customer_satisfaction', display_name: 'Customer Satisfaction', description: 'Customer satisfaction score', unit: '/5', category: 'quality', higher_is_better: true, format: 'number' },
  { key: 'lead_closing_days', display_name: 'Lead Closing Time', description: 'Average days to close a lead', unit: 'days', category: 'quality', higher_is_better: false, format: 'days' },
]

// Helper function to get metric definition
export function getMetricDefinition(key: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS.find(m => m.key === key)
}

// Helper function to format metric value
export function formatMetricValue(value: number, format: MetricDefinition['format']): string {
  switch (format) {
    case 'currency':
      if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
      if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
      return `₹${value.toLocaleString('en-IN')}`
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'duration':
      return `${value.toFixed(1)} min`
    case 'days':
      return `${value.toFixed(1)} days`
    default:
      return value.toLocaleString('en-IN')
  }
}

// Helper function to calculate performance grade
export function calculatePerformanceGrade(score: number): PerformanceGrade {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}
