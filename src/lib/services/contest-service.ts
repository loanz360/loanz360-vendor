/**
 * Contest Management Service
 * Enterprise-grade service layer for contest operations
 *
 * Features:
 * - Data normalization for schema compatibility
 * - Validation and sanitization
 * - Business logic encapsulation
 * - Error handling and logging
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import logger from '@/lib/monitoring/logger'

// Contest Types
export type ContestStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled'
export type ContestType = 'performance' | 'sales' | 'engagement' | 'custom'

export interface Contest {
  id: string
  contest_title: string
  contest_description: string | null
  contest_image_url: string | null
  contest_rules: string | null
  contest_type: ContestType
  target_category: string
  target_all_partners: boolean
  start_date: string
  end_date: string
  status: ContestStatus
  evaluation_criteria: EvaluationCriteria | null
  evaluation_frequency: string
  auto_evaluate: boolean
  reward_details: Record<string, unknown> | null
  winner_count: number
  reward_tiers: Record<string, unknown> | null
  enable_leaderboard: boolean
  leaderboard_visibility: string
  show_scores: boolean
  notification_enabled: boolean
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface EvaluationCriteria {
  metrics: EvaluationMetric[]
  scoring_formula: 'weighted_sum' | 'average' | 'custom'
}

export interface EvaluationMetric {
  name: string
  weight: number
  target: number
  measurement_type: 'amount' | 'count' | 'percentage'
}

export interface ContestParticipant {
  id: string
  contest_id: string
  partner_id: string
  is_eligible: boolean
  enrollment_type: 'auto' | 'manual' | 'invited'
  current_score: number
  current_rank: number | null
  last_rank: number | null
  performance_data: Record<string, unknown> | null
  progress_percentage: number
  participation_status: 'eligible' | 'participating' | 'disqualified' | 'winner' | 'completed'
  joined_at: string | null
  last_activity_at: string | null
  reward_tier_achieved: string | null
  reward_amount: number | null
  created_at: string
  updated_at: string
}

export interface LeaderboardEntry {
  id: string
  contest_id: string
  partner_id: string
  partner_name?: string
  current_rank: number
  previous_rank: number | null
  rank_change: number
  highest_rank_achieved: number
  total_score: number
  score_breakdown: Record<string, unknown> | null
  badges_earned: string[]
  achievements: Record<string, unknown> | null
  milestone_reached: string | null
  last_updated_at: string
}

export interface ContestAnalytics {
  contest_id: string
  total_eligible_partners: number
  total_active_participants: number
  participation_rate: number
  avg_score: number
  median_score: number
  highest_score: number
  lowest_score: number
  total_activities: number
  avg_activities_per_partner: number
  geography_breakdown: Record<string, number> | null
  subrole_breakdown: Record<string, number> | null
  last_calculated_at: string
}

// Status mapping for old to new schema
const STATUS_MAP: Record<string, ContestStatus> = {
  'completed': 'expired',
  'active': 'active',
  'scheduled': 'scheduled',
  'draft': 'draft',
  'expired': 'expired',
  'disabled': 'disabled',
}

/**
 * Normalize contest data from database to standard format
 * Handles both old and new schema formats
 */
export function normalizeContest(data: Record<string, unknown>): Contest {
  return {
    id: data.id,
    contest_title: data.contest_title || data.title || 'Untitled Contest',
    contest_description: data.contest_description || data.description || null,
    contest_image_url: data.contest_image_url || data.banner_url || null,
    contest_rules: data.contest_rules || null,
    contest_type: data.contest_type || 'performance',
    target_category: data.target_category || 'partner',
    target_all_partners: data.target_all_partners ?? true,
    start_date: data.start_date,
    end_date: data.end_date,
    status: STATUS_MAP[data.status] || data.status || 'draft',
    evaluation_criteria: data.evaluation_criteria || null,
    evaluation_frequency: data.evaluation_frequency || 'daily',
    auto_evaluate: data.auto_evaluate ?? true,
    reward_details: data.reward_details || null,
    winner_count: data.winner_count || 1,
    reward_tiers: data.reward_tiers || null,
    enable_leaderboard: data.enable_leaderboard ?? true,
    leaderboard_visibility: data.leaderboard_visibility || 'public',
    show_scores: data.show_scores ?? true,
    notification_enabled: data.notification_enabled ?? true,
    is_active: data.is_active ?? true,
    created_by: data.created_by || null,
    updated_by: data.updated_by || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    deleted_at: data.deleted_at || null,
    deleted_by: data.deleted_by || null,
  }
}

