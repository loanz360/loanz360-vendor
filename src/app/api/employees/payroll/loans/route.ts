export const dynamic = 'force-dynamic'

// =====================================================
// EMPLOYEE LOANS API
// GET: List employee loans
// POST: Request new loan
// PATCH: Update loan status (for HR/Finance)
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

// GET: List employee loans
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

    // Check if user is Finance/HR (can view all loans)
    const isFinanceOrHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE'].includes(employee.sub_role)

    let query = supabase
      .from('employee_loans')
      .select(`
        *,
        employee:employees!employee_loans_employee_id_fkey(
          id,
          employee_id,
          full_name,
          work_email
        ),
        repayment_schedule:loan_repayment_schedule(
          id,
          emi_number,
          due_date,
          emi_amount,
          payment_status
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by employee if not Finance/HR
    if (!isFinanceOrHR) {
      query = query.eq('employee_id', employee.id)
    }

    if (status) {
      query = query.eq('approval_status', status)
    }

    const { data: loans, error: loansError } = await query

    if (loansError) {
      apiLogger.error('Loans fetch error', loansError)
      return NextResponse.json({ success: false, error: 'Failed to fetch loans' }, { status: 500 })
    }

    // Calculate summary statistics
    const summary = {
      total_loans: loans.length,
      active_loans: loans.filter((l) => l.repayment_status === 'ACTIVE').length,
      total_outstanding: loans
        .filter((l) => l.repayment_status === 'ACTIVE')
        .reduce((sum: number, l) => sum + (parseFloat(l.total_outstanding) || 0), 0),
      monthly_emi: loans
        .filter((l) => l.repayment_status === 'ACTIVE')
        .reduce((sum: number, l) => sum + (parseFloat(l.emi_amount) || 0), 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        loans,
        summary
      }
    })
  } catch (error) {
    apiLogger.error('Loans GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Request new loan
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
      loan_type,
      loan_amount,
      interest_rate,
      tenure_months,
      requested_reason,
      supporting_documents
    } = body

    // Validation
    if (!loan_type || !loan_amount || !tenure_months || !requested_reason) {
      return NextResponse.json({ success: false, error: 'Missing required fields: loan_type, loan_amount, tenure_months, requested_reason'
      }, { status: 400 })
    }

    // Calculate EMI using database function
    const { data: emiAmount, error: emiError } = await supabase
      .rpc('fn_calculate_loan_emi', {
        p_principal: loan_amount,
        p_interest_rate: interest_rate || 0,
        p_tenure_months: tenure_months
      })

    if (emiError || !emiAmount) {
      return NextResponse.json({ success: false, error: 'Failed to calculate EMI' }, { status: 500 })
    }

    // Calculate repayment start date (next month 1st)
    const today = new Date()
    const repaymentStartDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    // Create loan request
    const { data: loan, error: insertError } = await supabase
      .from('employee_loans')
      .insert({
        employee_id: employee.id,
        loan_type,
        loan_amount,
        interest_rate: interest_rate || 0,
        tenure_months,
        emi_amount: emiAmount,
        requested_reason,
        supporting_documents: supporting_documents || [],
        approval_status: 'PENDING',
        repayment_status: 'ACTIVE',
        repayment_start_date: repaymentStartDate.toISOString().split('T')[0],
        total_outstanding: loan_amount,
        emis_remaining: tenure_months
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Loan insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create loan request' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: loan,
      message: 'Loan request submitted successfully. Awaiting approval.'
    })
  } catch (error) {
    apiLogger.error('Loans POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update loan (approve/reject/disburse)
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

    // Check if user is Finance/HR
    const isFinanceOrHR = ['HR_EXECUTIVE', 'HR_MANAGER', 'FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE'].includes(employee.sub_role)
    if (!isFinanceOrHR) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { loan_id, action, ...actionData } = body

    if (!loan_id || !action) {
      return NextResponse.json({ success: false, error: 'loan_id and action required' }, { status: 400 })
    }

    if (action === 'APPROVE') {
      const { data: updated, error: updateError } = await supabase
        .from('employee_loans')
        .update({
          approval_status: 'APPROVED',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_comments: actionData.approval_comments || null
        })
        .eq('id', loan_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      // Generate repayment schedule
      await supabase.rpc('fn_generate_loan_schedule', { p_loan_id: loan_id })

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Loan approved and repayment schedule generated'
      })
    } else if (action === 'REJECT') {
      const { data: updated, error: updateError } = await supabase
        .from('employee_loans')
        .update({
          approval_status: 'REJECTED',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_comments: actionData.approval_comments || null
        })
        .eq('id', loan_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Loan request rejected'
      })
    } else if (action === 'DISBURSE') {
      const { disbursement_method, disbursement_reference } = actionData

      if (!disbursement_method || !disbursement_reference) {
        return NextResponse.json({ success: false, error: 'disbursement_method and disbursement_reference required' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await supabase
        .from('employee_loans')
        .update({
          disbursement_status: 'DISBURSED',
          disbursement_date: new Date().toISOString().split('T')[0],
          disbursement_method,
          disbursement_reference
        })
        .eq('id', loan_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Loan disbursed successfully'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Loans PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
