
// =====================================================
// EMPLOYEE RESIGNATION API
// POST: Submit resignation
// GET: View resignation status
// PATCH: Withdraw resignation
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET: Fetch employee's resignation status
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
      .select('id, employee_id, full_name, date_of_joining, employee_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Get resignation record (if exists)
    const { data: resignation, error: resignationError } = await supabase
      .from('employee_resignations')
      .select(`
        *,
        clearance:exit_clearance_checklist(*),
        exit_interview:exit_interview_responses(*),
        settlement:employee_final_settlement(*),
        knowledge_transfer:knowledge_transfer_tasks(*)
      `)
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (resignationError && resignationError.code !== 'PGRST116') {
      apiLogger.error('Resignation fetch error', resignationError)
      return NextResponse.json(
        { error: 'Failed to fetch resignation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        employee,
        resignation: resignation || null,
        hasActiveResignation: !!resignation && resignation.status !== 'COMPLETED'
      }
    })
  } catch (error) {
    apiLogger.error('Resignation GET Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Submit resignation
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
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

    const body = await request.json()
    const {
      last_working_day,
      resignation_reason,
      detailed_reason,
      new_employer,
      resignation_letter_url
    } = body

    if (!last_working_day) {
      return NextResponse.json(
        { error: 'last_working_day is required' },
        { status: 400 }
      )
    }

    // Get employee record with contract details
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, date_of_joining, employee_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Check if already has active resignation
    const { data: existingResignation } = await supabase
      .from('employee_resignations')
      .select('id, status')
      .eq('employee_id', employee.id)
      .in('status', ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COUNTEROFFER_MADE'])
      .maybeSingle()

    if (existingResignation) {
      return NextResponse.json(
        { error: 'You already have an active resignation' },
        { status: 400 }
      )
    }

    // Calculate notice period (assuming 30 days standard, can be fetched from contract)
    const noticePeriodDays = 30
    const resignationDate = new Date()
    const lastWorkingDate = new Date(last_working_day)
    const actualNoticeDays = Math.ceil(
      (lastWorkingDate.getTime() - resignationDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Create resignation
    const { data: newResignation, error: createError } = await supabase
      .from('employee_resignations')
      .insert({
        employee_id: employee.id,
        resignation_date: resignationDate.toISOString().split('T')[0],
        last_working_day,
        notice_period_days: noticePeriodDays,
        actual_notice_period_days: actualNoticeDays,
        resignation_reason: resignation_reason || null,
        detailed_reason: detailed_reason || null,
        new_employer: new_employer || null,
        resignation_letter_url: resignation_letter_url || null,
        status: 'SUBMITTED',
        is_serving_notice: true
      })
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Resignation creation error', createError)
      return NextResponse.json(
        { error: 'Failed to submit resignation' },
        { status: 500 }
      )
    }

    // Update employee status
    await supabase
      .from('employees')
      .update({ employee_status: 'RESIGNED' })
      .eq('id', employee.id)

    return NextResponse.json({
      success: true,
      data: newResignation,
      message: 'Resignation submitted successfully. Your manager will be notified.'
    })
  } catch (error) {
    apiLogger.error('Resignation POST Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Withdraw resignation
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { action, resignation_id, withdrawal_reason } = body

    if (!action || !resignation_id) {
      return NextResponse.json(
        { error: 'action and resignation_id are required' },
        { status: 400 }
      )
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    if (action === 'WITHDRAW') {
      // Verify resignation belongs to employee and can be withdrawn
      const { data: resignation } = await supabase
        .from('employee_resignations')
        .select('id, status, employee_id')
        .eq('id', resignation_id)
        .eq('employee_id', employee.id)
        .maybeSingle()

      if (!resignation) {
        return NextResponse.json(
          { error: 'Resignation not found' },
          { status: 404 }
        )
      }

      if (!['SUBMITTED', 'UNDER_REVIEW'].includes(resignation.status)) {
        return NextResponse.json(
          { error: 'Resignation cannot be withdrawn at this stage' },
          { status: 400 }
        )
      }

      // Withdraw resignation
      const { data: updatedResignation, error: updateError } = await supabase
        .from('employee_resignations')
        .update({
          status: 'WITHDRAWN',
          is_withdrawn: true,
          withdrawn_at: new Date().toISOString(),
          withdrawal_reason: withdrawal_reason || null
        })
        .eq('id', resignation_id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Withdrawal error', updateError)
        return NextResponse.json(
          { error: 'Failed to withdraw resignation' },
          { status: 500 }
        )
      }

      // Update employee status back to ACTIVE
      await supabase
        .from('employees')
        .update({ employee_status: 'ACTIVE' })
        .eq('id', employee.id)

      return NextResponse.json({
        success: true,
        data: updatedResignation,
        message: 'Resignation withdrawn successfully'
      })
    } else if (action === 'RESPOND_TO_COUNTEROFFER') {
      const { response } = body // 'ACCEPTED' or 'REJECTED'

      if (!['ACCEPTED', 'REJECTED'].includes(response)) {
        return NextResponse.json(
          { error: 'Invalid counteroffer response' },
          { status: 400 }
        )
      }

      const { data: updatedResignation, error: updateError } = await supabase
        .from('employee_resignations')
        .update({
          counteroffer_response: response,
          counteroffer_response_at: new Date().toISOString(),
          status: response === 'ACCEPTED' ? 'COUNTEROFFER_ACCEPTED' : 'COUNTEROFFER_REJECTED'
        })
        .eq('id', resignation_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Counteroffer response error', updateError)
        return NextResponse.json(
          { error: 'Failed to respond to counteroffer' },
          { status: 500 }
        )
      }

      // If accepted, update employee status back to ACTIVE
      if (response === 'ACCEPTED') {
        await supabase
          .from('employees')
          .update({ employee_status: 'ACTIVE' })
          .eq('id', employee.id)
      }

      return NextResponse.json({
        success: true,
        data: updatedResignation,
        message: `Counteroffer ${response.toLowerCase()} successfully`
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    apiLogger.error('Resignation PATCH Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
