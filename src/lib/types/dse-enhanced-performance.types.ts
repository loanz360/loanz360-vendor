/**
 * ============================================================================
 * DSE ENHANCED PERFORMANCE TYPE SYSTEM
 * ============================================================================
 * Types for world-class DSE performance management:
 * - Multi-tier incentive engine
 * - Product-wise performance tracking
 * - Lead-to-disbursement funnel analytics
 * - Bank partner performance matrix
 * - Customer lifetime value (CLV) attribution
 * - Commission calculation engine
 * - Predictive performance scoring
 * - DSA compliance tracking
 * - Fraud detection
 * - Gamification (badges)
 * - Audit trail
 * ============================================================================
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/** Valid loan funnel stages in order */
export const FUNNEL_STAGES = [
  'lead_generated',
  'qualified',
  'application_filed',
  'documents_collected',
  'bank_submitted',
  'bank_login',
  'credit_approved',
  'sanction_letter',
  'disbursed',
  'first_emi_collected',
] as const

export const FUNNEL_TERMINAL_STAGES = ['rejected', 'dropped'] as const

export type FunnelStage = (typeof FUNNEL_STAGES)[number] | (typeof FUNNEL_TERMINAL_STAGES)[number]

/** Commission calculation statuses */
export type CommissionStatus = 'calculated' | 'verified' | 'approved' | 'paid' | 'disputed'

/** Fraud flag types */
export type FraudFlagType =
  | 'ghost_visit'
  | 'suspicious_conversion'
  | 'document_recycling'
  | 'time_anomaly'
  | 'self_referral'
  | 'location_mismatch'
  | 'other'

/** Fraud flag severity */
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical'

/** Fraud flag status */
export type FraudFlagStatus = 'open' | 'investigating' | 'confirmed' | 'dismissed' | 'resolved'

/** Pace indicator */
export type PaceIndicator = 'ahead' | 'on_track' | 'behind' | 'critical'

/** Badge category */
export type BadgeCategory = 'performance' | 'streak' | 'milestone' | 'special' | 'team'

/** Audit action types */
export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'calculate' | 'export'

// ============================================================================
// 1. MULTI-TIER INCENTIVE ENGINE
// ============================================================================

export interface IncentiveTier {
  id: string
  incentive_id: string
  tier_name: string
  tier_order: number
  min_achievement_pct: number
  max_achievement_pct: number | null
  payout_multiplier: number
  bonus_amount: number
  is_accelerator: boolean
  accelerator_condition: AcceleratorCondition | null
  created_at: string
  updated_at: string
}

export interface AcceleratorCondition {
  /** Number of consecutive months hitting this tier */
  consecutive_months: number
  /** Minimum achievement % to qualify */
  min_achievement: number
  /** Multiplier applied to base for next month */
  next_month_multiplier: number
}

export interface IncentiveSlabCalculation {
  tier_name: string
  achievement_pct: number
  multiplier: number
  base_amount: number
  calculated_amount: number
  is_accelerated: boolean
}

// ============================================================================
// 2. PRODUCT-WISE PERFORMANCE TRACKING
// ============================================================================

export interface DSEProductPerformance {
  id: string
  dse_user_id: string
  month: number
  year: number
  product_type: string
  leads_count: number
  conversions_count: number
  conversion_rate: number
  revenue_generated: number
  average_ticket_size: number
  applications_filed: number
  applications_approved: number
  applications_rejected: number
  approval_rate: number
  average_processing_days: number
  incentive_earned: number
  created_at: string
  updated_at: string
}

export interface ProductMixAnalysis {
  product_type: string
  revenue_share_pct: number
  volume_share_pct: number
  incentive_rate: number
  current_incentive_earned: number
  potential_incentive: number
  recommendation: string
}

// ============================================================================
// 3. LEAD-TO-DISBURSEMENT FUNNEL
// ============================================================================

