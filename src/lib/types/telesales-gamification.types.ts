// =====================================================
// TELESALES GAMIFICATION TYPES
// =====================================================

// =====================================================
// POINTS SYSTEM
// =====================================================

export type TSPointsTransactionType = 'EARNED' | 'REDEEMED' | 'BONUS' | 'PENALTY' | 'ADJUSTMENT'

export type TSPointsCategory =
  | 'CALL_COMPLETED'
  | 'CALL_CONNECTED'
  | 'CONVERSION'
  | 'QUALITY_BONUS'
  | 'FIRST_CALL_OF_DAY'
  | 'TARGET_ACHIEVED'
  | 'STREAK_BONUS'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'CONTEST_WIN'
  | 'REFERRAL'
  | 'TEAM_BONUS'
  | 'MANAGER_REWARD'
  | 'REDEMPTION'
  | 'PENALTY'

export interface TSPointsTransaction {
  id: string
  sales_executive_id: string
  points: number
  transaction_type: TSPointsTransactionType
  category: TSPointsCategory
  reference_type?: string
  reference_id?: string
  description?: string
  balance_after: number
  created_at: string
}

// =====================================================
// USER POINTS & LEVELS
// =====================================================

export type TSLevelName =
  | 'Rookie'
  | 'Apprentice'
  | 'Associate'
  | 'Professional'
  | 'Expert'
  | 'Master'
  | 'Grandmaster'
  | 'Legend'
  | 'Champion'
  | 'Elite'

export interface TSUserPoints {
  id: string
  sales_executive_id: string
  current_points: number
  lifetime_points: number
  redeemed_points: number
  current_level: number
  level_name: TSLevelName
  points_to_next_level: number
  current_streak_days: number
  longest_streak_days: number
  last_activity_date?: string
  weekly_rank?: number
  monthly_rank?: number
  all_time_rank?: number
  total_calls_made: number
  total_conversions: number
  total_badges_earned: number
  created_at: string
  updated_at: string
}

export interface TSLevelDefinition {
  level: number
  name: TSLevelName
  min_points: number
  max_points: number
  color: string
  icon: string
}

export const TS_LEVEL_DEFINITIONS: TSLevelDefinition[] = [
  { level: 1, name: 'Rookie', min_points: 0, max_points: 499, color: '#6B7280', icon: 'user' },
  { level: 2, name: 'Apprentice', min_points: 500, max_points: 1499, color: '#10B981', icon: 'trending-up' },
  { level: 3, name: 'Associate', min_points: 1500, max_points: 3499, color: '#3B82F6', icon: 'star' },
  { level: 4, name: 'Professional', min_points: 3500, max_points: 6999, color: '#8B5CF6', icon: 'award' },
  { level: 5, name: 'Expert', min_points: 7000, max_points: 12499, color: '#EC4899', icon: 'zap' },
  { level: 6, name: 'Master', min_points: 12500, max_points: 19999, color: '#F59E0B', icon: 'shield' },
  { level: 7, name: 'Grandmaster', min_points: 20000, max_points: 34999, color: '#EF4444', icon: 'flame' },
  { level: 8, name: 'Legend', min_points: 35000, max_points: 59999, color: '#14B8A6', icon: 'sparkles' },
  { level: 9, name: 'Champion', min_points: 60000, max_points: 99999, color: '#F97316', icon: 'trophy' },
  { level: 10, name: 'Elite', min_points: 100000, max_points: Infinity, color: '#FBBF24', icon: 'crown' },
]

// Points earned per action
export const TS_POINTS_CONFIG = {
  CALL_COMPLETED: 5,
  CALL_CONNECTED: 10,
  CONVERSION: 50,
  QUALITY_BONUS_PER_POINT: 5, // Per quality score point above 3
  FIRST_CALL_OF_DAY: 10,
  TARGET_ACHIEVED: 100,
  STREAK_BONUS_PER_DAY: 5, // Multiplied by streak length
  PERFECT_QUALITY_SCORE: 25,
}

// =====================================================
// BADGES & ACHIEVEMENTS
// =====================================================

export type TSBadgeCategory = 'CALLS' | 'CONVERSIONS' | 'STREAKS' | 'QUALITY' | 'SPECIAL'
export type TSBadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'
export type TSBadgeRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export type TSBadgeRequirementType = 'COUNT' | 'STREAK' | 'RATE' | 'SCORE' | 'MILESTONE'
export type TSBadgePeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME'

export interface TSBadge {
  id: string
  name: string
  description: string
  icon: string
  category: TSBadgeCategory
  requirement_type: TSBadgeRequirementType
  requirement_value: number
  requirement_period?: TSBadgePeriod
  points_reward: number
  tier: TSBadgeTier
  rarity: TSBadgeRarity
  is_active: boolean
  is_hidden: boolean
  created_at: string
}

export interface TSUserBadge {
  id: string
  sales_executive_id: string
  badge_id: string
  earned_at: string
  progress_value: number
  is_displayed: boolean
  current_tier?: TSBadgeTier
  badge?: TSBadge
}

