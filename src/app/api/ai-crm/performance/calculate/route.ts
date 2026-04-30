import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


interface CROPerformanceMetrics {
  userId: string
  date: string
  callsMade: number
  callsConnected: number
  positiveCalls: number
  avgCallDuration: number
  leadsCreated: number
  leadsConverted: number
  avgAIRating: number
  aiScore: number
  bestPoints: string[]
  improvementAreas: string[]
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  percentileRank: number
}

interface BDEPerformanceMetrics {
  userId: string
  date: string
  dealsAssigned: number
  dealsInProgress: number
  dealsSanctioned: number
  dealsDisbursed: number
  dealsDropped: number
  totalSanctionedAmount: number
  totalDisbursedAmount: number
  avgDaysToSanction: number
  avgDaysToDisburse: number
  conversionRate: number
  updateCompliance: number
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  percentileRank: number
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { userId, userRole, date } = await request.json()

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, message: 'userId and userRole are required' },
        { status: 400 }
      )
    }

    const targetDate = date || new Date().toISOString().split('T')[0]

    let metrics

    if (userRole === 'CRO') {
      metrics = await calculateCROPerformance(supabase, userId, targetDate)
    } else if (userRole === 'BDE') {
      metrics = await calculateBDEPerformance(supabase, userId, targetDate)
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid user role' },
        { status: 400 }
      )
    }

    // Save metrics to database
    const { error: saveError } = await supabase
      .from('performance_metrics')
      .upsert({
        user_id: userId,
        metric_date: targetDate,
        user_role: userRole,
        ...metrics,
        updated_at: new Date().toISOString(),
      })

    if (saveError) {
      apiLogger.error('Error saving performance metrics', saveError)
    }

    return NextResponse.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    apiLogger.error('Performance calculation error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, message: 'Failed to calculate performance' },
      { status: 500 }
    )
  }
}

