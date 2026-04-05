/**
 * Direct Sales Manager (DSM) Team Performance Types
 * Tracks team performance metrics based on DSE team members
 */

import { PerformanceGrade, TrendDirection } from './performance.types'

// =====================================================
// TEAM MEMBER PERFORMANCE
// =====================================================

export interface DSETeamMember {
  dse_user_id: string
  dse_name: string
  dse_email: string
  dse_mobile: string
  dse_avatar?: string
  dse_territory: string

  // Field Activity
  field_visits: number
  meetings_scheduled: number
  meetings_attended: number
  travel_distance_km: number

  // Lead & Revenue
  leads_generated: number
  leads_converted: number
  revenue_generated: number
  conversion_rate: number
  average_deal_size: number

  // Territory
  territory_coverage: number
  new_prospects_added: number

  // Performance
  performance_score: number
  performance_grade: PerformanceGrade | null
  team_rank: number | null

  // Engagement
  last_field_visit: string | null
  days_since_last_conversion: number
  last_one_on_one: string | null
}

// =====================================================
// TEAM ANALYTICS SUMMARY
// =====================================================

export interface DSMTeamAnalytics {
  // Team Overview
  total_dse_count: number
  active_dse_count: number
  on_leave_count: number
  top_performers_count: number        // A/A+ grade
  needs_coaching_count: number        // C/D/F grade

  // Aggregated Field Activity
  total_field_visits: number
  total_meetings_scheduled: number
  total_meetings_attended: number
  total_travel_distance: number
  avg_field_visits_per_dse: number
  avg_meetings_per_dse: number

  // Aggregated Revenue & Conversion
  total_revenue: number
  total_leads: number
  total_conversions: number
  avg_conversion_rate: number
  avg_deal_size: number

  // Territory Coverage
  total_territories: number
  avg_territory_coverage: number
  territories_expanded_this_month: number

  // Team Quality Metrics
  team_avg_score: number
  team_csat: number
  team_revenue_achievement_pct: number
  team_target_achievement_pct: number

  // Management Metrics
  total_one_on_ones_completed: number
  total_coaching_sessions: number
  total_training_hours: number
  one_on_one_coverage_pct: number      // % of DSEs who had 1-on-1 this month
}

// =====================================================
// DSE PROFILE WITH PERFORMANCE COMPARISON
// =====================================================

export interface DSEProfileData {
  // Profile information
  dse_user_id: string
  dse_name: string
  dse_email: string
  dse_mobile: string
  dse_avatar?: string
  dse_territory: string
  joining_date: string

  // Current month performance
  current_month_field_visits: number
  current_month_leads: number
  current_month_conversions: number
  current_month_revenue: number
  current_month_score: number
  current_month_grade: PerformanceGrade | null

  // Previous month performance
  previous_month_field_visits: number
  previous_month_leads: number
  previous_month_conversions: number
  previous_month_revenue: number
  previous_month_score: number
  previous_month_grade: PerformanceGrade | null

  // All-time metrics
  total_field_visits: number
  total_leads: number
  total_conversions: number
  total_revenue: number

  // Recent activity
  recent_activities: Array<{
    date: string
    activity_type: string
    description: string
    outcome?: string
  }>
}

// =====================================================
// TERRITORY DATA
// =====================================================

export interface DSETerritoryData {
  territory_id: string
  territory_name: string
  territory_region: string

  // Assigned DSEs
  assigned_dse_count: number
  assigned_dses: Array<{
    dse_user_id: string
    dse_name: string
    dse_avatar?: string
  }>

  // Performance
  total_revenue: number
  total_leads: number
  total_conversions: number
  conversion_rate: number

  // Coverage
  coverage_percentage: number
  untapped_potential: number
  market_size_estimate: number

  // Trend
  revenue_trend: TrendDirection
  revenue_change_pct: number
}

// =====================================================
// ANALYTICS TAB DATA STRUCTURES
// =====================================================

export interface TeamMetricCard {
  label: string
  value: number | string
  icon: string
  color: string
  description?: string
  trend?: TrendDirection
  changePercentage?: number
}

export interface CoachingAlert {
  dse_user_id: string
  dse_name: string
  alert_type: 'no_one_on_one' | 'low_performance' | 'no_activity' | 'declining_trend'
  severity: 'low' | 'medium' | 'high' | 'critical'
  days_since_last_action: number
  message: string
  recommended_action: string
}

// =====================================================
// LEADERBOARD DATA
// =====================================================

export interface DSELeaderboardEntry {
  rank: number
  dse_user_id: string
  dse_name: string
  dse_avatar?: string
  dse_territory: string

  // Primary metrics
  revenue_generated: number
  leads_converted: number
  conversion_rate: number
  performance_score: number
  grade: PerformanceGrade | null

  // Trends
  revenue_trend: TrendDirection
  revenue_change_pct: number

  // Badges
  badges: string[]
}

// =====================================================
// TERRITORY ANALYTICS
// =====================================================

export interface TerritoryPerformanceMap {
  territories: DSETerritoryData[]
  total_territories: number
  high_performing_count: number      // > 80% coverage
  medium_performing_count: number    // 50-80% coverage
  low_performing_count: number       // < 50% coverage
  expansion_opportunities: Array<{
    territory_name: string
    opportunity_score: number
    estimated_potential: number
  }>
}

// =====================================================
// PREDICTIVE ANALYTICS
// =====================================================

export interface TeamPerformancePrediction {
  // End of month predictions
  predicted_revenue: number
  predicted_conversions: number
  target_achievement_probability: number  // 0-100

  // Confidence metrics
  confidence_level: number  // 0-100
  prediction_date: string

  // Risk factors
  top_risks: Array<{
    risk: string
    impact: 'low' | 'medium' | 'high'
    likelihood: number
  }>

  // Opportunities
  opportunities: Array<{
    opportunity: string
    potential_value: number
    effort: 'low' | 'medium' | 'high'
  }>
}

export interface UnderperformerAlert {
  dse_user_id: string
  dse_name: string
  risk_score: number              // 0-100, higher = more risk
  risk_factors: string[]
  recommended_interventions: string[]
  estimated_revenue_impact: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

// =====================================================
// BEST PRACTICES
// =====================================================

export interface BestPractice {
  id: string
  title: string
  description: string
  category: 'coaching' | 'territory' | 'team_building' | 'process'
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  source: 'top_performer' | 'data_analysis' | 'industry_standard'
  evidence: string
  implementation_steps: string[]
}

// =====================================================
// COMPARATIVE ANALYTICS
// =====================================================

export interface ComparativeAnalytics {
  // Comparison with company average
  vs_company_average: {
    team_revenue: string          // e.g., "+15%"
    team_conversion_rate: string  // e.g., "+3%"
    team_size: string             // e.g., "same"
    territory_coverage: string    // e.g., "+8%"
  }

  // Comparison with top performer
  vs_top_performer: {
    team_revenue: string          // e.g., "-25%"
    gap: number
    time_to_close_gap: string     // e.g., "4.5 months at current pace"
  }

  // Rankings
  ranking: {
    overall: { rank: number; total: number; percentile: number }
    by_region: { rank: number; total: number; percentile: number }
    by_team_size: { rank: number; total: number; percentile: number }
  }
}
