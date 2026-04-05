export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/hr/payroll/reports/department
// Get department-wise payroll report (HR/Superadmin only)
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

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can view department reports' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const department = searchParams.get('department')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    // Get payroll run for the specified month/year
    const { data: payrollRun, error: runError } = await adminClient
      .from('payroll_runs')
      .select('id, month, year, status')
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .maybeSingle()

    if (runError || !payrollRun) {
      return NextResponse.json(
        { success: false, error: 'Payroll run not found for specified month/year' },
        { status: 404 }
      )
    }

    // Get all payroll details for this run with employee information
    const { data: payrollDetails, error: detailsError } = await adminClient
      .from('payroll_details')
      .select(`
        *,
        employee_profile!payroll_details_user_id_fkey (
          user_id,
          first_name,
          last_name,
          employee_id,
          email,
          department,
          designation
        )
      `)
      .eq('payroll_run_id', payrollRun.id)

    if (detailsError) {
      throw detailsError
    }

    // Filter by department if specified
    let filteredDetails = payrollDetails || []
    if (department) {
      filteredDetails = filteredDetails.filter(d => d.employee_profile?.department === department)
    }

    // Group by department
    const departmentMap = new Map()

    filteredDetails.forEach(detail => {
      const dept = detail.employee_profile?.department || 'Unknown'

      if (!departmentMap.has(dept)) {
        departmentMap.set(dept, {
          department: dept,
          employee_count: 0,
          total_gross_salary: 0,
          total_deductions: 0,
          total_net_salary: 0,
          total_lop_amount: 0,
          total_present_days: 0,
          total_absent_days: 0,
          employees: []
        })
      }

      const deptData = departmentMap.get(dept)
      deptData.employee_count++
      deptData.total_gross_salary += detail.gross_salary || 0
      deptData.total_deductions += detail.total_deductions || 0
      deptData.total_net_salary += detail.net_salary || 0
      deptData.total_lop_amount += detail.lop_amount || 0
      deptData.total_present_days += detail.present_days || 0
      deptData.total_absent_days += detail.absent_days || 0
      deptData.employees.push({
        user_id: detail.employee_profile?.user_id,
        employee_id: detail.employee_profile?.employee_id,
        name: `${detail.employee_profile?.first_name} ${detail.employee_profile?.last_name}`,
        designation: detail.employee_profile?.designation,
        gross_salary: detail.gross_salary,
        net_salary: detail.net_salary,
        present_days: detail.present_days,
        lop_days: detail.lop_days
      })
    })

    // Convert map to array and calculate averages
    const departmentBreakdown = Array.from(departmentMap.values()).map(dept => ({
      ...dept,
      average_gross_salary: dept.employee_count > 0 ? dept.total_gross_salary / dept.employee_count : 0,
      average_net_salary: dept.employee_count > 0 ? dept.total_net_salary / dept.employee_count : 0,
      average_present_days: dept.employee_count > 0 ? dept.total_present_days / dept.employee_count : 0
    }))

    // Sort by total net salary descending
    departmentBreakdown.sort((a, b) => b.total_net_salary - a.total_net_salary)

    // Calculate overall summary
    const totalEmployees = filteredDetails.length
    const totalGross = filteredDetails.reduce((sum, d) => sum + (d.gross_salary || 0), 0)
    const totalDeductions = filteredDetails.reduce((sum, d) => sum + (d.total_deductions || 0), 0)
    const totalNet = filteredDetails.reduce((sum, d) => sum + (d.net_salary || 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        payroll_run: {
          month: payrollRun.month,
          year: payrollRun.year,
          status: payrollRun.status
        },
        summary: {
          total_departments: departmentBreakdown.length,
          total_employees: totalEmployees,
          total_gross_salary: totalGross,
          total_deductions: totalDeductions,
          total_net_salary: totalNet,
          average_salary_per_employee: totalEmployees > 0 ? totalNet / totalEmployees : 0
        },
        department_breakdown: departmentBreakdown
      }
    })

  } catch (error) {
    apiLogger.error('Fetch department payroll report error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch department payroll report' },
      { status: 500 }
    )
  }
}
