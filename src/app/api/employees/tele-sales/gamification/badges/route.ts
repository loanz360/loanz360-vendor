
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get all badges and user's earned badges
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active badges
    const { data: allBadges, error: badgesError } = await supabase
      .from('ts_badges')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('requirement_value', { ascending: true })

    if (badgesError) throw badgesError

    // Get user's earned badges
    const { data: earnedBadges, error: earnedError } = await supabase
      .from('ts_user_badges')
      .select(`
        *,
        badge:ts_badges(*)
      `)
      .eq('sales_executive_id', user.id)
      .order('earned_at', { ascending: false })

    if (earnedError) throw earnedError

    // Get user stats for progress calculation
    const { data: userPoints } = await supabase
      .from('ts_user_points')
      .select('total_calls_made, total_conversions, longest_streak_days')
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    // Calculate progress for each badge
    const earnedBadgeIds = new Set((earnedBadges || []).map(b => b.badge_id))

    const badgeProgress = (allBadges || [])
      .filter(badge => !earnedBadgeIds.has(badge.id) && !badge.is_hidden)
      .map(badge => {
        let current = 0

        switch (badge.category) {
          case 'CALLS':
            current = userPoints?.total_calls_made || 0
            break
          case 'CONVERSIONS':
            current = userPoints?.total_conversions || 0
            break
          case 'STREAKS':
            current = userPoints?.longest_streak_days || 0
            break
        }

        return {
          badge_id: badge.id,
          badge_name: badge.name,
          badge_icon: badge.icon,
          badge_tier: badge.tier,
          badge_rarity: badge.rarity,
          category: badge.category,
          current,
          target: badge.requirement_value,
          progress_percentage: Math.min(100, Math.round((current / badge.requirement_value) * 100)),
          points_reward: badge.points_reward
        }
      })
      .sort((a, b) => b.progress_percentage - a.progress_percentage) // Show closest to completion first

    // Group badges by category
    const badgesByCategory = (allBadges || []).reduce((acc: any, badge) => {
      if (!acc[badge.category]) {
        acc[badge.category] = []
      }
      acc[badge.category].push({
        ...badge,
        is_earned: earnedBadgeIds.has(badge.id),
        earned_at: earnedBadges?.find(e => e.badge_id === badge.id)?.earned_at
      })
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        earned: earnedBadges || [],
        available: allBadges?.filter(b => !b.is_hidden) || [],
        progress: badgeProgress,
        by_category: badgesByCategory,
        total_earned: earnedBadges?.length || 0,
        total_available: allBadges?.filter(b => !b.is_hidden).length || 0
      }
    })
  } catch (error) {
    apiLogger.error('Badges error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch badges' },
      { status: 500 }
    )
  }
}

// PUT - Toggle badge display on profile
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { badge_id, is_displayed } = body

    if (!badge_id) {
      return NextResponse.json({ success: false, error: 'Badge ID is required' }, { status: 400 })
    }

    // Update badge display status
    const { data, error } = await supabase
      .from('ts_user_badges')
      .update({ is_displayed })
      .eq('sales_executive_id', user.id)
      .eq('badge_id', badge_id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    apiLogger.error('Badge update error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update badge' },
      { status: 500 }
    )
  }
}
