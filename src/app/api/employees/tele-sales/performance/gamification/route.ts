import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeLeaderboard = searchParams.get('leaderboard') === 'true'
    const includeBadges = searchParams.get('badges') === 'true'
    const includeChallenges = searchParams.get('challenges') === 'true'

    // Get user's gamification profile
    const { data: profile, error: profileError } = await supabase
      .from('ts_gamification_profiles')
      .select('*')
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      apiLogger.error('Error fetching gamification profile', profileError)
      return NextResponse.json({ success: false, error: 'Failed to fetch gamification profile' }, { status: 500 })
    }

    const result: Record<string, unknown> = {
      profile: profile || {
        total_points: 0,
        current_level: 1,
        current_streak: 0,
        longest_streak: 0,
        badges_earned: 0
      }
    }

    // Get user's badges if requested
    if (includeBadges) {
      const { data: badges, error: badgesError } = await supabase
        .from('ts_earned_badges')
        .select(`
          *,
          badge:ts_badges(*)
        `)
        .eq('sales_executive_id', user.id)
        .order('earned_at', { ascending: false })

      if (badgesError) {
        apiLogger.error('Error fetching badges', badgesError)
      } else {
        result.badges = badges || []
      }
    }

    // Get active challenges if requested
    if (includeChallenges) {
      const now = new Date().toISOString()
      const { data: challenges, error: challengesError } = await supabase
        .from('ts_challenges')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)

      if (challengesError) {
        apiLogger.error('Error fetching challenges', challengesError)
      } else {
        // Get user's progress for each challenge
        const challengeIds = challenges?.map(c => c.id) || []
        if (challengeIds.length > 0) {
          const { data: progress } = await supabase
            .from('ts_challenge_participants')
            .select('*')
            .eq('sales_executive_id', user.id)
            .in('challenge_id', challengeIds)

          const progressMap = new Map(progress?.map(p => [p.challenge_id, p]) || [])
          result.challenges = challenges?.map(c => ({
            ...c,
            userProgress: progressMap.get(c.id) || null
          })) || []
        } else {
          result.challenges = []
        }
      }
    }

    // Get leaderboard if requested
    if (includeLeaderboard) {
      const { data: leaderboard, error: leaderboardError } = await supabase
        .from('ts_gamification_profiles')
        .select(`
          sales_executive_id,
          total_points,
          current_level,
          current_streak
        `)
        .order('total_points', { ascending: false })
        .limit(10)

      if (leaderboardError) {
        apiLogger.error('Error fetching leaderboard', leaderboardError)
      } else {
        // Find user's rank
        const userRank = leaderboard?.findIndex(l => l.sales_executive_id === user.id) ?? -1
        result.leaderboard = {
          top10: leaderboard || [],
          userRank: userRank >= 0 ? userRank + 1 : null
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    apiLogger.error('Error fetching gamification data', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch gamification data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      points: z.string().optional(),


      reason: z.string().optional(),


      metadata: z.record(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action, points, reason, metadata } = body

    if (action === 'add_points') {
      // Record points transaction
      const { error: transactionError } = await supabase
        .from('ts_points_transactions')
        .insert({
          sales_executive_id: user.id,
          points: points,
          transaction_type: 'earned',
          reason: reason,
          metadata: metadata || {}
        })

      if (transactionError) {
        apiLogger.error('Error recording points transaction', transactionError)
        return NextResponse.json({ success: false, error: 'Failed to record points' }, { status: 500 })
      }

      // Update profile total points
      const { data: profile } = await supabase
        .from('ts_gamification_profiles')
        .select('total_points, current_level')
        .eq('sales_executive_id', user.id)
        .maybeSingle()

      const newTotal = (profile?.total_points || 0) + points
      const newLevel = Math.floor(newTotal / 1000) + 1 // Simple leveling: 1000 points per level

      const { data: updatedProfile, error: updateError } = await supabase
        .from('ts_gamification_profiles')
        .upsert({
          sales_executive_id: user.id,
          total_points: newTotal,
          current_level: Math.max(profile?.current_level || 1, newLevel),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'sales_executive_id'
        })
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Error updating profile', updateError)
        return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        pointsAdded: points,
        newTotal: updatedProfile?.total_points,
        levelUp: newLevel > (profile?.current_level || 1)
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Error processing gamification action', error)
    return NextResponse.json({ success: false, error: 'Failed to process action' }, { status: 500 })
  }
}
