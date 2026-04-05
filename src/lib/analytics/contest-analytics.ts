/**
 * Advanced Contest Analytics
 * Provides trends, predictions, and insights for contests
 *
 * Features:
 * - Performance trends over time
 * - Leaderboard position changes
 * - Participation growth tracking
 * - Score distribution analysis
 * - Predictive analytics for final rankings
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'

export interface ContestTrends {
  daily_participation: Array<{
    date: string
    new_participants: number
    active_participants: number
    cumulative_participants: number
  }>
  score_progression: Array<{
    date: string
    average_score: number
    median_score: number
    top_score: number
  }>
  engagement_rate: Array<{
    date: string
    engaged_percentage: number
  }>
}

export interface LeaderboardChanges {
  rank_changes: Array<{
    partner_id: string
    partner_name: string
    previous_rank: number
    current_rank: number
    rank_change: number
    rank_change_percentage: number
  }>
  new_entries: number
  dropped_out: number
}

export interface ScoreDistribution {
  ranges: Array<{
    min_score: number
    max_score: number
    count: number
    percentage: number
  }>
  percentiles: {
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
    p95: number
    p99: number
  }
}

export interface PredictiveAnalytics {
  projected_winner: {
    partner_id: string
    partner_name: string
    current_score: number
    projected_final_score: number
    confidence: number
  }
  projected_top_10: Array<{
    partner_id: string
    partner_name: string
    current_rank: number
    projected_rank: number
    confidence: number
  }>
  days_until_end: number
}

/**
 * Get contest trends over time
 */
export async function getContestTrends(contestId: string): Promise<ContestTrends> {
  const supabase = createSupabaseAdmin()

  // Get contest start and end dates
  const { data: contest } = await supabase
    .from('contests')
    .select('start_date, end_date')
    .eq('id', contestId)
    .maybeSingle()

  if (!contest) {
    throw new Error('Contest not found')
  }

  const startDate = new Date(contest.start_date)
  const endDate = new Date(contest.end_date)
  const now = new Date()
  const currentDate = now > endDate ? endDate : now

  // Generate daily participation data
  const daily_participation = []
  let cumulativeCount = 0

  for (let date = new Date(startDate); date <= currentDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0]

    // Count participants who joined on this date
    const { count: newCount } = await supabase
      .from('contest_participants')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId)
      .gte('joined_at', `${dateStr}T00:00:00Z`)
      .lt('joined_at', `${dateStr}T23:59:59Z`)

    // Count active participants (with score > 0) on this date
    const { count: activeCount } = await supabase
      .from('contest_participants')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId)
      .lte('joined_at', `${dateStr}T23:59:59Z`)
      .gt('total_score', 0)

    cumulativeCount += newCount || 0

    daily_participation.push({
      date: dateStr,
      new_participants: newCount || 0,
      active_participants: activeCount || 0,
      cumulative_participants: cumulativeCount,
    })
  }

  // Generate score progression (weekly snapshots)
  const score_progression = []
  for (let date = new Date(startDate); date <= currentDate; date.setDate(date.getDate() + 7)) {
    const dateStr = date.toISOString().split('T')[0]

    // Get score statistics for this date (from audit log or current data)
    const { data: participants } = await supabase
      .from('contest_participants')
      .select('total_score')
      .eq('contest_id', contestId)
      .lte('joined_at', `${dateStr}T23:59:59Z`)
      .gt('total_score', 0)

    if (participants && participants.length > 0) {
      const scores = participants.map((p) => p.total_score || 0).sort((a, b) => a - b)
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
      const median = scores[Math.floor(scores.length / 2)]
      const top = Math.max(...scores)

      score_progression.push({
        date: dateStr,
        average_score: Math.round(avg * 100) / 100,
        median_score: Math.round(median * 100) / 100,
        top_score: Math.round(top * 100) / 100,
      })
    }
  }

  // Calculate engagement rate over time
  const engagement_rate = []
  for (let date = new Date(startDate); date <= currentDate; date.setDate(date.getDate() + 7)) {
    const dateStr = date.toISOString().split('T')[0]

    const { count: totalCount } = await supabase
      .from('contest_participants')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId)
      .lte('joined_at', `${dateStr}T23:59:59Z`)

    const { count: activeCount } = await supabase
      .from('contest_participants')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId)
      .lte('joined_at', `${dateStr}T23:59:59Z`)
      .gt('total_score', 0)

    const engagedPercentage =
      totalCount && totalCount > 0 ? ((activeCount || 0) / totalCount) * 100 : 0

    engagement_rate.push({
      date: dateStr,
      engaged_percentage: Math.round(engagedPercentage * 100) / 100,
    })
  }

  return {
    daily_participation,
    score_progression,
    engagement_rate,
  }
}

/**
 * Get leaderboard rank changes (last 24 hours)
 */