export interface DSELoanFunnel {
  id: string
  dse_user_id: string
  lead_id: string | null
  customer_name: string | null
  customer_phone: string | null
  product_type: string
  bank_partner: string | null
  loan_amount: number | null
  current_stage: FunnelStage
  stage_history: FunnelStageEntry[]
  stage_entered_at: string
  stage_sla_hours: number
  is_sla_breached: boolean
  expected_disbursement_date: string | null
  actual_disbursement_date: string | null
  disbursed_amount: number | null
  rejection_reason: string | null
  drop_off_stage: string | null
  drop_off_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FunnelStageEntry {
  stage: FunnelStage
  entered_at: string
  exited_at?: string
  duration_hours?: number
  notes?: string
}

export interface FunnelAnalytics {
  stages: FunnelStageMetrics[]
  total_leads: number
  total_disbursed: number
  overall_conversion_rate: number
  average_cycle_days: number
  bottleneck_stage: string
  sla_breach_count: number
}

export interface FunnelStageMetrics {
  stage: FunnelStage
  stage_label: string
  count: number
  conversion_to_next: number
  average_duration_hours: number
  sla_breach_count: number
  drop_off_count: number
  revenue_weighted: number
}

// ============================================================================
// 4. BANK PARTNER PERFORMANCE
// ============================================================================

export interface DSEBankPerformance {
  id: string
  dse_user_id: string
  month: number
  year: number
  bank_name: string
  cases_submitted: number
  cases_approved: number
  cases_rejected: number
  cases_pending: number
  approval_rate: number
  average_tat_days: number
  total_disbursed_amount: number
  average_ticket_size: number
  rejection_reasons: BankRejectionReason[]
  created_at: string
  updated_at: string
}

export interface BankRejectionReason {
  reason: string
  count: number
  percentage: number
}

export interface BankRoutingSuggestion {
  bank_name: string
  approval_probability: number
  estimated_tat_days: number
  reason: string
  historical_approval_rate: number
}

// ============================================================================
// 5. CUSTOMER LIFETIME VALUE
// ============================================================================

export interface DSECustomerCLV {
  id: string
  dse_user_id: string
  customer_id: string | null
  customer_name: string | null
  first_loan_date: string | null
  total_loans_sourced: number
  total_disbursed_amount: number
  total_emi_collected: number
  emi_collection_rate: number
  is_npa: boolean
  npa_amount: number
  referrals_generated: number
  repeat_business_count: number
  topup_conversions: number
  lifetime_value: number
  quality_score: number
  created_at: string
  updated_at: string
}

export interface CLVSummary {
  total_customers: number
  average_clv: number
  total_lifetime_value: number
  npa_count: number
  npa_rate: number
  average_emi_collection_rate: number
  repeat_business_rate: number
  referral_rate: number
  quality_score: number
}

// ============================================================================
// 6. COMMISSION CALCULATION ENGINE
// ============================================================================

export interface CommissionSlab {
  id: string
  role: string
  product_type: string | null
  slab_name: string
  slab_order: number
  min_achievement_pct: number
  max_achievement_pct: number | null
  commission_rate: number
  fixed_amount: number
  is_incremental: boolean
  effective_from: string
  effective_to: string | null
  is_active: boolean
}

export interface DSECommissionCalculation {
  id: string
  dse_user_id: string
  month: number
  year: number
  base_salary: number
  variable_pay: number
  product_incentive: number
  cross_sell_bonus: number
  super_achiever_bonus: number
  clawback_amount: number
  gross_commission: number
  tds_deduction: number
  net_payout: number
  calculation_details: CommissionBreakdown
  status: CommissionStatus
  verified_by: string | null
  verified_at: string | null
  approved_by: string | null
  approved_at: string | null
  paid_at: string | null
  payment_reference: string | null
  dispute_reason: string | null
  created_at: string
  updated_at: string
}

export interface CommissionBreakdown {
  base_salary_details: { amount: number; description: string }
  variable_details: VariablePayDetail[]
  product_details: ProductCommissionDetail[]
  cross_sell_details: CrossSellDetail[]
  clawback_details: ClawbackDetail[]
  super_achiever: { qualified: boolean; amount: number; achievement_pct: number }
  tds: { rate: number; amount: number }
}

export interface VariablePayDetail {
  slab_name: string
  achievement_pct: number
  multiplier: number
  amount: number
}

export interface ProductCommissionDetail {
  product_type: string
  deals_count: number
  total_disbursed: number
  commission_rate: number
  amount: number
}

export interface CrossSellDetail {
  product_name: string
  count: number
  per_unit_bonus: number
  amount: number
}

export interface ClawbackDetail {
  loan_id: string
  customer_name: string
  reason: string
  original_incentive: number
  clawback_amount: number
  date: string
}

/** What-if simulator input */
export interface CommissionSimulatorInput {
  additional_deals: number
  additional_revenue: number
  product_type: string
  cross_sells: number
}

/** What-if simulator output */
export interface CommissionSimulatorResult {
  current_payout: number
  projected_payout: number
  additional_earning: number
  new_achievement_pct: number
  new_slab: string
  new_rank_estimate: number
  breakdown: CommissionBreakdown
}

// ============================================================================
// 7. PREDICTIVE PERFORMANCE SCORING
// ============================================================================

export interface DSEPerformancePrediction {
  id: string
  dse_user_id: string
  month: number
  year: number
  predicted_revenue: number
  predicted_conversions: number
  predicted_grade: string
  prediction_confidence: number
  revenue_probability: number
  conversion_probability: number
  daily_target_to_achieve: DailyTargetBreakdown
  pace_indicator: PaceIndicator
  recommendations: PredictionRecommendation[]
  model_version: string
  created_at: string
}

export interface DailyTargetBreakdown {
  remaining_working_days: number
  revenue_per_day_needed: number
  conversions_per_day_needed: number
  visits_per_day_needed: number
  meetings_per_day_needed: number
}

export interface PredictionRecommendation {
  type: 'focus_area' | 'risk_alert' | 'opportunity'
  title: string
  description: string
  impact_estimate: string
  priority: 'high' | 'medium' | 'low'
}

// ============================================================================
// 8. DSA COMPLIANCE TRACKING
// ============================================================================

export interface DSEComplianceTracking {
  id: string
  dse_user_id: string
  loan_application_id: string | null
  customer_id: string | null
  mitc_disclosed: boolean
  mitc_disclosed_at: string | null
  interest_rate_disclosed: boolean
  charges_disclosed: boolean
  cooling_off_period_respected: boolean
  customer_consent_obtained: boolean
  consent_document_url: string | null
  kyc_verified: boolean
  compliance_score: number
  issues: ComplianceIssue[]
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface ComplianceIssue {
  type: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolution: string | null
}

export interface ComplianceSummary {
  total_applications: number
  fully_compliant: number
  compliance_rate: number
  issues_count: number
  average_compliance_score: number
  critical_issues: number
}

// ============================================================================
// 9. FRAUD DETECTION
// ============================================================================

export interface DSEFraudFlag {
  id: string
  dse_user_id: string
  flag_type: FraudFlagType
  severity: FraudSeverity
  description: string
  evidence: Record<string, unknown>
  related_entity_type: string | null
  related_entity_id: string | null
  status: FraudFlagStatus
  investigated_by: string | null
  investigation_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface FraudSummary {
  total_flags: number
  open_flags: number
  confirmed_flags: number
  flags_by_type: Record<FraudFlagType, number>
  risk_score: number
}

// ============================================================================
// 10. GAMIFICATION & BADGES
// ============================================================================

export interface AchievementBadge {
  id: string
  badge_code: string
  badge_name: string
  badge_description: string | null
  badge_icon: string | null
  badge_category: BadgeCategory
  criteria: BadgeCriteria
  points: number
  is_active: boolean
  created_at: string
}

export interface BadgeCriteria {
  min_achievement?: number
  consecutive_months?: number
  max_rank?: number
  min_revenue?: number
  max_npa?: number
  min_conversion_rate?: number
  min_coverage?: number
  min_cross_sells?: number
  max_avg_days?: number
}

export interface UserBadge {
  id: string
  dse_user_id: string
  badge_id: string
  awarded_at: string
  awarded_for_period: string | null
  metadata: Record<string, unknown>
  badge?: AchievementBadge
}

export interface GamificationSummary {
  total_points: number
  badges_earned: number
  total_badges_available: number
  recent_badges: UserBadge[]
  next_achievable_badges: NextBadgeProgress[]
  rank_by_points: number
}

export interface NextBadgeProgress {
  badge: AchievementBadge
  current_progress: number
  target: number
  progress_pct: number
  estimated_days_to_achieve: number | null
}

// ============================================================================
// 11. AUDIT TRAIL
// ============================================================================

export interface PerformanceAuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  performed_by: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface DSEEnhancedPerformanceResponse {
  current_month: {
    month: number
    year: number
    summary: EnhancedMonthlySummary
    product_breakdown: DSEProductPerformance[]
    bank_breakdown: DSEBankPerformance[]
    funnel: FunnelAnalytics
    commission: DSECommissionCalculation | null
    predictions: DSEPerformancePrediction | null
    compliance: ComplianceSummary
    gamification: GamificationSummary
  }
}

export interface EnhancedMonthlySummary {
  // Core metrics (existing)
  performance_score: number
  performance_grade: string
  company_rank: number
  total_employees: number
  percentile: number
  target_achievement: number
  // New metrics
  quality_score: number
  compliance_score: number
  fraud_risk_score: number
  total_points: number
  pace_indicator: PaceIndicator
}

/** Daily standup briefing */
export interface DailyBriefing {
  greeting: string
  day_of_month: number
  working_days_total: number
  month_progress_pct: number
  pace_status: PaceIndicator
  pace_delta_pct: number
  focus_areas: BriefingFocusArea[]
  top_opportunity: BriefingOpportunity | null
  pending_follow_ups: number
  sla_at_risk: number
  meetings_today: number
  generated_at: string
}

export interface BriefingFocusArea {
  title: string
  description: string
  count: number
  urgency: 'high' | 'medium' | 'low'
}

export interface BriefingOpportunity {
  customer_name: string
  product_type: string
  loan_amount: number
  conversion_probability: number
  recommended_action: string
  best_contact_time: string | null
}
