/**
 * Advanced Gamification & Achievement Engine
 *
 * Features:
 * - Achievement unlock detection
 * - Tier progression system
 * - Points calculation
 * - Leaderboard management
 * - Streak tracking
 * - Team challenges
 */

import { createClient } from '@/lib/supabase/server';
import { getCache, CacheKeys, CacheTags, CacheTTL } from '@/lib/cache/redis-cache';

// ===================================
// TYPE DEFINITIONS
// ===================================

export interface Achievement {
  code: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  iconUrl?: string;
  unlockCriteria: UnlockCriteria;
  isActive: boolean;
}

export interface UnlockCriteria {
  type: string;
  value?: number;
  count?: number;
  period?: string;
  percentage?: number;
  rank?: number;
  months?: number;
  consecutiveMonths?: number;
  [key: string]: any;
}

export interface UserTier {
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  points: number;
  multiplier: number;
  nextTier?: string;
  pointsToNextTier?: number;
  progress?: number;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  rank: number;
  score: number;
  totalEarned: number;
  achievementsCount: number;
  tier: string;
  avatar?: string;
}

export interface StreakInfo {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
}

// ===================================
// TIER SYSTEM
// ===================================

const TIER_THRESHOLDS = {
  Bronze: { min: 0, max: 250, multiplier: 1.0 },
  Silver: { min: 250, max: 500, multiplier: 1.1 },
  Gold: { min: 500, max: 1000, multiplier: 1.25 },
  Platinum: { min: 1000, max: 2500, multiplier: 1.5 },
  Diamond: { min: 2500, max: Infinity, multiplier: 2.0 },
};

/**
 * Calculate user tier based on total points
 */
export function calculateUserTier(totalPoints: number): UserTier {
  let currentTier: keyof typeof TIER_THRESHOLDS = 'Bronze';

  for (const [tier, threshold] of Object.entries(TIER_THRESHOLDS)) {
    if (totalPoints >= threshold.min && totalPoints < threshold.max) {
      currentTier = tier as keyof typeof TIER_THRESHOLDS;
      break;
    }
  }

  const tierConfig = TIER_THRESHOLDS[currentTier];
  const nextTierEntry = Object.entries(TIER_THRESHOLDS).find(
    ([, config]) => config.min > tierConfig.max
  );

  const nextTier = nextTierEntry ? nextTierEntry[0] : undefined;
  const pointsToNextTier = nextTier
    ? TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS].min - totalPoints
    : 0;

  const progress = nextTier
    ? ((totalPoints - tierConfig.min) / (tierConfig.max - tierConfig.min)) * 100
    : 100;

  return {
    tier: currentTier,
    points: totalPoints,
    multiplier: tierConfig.multiplier,
    nextTier,
    pointsToNextTier,
    progress: Math.min(100, Math.max(0, progress)),
  };
}

/**
 * Update user tier and track history
 */
export async function updateUserTier(
  userId: string,
  newPoints: number
): Promise<UserTier> {
  const supabase = createClient();

  // Get current tier info
  const { data: currentTierData } = await supabase
    .from('incentive_user_achievements')
    .select('points')
    .eq('user_id', userId);

  const totalPoints =
    (currentTierData?.reduce((sum: number, a: any) => sum + (a.points || 0), 0) || 0) +
    newPoints;

  const newTier = calculateUserTier(totalPoints);

  // Check if tier changed
  const { data: lastTier } = await supabase
    .from('incentive_user_tier_history')
    .select('to_tier')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastTier || lastTier.to_tier !== newTier.tier) {
    // Record tier change
    await supabase.from('incentive_user_tier_history').insert({
      user_id: userId,
      from_tier: lastTier?.to_tier || 'Bronze',
      to_tier: newTier.tier,
      tier_points: totalPoints,
      metadata: {
        multiplier: newTier.multiplier,
        promoted_at: new Date().toISOString(),
      },
    });

    // Send notification
    await supabase.from('incentive_notification_queue').insert({
      recipient_user_id: userId,
      channel: 'push',
      subject: `🎉 Tier Promotion!`,
      body: `Congratulations! You've been promoted to ${newTier.tier} tier!`,
      priority: 'high',
    });

    // Emit event
    await supabase.from('incentive_events').insert({
      event_type: 'achievement_unlocked',
      aggregate_id: userId,
      aggregate_type: 'user',
      event_data: {
        tier_promotion: {
          from: lastTier?.to_tier || 'Bronze',
          to: newTier.tier,
          points: totalPoints,
        },
      },
      user_id: userId,
    });
  }

  return newTier;
}

// ===================================
// ACHIEVEMENT SYSTEM
// ===================================

/**
 * Check if criteria is met for achievement
 */
