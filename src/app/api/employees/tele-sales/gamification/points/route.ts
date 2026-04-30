
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TS_LEVEL_DEFINITIONS, TS_POINTS_CONFIG } from '@/lib/types/telesales-gamification.types'
import type { TSPointsCategory } from '@/lib/types/telesales-gamification.types'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// POST - Award points to user
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const {
      category,
      reference_type,
      reference_id,
      description,
      custom_points
    } = body as {
      category: TSPointsCategory
      reference_type?: string
      reference_id?: string
      description?: string
      custom_points?: number
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 })
    }

    // Calculate points to award
    let pointsToAward = custom_points || 0

    if (!custom_points) {
      switch (category) {
        case 'CALL_COMPLETED':
          pointsToAward = TS_POINTS_CONFIG.CALL_COMPLETED
          break
        case 'CALL_CONNECTED':
          pointsToAward = TS_POINTS_CONFIG.CALL_CONNECTED
          break
        case 'CONVERSION':
          pointsToAward = TS_POINTS_CONFIG.CONVERSION
          break
        case 'FIRST_CALL_OF_DAY':
          pointsToAward = TS_POINTS_CONFIG.FIRST_CALL_OF_DAY
          break
        case 'TARGET_ACHIEVED':
          pointsToAward = TS_POINTS_CONFIG.TARGET_ACHIEVED
          break
        case 'QUALITY_BONUS':
          pointsToAward = TS_POINTS_CONFIG.QUALITY_BONUS_PER_POINT
          break
        default:
          pointsToAward = 5
      }
    }

    // Get current user points
    let { data: userPoints, error: fetchError } = await supabase
      .from('ts_user_points')
      .select('*')
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    // Create user points record if doesn't exist
    if (!userPoints) {
      const { data: newPoints, error: createError } = await supabase
        .from('ts_user_points')
        .insert({
          sales_executive_id: user.id,
          current_points: 0,
          lifetime_points: 0,
          current_level: 1,
          level_name: 'Rookie',
          points_to_next_level: 500
        })
        .select()
        .maybeSingle()

      if (createError) throw createError
      userPoints = newPoints
    }

    const newBalance = (userPoints?.current_points || 0) + pointsToAward
    const newLifetime = (userPoints?.lifetime_points || 0) + pointsToAward

    // Check for level up
    let newLevel = userPoints?.current_level || 1
    let newLevelName = userPoints?.level_name || 'Rookie'
    let levelUp = false

    for (const level of TS_LEVEL_DEFINITIONS) {
      if (newLifetime >= level.min_points && level.level > newLevel) {
        newLevel = level.level
        newLevelName = level.name
        levelUp = true
      }
    }

    // Calculate points to next level
    const nextLevelDef = TS_LEVEL_DEFINITIONS.find(l => l.level === newLevel + 1)
    const pointsToNextLevel = nextLevelDef ? nextLevelDef.min_points - newLifetime : 0

    // Update streak
    const today = new Date().toISOString().split('T')[0]
    const lastActivity = userPoints?.last_activity_date
    let newStreak = userPoints?.current_streak_days || 0

    if (lastActivity !== today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (lastActivity === yesterdayStr) {
        newStreak += 1
      } else {
        newStreak = 1
      }
    }

    const longestStreak = Math.max(newStreak, userPoints?.longest_streak_days || 0)

    // Update call/conversion counts
    let totalCalls = userPoints?.total_calls_made || 0
    let totalConversions = userPoints?.total_conversions || 0

    if (category === 'CALL_COMPLETED' || category === 'CALL_CONNECTED') {
      totalCalls += 1
    }
    if (category === 'CONVERSION') {
      totalConversions += 1
    }

    // Create points transaction
    const { error: transactionError } = await supabase
      .from('ts_points_transactions')
      .insert({
        sales_executive_id: user.id,
        points: pointsToAward,
        transaction_type: 'EARNED',
        category,
        reference_type,
        reference_id,
        description: description || `Earned ${pointsToAward} points for ${category.toLowerCase().replace(/_/g, ' ')}`,
        balance_after: newBalance
      })

    if (transactionError) {
      apiLogger.error('Transaction insert error', transactionError)
    }

    // Update user points
    const { error: updateError } = await supabase
      .from('ts_user_points')
      .update({
        current_points: newBalance,
        lifetime_points: newLifetime,
        current_level: newLevel,
        level_name: newLevelName,
        points_to_next_level: pointsToNextLevel,
        current_streak_days: newStreak,
        longest_streak_days: longestStreak,
        last_activity_date: today,
        total_calls_made: totalCalls,
        total_conversions: totalConversions
      })
      .eq('sales_executive_id', user.id)

    if (updateError) throw updateError

    // Check for badge unlocks
    const badgesEarned = await checkAndAwardBadges(supabase, user.id, {
      totalCalls,
      totalConversions,
      currentStreak: newStreak,
      lifetimePoints: newLifetime
    })

    // Add level up bonus if leveled up
    if (levelUp) {
      const levelUpBonus = newLevel * 50
      await supabase
        .from('ts_points_transactions')
        .insert({
          sales_executive_id: user.id,
          points: levelUpBonus,
          transaction_type: 'BONUS',
          category: 'ACHIEVEMENT_UNLOCKED',
          description: `Level up bonus! Reached ${newLevelName}`,
          balance_after: newBalance + levelUpBonus
        })

      await supabase
        .from('ts_user_points')
        .update({
          current_points: newBalance + levelUpBonus,
          lifetime_points: newLifetime + levelUpBonus
        })
        .eq('sales_executive_id', user.id)
    }

    return NextResponse.json({
      success: true,
      data: {
        points_awarded: pointsToAward,
        new_balance: newBalance,
        level_up: levelUp,
        new_level: levelUp ? newLevel : undefined,
        new_level_name: levelUp ? newLevelName : undefined,
        badges_earned: badgesEarned,
        streak: newStreak
      }
    })
  } catch (error) {
    apiLogger.error('Award points error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to award points' },
      { status: 500 }
    )
  }
}

