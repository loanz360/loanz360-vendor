/**
 * Channel Partner Executive (CPE) Performance Types
 * Tracks performance metrics based on recruited partners
 */

export interface CPEDailyMetrics {
  id: string
  user_id: string
  metric_date: string // YYYY-MM-DD

  // Partner Recruitment Metrics
  partners_recruited_today: number
  total_active_partners: number

  // Partner Type Breakdown
  ba_recruited: number
  bp_recruited: number
  cp_recruited: number

  // Lead & Referral Metrics (from recruited partners)
  total_leads_generated: number
  leads_in_progress: number
  leads_converted: number
  leads_sanctioned: number
  leads_disbursed: number
  leads_dropped: number

  // Business Volume Metrics
  total_loan_applications: number
  total_loan_amount: number
  sanctioned_loan_amount: number
  disbursed_loan_amount: number

  // Revenue & Commission Metrics
  estimated_commission: number
  actual_commission: number

  // Partner Performance Metrics
  avg_partner_productivity: number
  top_performing_partner_id: string | null
  top_performing_partner_volume: number

  // Quality Metrics
  conversion_rate: number // Percentage
  sanction_rate: number
  disbursement_rate: number

  // Timestamps
  created_at: string
  updated_at: string
}

export interface CPETarget {
  id: string
  user_id: string
  assigned_by: string | null
  month: string // YYYY-MM
  year: number

  // Partner Recruitment Targets
  target_partners_recruitment: number
  target_ba_recruitment: number
  target_bp_recruitment: number
  target_cp_recruitment: number

  // Business Volume Targets
  target_total_leads: number
  target_leads_converted: number
  target_leads_sanctioned: number
  target_leads_disbursed: number

  // Revenue Targets
  target_loan_volume: number
  target_disbursed_volume: number
  target_commission: number

  // Quality Targets
  target_conversion_rate: number
  target_sanction_rate: number
  target_disbursement_rate: number
  target_partner_productivity: number

  // Metadata
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CPEMonthlySummary {
  id: string
  user_id: string
  month: number // 1-12 (month number)
  year: number

  // Partner Recruitment Achievement
  partners_recruited: number
  ba_recruited: number
  bp_recruited: number
  cp_recruited: number
  total_partners_onboarded: number
  total_active_partners: number

  // Business Volume Achievement
  total_leads_generated: number
  total_partner_leads_generated: number
  leads_converted: number
  total_partner_leads_converted: number
  leads_sanctioned: number
  leads_disbursed: number
  leads_dropped: number

  // Financial Achievement
  total_loan_volume: number
  sanctioned_volume: number
  disbursed_volume: number
  total_partner_revenue: number
  estimated_commission: number
  actual_commission: number
  total_commission_earned: number

  // Performance Rates
  conversion_rate: number
  partner_conversion_rate: number
  sanction_rate: number
  disbursement_rate: number
  avg_partner_productivity: number
  average_partner_engagement_score: number
  partner_network_size: number

  // Overall Performance Score (matches database column: performance_score)
  performance_score: number // 0-100
  performance_grade: PerformanceGrade
  target_achievement_percentage: number

  // Ranking
  company_rank: number | null
  total_employees: number | null
  percentile: number | null
  team_rank: number | null
  national_rank: number | null

  // Metadata
  created_at: string
  updated_at: string
}

export type PerformanceGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

export interface CPEPartnerPerformanceSnapshot {
  cpe_user_id: string
  partner_id: string
  partner_code: string // BA1, BP2, CP3, etc.
  partner_type: string
  partner_name: string
  mobile_number: string
  city: string
  state: string
  joining_date: string
  is_active: boolean

  // Performance metrics
  total_leads: number
  leads_in_progress: number
  leads_sanctioned: number
  leads_dropped: number
  estimated_payout: number
  actual_payout: number
  lifetime_earnings: number

  // Calculated productivity
  days_active: number
  avg_leads_per_day: number

  // Status flags
  is_recently_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// =====================================================
// ANALYTICS TAB DATA STRUCTURES
// =====================================================

export interface CPEAnalyticsData {
  // Overview Cards
  overview: {
    total_active_partners: number
    partners_recruited_this_month: number
    total_leads_generated: number
    total_business_volume: number // In currency
    estimated_commission: number
    avg_partner_productivity: number
  }

  // Partner Type Distribution
  partner_distribution: {
    ba_count: number
    bp_count: number
    cp_count: number
  }

  // Live Performance Metrics
  current_month_metrics: {
    leads_generated: number
    leads_converted: number
    leads_sanctioned: number
    leads_disbursed: number
    conversion_rate: number
    sanction_rate: number
    disbursement_rate: number
  }

  // Top Performing Partners (Top 5)
  top_partners: Array<{
    partner_id: string
    partner_code: string
    partner_name: string
    partner_type: string
    total_leads: number
    leads_sanctioned: number
    business_volume: number
    conversion_rate: number
  }>

