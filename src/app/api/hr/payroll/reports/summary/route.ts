export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/hr/payroll/reports/summary
// Get payroll summary report (HR/Superadmin only)
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
        { success: false, error: 'Access denied. Only HR and Super Admin can view payroll reports' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    // Build query for payroll runs
    let query = adminClient
      .from('payroll_runs')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (year) {
      query = query.eq('year', parseInt(year))
    }

    if (month) {
      query = query.eq('month', parseInt(month))
    }

    const { data: payrollRuns, error } = await query

    if (error) {
      throw error
    }

    // Calculate summary statistics
    const totalRuns = payrollRuns?.length || 0
    const totalGrossSalary = payrollRuns?.reduce((sum, run) => sum + (run.total_gross_salary || 0), 0) || 0
    const totalDeductions = payrollRuns?.reduce((sum, run) => sum + (run.total_deductions || 0), 0) || 0
    const totalNetSalary = payrollRuns?.reduce((sum, run) => sum + (run.total_net_salary || 0), 0) || 0
    const totalEmployerContribution = payrollRuns?.reduce((sum, run) => sum + (run.total_employer_contribution || 0), 0) || 0
    const totalCTC = payrollRuns?.reduce((sum, run) => sum + (run.total_ctc || 0), 0) || 0
    const totalEmployees = payrollRuns?.reduce((sum, run) => sum + (run.total_employees || 0), 0) || 0

    // Status breakdown
    const statusBreakdown = {
      draft: payrollRuns?.filter(r => r.status === 'draft').length || 0,
      processing: payrollRuns?.filter(r => r.status === 'processing').length || 0,
      processed: payrollRuns?.filter(r => r.status === 'processed').length || 0,
      approved: payrollRuns?.filter(r => r.status === 'approved').length || 0,
      paid: payrollRuns?.filter(r => r.status === 'paid').length || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_runs: totalRuns,
          total_gross_salary: totalGrossSalary,
          total_deductions: totalDeductions,
          total_net_salary: totalNetSalary,
          total_employer_contribution: totalEmployerContribution,
          total_ctc: totalCTC,
          total_employees: totalEmployees,
          average_salary_per_employee: totalEmployees > 0 ? totalNetSalary / totalEmployees : 0
        },
        status_breakdown: statusBreakdown,
        payroll_runs: payrollRuns || []
      }
    })

  } catch (error) {
    apiLogger.error('Fetch payroll summary error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payroll summary' },
      { status: 500 }
    )
  }
}