// Helper function to check and award badges
async function checkAndAwardBadges(
  supabase: any,
  userId: string,
  stats: {
    totalCalls: number
    totalConversions: number
    currentStreak: number
    lifetimePoints: number
  }
) {
  const badgesEarned: any[] = []

  try {
    // Get all badges not yet earned
    const { data: earnedBadgeIds } = await supabase
      .from('ts_user_badges')
      .select('badge_id')
      .eq('sales_executive_id', userId)

    const earnedIds = new Set((earnedBadgeIds || []).map((b: any) => b.badge_id))

    const { data: allBadges } = await supabase
      .from('ts_badges')
      .select('*')
      .eq('is_active', true)

    for (const badge of allBadges || []) {
      if (earnedIds.has(badge.id)) continue

      let qualified = false

      switch (badge.category) {
        case 'CALLS':
          qualified = stats.totalCalls >= badge.requirement_value
          break
        case 'CONVERSIONS':
          qualified = stats.totalConversions >= badge.requirement_value
          break
        case 'STREAKS':
          qualified = stats.currentStreak >= badge.requirement_value
          break
      }

      if (qualified) {
        const { data: newBadge, error } = await supabase
          .from('ts_user_badges')
          .insert({
            sales_executive_id: userId,
            badge_id: badge.id,
            progress_value: badge.requirement_value
          })
          .select(`*, badge:ts_badges(*)`)
          .maybeSingle()

        if (!error && newBadge) {
          badgesEarned.push(newBadge.badge)

          // Award badge points
          if (badge.points_reward > 0) {
            await supabase
              .from('ts_points_transactions')
              .insert({
                sales_executive_id: userId,
                points: badge.points_reward,
                transaction_type: 'BONUS',
                category: 'ACHIEVEMENT_UNLOCKED',
                reference_type: 'BADGE',
                reference_id: badge.id,
                description: `Unlocked badge: ${badge.name}`,
                balance_after: stats.lifetimePoints + badge.points_reward
              })

            // Update total badges count
            await supabase
              .from('ts_user_points')
              .update({
                total_badges_earned: supabase.sql`total_badges_earned + 1`,
                current_points: supabase.sql`current_points + ${badge.points_reward}`,
                lifetime_points: supabase.sql`lifetime_points + ${badge.points_reward}`
              })
              .eq('sales_executive_id', userId)
          }
        }
      }
    }
  } catch (error) {
    apiLogger.error('Badge check error', error)
  }

  return badgesEarned
}

// GET - Get points history
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: transactions, error, count } = await supabase
      .from('ts_points_transactions')
      .select('*', { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    })
  } catch (error) {
    apiLogger.error('Points history error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch points history' },
      { status: 500 }
    )
  }
}
