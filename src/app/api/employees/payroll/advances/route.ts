
// =====================================================
// SALARY ADVANCES API
// GET: List salary advances
// POST: Request salary advance
// PATCH: Approve/reject/mark recovered
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getEmployeeId(supabase: SupabaseClient, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id, sub_role')
    .eq('user_id', userId)
    .maybeSingle()

  return employee
}

// GET: List salary advances
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

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    const isFinanceOrHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE'].includes(employee.sub_role)

    let query = supabase
      .from('salary_advances')
      .select(`
        *,
        employee:employees!salary_advances_employee_id_fkey(
          id,
          employee_id,
          full_name,
          work_email
        )
      `)
      .order('created_at', { ascending: false })

    if (!isFinanceOrHR) {
      query = query.eq('employee_id', employee.id)
    }

    if (status) {
      query = query.eq('approval_status', status)
    }

    const { data: advances, error: advError } = await query

    if (advError) {
      apiLogger.error('Advances fetch error', advError)
      return NextResponse.json({ success: false, error: 'Failed to fetch advances' }, { status: 500 })
    }

    const summary = {
      total_advances: advances.length,
      pending_approval: advances.filter((a) => a.approval_status === 'PENDING').length,
      pending_recovery: advances.filter((a) => a.recovery_status === 'PENDING').length,
      total_pending_amount: advances
        .filter((a) => a.recovery_status === 'PENDING')
        .reduce((sum: number, a) => sum + (parseFloat(a.advance_amount) || 0), 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        advances,
        summary
      }
    })
  } catch (error) {
    apiLogger.error('Advances GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Request salary advance
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

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      advance_amount,
      requested_reason,
      urgency_level
    } = body

    if (!advance_amount || !requested_reason) {
      return NextResponse.json({ success: false, error: 'Missing required fields: advance_amount, requested_reason'
      }, { status: 400 })
    }

    // Check if employee has pending advances
    const { data: pendingAdvances } = await supabase
      .from('salary_advances')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('recovery_status', 'PENDING')

    if (pendingAdvances && pendingAdvances.length > 0) {
      return NextResponse.json({ success: false, error: 'You have a pending advance. Please clear it before requesting a new one.'
      }, { status: 400 })
    }

    // Get employee salary to validate advance amount
    const { data: salaryData } = await supabase
      .from('employee_salary')
      .select('basic_salary, gross_salary')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (salaryData && advance_amount > salaryData.basic_salary) {
      return NextResponse.json({ success: false, error: `Advance amount cannot exceed basic salary (₹${salaryData.basic_salary})`
      }, { status: 400 })
    }

    const { data: advance, error: insertError } = await supabase
      .from('salary_advances')
      .insert({
        employee_id: employee.id,
        advance_amount,
        requested_reason,
        urgency_level: urgency_level || 'NORMAL',
        approval_status: 'PENDING',
        disbursement_status: 'PENDING',
        recovery_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Advance insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create advance request' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: advance,
      message: 'Salary advance request submitted successfully'
    })
  } catch (error) {
    apiLogger.error('Advances POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Approve/reject/disburse/mark recovered
export async function PATCH(request: NextRequest) {
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

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const isFinanceOrHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE'].includes(employee.sub_role)
    if (!isFinanceOrHR) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { advance_id, action, ...actionData } = body

    if (!advance_id || !action) {
      return NextResponse.json({ success: false, error: 'advance_id and action required' }, { status: 400 })
    }

    if (action === 'APPROVE') {
      const { data: updated, error: updateError } = await supabase
        .from('salary_advances')
        .update({
          approval_status: 'APPROVED',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_comments: actionData.approval_comments || null
        })
        .eq('id', advance_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Salary advance approved'
      })
    } else if (action === 'REJECT') {
      const { data: updated, error: updateError } = await supabase
        .from('salary_advances')
        .update({
          approval_status: 'REJECTED',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_comments: actionData.approval_comments || null
        })
        .eq('id', advance_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Salary advance rejected'
      })
    } else if (action === 'DISBURSE') {
      const { disbursement_method, disbursement_reference } = actionData

      const { data: updated, error: updateError } = await supabase
        .from('salary_advances')
        .update({
          disbursement_status: 'DISBURSED',
          disbursement_date: new Date().toISOString().split('T')[0],
          disbursement_method,
          disbursement_reference
        })
        .eq('id', advance_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Salary advance disbursed'
      })
    } else if (action === 'MARK_RECOVERED') {
      const { recovery_month } = actionData

      const { data: updated, error: updateError } = await supabase
        .from('salary_advances')
        .update({
          recovery_status: 'RECOVERED',
          recovery_month: recovery_month || new Date().toISOString().slice(0, 7),
          recovered_amount: actionData.recovered_amount,
          recovery_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', advance_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Advance marked as recovered'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Advances PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
