/**
 * Channel Partner Manager (CPM) Team Performance Types
 * Tracks team performance metrics based on CPE team members
 */

import { PerformanceGrade } from './cpe-performance.types'

// =====================================================
// TEAM MEMBER PERFORMANCE
// =====================================================

export interface CPETeamMember {
  cpe_user_id: string
  cpe_name: string
  cpe_email: string
  cpe_mobile: string

  // Partner metrics
  total_partners: number
  total_ba: number
  total_bp: number
  total_cp: number
  active_partners: number

  // Lead metrics
  total_leads: number
  leads_in_progress: number
  leads_sanctioned: number
  leads_dropped: number

  // Financial metrics
  total_loan_volume: number
  sanctioned_volume: number
  disbursed_volume: number
  estimated_commission: number
  actual_commission: number

  // Performance metrics
  performance_score: number
  performance_grade: PerformanceGrade | null
  team_rank: number | null
  conversion_rate: number
  sanction_rate: number
  disbursement_rate: number
}

// =====================================================
// TEAM ANALYTICS SUMMARY
// =====================================================

export interface CPMTeamAnalytics {
  // Team overview
  total_cpe_count: number
  active_cpe_count: number

  // Partner network
  total_partners: number
  total_ba: number
  total_bp: number
  total_cp: number
  active_partners: number

  // Lead metrics
  total_leads: number
  leads_in_progress: number
  leads_sanctioned: number
  leads_disbursed: number
  leads_dropped: number
  leads_rejected: number

  // Financial metrics
  total_loan_volume: number
  volume_in_process: number
  sanctioned_volume: number
  disbursed_volume: number
  rejected_volume: number
  estimated_commission: number
  actual_commission: number

  // Performance metrics
  avg_conversion_rate: number
  avg_sanction_rate: number
  avg_disbursement_rate: number
  team_avg_score: number
}

// =====================================================
// CPE PROFILE WITH PERFORMANCE COMPARISON
// =====================================================

export interface CPEProfileData {
  // Profile information
  cpe_user_id: string
  cpe_name: string
  cpe_email: string
  cpe_mobile: string
  joining_date: string

  // Current month performance
  current_month_partners: number
  current_month_leads: number
  current_month_volume: number
  current_month_score: number
  current_month_grade: PerformanceGrade | null

  // Previous month performance
  previous_month_partners: number
  previous_month_leads: number
  previous_month_volume: number
  previous_month_score: number
  previous_month_grade: PerformanceGrade | null

  // All-time metrics
  total_partners: number
  total_leads: number
  total_volume: number
  total_commission: number

  // Top performing partners
  top_performing_partners: Array<{
    partner_id: string
    partner_name: string
    partner_type: string
    total_leads: number
    total_business: number
  }>
}

// =====================================================
// PARTNER NETWORK
// =====================================================

export interface PartnerInNetwork {
  cpe_user_id: string
  cpe_name: string
  partner_id: string
  partner_code: string
  partner_name: string
  partner_type: string
  partner_mobile: string
  joining_date: string
  is_active: boolean
  total_leads: number
  leads_sanctioned: number
  total_business: number
  last_active: string | null
}

// =====================================================
// ANALYTICS TAB DATA STRUCTURES
// =====================================================

export interface CPMTeamPerformanceData {
  // Team Analytics Cards
  team_analytics: {
    total_cpes: number
    total_partners: number
    partners_breakdown: {
      ba: number
      bp: number
      cp: number
    }
    total_leads: number
    total_volume: number
    volume_in_process: number
    sanctioned_volume: number
    disbursed_volume: number
    rejected_volume: number
    dropped_volume: number
  }

  // CPE Performance List
  cpe_list: CPETeamMember[]

  // Top Performers
  top_performers: Array<{
    cpe_user_id: string
    cpe_name: string
    performance_score: number
    performance_grade: PerformanceGrade | null
    total_partners: number
    total_leads: number
    total_volume: number
    rank: number
  }>

  // Partner Network Distribution
  partner_network: {
    total_partners: number
    by_cpe: Array<{
      cpe_user_id: string
      cpe_name: string
      partner_count: number
      ba_count: number
      bp_count: number
      cp_count: number
    }>
    by_type: {
      ba_count: number
      bp_count: number
      cp_count: number
    }
  }

  // Team Performance Trends (Last 30 days)
  performance_trend: Array<{
    date: string
    partners_recruited: number
    leads_generated: number
    business_volume: number
    team_avg_score: number
  }>

  // Recent Activitiesby CPEs
  recent_activities: Array<{
    cpe_user_id: string
    cpe_name: string
    activity_type: 'PARTNER_RECRUITED' | 'LEAD_GENERATED' | 'LEAD_SANCTIONED' | 'LEAD_DISBURSED'
    activity_description: string
    timestamp: string
  }>

  last_updated: string
}

// =====================================================
// TARGETS AND ACHIEVEMENTS
// =====================================================

export interface CPMTeamTarget {
  id: string
  cpm_user_id: string
  month: string // YYYY-MM
  year: number

  // Team-level targets
  target_total_partners: number
  target_ba_recruitment: number
  target_bp_recruitment: number
  target_cp_recruitment: number
  target_total_leads: number
  target_loan_volume: number
  target_commission: number