/**
 * Get all contests with pagination and filters
 */
export async function getContests(options: {
  status?: ContestStatus
  type?: ContestType
  category?: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
}): Promise<{ contests: Contest[]; total: number }> {
  const supabase = createSupabaseAdmin()
  const { status, type, category, limit = 50, offset = 0, includeDeleted = false } = options

  let query = supabase
    .from('contests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  if (status) {
    // Handle both old and new status values
    if (status === 'expired') {
      query = query.in('status', ['expired', 'completed'])
    } else {
      query = query.eq('status', status)
    }
  }

  if (type) {
    query = query.eq('contest_type', type)
  }

  if (category) {
    query = query.eq('target_category', category)
  }

  const { data, error, count } = await query

  if (error) {
    logger.error('Error fetching contests', error)
    throw new Error(`Failed to fetch contests: ${error.message}`)
  }

  return {
    contests: (data || []).map(normalizeContest),
    total: count || 0,
  }
}

/**
 * Get contest by ID
 */
export async function getContestById(id: string): Promise<Contest | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    logger.error(`Error fetching contest ${id}`, error)
    throw new Error(`Failed to fetch contest: ${error.message}`)
  }

  return normalizeContest(data)
}

/**
 * Get leaderboard for a contest
 */
export async function getContestLeaderboard(
  contestId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<LeaderboardEntry[]> {
  const supabase = createSupabaseAdmin()
  const { limit = 100, offset = 0 } = options

  const { data, error } = await supabase
    .from('contest_leaderboard')
    .select(`
      *,
      partner:auth.users!partner_id (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('contest_id', contestId)
    .order('current_rank', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    // Table might not exist if migration hasn't been run
    if (error.message?.includes('does not exist')) {
      logger.warn('Leaderboard table does not exist, returning empty array')
      return []
    }
    logger.error(`Error fetching leaderboard for contest ${contestId}`, error)
    throw new Error(`Failed to fetch leaderboard: ${error.message}`)
  }

  return (data || []).map(entry => ({
    ...entry,
    partner_name: entry.partner?.raw_user_meta_data?.name || entry.partner?.email || 'Unknown',
    badges_earned: entry.badges_earned || [],
  }))
}

/**
 * Get contest analytics
 */
export async function getContestAnalytics(contestId: string): Promise<ContestAnalytics | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('contest_analytics')
    .select('*')
    .eq('contest_id', contestId)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST116') {
      // Analytics not calculated yet
      return null
    }
    // Table might not exist
    if (error.message?.includes('does not exist')) {
      logger.warn('Analytics table does not exist')
      return null
    }
    logger.error(`Error fetching analytics for contest ${contestId}`, error)
    throw new Error(`Failed to fetch analytics: ${error.message}`)
  }

  return data
}

/**
 * Refresh contest leaderboard
 */
export async function refreshLeaderboard(contestId: string): Promise<void> {
  const supabase = createSupabaseAdmin()

  const { error } = await supabase.rpc('update_contest_leaderboard', {
    p_contest_id: contestId,
  })

  if (error) {
    logger.error(`Error refreshing leaderboard for contest ${contestId}`, error)
    throw new Error(`Failed to refresh leaderboard: ${error.message}`)
  }

  logger.info(`Leaderboard refreshed for contest ${contestId}`)
}

/**
 * Calculate contest analytics
 */
export async function calculateAnalytics(contestId: string): Promise<void> {
  const supabase = createSupabaseAdmin()

  const { error } = await supabase.rpc('calculate_contest_analytics', {
    p_contest_id: contestId,
  })

  if (error) {
    logger.error(`Error calculating analytics for contest ${contestId}`, error)
    throw new Error(`Failed to calculate analytics: ${error.message}`)
  }

  logger.info(`Analytics calculated for contest ${contestId}`)
}

/**
 * Update contest status based on dates
 */
export async function updateContestStatuses(): Promise<number> {
  const supabase = createSupabaseAdmin()

  const { error } = await supabase.rpc('update_contest_status')

  if (error) {
    logger.error('Error updating contest statuses', error)
    throw new Error(`Failed to update contest statuses: ${error.message}`)
  }

  logger.info('Contest statuses updated')
  return 0 // Return count of updated contests if needed
}

/**
 * Get partner's participation status in a contest
 */
export async function getPartnerContestStatus(
  contestId: string,
  partnerId: string
): Promise<ContestParticipant | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('contest_participants')
    .select('*')
    .eq('contest_id', contestId)
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    if (error.message?.includes('does not exist')) {
      return null
    }
    logger.error(`Error fetching participant status`, error)
    throw new Error(`Failed to fetch participant status: ${error.message}`)
  }

  return data
}

/**
 * Enroll partners in a contest
 */
export async function enrollPartnersInContest(
  contestId: string,
  partnerIds: string[],
  enrollmentType: 'auto' | 'manual' | 'invited' = 'manual'
): Promise<number> {
  const supabase = createSupabaseAdmin()

  const participants = partnerIds.map(partnerId => ({
    contest_id: contestId,
    partner_id: partnerId,
    is_eligible: true,
    enrollment_type: enrollmentType,
    participation_status: 'eligible',
    current_score: 0,
    progress_percentage: 0,
    joined_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('contest_participants')
    .upsert(participants, {
      onConflict: 'contest_id,partner_id',
      ignoreDuplicates: true,
    })
    .select()

  if (error) {
    logger.error(`Error enrolling partners in contest ${contestId}`, error)
    throw new Error(`Failed to enroll partners: ${error.message}`)
  }

  const enrolledCount = data?.length || 0
  logger.info(`Enrolled ${enrolledCount} partners in contest ${contestId}`)
  return enrolledCount
}

/**
 * Validate contest data before creation/update
 */
export function validateContestData(data: Partial<Contest>): string[] {
  const errors: string[] = []

  if (data.contest_title !== undefined) {
    if (!data.contest_title?.trim()) {
      errors.push('Contest title is required')
    } else if (data.contest_title.length > 255) {
      errors.push('Contest title must be 255 characters or less')
    }
  }

  if (data.start_date && data.end_date) {
    const startDate = new Date(data.start_date)
    const endDate = new Date(data.end_date)
    if (endDate <= startDate) {
      errors.push('End date must be after start date')
    }
  }

  if (data.winner_count !== undefined) {
    if (data.winner_count < 1) {
      errors.push('Winner count must be at least 1')
    } else if (data.winner_count > 1000) {
      errors.push('Winner count cannot exceed 1000')
    }
  }

  if (data.evaluation_criteria) {
    const criteria = data.evaluation_criteria as EvaluationCriteria
    if (!criteria.metrics || criteria.metrics.length === 0) {
      errors.push('At least one evaluation metric is required')
    } else {
      const totalWeight = criteria.metrics.reduce((sum, m) => sum + m.weight, 0)
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        errors.push(`Metric weights must sum to 1.0 (currently ${totalWeight.toFixed(2)})`)
      }
    }
  }

  return errors
}

export default {
  normalizeContest,
  getContests,
  getContestById,
  getContestLeaderboard,
  getContestAnalytics,
  refreshLeaderboard,
  calculateAnalytics,
  updateContestStatuses,
  getPartnerContestStatus,
  enrollPartnersInContest,
  validateContestData,
}