export async function getLeaderboardChanges(contestId: string): Promise<LeaderboardChanges> {
  const supabase = createSupabaseAdmin()

  // Get current leaderboard
  const { data: currentLeaderboard } = await supabase
    .from('contest_participants')
    .select('id, partner_id, current_rank, current_score, users!inner(email)')
    .eq('contest_id', contestId)
    .order('current_rank', { ascending: true })
    .limit(50)

  // Get previous leaderboard from audit log (24 hours ago)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: auditLog } = await supabase
    .from('contest_audit_log')
    .select('new_values')
    .eq('contest_id', contestId)
    .eq('action', 'leaderboard.updated')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousLeaderboard = auditLog?.new_values || []

  // Calculate rank changes
  const rank_changes = []

  for (const current of currentLeaderboard || []) {
    const previous = previousLeaderboard.find(
      (p: any) => p.partner_id === current.partner_id
    )

    if (previous && previous.rank !== current.current_rank) {
      const rankChange = previous.rank - (current.current_rank || 0)
      const percentageChange = ((rankChange / previous.rank) * 100).toFixed(2)

      rank_changes.push({
        partner_id: current.partner_id,
        partner_name: current.users?.email || 'Unknown',
        previous_rank: previous.rank,
        current_rank: current.current_rank || 0,
        rank_change: rankChange,
        rank_change_percentage: parseFloat(percentageChange),
      })
    }
  }

  // Sort by absolute rank change
  rank_changes.sort((a, b) => Math.abs(b.rank_change) - Math.abs(a.rank_change))

  // Count new entries and dropouts
  const currentIds = new Set((currentLeaderboard || []).map((p) => p.partner_id))
  const previousIds = new Set(previousLeaderboard.map((p: any) => p.partner_id))

  const new_entries = [...currentIds].filter((id) => !previousIds.has(id)).length
  const dropped_out = [...previousIds].filter((id) => !currentIds.has(id)).length

  return {
    rank_changes,
    new_entries,
    dropped_out,
  }
}

/**
 * Get score distribution analysis
 */
export async function getScoreDistribution(contestId: string): Promise<ScoreDistribution> {
  const supabase = createSupabaseAdmin()

  // Get all participant scores
  const { data: participants } = await supabase
    .from('contest_participants')
    .select('total_score')
    .eq('contest_id', contestId)
    .gt('total_score', 0)

  if (!participants || participants.length === 0) {
    return {
      ranges: [],
      percentiles: {
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      },
    }
  }

  const scores = participants.map((p) => p.total_score || 0).sort((a, b) => a - b)
  const totalCount = scores.length

  // Define score ranges (0-20, 20-40, 40-60, 60-80, 80-100)
  const ranges = [
    { min_score: 0, max_score: 20 },
    { min_score: 20, max_score: 40 },
    { min_score: 40, max_score: 60 },
    { min_score: 60, max_score: 80 },
    { min_score: 80, max_score: 100 },
  ]

  const distribution = ranges.map((range) => {
    const count = scores.filter((s) => s >= range.min_score && s < range.max_score).length
    const percentage = (count / totalCount) * 100

    return {
      ...range,
      count,
      percentage: Math.round(percentage * 100) / 100,
    }
  })

  // Calculate percentiles
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * totalCount) - 1
    return scores[Math.max(0, Math.min(index, totalCount - 1))]
  }

  const percentiles = {
    p10: getPercentile(10),
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  }

  return {
    ranges: distribution,
    percentiles,
  }
}

/**
 * Get predictive analytics for final rankings
 */
export async function getPredictiveAnalytics(
  contestId: string
): Promise<PredictiveAnalytics> {
  const supabase = createSupabaseAdmin()

  // Get contest details
  const { data: contest } = await supabase
    .from('contests')
    .select('start_date, end_date')
    .eq('id', contestId)
    .maybeSingle()

  if (!contest) {
    throw new Error('Contest not found')
  }

  const now = new Date()
  const startDate = new Date(contest.start_date)
  const endDate = new Date(contest.end_date)

  const daysElapsed = Math.max(1, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysRemaining = Math.max(
    0,
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)

  // Get top participants
  const { data: topParticipants } = await supabase
    .from('contest_participants')
    .select('partner_id, current_rank, current_score, users!inner(email)')
    .eq('contest_id', contestId)
    .order('current_rank', { ascending: true })
    .limit(10)

  if (!topParticipants || topParticipants.length === 0) {
    throw new Error('No participants found')
  }

  // Simple linear projection based on current progress
  const projectionFactor = totalDays / daysElapsed

  const projected_winner = {
    partner_id: topParticipants[0].partner_id,
    partner_name: topParticipants[0].users?.email || 'Unknown',
    current_score: topParticipants[0].current_score || 0,
    projected_final_score: Math.round((topParticipants[0].current_score || 0) * projectionFactor),
    confidence: Math.max(50, Math.min(95, (daysElapsed / totalDays) * 100)), // Confidence increases with time
  }

  const projected_top_10 = topParticipants.map((p, index) => ({
    partner_id: p.partner_id,
    partner_name: p.users?.email || 'Unknown',
    current_rank: p.current_rank || index + 1,
    projected_rank: p.current_rank || index + 1, // Simplified: assume ranks remain stable
    confidence: Math.max(50, Math.min(95, (daysElapsed / totalDays) * 100)),
  }))

  return {
    projected_winner,
    projected_top_10,
    days_until_end: Math.round(daysRemaining),
  }
}

/**
 * Get comprehensive analytics report
 */
export async function getComprehensiveAnalytics(contestId: string) {
  const [trends, changes, distribution, predictions] = await Promise.all([
    getContestTrends(contestId),
    getLeaderboardChanges(contestId),
    getScoreDistribution(contestId),
    getPredictiveAnalytics(contestId),
  ])

  return {
    trends,
    leaderboard_changes: changes,
    score_distribution: distribution,
    predictions,
    generated_at: new Date().toISOString(),
  }
}
