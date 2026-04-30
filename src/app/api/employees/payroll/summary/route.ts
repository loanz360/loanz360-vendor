
// =====================================================
// PAYROLL SUMMARY API
// GET: Complete payroll summary for employee
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getEmployeeId(supabase: SupabaseClient, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  return employee?.id || null
}

// GET: Payroll summary
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
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    // Get payroll summary using database function
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('fn_get_employee_payroll_summary', {
        p_employee_id: employeeId,
        p_month: month
      })

    if (summaryError) {
      apiLogger.error('Summary fetch error', summaryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch payroll summary' }, { status: 500 })
    }

    const summary = summaryData && summaryData.length > 0 ? summaryData[0] : null

    // Get salary details
    const { data: salary } = await supabase
      .from('employee_salary')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    // Get recent loans
    const { data: loans } = await supabase
      .from('employee_loans')
      .select('id, loan_type, loan_amount, emi_amount, total_outstanding, repayment_status')
      .eq('employee_id', employeeId)
      .eq('repayment_status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(5)

    // Get recent advances
    const { data: advances } = await supabase
      .from('salary_advances')
      .select('id, advance_amount, recovery_status, created_at')
      .eq('employee_id', employeeId)
      .eq('recovery_status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(5)

    // Get recent reimbursements
    const { data: reimbursements } = await supabase
      .from('employee_reimbursements')
      .select(`
        id,
        claim_amount,
        approval_status,
        payment_status,
        claim_date,
        category:reimbursement_categories(category_name)
      `)
      .eq('employee_id', employeeId)
      .in('approval_status', ['PENDING', 'MANAGER_APPROVED'])
      .order('created_at', { ascending: false })
      .limit(5)

    // Calculate net salary
    const grossSalary = salary?.gross_salary || 0
    const deductions = {
      loans: summary?.monthly_emi || 0,
      epf: summary?.epf_contribution || 0,
      esi: summary?.esi_contribution || 0,
      pt: summary?.pt_deduction || 0,
      total: (summary?.monthly_emi || 0) + (summary?.epf_contribution || 0) + (summary?.esi_contribution || 0) + (summary?.pt_deduction || 0)
    }
    const netSalary = grossSalary - deductions.total

    return NextResponse.json({
      success: true,
      data: {
        month,
        salary: {
          basic: salary?.basic_salary || 0,
          hra: salary?.hra || 0,
          special_allowance: salary?.special_allowance || 0,
          gross: grossSalary,
          net: netSalary
        },
        deductions,
        summary: {
          total_loans: summary?.total_loans || 0,
          total_loan_outstanding: summary?.total_loan_outstanding || 0,
          monthly_emi: summary?.monthly_emi || 0,
          pending_advances: summary?.pending_advances || 0,
          pending_reimbursements: summary?.pending_reimbursements || 0
        },
        statutory: {
          epf_contribution: summary?.epf_contribution || 0,
          esi_contribution: summary?.esi_contribution || 0,
          pt_deduction: summary?.pt_deduction || 0
        },
        recent_activity: {
          loans: loans || [],
          advances: advances || [],
          reimbursements: reimbursements || []
        }
      }
    })
  } catch (error) {
    apiLogger.error('Payroll Summary GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
