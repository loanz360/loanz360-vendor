import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/** Get IST date string (YYYY-MM-DD) */
function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

/** Get first day of a month */
function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Get last day of a month */
function monthEnd(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/** Get days in a month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Previous month/year */
function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/**
 * GET /api/employees/accounts-manager/scorecards
 * Returns detailed performance scorecards for each AE team member
 * Query params: month (1-12), year (YYYY)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const today = getISTDate()
    const [todayYear, todayMonth] = today.split('-').map(Number)
    const qMonth = parseInt(searchParams.get('month') || String(todayMonth))
    const qYear = parseInt(searchParams.get('year') || String(todayYear))

    if (qMonth < 1 || qMonth > 12 || qYear < 2020 || qYear > 2100) {
      return NextResponse.json({ success: false, error: 'Invalid month/year' }, { status: 400 })
    }

    const periodStart = monthStart(qYear, qMonth)
    const periodEnd = monthEnd(qYear, qMonth)
    const prev = prevMonth(qYear, qMonth)
    const prevStart = monthStart(prev.year, prev.month)
    const prevEnd = monthEnd(prev.year, prev.month)
    const totalDays = daysInMonth(qYear, qMonth)

    // Fetch team members (ACCOUNTS_EXECUTIVE)
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, email, sub_role')
      .eq('role', 'EMPLOYEE')
      .eq('sub_role', 'ACCOUNTS_EXECUTIVE')
      .eq('status', 'active')

    if (teamError) {
      logger.error('Failed to fetch team members', { error: teamError })
      return NextResponse.json({ success: false, error: 'Failed to fetch team' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { scorecards: [], teamAverage: null, month: `${qYear}-${String(qMonth).padStart(2, '0')}` }
      })
    }

    const memberIds = teamMembers.map(m => m.id)

    // Fetch all status_history entries for the period (current + previous month for trends)
    const { data: currentHistory, error: histErr } = await supabase
      .from('status_history')
      .select('application_id, old_status, new_status, changed_by, changed_at')
      .in('changed_by', memberIds)
      .gte('changed_at', `${prevStart}T00:00:00+05:30`)
      .lte('changed_at', `${periodEnd}T23:59:59+05:30`)

    if (histErr) {
      logger.error('Failed to fetch status history', { error: histErr })
      return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 })
    }

    const history = currentHistory || []

    // Build per-member metrics
    const scorecardData = memberIds.map(memberId => {
      const member = teamMembers.find(m => m.id === memberId)!

      // Filter history for this member
      const memberHistory = history.filter(h => h.changed_by === memberId)

      // --- CURRENT MONTH ---
      const currentEntries = memberHistory.filter(h => {
        const d = h.changed_at?.substring(0, 10) || ''
        return d >= periodStart && d <= periodEnd
      })

      // Volume: transitions to ACCOUNTS_VERIFIED
      const verifiedCurrent = currentEntries.filter(
        h => h.new_status === 'ACCOUNTS_VERIFIED'
      )
      const volumeCurrent = verifiedCurrent.length

      // Speed: avg time from ACCOUNTS_VERIFICATION to ACCOUNTS_VERIFIED per application
      const verificationStarts = currentEntries.filter(
        h => h.new_status === 'ACCOUNTS_VERIFICATION'
      )
      const speedTimes: number[] = []
      for (const ver of verifiedCurrent) {
        // Find matching start for same application
        const start = verificationStarts.find(
          s => s.application_id === ver.application_id && s.changed_at < ver.changed_at
        )
        if (start) {
          const diff = new Date(ver.changed_at).getTime() - new Date(start.changed_at).getTime()
          const hours = diff / (1000 * 60 * 60)
          if (hours > 0 && hours < 720) { // cap at 30 days
            speedTimes.push(hours)
          }
        }
      }
      const avgSpeedCurrent = speedTimes.length > 0
        ? speedTimes.reduce((a, b) => a + b, 0) / speedTimes.length
        : 0

      // Accuracy: % of verified NOT later rejected
      const rejectedApps = new Set(
        currentEntries
          .filter(h => h.new_status === 'REJECTED' || h.new_status === 'ACCOUNTS_REJECTED')
          .map(h => h.application_id)
      )
      const verifiedApps = verifiedCurrent.map(h => h.application_id)
      const rejectedAfterVerify = verifiedApps.filter(appId => rejectedApps.has(appId)).length
      const accuracyCurrent = verifiedApps.length > 0
        ? ((verifiedApps.length - rejectedAfterVerify) / verifiedApps.length) * 100
        : 100

      // Consistency: std dev of daily verification counts
      const dailyCounts: number[] = Array(totalDays).fill(0)
      for (const ver of verifiedCurrent) {
        const day = parseInt(ver.changed_at?.substring(8, 10) || '0')
        if (day >= 1 && day <= totalDays) {
          dailyCounts[day - 1]++
        }
      }
      const mean = volumeCurrent / totalDays
      const variance = dailyCounts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / totalDays
      const stdDev = Math.sqrt(variance)

      // --- PREVIOUS MONTH ---
      const prevEntries = memberHistory.filter(h => {
        const d = h.changed_at?.substring(0, 10) || ''
        return d >= prevStart && d <= prevEnd
      })

      const verifiedPrev = prevEntries.filter(h => h.new_status === 'ACCOUNTS_VERIFIED')
      const volumePrev = verifiedPrev.length

      const verificationStartsPrev = prevEntries.filter(h => h.new_status === 'ACCOUNTS_VERIFICATION')
      const speedTimesPrev: number[] = []
      for (const ver of verifiedPrev) {
        const start = verificationStartsPrev.find(
          s => s.application_id === ver.application_id && s.changed_at < ver.changed_at
        )
        if (start) {
          const diff = new Date(ver.changed_at).getTime() - new Date(start.changed_at).getTime()
          const hours = diff / (1000 * 60 * 60)
          if (hours > 0 && hours < 720) speedTimesPrev.push(hours)
        }
      }
      const avgSpeedPrev = speedTimesPrev.length > 0
        ? speedTimesPrev.reduce((a, b) => a + b, 0) / speedTimesPrev.length
        : 0

      const rejectedAppsPrev = new Set(
        prevEntries
          .filter(h => h.new_status === 'REJECTED' || h.new_status === 'ACCOUNTS_REJECTED')
          .map(h => h.application_id)
      )
      const verifiedAppsPrev = verifiedPrev.map(h => h.application_id)
      const rejectedAfterVerifyPrev = verifiedAppsPrev.filter(appId => rejectedAppsPrev.has(appId)).length
      const accuracyPrev = verifiedAppsPrev.length > 0
        ? ((verifiedAppsPrev.length - rejectedAfterVerifyPrev) / verifiedAppsPrev.length) * 100
        : 100

      const prevTotalDays = daysInMonth(prev.year, prev.month)
      const dailyCountsPrev: number[] = Array(prevTotalDays).fill(0)
      for (const ver of verifiedPrev) {
        const day = parseInt(ver.changed_at?.substring(8, 10) || '0')
        if (day >= 1 && day <= prevTotalDays) dailyCountsPrev[day - 1]++
      }
      const meanPrev = volumePrev / prevTotalDays
      const variancePrev = dailyCountsPrev.reduce((sum, c) => sum + Math.pow(c - meanPrev, 2), 0) / prevTotalDays
      const stdDevPrev = Math.sqrt(variancePrev)

      return {
        member_id: memberId,
        name: member.full_name || member.email,
        email: member.email,
        volumeCurrent,
        volumePrev,
        avgSpeedCurrent,
        avgSpeedPrev,
        accuracyCurrent,
        accuracyPrev,
        stdDev,
        stdDevPrev,
        dailyCounts,
      }
    })

    // Calculate max volume for normalization
    const maxVolume = Math.max(1, ...scorecardData.map(s => s.volumeCurrent))

    // Score each member
    const scored = scorecardData.map(s => {
      // Volume score (0-100): based on proportion of max
      const volumeScore = Math.min(100, (s.volumeCurrent / maxVolume) * 100)

      // Speed score (0-100): faster = better. Assume 2h is perfect, 48h is 0
      const speedScore = s.avgSpeedCurrent <= 0
        ? (s.volumeCurrent > 0 ? 50 : 0)
        : Math.max(0, Math.min(100, ((48 - s.avgSpeedCurrent) / 46) * 100))

      // Accuracy score (0-100): direct percentage
      const accuracyScore = s.accuracyCurrent

      // Consistency score (0-100): lower std dev = better. 0 stddev = 100, stddev of 5+ = 0
      const maxStdDev = 5
      const consistencyScore = s.volumeCurrent === 0
        ? 0
        : Math.max(0, Math.min(100, ((maxStdDev - s.stdDev) / maxStdDev) * 100))

      // Overall score: weighted
      const overallScore = Math.round(
        volumeScore * 0.30 + speedScore * 0.25 + accuracyScore * 0.30 + consistencyScore * 0.15
      )

      // Trends (current - previous)
      const volumeTrend = s.volumeCurrent - s.volumePrev
      const speedTrend = s.avgSpeedPrev > 0
        ? s.avgSpeedPrev - s.avgSpeedCurrent  // positive = improved (faster)
        : 0
      const accuracyTrend = s.accuracyCurrent - s.accuracyPrev
      const consistencyTrendVal = s.stdDevPrev - s.stdDev  // positive = improved

      // Prev overall for trend
      const volumeScorePrev = Math.min(100, (s.volumePrev / Math.max(1, maxVolume)) * 100)
      const speedScorePrev = s.avgSpeedPrev <= 0
        ? (s.volumePrev > 0 ? 50 : 0)
        : Math.max(0, Math.min(100, ((48 - s.avgSpeedPrev) / 46) * 100))
      const consistencyScorePrev = s.volumePrev === 0
        ? 0
        : Math.max(0, Math.min(100, ((maxStdDev - s.stdDevPrev) / maxStdDev) * 100))
      const overallPrev = Math.round(
        volumeScorePrev * 0.30 + speedScorePrev * 0.25 + s.accuracyPrev * 0.30 + consistencyScorePrev * 0.15
      )
      const overallTrend = overallScore - overallPrev

      return {
        member_id: s.member_id,
        name: s.name,
        email: s.email,
        rank: 0, // set after sorting
        total_members: scorecardData.length,
        volume: { value: s.volumeCurrent, max: maxVolume, score: Math.round(volumeScore), trend: volumeTrend },
        speed: { avg_hours: Math.round(s.avgSpeedCurrent * 10) / 10, score: Math.round(speedScore), trend: Math.round(speedTrend * 10) / 10 },
        accuracy: { rate: Math.round(s.accuracyCurrent * 10) / 10, score: Math.round(accuracyScore), trend: Math.round(accuracyTrend * 10) / 10 },
        consistency: { score: Math.round(consistencyScore), trend: Math.round(consistencyTrendVal * 10) / 10 },
        overall_score: overallScore,
        overall_trend: overallTrend,
        daily_counts: s.dailyCounts,
      }
    })

    // Rank by overall score
    scored.sort((a, b) => b.overall_score - a.overall_score)
    scored.forEach((s, i) => { s.rank = i + 1 })

    // Team averages
    const count = scored.length || 1
    const teamAverage = {
      volume: Math.round(scored.reduce((s, c) => s + c.volume.value, 0) / count),
      speed_hours: Math.round((scored.reduce((s, c) => s + c.speed.avg_hours, 0) / count) * 10) / 10,
      accuracy: Math.round((scored.reduce((s, c) => s + c.accuracy.rate, 0) / count) * 10) / 10,
      consistency: Math.round(scored.reduce((s, c) => s + c.consistency.score, 0) / count),
      overall_score: Math.round(scored.reduce((s, c) => s + c.overall_score, 0) / count),
    }

    return NextResponse.json({
      success: true,
      data: {
        scorecards: scored,
        teamAverage,
        month: `${qYear}-${String(qMonth).padStart(2, '0')}`,
      }
    })

  } catch (error) {
    logger.error('Scorecards API error', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
