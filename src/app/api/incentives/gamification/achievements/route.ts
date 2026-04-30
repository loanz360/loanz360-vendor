
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/incentives/gamification/achievements
 * Fetch user's achievements and current tier
 * Access: All authenticated employees
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's achievements
    const { data: achievements, error: achievementsError } = await supabase
      .from('tier_achievements')
      .select(`
        id,
        tier_code,
        achieved_at,
        incentive_tiers (
          tier_name,
          tier_icon,
          tier_color
        )
      `)
      .eq('user_id', user.id)
      .order('achieved_at', { ascending: false })

    if (achievementsError) {
      logger.error('Error fetching achievements:', achievementsError)
    }

    // Fetch user's current tier
    const { data: currentTier, error: tierError } = await supabase
      .rpc('get_user_current_tier', { user_uuid: user.id })

    if (tierError) {
      logger.error('Error fetching current tier:', tierError)
    }

    // Format achievements
    const formattedAchievements = (achievements || []).map((achievement: unknown) => {
      const tierInfo = achievement.incentive_tiers || {}

      // Determine rarity based on tier
      let rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common'
      switch (tierInfo.tier_name) {
        case 'Bronze':
          rarity = 'common'
          break
        case 'Silver':
          rarity = 'rare'
          break
        case 'Gold':
          rarity = 'epic'
          break
        case 'Platinum':
        case 'Diamond':
          rarity = 'legendary'
          break
      }

      return {
        id: achievement.id,
        title: `${tierInfo.tier_name} Tier Achieved`,
        description: `Congratulations on reaching ${tierInfo.tier_name} tier!`,
        icon: tierInfo.tier_icon || '🏆',
        earned_at: achievement.achieved_at,
        rarity
      }
    })

    return NextResponse.json({
      success: true,
      achievements: formattedAchievements,
      currentTier: currentTier ? currentTier[0] : null,
    })
  } catch (error) {
    logger.error('Error in GET /api/incentives/gamification/achievements', error instanceof Error ? error : undefined)
    return NextResponse.json({ success: false, error: 'Failed to fetch achievements' }, { status: 500 })
  }
}
