import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Direct Sales Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'DIRECT_SALES_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get team members (Direct Sales Executives reporting to this manager)
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, email, phone, location, avatar_url')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('reporting_manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    const leaderboard = (teamMembers || []).map((member, index) => {
      return {
        id: member.id,
        name: member.full_name || 'Unknown',
        email: member.email || '',
        phone: member.phone || 'N/A',
        location: member.location || 'Not specified',
        avatar: member.avatar_url,
        rank: index + 1,
        dealsCompleted: 0,
        revenue: 0,
        conversionRate: 0,
        targetAchievement: 0,
        trend: 'stable',
        lastMonthRank: index + 1,
      }
    })

    // Sort by revenue (or your preferred metric)
    leaderboard.sort((a, b) => b.revenue - a.revenue)

    // Update ranks after sorting
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1
    })

    return NextResponse.json({ leaderboard })
  } catch (error: unknown) {
    apiLogger.error('Error in leaderboard API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
