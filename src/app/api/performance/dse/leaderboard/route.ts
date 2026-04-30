import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/performance/dse/leaderboard
 * Returns DSE leaderboard with:
 * - Organization-wide ranking (all DSEs)
 * - Location-wise ranking (DSEs in same location)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client for all queries
    const adminClient = createSupabaseAdmin()

    // Verify user is a DSE or DSM
    const { data: userProfile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userProfile || !['DIRECT_SALES_EXECUTIVE', 'DIRECT_SALES_MANAGER'].includes(userProfile.sub_role)) {
      return NextResponse.json(
        { error: 'Access denied. This endpoint is for Direct Sales roles only.' },
        { status: 403 }
      )
    }

    // Get current month and year
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Fetch DSE users
    const { data: dseUsers, error: usersError } = await adminClient
      .from('users')
      .select('id, full_name, avatar_url')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (usersError) {
      apiLogger.error('Error fetching DSE users', usersError)
      return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
    }

    if (!dseUsers || dseUsers.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        locationLeaderboard: [],
        currentUserRank: 0,
        currentUserLocationRank: 0,
        totalEmployees: 0,
      })
    }

    const userIds = dseUsers.map((u) => u.id)

    // Fetch profiles for location and employee_id data
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('user_id, location, employee_id')
      .in('user_id', userIds)

    // Build location and employee_id maps
    const locationMap: Record<string, string> = {}
    const employeeIdMap: Record<string, string> = {}
    for (const p of profiles || []) {
      if (p.user_id && p.location) {
        locationMap[p.user_id] = p.location
      }
      if (p.user_id && p.employee_id) {
        employeeIdMap[p.user_id] = p.employee_id
      }
    }

    // Fetch monthly summaries for all DSEs — try user_id first (old schema), then dse_user_id (new schema)
    let monthlySummaries: unknown[] = []

    const { data: ms1, error: ms1Err } = await adminClient
      .from('dse_monthly_summary')
      .select('*')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .in('user_id', userIds)

    if (!ms1Err && ms1 && ms1.length > 0) {
      monthlySummaries = ms1
    } else {
      const { data: ms2, error: ms2Err } = await adminClient
        .from('dse_monthly_summary')
        .select('*')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .in('dse_user_id', userIds)

      if (ms2Err) {
        apiLogger.error('Error fetching DSE monthly summaries', ms2Err)
      }
      monthlySummaries = ms2 || []
    }

    // Build leaderboard entries — handle both old and new column names
    const allEntries: LeaderboardEntry[] = dseUsers.map((emp) => {
      const summary = monthlySummaries.find(
        (s) => s.user_id === emp.id || s.dse_user_id === emp.id
      )
      const empLocation = locationMap[emp.id] || ''

      return {
        rank: 0,
        userId: emp.id,
        name: emp.full_name,
        employeeId: employeeIdMap[emp.id] || '',
        avatar: emp.avatar_url,
        location: empLocation,
        primaryMetric: Number(summary?.total_revenue || summary?.total_converted_revenue) || 0,
        secondaryMetric: summary?.total_conversions || summary?.leads_converted || 0,
        tertiaryMetric: Number(summary?.field_conversion_rate || summary?.conversion_rate) || 0,
        trend: 'stable' as const,
        changePercentage: 0,
        isCurrentUser: emp.id === user.id,
        badge: summary?.performance_grade === 'A+' ? 'Top Performer' : undefined,
      }
    })

    // Sort org-wide leaderboard by revenue desc, then conversions
    const orgLeaderboard = [...allEntries].sort((a, b) => {
      if (b.primaryMetric !== a.primaryMetric) return b.primaryMetric - a.primaryMetric
      return (b.secondaryMetric || 0) - (a.secondaryMetric || 0)
    })
    orgLeaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1
    })

    // Find current user's location for location-wise leaderboard
    const currentUserLocation = locationMap[user.id] || ''
    let locationLeaderboard: LeaderboardEntry[] = []
    let currentUserLocationRank = 0

    if (currentUserLocation) {
      // Filter entries in the same location
      locationLeaderboard = allEntries
        .filter((e) => e.location?.toLowerCase() === currentUserLocation.toLowerCase())
        .sort((a, b) => {
          if (b.primaryMetric !== a.primaryMetric) return b.primaryMetric - a.primaryMetric
          return (b.secondaryMetric || 0) - (a.secondaryMetric || 0)
        })
        .map((entry, idx) => ({
          ...entry,
          rank: idx + 1,
        }))

      currentUserLocationRank = locationLeaderboard.find((e) => e.userId === user.id)?.rank || 0
    }

    // Get unique locations for summary
    const locationCounts: Record<string, number> = {}
    for (const entry of allEntries) {
      const loc = entry.location || 'Unknown'
      locationCounts[loc] = (locationCounts[loc] || 0) + 1
    }

    const currentUserOrgRank = orgLeaderboard.find((e) => e.userId === user.id)?.rank || 0

    return NextResponse.json({
      leaderboard: orgLeaderboard,
      locationLeaderboard,
      currentUserRank: currentUserOrgRank,
      currentUserLocationRank,
      currentUserLocation,
      totalEmployees: orgLeaderboard.length,
      totalInLocation: locationLeaderboard.length,
      locationSummary: locationCounts,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DSE leaderboard API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