function checkCriteria(criteria: UnlockCriteria, userStats: any): boolean {
  switch (criteria.type) {
    case 'target_achieved':
      return userStats.targetsAchieved >= (criteria.count || 1);

    case 'monthly_achievement':
      return userStats.monthlyProgress >= (criteria.percentage || 100);

    case 'leaderboard_rank':
      return (
        userStats.currentRank !== undefined &&
        userStats.currentRank <= (criteria.rank || 10)
      );

    case 'consecutive_rank':
      return (
        userStats.consecutiveTopRanks >= (criteria.months || 3) &&
        userStats.currentRank === (criteria.rank || 1)
      );

    case 'early_completion':
      return userStats.completionTimePercentage <= (criteria.time_percentage || 50);

    case 'consecutive_achievement':
      return userStats.consecutiveAchievements >= (criteria.months || 6);

    case 'total_earned':
      return userStats.totalEarned >= (criteria.amount || 100000);

    case 'perfect_score':
      return userStats.perfectMonths >= (criteria.count || 1);

    default:
      return false;
  }
}

/**
 * Get user statistics for achievement checking
 */
async function getUserStats(userId: string): Promise<unknown> {
  const supabase = createClient();

  // Get allocations with achievements
  const { data: allocations } = await supabase
    .from('incentive_allocations')
    .select('*')
    .eq('user_id', userId);

  const targetsAchieved = allocations?.filter(
    (a: any) => a.progress_percentage >= 100
  ).length || 0;

  const totalEarned = allocations?.reduce(
    (sum: number, a: any) => sum + (a.earned_amount || 0),
    0
  ) || 0;

  // Get monthly performance
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const { data: monthlyAllocations } = await supabase
    .from('incentive_allocations')
    .select('progress_percentage')
    .eq('user_id', userId)
    .gte('created_at', new Date(currentYear, currentMonth, 1).toISOString())
    .lte('created_at', new Date(currentYear, currentMonth + 1, 0).toISOString());

  const monthlyProgress =
    monthlyAllocations?.reduce(
      (sum: number, a: any) => sum + (a.progress_percentage || 0),
      0
    ) / (monthlyAllocations?.length || 1) || 0;

  // Get leaderboard rank
  const { data: leaderboard } = await supabase
    .from('incentive_leaderboard_cache')
    .select('rank')
    .eq('user_id', userId)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentRank = leaderboard?.rank;

  // Get consecutive achievements
  const { data: history } = await supabase
    .from('incentive_allocations')
    .select('progress_percentage, created_at')
    .eq('user_id', userId)
    .gte('progress_percentage', 100)
    .order('created_at', { ascending: false })
    .limit(12);

  let consecutiveAchievements = 0;
  if (history && history.length > 0) {
    for (let i = 0; i < history.length; i++) {
      const date = new Date(history[i].created_at);
      const expectedMonth = new Date();
      expectedMonth.setMonth(expectedMonth.getMonth() - i);

      if (date.getMonth() === expectedMonth.getMonth()) {
        consecutiveAchievements++;
      } else {
        break;
      }
    }
  }

  return {
    targetsAchieved,
    totalEarned,
    monthlyProgress,
    currentRank,
    consecutiveAchievements,
    perfectMonths: allocations?.filter((a: any) => a.progress_percentage === 100)
      .length || 0,
  };
}

/**
 * Check and unlock achievements for user
 */
export async function checkAndUnlockAchievements(
  userId: string
): Promise<Achievement[]> {
  const supabase = createClient();
  const unlockedAchievements: Achievement[] = [];

  try {
    // Get all achievement definitions
    const { data: allAchievements } = await supabase
      .from('incentive_achievement_definitions')
      .select('*')
      .eq('is_active', true);

    if (!allAchievements) return [];

    // Get user's already unlocked achievements
    const { data: userAchievements } = await supabase
      .from('incentive_user_achievements')
      .select('achievement_code')
      .eq('user_id', userId);

    const unlockedCodes = new Set(
      userAchievements?.map((a: any) => a.achievement_code) || []
    );

    // Get user stats
    const userStats = await getUserStats(userId);

    // Check each achievement
    for (const achievement of allAchievements) {
      // Skip if already unlocked
      if (unlockedCodes.has(achievement.achievement_code)) {
        continue;
      }

      // Check if criteria is met
      const criteriamet = checkCriteria(achievement.unlock_criteria, userStats);

      if (criteriaMet) {
        // Unlock achievement
        await supabase.from('incentive_user_achievements').insert({
          user_id: userId,
          achievement_code: achievement.achievement_code,
          achievement_name: achievement.achievement_name,
          achievement_description: achievement.description,
          rarity: achievement.rarity,
          points: achievement.points,
        });

        unlockedAchievements.push({
          code: achievement.achievement_code,
          name: achievement.achievement_name,
          description: achievement.description,
          rarity: achievement.rarity,
          points: achievement.points,
          iconUrl: achievement.icon_url,
          unlockCriteria: achievement.unlock_criteria,
          isActive: true,
        });

        // Update tier
        await updateUserTier(userId, achievement.points);

        // Send notification
        await supabase.from('incentive_notification_queue').insert({
          recipient_user_id: userId,
          channel: 'push',
          subject: `🏆 Achievement Unlocked!`,
          body: `You've unlocked "${achievement.achievement_name}"! +${achievement.points} points`,
          priority: 'high',
        });

        // Emit event
        await supabase.from('incentive_events').insert({
          event_type: 'achievement_unlocked',
          aggregate_id: userId,
          aggregate_type: 'user',
          event_data: {
            achievement,
          },
          user_id: userId,
        });
      }
    }

    return unlockedAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return unlockedAchievements;
  }
}