async function calculateCROPerformance(
  supabase: unknown,
  userId: string,
  date: string
): Promise<CROPerformanceMetrics> {
  // Get calls made on this date
  const { data: callLogs } = await supabase
    .from('call_logs')
    .select('*')
    .eq('cro_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)

  const callsMade = callLogs?.length || 0
  const callsConnected = callLogs?.filter((c) => c.duration > 0).length || 0
  const positiveCalls =
    callLogs?.filter((c) => c.sentiment === 'positive' || c.interest_level === 'high').length || 0

  // Calculate average call duration
  const avgCallDuration =
    callsMade > 0
      ? callLogs!.reduce((sum, c) => sum + (c.duration || 0), 0) / callsMade
      : 0

  // Calculate average AI rating
  const ratedCalls = callLogs?.filter((c) => c.ai_rating > 0) || []
  const avgAIRating =
    ratedCalls.length > 0
      ? ratedCalls.reduce((sum, c) => sum + c.ai_rating, 0) / ratedCalls.length
      : 0

  // Get leads created on this date
  const { count: leadsCreated } = await supabase
    .from('crm_leads')
    .select('*', { count: 'exact', head: true })
    .eq('cro_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)

  // Get leads converted on this date
  const { count: leadsConverted } = await supabase
    .from('crm_leads')
    .select('*', { count: 'exact', head: true })
    .eq('cro_id', userId)
    .eq('status', 'converted')
    .gte('converted_at', `${date}T00:00:00`)
    .lte('converted_at', `${date}T23:59:59`)

  // Extract best points and improvement areas from AI analysis
  const bestPoints = new Set<string>()
  const improvementAreas = new Set<string>()

  callLogs?.forEach((call) => {
    try {
      const positive = JSON.parse(call.positive_points || '[]')
      const improvements = JSON.parse(call.improvement_points || '[]')
      positive.forEach((p: string) => bestPoints.add(p))
      improvements.forEach((i: string) => improvementAreas.add(i))
    } catch (e) {
      // Skip if JSON parsing fails
    }
  })

  // Calculate AI score (0-100)
  const callQualityScore = avgAIRating * 10 // Max 100
  const connectionRate = callsMade > 0 ? (callsConnected / callsMade) * 100 : 0
  const positiveRate = callsConnected > 0 ? (positiveCalls / callsConnected) * 100 : 0
  const conversionRate = (leadsCreated || 0) > 0 ? ((leadsConverted || 0) / (leadsCreated || 1)) * 100 : 0

  const aiScore = Math.round(
    callQualityScore * 0.4 +
    connectionRate * 0.2 +
    positiveRate * 0.2 +
    conversionRate * 0.2
  )

  // Calculate performance grade
  const performanceGrade = getPerformanceGrade(aiScore)

  // Get percentile rank (compare with other CROs)
  const percentileRank = await calculatePercentileRank(supabase, 'CRO', aiScore, date)

  return {
    userId,
    date,
    callsMade,
    callsConnected,
    positiveCalls,
    avgCallDuration: Math.round(avgCallDuration),
    leadsCreated: leadsCreated || 0,
    leadsConverted: leadsConverted || 0,
    avgAIRating: Math.round(avgAIRating * 10) / 10,
    aiScore,
    bestPoints: Array.from(bestPoints).slice(0, 5),
    improvementAreas: Array.from(improvementAreas).slice(0, 5),
    performanceGrade,
    percentileRank,
  }
}

async function calculateBDEPerformance(
  supabase: unknown,
  userId: string,
  date: string
): Promise<BDEPerformanceMetrics> {
  // Get all deals for this BDE
  const { data: allDeals } = await supabase
    .from('crm_deals')
    .select('*')
    .eq('bde_id', userId)

  // Deals assigned on this date
  const { count: dealsAssigned } = await supabase
    .from('crm_deals')
    .select('*', { count: 'exact', head: true })
    .eq('bde_id', userId)
    .gte('assigned_at', `${date}T00:00:00`)
    .lte('assigned_at', `${date}T23:59:59`)

  // Current status counts
  const dealsInProgress =
    allDeals?.filter((d) => d.status === 'in_progress' || d.status === 'new').length || 0
  const dealsSanctioned = allDeals?.filter((d) => d.status === 'sanctioned').length || 0
  const dealsDisbursed = allDeals?.filter((d) => d.status === 'disbursed').length || 0
  const dealsDropped = allDeals?.filter((d) => d.status === 'dropped').length || 0

  // Financial metrics
  const totalSanctionedAmount =
    allDeals
      ?.filter((d) => d.sanctioned_amount > 0)
      .reduce((sum, d) => sum + d.sanctioned_amount, 0) || 0

  const totalDisbursedAmount =
    allDeals
      ?.filter((d) => d.disbursed_amount > 0)
      .reduce((sum, d) => sum + d.disbursed_amount, 0) || 0

  // Calculate average days to sanction
  const sanctionedDeals = allDeals?.filter((d) => d.sanctioned_at) || []
  const avgDaysToSanction =
    sanctionedDeals.length > 0
      ? sanctionedDeals.reduce((sum, d) => {
          const assignedDate = new Date(d.assigned_at)
          const sanctionedDate = new Date(d.sanctioned_at)
          const days = Math.ceil(
            (sanctionedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + days
        }, 0) / sanctionedDeals.length
      : 0

  // Calculate average days to disburse
  const disbursedDeals = allDeals?.filter((d) => d.disbursed_at) || []
  const avgDaysToDisburse =
    disbursedDeals.length > 0
      ? disbursedDeals.reduce((sum, d) => {
          const assignedDate = new Date(d.assigned_at)
          const disbursedDate = new Date(d.disbursed_at)
          const days = Math.ceil(
            (disbursedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + days
        }, 0) / disbursedDeals.length
      : 0

  // Calculate conversion rate (disbursed / total assigned)
  const totalDeals = allDeals?.length || 0
  const conversionRate = totalDeals > 0 ? (dealsDisbursed / totalDeals) * 100 : 0

  // Calculate update compliance (deals with recent updates)
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const dealsWithRecentUpdates =
    allDeals?.filter(
      (d) =>
        d.status === 'in_progress' &&
        d.last_updated_by_bde_at &&
        new Date(d.last_updated_by_bde_at) >= oneDayAgo
    ).length || 0

  const updateCompliance =
    dealsInProgress > 0 ? (dealsWithRecentUpdates / dealsInProgress) * 100 : 100

  // Calculate overall score
  const timeEfficiencyScore = Math.max(0, 100 - avgDaysToSanction * 2)
  const conversionScore = conversionRate
  const complianceScore = updateCompliance
  const volumeScore = Math.min(100, (dealsSanctioned + dealsDisbursed) * 5)

  const overallScore = Math.round(
    timeEfficiencyScore * 0.3 +
    conversionScore * 0.3 +
    complianceScore * 0.2 +
    volumeScore * 0.2
  )

  const performanceGrade = getPerformanceGrade(overallScore)
  const percentileRank = await calculatePercentileRank(supabase, 'BDE', overallScore, date)

  return {
    userId,
    date,
    dealsAssigned: dealsAssigned || 0,
    dealsInProgress,
    dealsSanctioned,
    dealsDisbursed,
    dealsDropped,
    totalSanctionedAmount,
    totalDisbursedAmount,
    avgDaysToSanction: Math.round(avgDaysToSanction),
    avgDaysToDisburse: Math.round(avgDaysToDisburse),
    conversionRate: Math.round(conversionRate * 10) / 10,
    updateCompliance: Math.round(updateCompliance * 10) / 10,
    performanceGrade,
    percentileRank,
  }
}

function getPerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 45) return 'D'
  return 'F'
}

async function calculatePercentileRank(
  supabase: unknown,
  role: string,
  score: number,
  date: string
): Promise<number> {
  // Get all performance metrics for this role on this date
  const { data: allMetrics } = await supabase
    .from('performance_metrics')
    .select('ai_score')
    .eq('user_role', role)
    .eq('metric_date', date)

  if (!allMetrics || allMetrics.length === 0) {
    return 50 // Default to 50th percentile if no data
  }

  const scores = allMetrics.map((m) => m.ai_score || 0)
  const lowerScores = scores.filter((s) => s < score).length

  return Math.round((lowerScores / scores.length) * 100)
}
