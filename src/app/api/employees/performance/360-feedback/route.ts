export const dynamic = 'force-dynamic'

// =====================================================
// 360 DEGREE FEEDBACK API
// GET: List feedback requests and responses
// POST: Submit 360 feedback response
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

// GET: List 360 feedback requests and responses
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
    const type = searchParams.get('type') // 'my_requests' or 'pending_to_give'

    if (type === 'my_requests') {
      // Feedback requests for me (to see who I nominated and responses)
      const { data: requests, error: reqError } = await supabase
        .from('feedback_360_requests')
        .select(`
          *,
          responses:feedback_360_responses(
            id,
            relationship_to_employee,
            overall_rating,
            status,
            submitted_at
          )
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

      if (reqError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: { requests }
      })
    } else if (type === 'pending_to_give') {
      // Feedback requests where I'm nominated to give feedback
      const { data: requests, error: reqError } = await supabase
        .from('feedback_360_requests')
        .select('*')
        .or(`nominated_peers.cs.{${user.id}},nominated_direct_reports.cs.{${user.id}},nominated_skip_level.cs.{${user.id}}`)
        .eq('status', 'IN_PROGRESS')
        .order('due_date', { ascending: true })

      if (reqError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch pending requests' }, { status: 500 })
      }

      // Filter out requests where I've already responded
      const pendingRequests = []
      for (const request of (requests || [])) {
        const { data: existing } = await supabase
          .from('feedback_360_responses')
          .select('id')
          .eq('request_id', request.id)
          .eq('feedback_giver_id', user.id)
          .maybeSingle()

        if (!existing) {
          pendingRequests.push(request)
        }
      }

      return NextResponse.json({
        success: true,
        data: { pending_requests: pendingRequests }
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('360 Feedback GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Submit 360 feedback
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

    const body = await request.json()
    const {
      request_id,
      employee_id, // Subject of feedback
      relationship_to_employee, // PEER, DIRECT_REPORT, MANAGER, etc.
      competency_ratings, // JSONB
      overall_rating,
      what_works_well,
      what_could_improve,
      specific_examples,
      additional_comments
    } = body

    // Validation
    if (!request_id || !employee_id || !relationship_to_employee || !competency_ratings) {
      return NextResponse.json({ success: false, error: 'request_id, employee_id, relationship_to_employee, and competency_ratings required'
      }, { status: 400 })
    }

    // Verify request exists and user is nominated
    const { data: feedbackRequest, error: reqError } = await supabase
      .from('feedback_360_requests')
      .select('*')
      .eq('id', request_id)
      .eq('employee_id', employee_id)
      .maybeSingle()

    if (reqError || !feedbackRequest) {
      return NextResponse.json({ success: false, error: 'Feedback request not found' }, { status: 404 })
    }

    // Check if user is in nominated list
    const isNominated = (
      feedbackRequest.nominated_peers?.includes(user.id) ||
      feedbackRequest.nominated_direct_reports?.includes(user.id) ||
      feedbackRequest.nominated_skip_level?.includes(user.id)
    )

    if (!isNominated) {
      return NextResponse.json({ success: false, error: 'You are not nominated for this feedback' }, { status: 403 })
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('feedback_360_responses')
      .select('id')
      .eq('request_id', request_id)
      .eq('feedback_giver_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'Feedback already submitted' }, { status: 400 })
    }

    // Insert response
    const { data: response, error: insertError } = await supabase
      .from('feedback_360_responses')
      .insert({
        request_id,
        employee_id,
        feedback_giver_id: user.id,
        relationship_to_employee,
        competency_ratings,
        overall_rating,
        what_works_well,
        what_could_improve,
        specific_examples,
        additional_comments,
        is_anonymous: feedbackRequest.is_anonymous || true,
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('360 Response insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to submit feedback' }, { status: 500 })
    }

    // Check if all nominated have responded, mark request complete
    const { data: allResponses } = await supabase
      .from('feedback_360_responses')
      .select('id')
      .eq('request_id', request_id)
      .eq('status', 'SUBMITTED')

    const totalNominated = (
      (feedbackRequest.nominated_peers?.length || 0) +
      (feedbackRequest.nominated_direct_reports?.length || 0) +
      (feedbackRequest.nominated_skip_level?.length || 0)
    )

    if (allResponses && allResponses.length >= totalNominated) {
      await supabase
        .from('feedback_360_requests')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', request_id)
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Feedback submitted successfully'
    })
  } catch (error) {
    apiLogger.error('360 Feedback POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