export const TS_BADGE_TIER_COLORS: Record<TSBadgeTier, { bg: string; text: string; border: string }> = {
  BRONZE: { bg: 'bg-amber-900/30', text: 'text-amber-600', border: 'border-amber-600/50' },
  SILVER: { bg: 'bg-gray-400/20', text: 'text-gray-300', border: 'border-gray-400/50' },
  GOLD: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  PLATINUM: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-400/50' },
  DIAMOND: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-400/50' },
}

export const TS_BADGE_RARITY_COLORS: Record<TSBadgeRarity, { bg: string; text: string }> = {
  COMMON: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  UNCOMMON: { bg: 'bg-green-500/20', text: 'text-green-400' },
  RARE: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  EPIC: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  LEGENDARY: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
}

// =====================================================
// LEADERBOARDS
// =====================================================

export type TSLeaderboardPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME'

export interface TSLeaderboardEntry {
  rank: number
  user_id: string
  user_name: string
  user_avatar?: string
  level: number
  level_name: TSLevelName
  points: number
  calls_completed: number
  conversions: number
  connect_rate: number
  badges_count: number
  streak_days: number
  change?: number // Position change from previous period
}

export interface TSLeaderboard {
  id: string
  period_type: TSLeaderboardPeriod
  period_start: string
  period_end: string
  rankings: TSLeaderboardEntry[]
  total_participants: number
  last_calculated: string
}

// =====================================================
// CONTESTS
// =====================================================

export type TSContestType = 'CALLS' | 'CONVERSIONS' | 'QUALITY' | 'TALK_TIME' | 'CUSTOM'
export type TSContestStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface TSContestPrize {
  rank: number
  points: number
  badge_id?: string
  description?: string
}

export interface TSContestParticipant {
  user_id: string
  user_name: string
  current_value: number
  rank: number
  joined_at: string
}

export interface TSContest {
  id: string
  name: string
  description?: string
  contest_type: TSContestType
  start_date: string
  end_date: string
  metric: string
  target_value?: number
  prizes: TSContestPrize[]
  status: TSContestStatus
  participants: TSContestParticipant[]
  winners: TSContestParticipant[]
  created_by?: string
  created_at: string
}

// =====================================================
// DAILY CHALLENGES
// =====================================================

export type TSDailyChallengeType =
  | 'CALLS_COUNT'
  | 'CONNECTS_COUNT'
  | 'CONVERSIONS_COUNT'
  | 'TALK_TIME'
  | 'QUALITY_SCORE'
  | 'NO_MISSED_CALLBACKS'
  | 'FIRST_CALL_EARLY'
  | 'PERFECT_ATTENDANCE'

export interface TSDailyChallenge {
  id: string
  challenge_date: string
  title: string
  description?: string
  challenge_type: TSDailyChallengeType
  target_value: number
  points_reward: number
  bonus_multiplier: number
  is_active: boolean
  created_at: string
}

export interface TSUserChallengeProgress {
  id: string
  sales_executive_id: string
  challenge_id: string
  current_value: number
  is_completed: boolean
  completed_at?: string
  points_earned: number
  created_at: string
  updated_at: string
  challenge?: TSDailyChallenge
}

// =====================================================
// GAMIFICATION DASHBOARD
// =====================================================

export interface TSGamificationDashboard {
  user_points: TSUserPoints
  recent_points: TSPointsTransaction[]
  earned_badges: TSUserBadge[]
  available_badges: TSBadge[]
  badge_progress: { badge_id: string; progress: number; target: number }[]
  weekly_leaderboard: TSLeaderboardEntry[]
  user_rank: {
    weekly: number
    monthly: number
    all_time: number
  }
  active_contests: TSContest[]
  daily_challenge?: TSDailyChallenge
  challenge_progress?: TSUserChallengeProgress
  streak_info: {
    current: number
    longest: number
    at_risk: boolean // Hasn't logged activity today
  }
  next_level: {
    name: TSLevelName
    points_needed: number
    progress_percentage: number
  }
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface TSGamificationStatsResponse {
  success: boolean
  data?: TSGamificationDashboard
  error?: string
}

export interface TSLeaderboardResponse {
  success: boolean
  data?: {
    leaderboard: TSLeaderboard
    user_position?: TSLeaderboardEntry
  }
  error?: string
}

export interface TSBadgesResponse {
  success: boolean
  data?: {
    earned: TSUserBadge[]
    available: TSBadge[]
    progress: { badge_id: string; current: number; target: number }[]
  }
  error?: string
}

export interface TSContestsResponse {
  success: boolean
  data?: TSContest[]
  error?: string
}

export interface TSAwardPointsRequest {
  category: TSPointsCategory
  reference_type?: string
  reference_id?: string
  description?: string
  custom_points?: number
}

export interface TSAwardPointsResponse {
  success: boolean
  data?: {
    points_awarded: number
    new_balance: number
    level_up?: boolean
    new_level?: number
    badges_earned?: TSBadge[]
  }
  error?: string
}
