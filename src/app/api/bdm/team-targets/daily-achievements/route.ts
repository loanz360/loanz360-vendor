export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/bdm/team-targets/daily-achievements
// List all daily achievements with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const bdeUserId = searchParams.get('bdeUserId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '30')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('bde_daily_achievements')
      .select(`
        *,
        bde:profiles!bde_user_id (
          id,
          full_name,
          email
        )
      `)
      .order('achievement_date', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (bdeUserId) {
      query = query.eq('bde_user_id', bdeUserId)
    }

    if (startDate) {
      query = query.gte('achievement_date', startDate)
    }

    if (endDate) {
      query = query.lte('achievement_date', endDate)
    }

    const { data: achievements, error } = await query

    if (error) throw error

    // Calculate team summary
    const { data: teamSummary } = await supabase
      .from('bde_daily_achievements')
      .select('mtd_leads_contacted, mtd_conversions, mtd_revenue, current_streak')
      .gte('achievement_date', startDate || new Date(new Date().setDate(1)).toISOString().split('T')[0])

    const summary = {
      totalLeadsContacted: teamSummary?.reduce((sum, a) => sum + (a.mtd_leads_contacted || 0), 0) || 0,
      totalConversions: teamSummary?.reduce((sum, a) => sum + (a.mtd_conversions || 0), 0) || 0,
      totalRevenue: teamSummary?.reduce((sum, a) => sum + (a.mtd_revenue || 0), 0) || 0,
      avgStreak: teamSummary && teamSummary.length > 0
        ? teamSummary.reduce((sum, a) => sum + (a.current_streak || 0), 0) / teamSummary.length
        : 0,
      activeBDEs: new Set(achievements?.map(a => a.bde_user_id)).size || 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        achievements: achievements || [],
        summary,
        pagination: {
          limit,
          offset,
          total: achievements?.length || 0,
        },
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching daily achievements', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/bdm/team-targets/daily-achievements
// Record daily achievement
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      bdeUserId,
      achievementDate,
      leadsContacted,
      conversions,
      revenue,
      callsMade,
      emailsSent,
      meetingsHeld,
    } = body

    // Validate required fields
    if (!bdeUserId || !achievementDate) {
      return NextResponse.json(
        { error: 'Missing required fields: bdeUserId, achievementDate' },
        { status: 400 }
      )
    }

    // Get previous day's achievement to calculate streak
    const previousDate = new Date(achievementDate)
    previousDate.setDate(previousDate.getDate() - 1)

    const { data: previousAchievement } = await supabase
      .from('bde_daily_achievements')
      .select('current_streak, longest_streak')
      .eq('bde_user_id', bdeUserId)
      .eq('achievement_date', previousDate.toISOString().split('T')[0])
      .maybeSingle()

    // Calculate new streak
    let currentStreak = 1
    let longestStreak = 1

    if (previousAchievement) {
      currentStreak = (previousAchievement.current_streak || 0) + 1
      longestStreak = Math.max(currentStreak, previousAchievement.longest_streak || 0)
    }

    // Get MTD totals
    const startOfMonth = new Date(achievementDate)
    startOfMonth.setDate(1)

    const { data: mtdAchievements } = await supabase
      .from('bde_daily_achievements')
      .select('leads_contacted, conversions, revenue')
      .eq('bde_user_id', bdeUserId)
      .gte('achievement_date', startOfMonth.toISOString().split('T')[0])
      .lt('achievement_date', achievementDate)

    const mtdLeadsContacted = (mtdAchievements?.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) || 0) + (leadsContacted || 0)
    const mtdConversions = (mtdAchievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0) + (conversions || 0)
    const mtdRevenue = (mtdAchievements?.reduce((sum, a) => sum + (a.revenue || 0), 0) || 0) + (revenue || 0)

    // Insert or update achievement
    const { data: achievement, error } = await supabase
      .from('bde_daily_achievements')
      .upsert({
        bde_user_id: bdeUserId,
        achievement_date: achievementDate,
        leads_contacted: leadsContacted || 0,
        conversions: conversions || 0,
        revenue: revenue || 0,
        mtd_leads_contacted: mtdLeadsContacted,
        mtd_conversions: mtdConversions,
        mtd_revenue: mtdRevenue,
        calls_made: callsMade || 0,
        emails_sent: emailsSent || 0,
        meetings_held: meetingsHeld || 0,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'bde_user_id,achievement_date'
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // Check if any badges should be awarded based on this achievement
    // This would trigger badge auto-award logic (implemented separately)

    return NextResponse.json({
      success: true,
      data: achievement,
      message: 'Daily achievement recorded successfully',
    })
  } catch (error: unknown) {
    apiLogger.error('Error recording daily achievement', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
