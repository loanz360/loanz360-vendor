export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get leaderboard data
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

    const period = searchParams.get('period') || 'WEEKLY'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    // Calculate period dates
    const today = new Date()
    let periodStart: Date
    let periodEnd: Date

    switch (period) {
      case 'DAILY':
        periodStart = new Date(today)
        periodStart.setHours(0, 0, 0, 0)
        periodEnd = new Date(today)
        periodEnd.setHours(23, 59, 59, 999)
        break
      case 'WEEKLY':
        periodStart = new Date(today)
        periodStart.setDate(today.getDate() - today.getDay())
        periodStart.setHours(0, 0, 0, 0)
        periodEnd = new Date(periodStart)
        periodEnd.setDate(periodStart.getDate() + 6)
        periodEnd.setHours(23, 59, 59, 999)
        break
      case 'MONTHLY':
        periodStart = new Date(today.getFullYear(), today.getMonth(), 1)
        periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        periodEnd.setHours(23, 59, 59, 999)
        break
      case 'ALL_TIME':
      default:
        periodStart = new Date('2020-01-01')
        periodEnd = today
        break
    }

    // Get leaderboard data by aggregating user points
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('ts_user_points')
      .select(`
        sales_executive_id,
        current_points,
        lifetime_points,
        current_level,
        level_name,
        current_streak_days,
        total_calls_made,
        total_conversions,
        total_badges_earned,
        weekly_rank,
        monthly_rank,
        all_time_rank
      `)
      .order('lifetime_points', { ascending: false })
      .limit(limit)

    if (leaderboardError) {
      apiLogger.error('Leaderboard query error', leaderboardError)
      throw leaderboardError
    }

    // Get user names from users table
    const userIds = (leaderboardData || []).map(entry => entry.sales_executive_id)

    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, profile_image')
      .in('id', userIds)

    const usersMap = new Map((usersData || []).map(u => [u.id, u]))

    // Build leaderboard entries
    const rankings = (leaderboardData || []).map((entry, index) => {
      const userData = usersMap.get(entry.sales_executive_id)
      const connectRate = entry.total_calls_made > 0
        ? Math.round((entry.total_conversions / entry.total_calls_made) * 100)
        : 0

      return {
        rank: index + 1,
        user_id: entry.sales_executive_id,
        user_name: userData?.full_name || 'Unknown User',
        user_avatar: userData?.profile_image,
        level: entry.current_level,
        level_name: entry.level_name,
        points: period === 'ALL_TIME' ? entry.lifetime_points : entry.current_points,
        calls_completed: entry.total_calls_made,
        conversions: entry.total_conversions,
        connect_rate: connectRate,
        badges_count: entry.total_badges_earned,
        streak_days: entry.current_streak_days
      }
    })

    // Find current user's position
    const userPosition = rankings.find(r => r.user_id === user.id)

    // If user not in top list, get their actual rank
    let userRank = userPosition
    if (!userPosition) {
      const { data: userData } = await supabase
        .from('ts_user_points')
        .select('*')
        .eq('sales_executive_id', user.id)
        .maybeSingle()

      if (userData) {
        const { data: userDetails } = await supabase
          .from('users')
          .select('full_name, profile_image')
          .eq('id', user.id)
          .maybeSingle()

        // Count users with more points
        const { count } = await supabase
          .from('ts_user_points')
          .select('*', { count: 'exact', head: true })
          .gt('lifetime_points', userData.lifetime_points)

        userRank = {
          rank: (count || 0) + 1,
          user_id: user.id,
          user_name: userDetails?.full_name || 'You',
          user_avatar: userDetails?.profile_image,
          level: userData.current_level,
          level_name: userData.level_name,
          points: period === 'ALL_TIME' ? userData.lifetime_points : userData.current_points,
          calls_completed: userData.total_calls_made,
          conversions: userData.total_conversions,
          connect_rate: userData.total_calls_made > 0
            ? Math.round((userData.total_conversions / userData.total_calls_made) * 100)
            : 0,
          badges_count: userData.total_badges_earned,
          streak_days: userData.current_streak_days
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        leaderboard: {
          period_type: period,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          rankings,
          total_participants: rankings.length,
          last_calculated: new Date().toISOString()
        },
        user_position: userRank
      }
    })
  } catch (error) {
    apiLogger.error('Leaderboard error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
