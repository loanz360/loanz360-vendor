import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cro/leaderboard?period=today|week|month
 * Live team leaderboard with calls, conversions, AI scores, and gamification levels.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const period = request.nextUrl.searchParams.get('period') || 'today'

    // Calculate date range
    const now = new Date()
    let fromDate: Date
    switch (period) {
      case 'week':
        fromDate = new Date(now)
        fromDate.setDate(now.getDate() - 7)
        break
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'today':
      default:
        fromDate = new Date(now)
        fromDate.setHours(0, 0, 0, 0)
        break
    }

    const fromISO = fromDate.toISOString()

    // Get all CROs with employee profiles
    const { data: croUsers } = await supabase
      .from('employee_profile')
      .select('user_id')
      .eq('sub_role', 'CRO')
      .eq('is_active', true)

    if (!croUsers || croUsers.length === 0) {
      return NextResponse.json({ success: true, data: { leaderboard: [], currentUserRank: 0 } })
    }

    const croIds = croUsers.map(u => u.user_id)

    // Fetch data in parallel
    const [profilesResult, callLogsResult, conversionsResult, levelsResult] = await Promise.all([
      // CRO profiles
      supabase
        .from('employee_profile')
        .select('user_id, first_name, last_name, employee_id')
        .in('user_id', croIds),

      // Call logs in period
      supabase
        .from('cro_call_logs')
        .select('cro_id, call_outcome, call_duration_seconds, ai_rating')
        .in('cro_id', croIds)
        .gte('call_started_at', fromISO),

      // Conversions in period
      supabase
        .from('crm_leads')
        .select('cro_id')
        .in('cro_id', croIds)
        .eq('status', 'converted')
        .gte('updated_at', fromISO),

      // Gamification levels
      supabase
        .from('cro_level_system')
        .select('cro_id, level, xp')
        .in('cro_id', croIds),
    ])

    const profiles = new Map((profilesResult.data || []).map(p => [p.user_id, p]))
    const callLogs = callLogsResult.data || []
    const conversions = conversionsResult.data || []
    const levels = new Map((levelsResult.data || []).map(l => [l.cro_id, l]))

    // Aggregate per CRO
    const croStats = new Map<string, {
      calls: number
      connected: number
      totalDuration: number
      avgAIRating: number
      ratedCalls: number
      totalRating: number
      conversions: number
    }>()

    for (const croId of croIds) {
      croStats.set(croId, {
        calls: 0, connected: 0, totalDuration: 0,
        avgAIRating: 0, ratedCalls: 0, totalRating: 0,
        conversions: 0,
      })
    }

    callLogs.forEach(log => {
      const stats = croStats.get(log.cro_id)
      if (!stats) return
      stats.calls++
      stats.totalDuration += log.call_duration_seconds || 0
      if (['connected', 'interested', 'callback_requested'].includes(log.call_outcome)) {
        stats.connected++
      }
      if (log.ai_rating) {
        stats.ratedCalls++
        stats.totalRating += log.ai_rating
      }
    })

    conversions.forEach(conv => {
      const stats = croStats.get(conv.cro_id)
      if (stats) stats.conversions++
    })

    // Build leaderboard with composite score
    const leaderboard = croIds.map(croId => {
      const stats = croStats.get(croId)!
      const profile = profiles.get(croId)
      const level = levels.get(croId)

      const avgRating = stats.ratedCalls > 0 ? stats.totalRating / stats.ratedCalls : 0

      // Composite score: calls (30%) + conversions (40%) + AI rating (30%)
      const normalizedCalls = Math.min(stats.calls / 50, 1) * 30 // 50 calls = max
      const normalizedConversions = Math.min(stats.conversions / 10, 1) * 40 // 10 conversions = max
      const normalizedRating = (avgRating / 10) * 30

      const compositeScore = Math.round(normalizedCalls + normalizedConversions + normalizedRating)

      return {
        croId,
        name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown',
        employeeId: profile?.employee_id || '',
        calls: stats.calls,
        connected: stats.connected,
        conversions: stats.conversions,
        avgAIRating: Number(avgRating.toFixed(1)),
        avgDuration: stats.calls > 0 ? Math.round(stats.totalDuration / stats.calls) : 0,
        compositeScore,
        level: level?.level || 'junior',
        xp: level?.xp || 0,
        isCurrentUser: croId === user.id,
      }
    })
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }))

    const currentUserRank = leaderboard.find(e => e.isCurrentUser)?.rank || 0

    return NextResponse.json({
      success: true,
      data: {
        period,
        leaderboard: leaderboard.slice(0, 50),
        currentUserRank,
        totalCROs: croIds.length,
      },
    })
  } catch (error) {
    apiLogger.error('Leaderboard error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