// ===================================
// LEADERBOARD SYSTEM
// ===================================

/**
 * Calculate leaderboard for a period
 */
export async function calculateLeaderboard(
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all_time',
  periodStart: Date,
  periodEnd: Date
): Promise<LeaderboardEntry[]> {
  const supabase = createClient();

  try {
    // Check cache first
    const cache = getCache();
    const cacheKey = CacheKeys.leaderboard(
      `${periodType}:${periodStart.toISOString()}`
    );
    const cached = await cache.get<LeaderboardEntry[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // Query allocations for period
    const { data: allocations } = await supabase
      .from('incentive_allocations')
      .select(`
        user_id,
        earned_amount,
        progress_percentage,
        employee_profile:user_id (
          first_name,
          last_name,
          profile_image_url
        )
      `)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())
      .is('deleted_at', null);

    if (!allocations) return [];

    // Group by user
    const userScores = new Map<string, unknown>();

    for (const allocation of allocations) {
      const userId = allocation.user_id;

      if (!userScores.has(userId)) {
        userScores.set(userId, {
          userId,
          userName: `${allocation.employee_profile?.first_name} ${allocation.employee_profile?.last_name}`,
          totalEarned: 0,
          achievementsCount: 0,
          score: 0,
          avatar: allocation.employee_profile?.profile_image_url,
        });
      }

      const user = userScores.get(userId);
      user.totalEarned += allocation.earned_amount || 0;

      if (allocation.progress_percentage >= 100) {
        user.achievementsCount++;
      }

      // Calculate score (weighted formula)
      user.score = user.totalEarned * 0.7 + user.achievementsCount * 1000 * 0.3;
    }

    // Get user tiers
    for (const [userId, userData] of userScores.entries()) {
      const { data: achievements } = await supabase
        .from('incentive_user_achievements')
        .select('points')
        .eq('user_id', userId);

      const totalPoints = achievements?.reduce(
        (sum: number, a: any) => sum + (a.points || 0),
        0
      ) || 0;

      const tier = calculateUserTier(totalPoints);
      userData.tier = tier.tier;
    }

    // Sort and rank
    const leaderboard: LeaderboardEntry[] = Array.from(userScores.values())
      .sort((a, b) => b.score - a.score)
      .map((user, index) => ({
        ...user,
        rank: index + 1,
      }));

    // Cache leaderboard
    await cache.set(cacheKey, leaderboard, {
      ttl: CacheTTL.MEDIUM,
      tags: [CacheTags.leaderboard],
    });

    // Store in leaderboard cache table
    for (const entry of leaderboard) {
      await supabase.from('incentive_leaderboard_cache').upsert({
        period_type: periodType,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        user_id: entry.userId,
        rank: entry.rank,
        total_earned: entry.totalEarned,
        achievements_count: entry.achievementsCount,
        tier: entry.tier,
        score: entry.score,
      });
    }

    return leaderboard;
  } catch (error) {
    console.error('Error calculating leaderboard:', error);
    return [];
  }
}

/**
 * Get user rank in leaderboard
 */
export async function getUserRank(
  userId: string,
  periodType: string = 'monthly'
): Promise<number | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('incentive_leaderboard_cache')
    .select('rank')
    .eq('user_id', userId)
    .eq('period_type', periodType)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.rank || null;
}

// ===================================
// STREAK TRACKING
// ===================================

/**
 * Update user streak
 */
export async function updateUserStreak(userId: string): Promise<StreakInfo> {
  const supabase = createClient();

  const today = new Date().toISOString().split('T')[0];

  // Get last activity
  const { data: lastActivity } = await supabase
    .from('incentive_progress')
    .select('recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastActivityDate = lastActivity
    ? new Date(lastActivity.recorded_at)
    : new Date();

  // Calculate streak
  const daysSinceLastActivity = Math.floor(
    (new Date().getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let currentStreak = 1;

  if (daysSinceLastActivity === 0 || daysSinceLastActivity === 1) {
    // Get current streak from metadata
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('metadata')
      .eq('user_id', userId)
      .maybeSingle();

    currentStreak = (profile?.metadata?.currentStreak || 0) + 1;
  } else if (daysSinceLastActivity > 1) {
    currentStreak = 1; // Streak broken
  }

  // Update profile metadata
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('metadata')
    .eq('user_id', userId)
    .maybeSingle();

  const longestStreak = Math.max(
    currentStreak,
    profile?.metadata?.longestStreak || 0
  );

  await supabase
    .from('employee_profile')
    .update({
      metadata: {
        ...profile?.metadata,
        currentStreak,
        longestStreak,
        lastActivityDate: today,
      },
    })
    .eq('user_id', userId);

  return {
    userId,
    currentStreak,
    longestStreak,
    lastActivityDate,
  };
}

export default {
  calculateUserTier,
  updateUserTier,
  checkAndUnlockAchievements,
  calculateLeaderboard,
  getUserRank,
  updateUserStreak,
};