  // Recent Recruitment Activity (Last 10)
  recent_recruitments: Array<{
    partner_id: string
    partner_code: string
    partner_name: string
    partner_type: string
    joining_date: string
    days_active: number
    total_leads: number
  }>

  // Performance Trend (Last 30 days)
  performance_trend: Array<{
    date: string
    leads_generated: number
    leads_converted: number
    business_volume: number
  }>

  // Target Achievement
  target_achievement: {
    partners_recruited: {
      current: number
      target: number
      achievement_percentage: number
    }
    leads_generated: {
      current: number
      target: number
      achievement_percentage: number
    }
    business_volume: {
      current: number
      target: number
      achievement_percentage: number
    }
    commission: {
      current: number
      target: number
      achievement_percentage: number
    }
  }

  last_updated: string
}

// =====================================================
// HISTORY TAB DATA STRUCTURES
// =====================================================

export interface CPEHistoryData {
  // Monthly Performance History (Last 12 months)
  monthly_history: Array<{
    month: number // 1-12
    year: number
    month_label: string // "January 2025"
    partners_recruited: number
    ba_recruited: number
    bp_recruited: number
    cp_recruited: number
    total_leads_generated: number
    leads_converted: number
    leads_sanctioned: number
    leads_disbursed: number
    total_business_volume: number
    sanctioned_volume: number
    disbursed_volume: number
    estimated_commission: number
    actual_commission: number
    conversion_rate: number
    sanction_rate: number
    disbursement_rate: number
    performance_score: number // Changed from overall_score to match database
    performance_grade: PerformanceGrade
    target_achievement_percentage: number
    team_rank: number | null
    national_rank: number | null
  }>

  // Partner Performance Breakdown (All recruited partners)
  partner_breakdown: Array<{
    partner_id: string
    partner_code: string
    partner_name: string
    partner_type: string
    city: string
    state: string
    joining_date: string
    days_active: number
    total_leads: number
    leads_sanctioned: number
    leads_disbursed: number
    business_volume: number
    estimated_payout: number
    actual_payout: number
    avg_leads_per_day: number
    is_active: boolean
    is_recently_active: boolean
    last_login_at: string | null
  }>

  // Yearly Summary
  yearly_summary: {
    year: number
    total_partners_recruited: number
    ba_recruited: number
    bp_recruited: number
    cp_recruited: number
    total_leads: number
    total_business_volume: number
    total_commission: number
    avg_monthly_score: number
    best_month: string
    best_month_score: number
  }

  // Comparative Analysis
  comparative_analysis: {
    vs_last_month: {
      partners_recruited_change: number // Percentage
      leads_generated_change: number
      business_volume_change: number
      commission_change: number
    }
    vs_last_year: {
      partners_recruited_change: number
      leads_generated_change: number
      business_volume_change: number
      commission_change: number
    }
  }
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface CPEAnalyticsResponse {
  success: boolean
  data: CPEAnalyticsData
  message?: string
}

export interface CPEHistoryResponse {
  success: boolean
  data: CPEHistoryData
  message?: string
}

export interface CPETargetResponse {
  success: boolean
  data: CPETarget
  message?: string
}

// =====================================================
// METRIC CARD TYPES
// =====================================================

export interface MetricCard {
  label: string
  value: number | string
  unit?: string // '₹', '%', 'partners', 'leads', etc.
  trend?: 'up' | 'down' | 'stable'
  trend_percentage?: number
  icon?: string
  color?: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'yellow'
  description?: string
}

// =====================================================
// CHART DATA TYPES
// =====================================================

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface TimeSeriesDataPoint {
  date: string
  value: number
  label?: string
}

export interface MultiSeriesDataPoint {
  date: string
  [key: string]: string | number // Dynamic series names
}

// =====================================================
// HELPER TYPES
// =====================================================

export type MetricType =
  | 'partners_recruited'
  | 'leads_generated'
  | 'leads_converted'
  | 'leads_sanctioned'
  | 'leads_disbursed'
  | 'business_volume'
  | 'commission'
  | 'conversion_rate'
  | 'sanction_rate'
  | 'disbursement_rate'

export type PartnerTypeFilter = 'all' | 'BA' | 'BP' | 'CP'

export type DateRangeFilter = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all_time' | 'custom'

export interface DateRange {
  start_date: string
  end_date: string
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function calculateAchievementPercentage(current: number, target: number): number {
  if (target === 0) return 0
  return Math.round((current / target) * 100)
}

export function getPerformanceGrade(score: number): PerformanceGrade {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 75) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function getMonthLabel(monthString: string): string {
  // Convert "2025-01" to "January 2025"
  const [year, month] = monthString.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date)
}

export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '↑'
    case 'down':
      return '↓'
    case 'stable':
      return '→'
  }
}

export function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return 'text-green-500'
    case 'down':
      return 'text-red-500'
    case 'stable':
      return 'text-yellow-500'
  }
}