  // Individual CPE targets (aggregated)
  cpe_targets: Array<{
    cpe_user_id: string
    cpe_name: string
    target_partners: number
    target_leads: number
    target_volume: number
  }>

  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CPMTargetAchievement {
  target_id: string
  month: string

  // Achievement percentages
  partners_achievement: number
  leads_achievement: number
  volume_achievement: number
  commission_achievement: number

  // Individual CPE achievements
  cpe_achievements: Array<{
    cpe_user_id: string
    cpe_name: string
    partners_achievement: number
    leads_achievement: number
    volume_achievement: number
    overall_achievement: number
  }>

  team_overall_achievement: number
}

// =====================================================
// METRIC CARDS FOR ANALYTICS TAB
// =====================================================

export interface TeamMetricCard {
  id: string
  label: string
  value: number | string
  unit?: string // '₹', '%', 'partners', 'leads', etc.
  subtext?: string
  trend?: 'up' | 'down' | 'stable'
  trend_percentage?: number
  icon?: string
  color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'yellow' | 'indigo' | 'teal'
  breakdown?: Array<{
    label: string
    value: number
    percentage: number
  }>
}

// =====================================================
// CPE COMPARISON DATA
// =====================================================

export interface CPEComparison {
  cpe_list: Array<{
    cpe_user_id: string
    cpe_name: string
    total_partners: number
    total_leads: number
    total_volume: number
    conversion_rate: number
    performance_score: number
    performance_grade: PerformanceGrade | null
    rank: number
  }>

  comparison_metrics: {
    metric: string
    values: Array<{
      cpe_user_id: string
      cpe_name: string
      value: number
    }>
  }[]

  best_performers: {
    highest_partners: { cpe_user_id: string; cpe_name: string; value: number }
    highest_leads: { cpe_user_id: string; cpe_name: string; value: number }
    highest_volume: { cpe_user_id: string; cpe_name: string; value: number }
    highest_conversion: { cpe_user_id: string; cpe_name: string; value: number }
  }
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface CPMTeamAnalyticsResponse {
  success: boolean
  data: CPMTeamAnalytics
  message?: string
}

export interface CPMTeamPerformanceResponse {
  success: boolean
  data: CPMTeamPerformanceData
  message?: string
}

export interface CPEListResponse {
  success: boolean
  data: CPETeamMember[]
  message?: string
}

export interface CPEProfileResponse {
  success: boolean
  data: CPEProfileData
  message?: string
}

export interface PartnerNetworkResponse {
  success: boolean
  data: PartnerInNetwork[]
  message?: string
}

export interface CPMTargetResponse {
  success: boolean
  data: CPMTeamTarget
  message?: string
}

// =====================================================
// FILTER TYPES
// =====================================================

export interface TeamPerformanceFilters {
  date_range: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  start_date?: string
  end_date?: string
  cpe_filter?: string[] // Array of CPE user IDs
  partner_type_filter?: 'all' | 'BA' | 'BP' | 'CP'
  metric_filter?: TeamMetricType
}

export type TeamMetricType =
  | 'partners_recruited'
  | 'leads_generated'
  | 'leads_sanctioned'
  | 'leads_disbursed'
  | 'business_volume'
  | 'commission'
  | 'conversion_rate'
  | 'performance_score'

// =====================================================
// TAB TYPES
// =====================================================

export type TeamPerformanceTab =
  | 'analytics'
  | 'cpe_list'
  | 'targets'
  | 'partner_network'
  | 'leads'
  | 'comparison'

export interface TabConfig {
  id: TeamPerformanceTab
  label: string
  icon?: string
  badge?: number
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function calculateTeamAverage(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return Math.round((sum / values.length) * 100) / 100
}

export function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function calculateTeamGrade(averageScore: number): PerformanceGrade {
  if (averageScore >= 95) return 'A+'
  if (averageScore >= 90) return 'A'
  if (averageScore >= 85) return 'B+'
  if (averageScore >= 80) return 'B'
  if (averageScore >= 75) return 'C+'
  if (averageScore >= 70) return 'C'
  if (averageScore >= 60) return 'D'
  return 'F'
}

export function formatTeamMetric(value: number, type: TeamMetricType): string {
  switch (type) {
    case 'business_volume':
    case 'commission':
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(value)
    case 'conversion_rate':
    case 'performance_score':
      return `${value.toFixed(1)}%`
    default:
      return new Intl.NumberFormat('en-IN').format(value)
  }
}

export function getPerformanceColor(grade: PerformanceGrade | null): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'text-green-600'
    case 'B+':
    case 'B':
      return 'text-blue-600'
    case 'C+':
    case 'C':
      return 'text-yellow-600'
    case 'D':
      return 'text-orange-600'
    case 'F':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export function getPerformanceBadgeColor(grade: PerformanceGrade | null): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'bg-green-100 text-green-800'
    case 'B+':
    case 'B':
      return 'bg-blue-100 text-blue-800'
    case 'C+':
    case 'C':
      return 'bg-yellow-100 text-yellow-800'
    case 'D':
      return 'bg-orange-100 text-orange-800'
    case 'F':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
