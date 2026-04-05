export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/bdm/team-targets/daily-achievements/[date]
// Get specific date achievements with team summary
export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { date } = params

    // Get all achievements for this date
    const { data: achievements, error } = await supabase
      .from('bde_daily_achievements')
      .select(`
        *,
        bde:profiles!bde_user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('achievement_date', date)
      .order('leads_contacted', { ascending: false })

    if (error) throw error

    // Calculate team summary for this date
    const summary = {
      totalLeads: achievements?.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) || 0,
      totalConversions: achievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0,
      totalRevenue: achievements?.reduce((sum, a) => sum + (a.revenue || 0), 0) || 0,
      totalCalls: achievements?.reduce((sum, a) => sum + (a.calls_made || 0), 0) || 0,
      totalEmails: achievements?.reduce((sum, a) => sum + (a.emails_sent || 0), 0) || 0,
      totalMeetings: achievements?.reduce((sum, a) => sum + (a.meetings_held || 0), 0) || 0,
      activeBDEs: achievements?.length || 0,
      avgLeadsPerBDE: achievements && achievements.length > 0
        ? achievements.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) / achievements.length
        : 0,
    }

    // Get top performers
    const topPerformers = {
      mostLeads: achievements && achievements.length > 0 ? achievements[0] : null,
      mostConversions: achievements
        ? [...achievements].sort((a, b) => (b.conversions || 0) - (a.conversions || 0))[0]
        : null,
      mostRevenue: achievements
        ? [...achievements].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0]
        : null,
    }

    return NextResponse.json({
      success: true,
      data: {
        date,
        achievements: achievements || [],
        summary,
        topPerformers,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching date achievements', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
