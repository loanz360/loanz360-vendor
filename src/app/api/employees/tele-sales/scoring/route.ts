export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get call scoring dashboard data
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

    const period = searchParams.get('period') || '30d'

    // Calculate date range
    const now = new Date()
    let startDate: Date
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get user's call scores
    const { data: scores, error: scoresError } = await supabase
      .from('ts_call_scores')
      .select('*')
      .eq('sales_executive_id', user.id)
      .gte('scored_at', startDate.toISOString())
      .order('scored_at', { ascending: false })

    if (scoresError) throw scoresError

    // Calculate statistics
    const totalScored = scores?.length || 0
    const totalScore = scores?.reduce((sum, s) => sum + (s.percentage_score || 0), 0) || 0
    const averageScore = totalScored > 0 ? totalScore / totalScored : 0
    const passedCount = scores?.filter(s => s.passed).length || 0
    const passRate = totalScored > 0 ? (passedCount / totalScored) * 100 : 0

    // Grade distribution
    const gradeDistribution: Record<string, number> = {}
    scores?.forEach(s => {
      if (s.grade) {
        gradeDistribution[s.grade] = (gradeDistribution[s.grade] || 0) + 1
      }
    })

    // Calculate criteria averages
    const criteriaScores: Record<string, { total: number; count: number }> = {}
    scores?.forEach(s => {
      const criteriaArray = s.criteria_scores as any[]
      criteriaArray?.forEach(cs => {
        if (!criteriaScores[cs.name]) {
          criteriaScores[cs.name] = { total: 0, count: 0 }
        }
        criteriaScores[cs.name].total += (cs.score / cs.max_score) * 100
        criteriaScores[cs.name].count += 1
      })
    })

    const criteriaAverages = Object.entries(criteriaScores).map(([name, data]) => ({
      name,
      average: data.count > 0 ? data.total / data.count : 0
    })).sort((a, b) => b.average - a.average)

    // Identify strengths and improvement areas
    const strengths = criteriaAverages.filter(c => c.average >= 80).slice(0, 3).map(c => c.name)
    const improvementAreas = criteriaAverages.filter(c => c.average < 70).slice(-3).map(c => c.name)

    // Get recent scores for trend
    const recentScores = scores?.slice(0, 10) || []
    const olderScores = scores?.slice(10, 20) || []

    const recentAvg = recentScores.length > 0
      ? recentScores.reduce((sum, s) => sum + (s.percentage_score || 0), 0) / recentScores.length
      : 0
    const olderAvg = olderScores.length > 0
      ? olderScores.reduce((sum, s) => sum + (s.percentage_score || 0), 0) / olderScores.length
      : 0

    let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE'
    if (olderAvg > 0) {
      const change = recentAvg - olderAvg
      if (change > 5) trend = 'IMPROVING'
      else if (change < -5) trend = 'DECLINING'
    }

    // Get scoring templates
    const { data: templates } = await supabase
      .from('ts_scoring_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total_scored: totalScored,
          average_score: Math.round(averageScore * 10) / 10,
          pass_rate: Math.round(passRate * 10) / 10,
          grade_distribution: gradeDistribution,
          strengths,
          improvement_areas: improvementAreas,
          recent_trend: trend
        },
        criteria_breakdown: criteriaAverages,
        recent_scores: recentScores.slice(0, 5),
        templates: templates || []
      }
    })
  } catch (error) {
    apiLogger.error('Scoring dashboard error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scoring data' },
      { status: 500 }
    )
  }
}

// POST - Score a call
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const {
      call_id,
      scoring_template_id,
      criteria_scores,
      review_notes,
      scoring_method = 'MANUAL'
    } = body

    if (!call_id || !criteria_scores || !Array.isArray(criteria_scores)) {
      return NextResponse.json({
        success: false,
        error: 'Call ID and criteria scores are required'
      }, { status: 400 })
    }

    // Get template to validate scores
    let template = null
    if (scoring_template_id) {
      const { data } = await supabase
        .from('ts_scoring_templates')
        .select('*')
        .eq('id', scoring_template_id)
        .maybeSingle()
      template = data
    } else {
      // Get default template
      const { data } = await supabase
        .from('ts_scoring_templates')
        .select('*')
        .eq('is_default', true)
        .maybeSingle()
      template = data
    }

    // Calculate total score
    let totalScore = 0
    let maxPossibleScore = 0
    const enrichedCriteriaScores = criteria_scores.map(cs => {
      const templateCriteria = template?.criteria?.find((c: any) => c.id === cs.criteria_id)
      const maxScore = templateCriteria?.max_score || 10
      const weight = templateCriteria?.weight || 1.0

      totalScore += (cs.score || 0) * weight
      maxPossibleScore += maxScore * weight

      return {
        criteria_id: cs.criteria_id,
        name: templateCriteria?.name || cs.criteria_id,
        score: cs.score || 0,
        max_score: maxScore,
        weight,
        notes: cs.notes || null
      }
    })

    // Create call score record
    const { data: callScore, error: insertError } = await supabase
      .from('ts_call_scores')
      .insert({
        call_id,
        sales_executive_id: user.id,
        scoring_template_id: template?.id,
        total_score: Math.round(totalScore),
        max_possible_score: Math.round(maxPossibleScore),
        criteria_scores: enrichedCriteriaScores,
        scoring_method,
        review_notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) throw insertError

    // Award points if score is good
    if (callScore.passed) {
      const bonusPoints = Math.round((callScore.percentage_score - 70) / 10) * 5
      if (bonusPoints > 0) {
        await supabase
          .from('ts_points_transactions')
          .insert({
            sales_executive_id: user.id,
            points: bonusPoints,
            transaction_type: 'BONUS',
            category: 'QUALITY_BONUS',
            reference_type: 'CALL_SCORE',
            reference_id: callScore.id,
            description: `Quality bonus for ${callScore.grade} grade call`
          })
      }
    }

    return NextResponse.json({
      success: true,
      data: callScore
    })
  } catch (error) {
    apiLogger.error('Score call error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to score call' },
      { status: 500 }
    )
  }
}
