import { SupabaseClient } from '@supabase/supabase-js'

interface BadgeDefinition {
  type: string
  name: string
  description: string
  icon: string
  xp: number
  check: (stats: CROStats) => boolean
}

interface CROStats {
  totalCalls: number
  todayCalls: number
  totalConversions: number
  monthConversions: number
  avgAIRating: number
  highestAIRating: number
  currentCallStreak: number
  totalFollowupsCompleted: number
  totalLeadsHandled: number
  totalChatsResponded: number
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: 'first_call',
    name: 'First Call',
    description: 'Made your first call',
    icon: '📞',
    xp: 10,
    check: (s) => s.totalCalls >= 1,
  },
  {
    type: 'ten_calls',
    name: 'Getting Started',
    description: 'Made 10 calls',
    icon: '🔟',
    xp: 20,
    check: (s) => s.totalCalls >= 10,
  },
  {
    type: 'hundred_calls',
    name: 'Century Caller',
    description: 'Made 100 calls',
    icon: '💯',
    xp: 50,
    check: (s) => s.totalCalls >= 100,
  },
  {
    type: 'five_hundred_calls',
    name: 'Call Machine',
    description: 'Made 500 calls',
    icon: '🏭',
    xp: 100,
    check: (s) => s.totalCalls >= 500,
  },
  {
    type: 'powerhouse',
    name: 'Powerhouse',
    description: 'Made 50+ calls in a single day',
    icon: '⚡',
    xp: 75,
    check: (s) => s.todayCalls >= 50,
  },
  {
    type: 'first_conversion',
    name: 'First Conversion',
    description: 'Converted your first lead',
    icon: '🎯',
    xp: 100,
    check: (s) => s.totalConversions >= 1,
  },
  {
    type: 'ten_conversions',
    name: 'Closer',
    description: 'Converted 10 leads',
    icon: '🏆',
    xp: 200,
    check: (s) => s.totalConversions >= 10,
  },
  {
    type: 'monthly_ten',
    name: 'Monthly Champion',
    description: '10+ conversions in a month',
    icon: '👑',
    xp: 150,
    check: (s) => s.monthConversions >= 10,
  },
  {
    type: 'top_communicator',
    name: 'Top Communicator',
    description: 'Achieved AI rating above 9.0',
    icon: '🌟',
    xp: 100,
    check: (s) => s.highestAIRating >= 9,
  },
  {
    type: 'consistent_quality',
    name: 'Quality Speaker',
    description: 'Average AI rating above 7.5',
    icon: '🎙️',
    xp: 75,
    check: (s) => s.avgAIRating >= 7.5,
  },
  {
    type: 'streak_7',
    name: 'Consistent Caller',
    description: '7-day call streak',
    icon: '🔥',
    xp: 50,
    check: (s) => s.currentCallStreak >= 7,
  },
  {
    type: 'streak_30',
    name: 'Unstoppable',
    description: '30-day call streak',
    icon: '🚀',
    xp: 150,
    check: (s) => s.currentCallStreak >= 30,
  },
  {
    type: 'followup_master',
    name: 'Follow-up Master',
    description: 'Completed 50 follow-ups',
    icon: '📋',
    xp: 50,
    check: (s) => s.totalFollowupsCompleted >= 50,
  },
  {
    type: 'chat_hero',
    name: 'Chat Hero',
    description: 'Responded to 25+ customer chats',
    icon: '💬',
    xp: 40,
    check: (s) => s.totalChatsResponded >= 25,
  },
]

const LEVEL_THRESHOLDS = {
  junior: { min: 0, max: 499 },
  mid: { min: 500, max: 1499 },
  senior: { min: 1500, max: 3499 },
  star: { min: 3500, max: 6999 },
  champion: { min: 7000, max: Infinity },
}

