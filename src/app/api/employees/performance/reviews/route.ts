
// =====================================================
// PERFORMANCE REVIEWS API
// GET: List reviews for employee
// POST: Submit performance review (self/manager)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

async function getEmployeeId(supabase: any, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  return employee?.id || null
}

// GET: List performance reviews
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = await getEmployeeId(supabase, user.id)
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const cycleId = searchParams.get('cycle_id')
    const reviewType = searchParams.get('review_type')

    let query = supabase
      .from('performance_reviews')
      .select(`
        *,
        cycle:performance_review_cycles(
          cycle_name,
          cycle_type,
          review_period_start,
          review_period_end
        ),
        reviewer:reviewer_id(
          id,
          full_name,
          work_email
        )
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (cycleId) {
      query = query.eq('cycle_id', cycleId)
    }

    if (reviewType) {
      query = query.eq('review_type', reviewType)
    }

    const { data: reviews, error: reviewsError } = await query

    if (reviewsError) {
      apiLogger.error('Reviews fetch error', reviewsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 })
    }

    // Get active review cycles
    const { data: cycles } = await supabase
      .from('performance_review_cycles')
      .select('*')
      .eq('status', 'OPEN')
      .gte('submission_end_date', new Date().toISOString().split('T')[0])
      .order('submission_end_date', { ascending: true })

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        active_cycles: cycles || []
      }
    })
  } catch (error) {
    apiLogger.error('Reviews GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Submit performance review
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = await getEmployeeId(supabase, user.id)
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      cycle_id,
      review_type, // SELF, MANAGER, PEER, SKIP_LEVEL
      employee_id_for_review, // If reviewing someone else (manager review)
      overall_rating,
      competency_ratings,
      goal_achievement_percentage,
      goals_rating,
      strengths,
      areas_for_improvement,
      achievements,
      key_accomplishments,
      development_areas,
      training_recommendations,
      career_aspirations,
      promotion_recommendation,
      promotion_justification,
      retention_risk,
      retention_risk_reason,
      increment_recommendation_percentage,
      increment_justification,
      bonus_recommendation
    } = body

    // Validation
    if (!cycle_id || !review_type) {
      return NextResponse.json({ success: false, error: 'cycle_id and review_type required'
      }, { status: 400 })
    }

    // Verify cycle is open
    const { data: cycle } = await supabase
      .from('performance_review_cycles')
      .select('*')
      .eq('id', cycle_id)
      .maybeSingle()

    if (!cycle || cycle.status !== 'OPEN') {
      return NextResponse.json({ success: false, error: 'Review cycle is not open' }, { status: 400 })
    }

    // Check submission window
    const today = new Date().toISOString().split('T')[0]
    if (today < cycle.submission_start_date || today > cycle.submission_end_date) {
      return NextResponse.json({ success: false, error: 'Outside submission window' }, { status: 400 })
    }

    // Determine reviewer_id and employee_id based on review_type
    let reviewerId = null
    let targetEmployeeId = employeeId

    if (review_type === 'SELF') {
      reviewerId = null // Self review
      targetEmployeeId = employeeId
    } else if (review_type === 'MANAGER') {
      reviewerId = user.id
      targetEmployeeId = employee_id_for_review

      if (!targetEmployeeId) {
        return NextResponse.json({ success: false, error: 'employee_id_for_review required for manager review' }, { status: 400 })
      }

      // Verify this user is the manager
      const { data: reportingEmployee } = await supabase
        .from('employees')
        .select('reporting_manager_id')
        .eq('id', targetEmployeeId)
        .maybeSingle()

      if (!reportingEmployee || reportingEmployee.reporting_manager_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Not authorized to review this employee' }, { status: 403 })
      }
    }

    // Check for existing review
    const { data: existing } = await supabase
      .from('performance_reviews')
      .select('id')
      .eq('cycle_id', cycle_id)
      .eq('employee_id', targetEmployeeId)
      .eq('review_type', review_type)
      .eq('reviewer_id', reviewerId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'Review already submitted for this cycle' }, { status: 400 })
    }

    // Determine overall rating label
    let overall_rating_label = 'MEETS'
    if (overall_rating >= 4.5) overall_rating_label = 'EXCEPTIONAL'
    else if (overall_rating >= 3.5) overall_rating_label = 'EXCEEDS'
    else if (overall_rating >= 2.5) overall_rating_label = 'MEETS'
    else if (overall_rating >= 1.5) overall_rating_label = 'NEEDS_IMPROVEMENT'
    else overall_rating_label = 'UNSATISFACTORY'

    // Insert review
    const { data: review, error: insertError } = await supabase
      .from('performance_reviews')
      .insert({
        cycle_id,
        employee_id: targetEmployeeId,
        review_type,
        reviewer_id: reviewerId,
        overall_rating,
        overall_rating_label,
        competency_ratings,
        goal_achievement_percentage,
        goals_rating,
        strengths,
        areas_for_improvement,
        achievements,
        key_accomplishments,
        development_areas,
        training_recommendations,
        career_aspirations,
        promotion_recommendation: promotion_recommendation || false,
        promotion_justification,
        retention_risk,
        retention_risk_reason,
        increment_recommendation_percentage,
        increment_justification,
        bonus_recommendation,
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Review insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to submit review' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: review,
      message: 'Review submitted successfully'
    })
  } catch (error) {
    apiLogger.error('Reviews POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
