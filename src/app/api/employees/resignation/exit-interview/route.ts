import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// EXIT INTERVIEW API
// GET: Fetch exit interview questions
// POST: Submit exit interview responses
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET: Fetch exit interview questions
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Check if employee has resignation
    const { data: resignation } = await supabase
      .from('employee_resignations')
      .select('id, status')
      .eq('employee_id', employee.id)
      .maybeSingle()

    if (!resignation) {
      return NextResponse.json(
        { error: 'No resignation found' },
        { status: 404 }
      )
    }

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase
      .from('exit_interview_questions')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (questionsError) {
      apiLogger.error('Questions fetch error', questionsError)
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      )
    }

    // Check if already submitted
    const { data: existingResponse } = await supabase
      .from('exit_interview_responses')
      .select('id, interview_date, overall_sentiment')
      .eq('resignation_id', resignation.id)
      .maybeSingle()

    // Group questions by category
    const questionsByCategory = questions.reduce((acc: any, q: any) => {
      if (!acc[q.question_category]) {
        acc[q.question_category] = []
      }
      acc[q.question_category].push(q)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        questions,
        questionsByCategory,
        resignation,
        alreadySubmitted: !!existingResponse,
        submittedAt: existingResponse?.interview_date || null
      }
    })
  } catch (error) {
    apiLogger.error('Exit Interview GET Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Submit exit interview responses
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { resignation_id, responses, interview_mode } = body

    if (!resignation_id || !responses) {
      return NextResponse.json(
        { error: 'resignation_id and responses are required' },
        { status: 400 }
      )
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Verify resignation belongs to employee
    const { data: resignation } = await supabase
      .from('employee_resignations')
      .select('id, employee_id')
      .eq('id', resignation_id)
      .eq('employee_id', employee.id)
      .maybeSingle()

    if (!resignation) {
      return NextResponse.json(
        { error: 'Resignation not found or unauthorized' },
        { status: 404 }
      )
    }

    // Check if already submitted
    const { data: existingResponse } = await supabase
      .from('exit_interview_responses')
      .select('id')
      .eq('resignation_id', resignation_id)
      .maybeSingle()

    if (existingResponse) {
      return NextResponse.json(
        { error: 'Exit interview already submitted' },
        { status: 400 }
      )
    }

    // Calculate sentiment score (simple algorithm based on ratings)
    let sentimentScore = 5 // Default neutral
    let totalRatings = 0
    let sumRatings = 0

    Object.entries(responses).forEach(([key, value]) => {
      if (key.includes('RATING') && typeof value === 'number') {
        sumRatings += value as number
        totalRatings++
      }
    })

    if (totalRatings > 0) {
      sentimentScore = Math.round(sumRatings / totalRatings)
    }

    // Determine overall sentiment
    let overallSentiment = 'NEUTRAL'
    if (sentimentScore >= 4) overallSentiment = 'POSITIVE'
    else if (sentimentScore <= 2) overallSentiment = 'NEGATIVE'

    // Check if regrettable attrition (high performer leaving)
    // Simple logic: if sentiment is positive or neutral, it's regrettable
    const isRegrettable = overallSentiment !== 'NEGATIVE'

    // Save response
    const { data: savedResponse, error: saveError } = await supabase
      .from('exit_interview_responses')
      .insert({
        resignation_id,
        employee_id: employee.id,
        interview_date: new Date().toISOString(),
        interview_mode: interview_mode || 'WRITTEN',
        responses: responses,
        overall_sentiment: overallSentiment,
        sentiment_score: sentimentScore,
        is_regrettable_attrition: isRegrettable
      })
      .select()
      .maybeSingle()

    if (saveError) {
      apiLogger.error('Save response error', saveError)
      return NextResponse.json(
        { error: 'Failed to save exit interview' },
        { status: 500 }
      )
    }

    // Update resignation status
    await supabase
      .from('employee_resignations')
      .update({
        exit_interview_completed: true,
        exit_interview_completed_at: new Date().toISOString()
      })
      .eq('id', resignation_id)

    return NextResponse.json({
      success: true,
      data: savedResponse,
      message: 'Exit interview submitted successfully. Thank you for your feedback.'
    })
  } catch (error) {
    apiLogger.error('Exit Interview POST Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