function getLevel(xp: number): string {
  if (xp >= 7000) return 'champion'
  if (xp >= 3500) return 'star'
  if (xp >= 1500) return 'senior'
  if (xp >= 500) return 'mid'
  return 'junior'
}

function getNextLevelThreshold(xp: number): number {
  if (xp < 500) return 500
  if (xp < 1500) return 1500
  if (xp < 3500) return 3500
  if (xp < 7000) return 7000
  return 10000 // Beyond champion
}

/**
 * Evaluate all badge criteria for a CRO and award any newly earned badges.
 * Also updates streaks and XP.
 */
export async function evaluateGamification(
  supabase: SupabaseClient,
  croId: string
): Promise<{ newBadges: string[]; xpEarned: number; currentLevel: string; totalXP: number }> {
  // Gather CRO stats
  const stats = await gatherCROStats(supabase, croId)

  // Fetch existing achievements
  const { data: existingBadges } = await supabase
    .from('cro_achievements')
    .select('badge_type')
    .eq('cro_id', croId)

  const earnedTypes = new Set((existingBadges || []).map(b => b.badge_type))

  // Check for new badges
  const newBadges: string[] = []
  let xpEarned = 0

  for (const badge of BADGE_DEFINITIONS) {
    if (!earnedTypes.has(badge.type) && badge.check(stats)) {
      // Award badge
      await supabase
        .from('cro_achievements')
        .upsert({
          cro_id: croId,
          badge_type: badge.type,
          badge_name: badge.name,
          description: badge.description,
          icon: badge.icon,
          xp_awarded: badge.xp,
          earned_at: new Date().toISOString(),
        }, { onConflict: 'cro_id,badge_type' })

      newBadges.push(badge.name)
      xpEarned += badge.xp
    }
  }

  // Update XP and level
  const { data: currentLevel } = await supabase
    .from('cro_level_system')
    .select('xp, total_xp_earned')
    .eq('cro_id', croId)
    .maybeSingle()

  const currentXP = (currentLevel?.xp || 0) + xpEarned
  const totalXPEarned = (currentLevel?.total_xp_earned || 0) + xpEarned
  const newLevel = getLevel(currentXP)

  await supabase
    .from('cro_level_system')
    .upsert({
      cro_id: croId,
      xp: currentXP,
      total_xp_earned: totalXPEarned,
      level: newLevel,
      level_up_threshold: getNextLevelThreshold(currentXP),
      last_xp_earned_at: xpEarned > 0 ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cro_id' })

  // Update daily call streak
  await updateStreak(supabase, croId, 'daily_calls', stats.todayCalls > 0)

  return {
    newBadges,
    xpEarned,
    currentLevel: newLevel,
    totalXP: currentXP,
  }
}

/**
 * Get gamification profile for a CRO
 */
export async function getGamificationProfile(
  supabase: SupabaseClient,
  croId: string
) {
  const [levelResult, badgesResult, streaksResult] = await Promise.all([
    supabase.from('cro_level_system').select('*').eq('cro_id', croId).maybeSingle(),
    supabase.from('cro_achievements').select('*').eq('cro_id', croId).order('earned_at', { ascending: false }),
    supabase.from('cro_streaks').select('*').eq('cro_id', croId),
  ])

  const level = levelResult.data || { xp: 0, total_xp_earned: 0, level: 'junior', level_up_threshold: 500 }
  const badges = badgesResult.data || []
  const streaks = streaksResult.data || []

  const nextThreshold = getNextLevelThreshold(level.xp || 0)
  const currentLevelInfo = LEVEL_THRESHOLDS[level.level as keyof typeof LEVEL_THRESHOLDS] || LEVEL_THRESHOLDS.junior
  const progress = currentLevelInfo.max === Infinity
    ? 100
    : Math.round(((level.xp - currentLevelInfo.min) / (currentLevelInfo.max - currentLevelInfo.min + 1)) * 100)

  return {
    level: level.level || 'junior',
    xp: level.xp || 0,
    totalXPEarned: level.total_xp_earned || 0,
    nextLevelThreshold: nextThreshold,
    progressPercent: Math.min(100, progress),
    badges,
    streaks,
    availableBadges: BADGE_DEFINITIONS.map(b => ({
      type: b.type,
      name: b.name,
      description: b.description,
      icon: b.icon,
      xp: b.xp,
      earned: badges.some(eb => eb.badge_type === b.type),
    })),
  }
}

async function gatherCROStats(supabase: SupabaseClient, croId: string): Promise<CROStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [allCallsResult, todayCallsResult, conversionsResult, monthConversionsResult, followupsResult, chatsResult] = await Promise.all([
    supabase.from('cro_call_logs').select('ai_rating').eq('cro_id', croId),
    supabase.from('cro_call_logs').select('id').eq('cro_id', croId).gte('call_started_at', today.toISOString()),
    supabase.from('crm_leads').select('id').eq('assigned_cro_id', croId).eq('status', 'Converted'),
    supabase.from('crm_leads').select('id').eq('assigned_cro_id', croId).eq('status', 'Converted').gte('updated_at', monthStart.toISOString()),
    supabase.from('crm_followups').select('id').eq('scheduled_by', croId).eq('status', 'Completed'),
    supabase.from('chat_messages').select('id').eq('sender_id', croId).eq('sender_type', 'cro'),
  ])

  const allCalls = allCallsResult.data || []
  const ratedCalls = allCalls.filter(c => c.ai_rating)
  const avgRating = ratedCalls.length > 0 ? ratedCalls.reduce((s, c) => s + c.ai_rating, 0) / ratedCalls.length : 0
  const highestRating = ratedCalls.length > 0 ? Math.max(...ratedCalls.map(c => c.ai_rating)) : 0

  // Get streak
  const { data: streakData } = await supabase
    .from('cro_streaks')
    .select('current_streak')
    .eq('cro_id', croId)
    .eq('streak_type', 'daily_calls')
    .maybeSingle()

  return {
    totalCalls: allCalls.length,
    todayCalls: (todayCallsResult.data || []).length,
    totalConversions: (conversionsResult.data || []).length,
    monthConversions: (monthConversionsResult.data || []).length,
    avgAIRating: avgRating,
    highestAIRating: highestRating,
    currentCallStreak: streakData?.current_streak || 0,
    totalFollowupsCompleted: (followupsResult.data || []).length,
    totalLeadsHandled: 0, // Simplified
    totalChatsResponded: (chatsResult.data || []).length,
  }
}

async function updateStreak(
  supabase: SupabaseClient,
  croId: string,
  streakType: string,
  hadActivity: boolean
) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: existing } = await supabase
    .from('cro_streaks')
    .select('*')
    .eq('cro_id', croId)
    .eq('streak_type', streakType)
    .maybeSingle()

  if (!existing) {
    if (hadActivity) {
      await supabase.from('cro_streaks').insert({
        cro_id: croId,
        streak_type: streakType,
        current_streak: 1,
        best_streak: 1,
        last_activity_date: today,
        streak_started_at: today,
      })
    }
    return
  }

  if (existing.last_activity_date === today) return // Already counted today

  if (!hadActivity) return // No activity, don't break streak until tomorrow

  const lastDate = existing.last_activity_date ? new Date(existing.last_activity_date) : null
  const todayDate = new Date(today)

  if (lastDate) {
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      // Consecutive day - extend streak
      const newStreak = (existing.current_streak || 0) + 1
      await supabase
        .from('cro_streaks')
        .update({
          current_streak: newStreak,
          best_streak: Math.max(newStreak, existing.best_streak || 0),
          last_activity_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else if (diffDays > 1) {
      // Streak broken - reset
      await supabase
        .from('cro_streaks')
        .update({
          current_streak: 1,
          last_activity_date: today,
          streak_started_at: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  }
}
