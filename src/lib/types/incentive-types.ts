/**
 * Incentive Management System - TypeScript Type Definitions
 * Complete type definitions for the incentive management module
 */

// =====================================================
// ENUM TYPES
// =====================================================

export type IncentiveStatus = 'draft' | 'active' | 'expired' | 'disabled'

export type IncentiveType =
  | 'bonus'
  | 'commission'
  | 'reward'
  | 'cash'
  | 'voucher'
  | 'gift'
  | 'travel'
  | 'other'

export type AllocationStatus =
  | 'eligible'
  | 'in_progress'
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'
  | 'claimed'
  | 'expired'

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export type TargetCategory = 'employee' | 'partner' | 'customer' | 'all'

// =====================================================
// MAIN ENTITIES
// =====================================================

export interface IncentiveSubRole {
  id: string
  subrole_code: string
  subrole_name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PerformanceCriteria {
  metric: string // 'leads_converted', 'sales_closed', 'revenue_generated', etc.
  target_value: number
  measurement_type: 'count' | 'amount' | 'percentage'
  target_period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'program_duration'
  description?: string
  // Tiered criteria (optional)
  tiers?: {
    min: number
    max: number
    reward_amount: number
    reward_percentage?: number
  }[]
}

export interface RewardDetails {
  type: 'fixed' | 'tiered' | 'percentage' | 'variable'
  // Tiered rewards
  slabs?: {
    min: number
    max: number
    amount: number
  }[]
  // Percentage-based rewards
  percentage?: number
  base_amount?: number
  // Additional details
  voucher_type?: string
  gift_details?: string
  travel_destination?: string
  [key: string]: unknown
}

export interface Incentive {
  id: string
  incentive_title: string
  incentive_description?: string | null
  incentive_type: IncentiveType
  incentive_image_url?: string | null
  reward_amount?: number | null
  reward_currency: string
  reward_details?: RewardDetails | null
  start_date: string
  end_date: string
  target_category: TargetCategory
  target_all_employees: boolean
  performance_criteria: PerformanceCriteria
  status: IncentiveStatus
  is_active: boolean
  display_order: number
  notify_on_launch: boolean
  notify_before_expiry_days: number
  notification_sent_at?: string | null
  expiry_reminder_sent_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

export interface IncentiveTargetAudience {
  id: string
  incentive_id: string
  subrole_id: string
  created_at: string
  // Relationships
  subrole?: IncentiveSubRole
}

export interface CurrentProgress {
  [metric: string]: number
  percentage?: number
  last_updated?: string
}

export interface IncentiveAllocation {
  id: string
  incentive_id: string
  user_id: string
  is_eligible: boolean
  eligibility_checked_at: string
  current_progress?: CurrentProgress | null
  progress_percentage: number
  allocation_status: AllocationStatus
  achieved_at?: string | null
  earned_amount: number
  earned_reward_details?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  // Relationships
  incentive?: Incentive
  user?: EmployeeProfile
}

export interface IncentiveClaim {
  id: string
  allocation_id: string
  user_id: string
  incentive_id: string
  claimed_amount: number
  claim_status: ClaimStatus
  claimed_at: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  payment_method?: string | null
  payment_reference?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
  // Relationships
  allocation?: IncentiveAllocation
  user?: EmployeeProfile
  incentive?: Incentive
  reviewed_by_user?: EmployeeProfile
}

export interface IncentiveProgress {
  id: string
  allocation_id: string
  user_id: string
  incentive_id: string
  metric_name: string
  metric_value: number
  target_value: number
  progress_percentage: number
  milestone_reached?: string | null
  milestone_reward?: number | null
  recorded_at: string
  created_at: string
}

export interface IncentiveAnalytics {
  id: string
  incentive_id: string
  total_eligible_users: number
  total_participating_users: number
  participation_rate: number
  users_achieved: number
  users_partially_achieved: number
  users_not_achieved: number
  achievement_rate: number
  total_allocated_amount: number
  total_earned_amount: number
  total_claimed_amount: number
  total_paid_amount: number
  avg_progress_percentage: number
  median_progress_percentage: number
  last_calculated_at: string
  created_at: string
  updated_at: string
  // Relationships
  incentive?: Incentive
}

// =====================================================
// EXTENDED TYPES (with relationships)
// =====================================================

export interface IncentiveWithRelations extends Incentive {
  created_by_user?: EmployeeProfile
  updated_by_user?: EmployeeProfile
  incentive_target_audience?: IncentiveTargetAudience[]
  incentive_analytics?: IncentiveAnalytics
}

export interface IncentiveAllocationWithRelations extends IncentiveAllocation {
  incentive: Incentive
  user: EmployeeProfile
}

export interface IncentiveClaimWithRelations extends IncentiveClaim {
  allocation: IncentiveAllocation
  user: EmployeeProfile
  incentive: Incentive
  reviewed_by_user?: EmployeeProfile
}

// =====================================================
// EMPLOYEE PROFILE (Minimal for relationships)
// =====================================================

export interface EmployeeProfile {
  id: string
  full_name: string
  email: string
  sub_role?: string | null
  role?: string | null
  status?: string
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateIncentiveRequest {
  incentive_title: string
  incentive_description?: string
  incentive_type: IncentiveType
  incentive_image_url?: string
  reward_amount?: number
  reward_currency?: string
  reward_details?: RewardDetails
  start_date: string
  end_date: string
  target_category?: TargetCategory
  target_all_employees?: boolean
  target_subroles?: string[] // Array of subrole IDs
  performance_criteria: PerformanceCriteria
  status?: IncentiveStatus
  display_order?: number
  notify_on_launch?: boolean
  notify_before_expiry_days?: number
}

export interface UpdateIncentiveRequest {
  incentive_title?: string
  incentive_description?: string
  incentive_type?: IncentiveType
  incentive_image_url?: string
  reward_amount?: number
  reward_currency?: string
  reward_details?: RewardDetails
  start_date?: string
  end_date?: string
  target_all_employees?: boolean
  target_subroles?: string[]
  performance_criteria?: PerformanceCriteria
  status?: IncentiveStatus
  display_order?: number
  notify_before_expiry_days?: number
  is_active?: boolean
}

export interface CreateClaimRequest {
  allocation_id: string
  claimed_amount: number
  payment_method?: string
}

export interface ReviewClaimRequest {
  claim_id: string
  claim_status: 'approved' | 'rejected' | 'paid'
  review_notes?: string
  payment_reference?: string
}

export interface IncentiveListResponse {
  success: boolean
  data: IncentiveWithRelations[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface IncentiveDetailResponse {
  success: boolean
  data: IncentiveWithRelations
}

export interface MyIncentivesResponse {
  success: boolean
  data: {
    active: IncentiveAllocationWithRelations[]
    expired: IncentiveAllocationWithRelations[]
  }
  summary: {
    total_active: number
    total_expired: number
    in_progress: number
    achieved: number
    total_potential_earnings: number
    total_earned: number
  }
}

export interface IncentiveAnalyticsResponse {
  success: boolean
  data: IncentiveAnalytics | IncentiveAnalytics[]
  summary?: {
    total_incentives: number
    total_eligible_users: number
    total_participating_users: number
    total_allocated_amount: number
    total_earned_amount: number
    total_claimed_amount: number
    total_paid_amount: number
    avg_participation_rate: number
    avg_achievement_rate: number
  }
}

export interface TopPerformer {
  id: string
  user_id: string
  progress_percentage: number
  earned_amount: number
  allocation_status: AllocationStatus
  user: EmployeeProfile
}

export interface IncentiveAnalyticsDetailResponse {
  success: boolean
  data: IncentiveAnalytics & {
    incentive: Incentive
    top_performers: TopPerformer[]
  }
}

export interface ClaimListResponse {
  success: boolean
  data: IncentiveClaimWithRelations[]
}

export interface ClaimResponse {
  success: boolean
  data: IncentiveClaim
  message: string
}

// =====================================================
// FORM TYPES (for UI components)
// =====================================================

export interface IncentiveFormData {
  incentive_title: string
  incentive_description: string
  incentive_type: IncentiveType
  incentive_image_url: string
  reward_amount: string
  reward_currency: string
  reward_details: RewardDetails
  start_date: string
  end_date: string
  target_all_employees: boolean
  target_subroles: string[]
  performance_criteria: PerformanceCriteria
  status: IncentiveStatus
  display_order: number
  notify_on_launch: boolean
  notify_before_expiry_days: number
}

export interface IncentiveFilterOptions {
  status?: IncentiveStatus
  subrole?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

// =====================================================
// UI COMPONENT PROPS
// =====================================================

export interface IncentiveCardProps {
  incentive: Incentive | IncentiveAllocationWithRelations
  allocation?: IncentiveAllocation
  showActions?: boolean
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onView?: (id: string) => void
  showProgress?: boolean
  compact?: boolean
}

export interface IncentiveFormProps {
  initialData?: Incentive
  mode: 'create' | 'edit'
  onSubmit: (data: CreateIncentiveRequest | UpdateIncentiveRequest) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export interface IncentiveAnalyticsProps {
  incentiveId?: string
  showSummary?: boolean
  showTopPerformers?: boolean
  refreshInterval?: number
}

export interface IncentiveProgressBarProps {
  current: number
  target: number
  label?: string
  showPercentage?: boolean
  color?: 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'yellow' | 'purple'
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface IncentiveSummaryStats {
  total: number
  active: number
  expired: number
  draft: number
  disabled: number
}

export interface UserIncentiveSummary {
  total_active: number
  total_expired: number
  in_progress: number
  achieved: number
  total_earned: number
  pending_claims: number
}

export interface IncentiveTimelineEvent {
  date: string
  type: 'created' | 'activated' | 'progress_update' | 'achieved' | 'claimed' | 'paid' | 'expired'
  description: string
  metadata?: unknown}

// =====================================================
// DATABASE FUNCTION TYPES
// =====================================================

export interface GetActiveIncentivesParams {
  user_uuid?: string
}

export interface GetExpiredIncentivesParams {
  user_uuid?: string
}

export interface CalculateAnalyticsParams {
  incentive_uuid: string
}

export interface ActiveIncentiveRow {
  id: string
  incentive_title: string
  incentive_description: string
  incentive_type: string
  incentive_image_url: string
  reward_amount: number
  start_date: string
  end_date: string
  performance_criteria: PerformanceCriteria
  days_remaining: number
  allocation_id: string
  progress_percentage: number
  allocation_status: string
  earned_amount: number
}

export interface ExpiredIncentiveRow {
  id: string
  incentive_title: string
  incentive_description: string
  incentive_type: string
  incentive_image_url: string
  reward_amount: number
  start_date: string
  end_date: string
  performance_criteria: PerformanceCriteria
  allocation_status: string
  earned_amount: number
  final_progress_percentage: number
}
