export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/hr/payroll/reports/employee
// Get employee-wise payroll report (HR sees all, employees see their own)
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check user role
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const year = searchParams.get('year')
    const startMonth = searchParams.get('start_month')
    const endMonth = searchParams.get('end_month')

    // Determine target user
    let targetUserId = user.id
    if (isHROrAdmin && employeeId) {
      targetUserId = employeeId
    }

    // Get employee details
    const { data: employee, error: empError } = await adminClient
      .from('employee_profile')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Build query for payroll details
    let query = adminClient
      .from('payroll_details')
      .select(`
        *,
        payroll_runs!payroll_details_payroll_run_id_fkey (
          month,
          year,
          period_start_date,
          period_end_date,
          status,
          payment_date
        )
      `)
      .eq('user_id', targetUserId)
      .order('payroll_run_id', { ascending: false })

    const { data: payrollDetails, error } = await query

    if (error) {
      throw error
    }

    // Filter by year and month range if provided
    let filteredDetails = payrollDetails || []
    if (year) {
      filteredDetails = filteredDetails.filter(d => d.payroll_runs?.year === parseInt(year))
    }
    if (startMonth && endMonth) {
      filteredDetails = filteredDetails.filter(d => {
        const month = d.payroll_runs?.month
        return month && month >= parseInt(startMonth) && month <= parseInt(endMonth)
      })
    }

    // Calculate statistics
    const totalMonths = filteredDetails.length
    const totalGross = filteredDetails.reduce((sum, d) => sum + (d.gross_salary || 0), 0)
    const totalDeductions = filteredDetails.reduce((sum, d) => sum + (d.total_deductions || 0), 0)
    const totalNet = filteredDetails.reduce((sum, d) => sum + (d.net_salary || 0), 0)
    const totalLOP = filteredDetails.reduce((sum, d) => sum + (d.lop_amount || 0), 0)
    const totalPresentDays = filteredDetails.reduce((sum, d) => sum + (d.present_days || 0), 0)
    const totalAbsentDays = filteredDetails.reduce((sum, d) => sum + (d.absent_days || 0), 0)

    // Component-wise breakdown
    const componentBreakdown = {
      earnings: {
        basic: filteredDetails.reduce((sum, d) => sum + (d.basic_salary || 0), 0),
        hra: filteredDetails.reduce((sum, d) => sum + (d.hra || 0), 0),
        da: filteredDetails.reduce((sum, d) => sum + (d.da || 0), 0),
        special_allowance: filteredDetails.reduce((sum, d) => sum + (d.special_allowance || 0), 0),
        medical: filteredDetails.reduce((sum, d) => sum + (d.medical_allowance || 0), 0),
        conveyance: filteredDetails.reduce((sum, d) => sum + (d.conveyance_allowance || 0), 0),
        education: filteredDetails.reduce((sum, d) => sum + (d.education_allowance || 0), 0),
        bonus: filteredDetails.reduce((sum, d) => sum + (d.performance_bonus || 0), 0),
        other: filteredDetails.reduce((sum, d) => sum + (d.other_allowances || 0), 0)
      },
      deductions: {
        pf: filteredDetails.reduce((sum, d) => sum + (d.pf_employee || 0), 0),
        esi: filteredDetails.reduce((sum, d) => sum + (d.esi_employee || 0), 0),
        pt: filteredDetails.reduce((sum, d) => sum + (d.professional_tax || 0), 0),
        tds: filteredDetails.reduce((sum, d) => sum + (d.tds || 0), 0),
        loan: filteredDetails.reduce((sum, d) => sum + (d.loan_deduction || 0), 0),
        advance: filteredDetails.reduce((sum, d) => sum + (d.advance_deduction || 0), 0),
        lop: totalLOP,
        other: filteredDetails.reduce((sum, d) => sum + (d.other_deductions || 0), 0)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          user_id: employee.user_id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.last_name}`,
          email: employee.email,
          department: employee.department,
          designation: employee.designation
        },
        summary: {
          total_months: totalMonths,
          total_gross_salary: totalGross,
          total_deductions: totalDeductions,
          total_net_salary: totalNet,
          total_lop_amount: totalLOP,
          total_present_days: totalPresentDays,
          total_absent_days: totalAbsentDays,
          average_monthly_gross: totalMonths > 0 ? totalGross / totalMonths : 0,
          average_monthly_net: totalMonths > 0 ? totalNet / totalMonths : 0
        },
        component_breakdown: componentBreakdown,
        monthly_details: filteredDetails.map(d => ({
          month: d.payroll_runs?.month,
          year: d.payroll_runs?.year,
          period: `${d.payroll_runs?.period_start_date} to ${d.payroll_runs?.period_end_date}`,
          working_days: d.working_days,
          present_days: d.present_days,
          absent_days: d.absent_days,
          lop_days: d.lop_days,
          gross_salary: d.gross_salary,
          total_deductions: d.total_deductions,
          net_salary: d.net_salary,
          payment_status: d.payment_status,
          payment_date: d.payment_date
        }))
      }
    })

  } catch (error) {
    apiLogger.error('Fetch employee payroll report error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employee payroll report' },
      { status: 500 }
    )
  }
}
