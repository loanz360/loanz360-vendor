import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { payrollRunsQuerySchema } from '@/lib/validations/hr-schemas'
import { checkHRAccess } from '@/lib/auth/hr-access'

// Statutory payroll constants (Indian labor law rates)
// Used as fallback when employee salary record doesn't have pre-calculated values
const PAYROLL_CONSTANTS = {
  PF_EMPLOYEE_RATE: 0.12,      // EPF Act 1952 - 12% of basic
  PF_EMPLOYER_RATE: 0.12,      // EPF Act 1952 - 12% of basic (3.67% EPF + 8.33% EPS)
  ESI_EMPLOYEE_RATE: 0.0075,   // ESI Act 1948 - 0.75% of gross (w.e.f. Jul 2019)
  ESI_EMPLOYER_RATE: 0.0325,   // ESI Act 1948 - 3.25% of gross (w.e.f. Jul 2019)
  ESI_WAGE_CEILING: 21000,     // ESI wage ceiling Rs.21,000/month
  PF_WAGE_CEILING: 15000,      // EPF wage ceiling Rs.15,000/month
  PROFESSIONAL_TAX_MAX: 200,   // Maximum monthly professional tax
} as const

// GET /api/hr/payroll/runs
// Fetch all payroll runs with optional filtering
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryParams = payrollRunsQuerySchema.safeParse({
      year: searchParams.get('year') || undefined,
      month: searchParams.get('month') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!queryParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { year, month, status, limit } = queryParams.data

    // Build query
    let query = adminClient
      .from('payroll_runs')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    // Apply filters
    if (year) {
      query = query.eq('year', year)
    }

    if (month) {
      query = query.eq('month', month)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data: payrollRuns, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: payrollRuns || []
    })

  } catch (error) {
    apiLogger.error('Fetch payroll runs error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payroll runs' },
      { status: 500 }
    )
  }
}

// POST /api/hr/payroll/runs
// Generate new payroll run (HR/Superadmin only)
export async function POST(request: Request) {
  let payrollRunId: string | null = null

  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can generate payroll' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      month: z.number().optional(),


      year: z.number().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { month, year } = body

    // Validate required fields
    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: 'Month and year are required' },
        { status: 400 }
      )
    }

    // Validate month and year ranges
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: 'Invalid month or year value' },
        { status: 400 }
      )
    }

    // Calculate period dates
    const periodStartDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const periodEndDate = new Date(year, month, 0).toISOString().split('T')[0]

    // Atomically insert payroll run — uses DB-level uniqueness to prevent duplicates
    // This prevents TOCTOU race conditions where two concurrent requests
    // both pass a "check if exists" query and then both insert
    const { data: payrollRun, error: createError } = await adminClient
      .from('payroll_runs')
      .insert({
        month,
        year,
        period_start_date: periodStartDate,
        period_end_date: periodEndDate,
        status: 'draft',
        processed_by: user.id
      })
      .select()
      .maybeSingle()

    if (createError) {
      // Check if it's a unique constraint violation (duplicate payroll)
      const errMsg = (createError.message || '').toLowerCase()
      if (errMsg.includes('unique') || errMsg.includes('duplicate') || createError.code === '23505') {
        // Fetch the existing run to show its status
        const { data: existing } = await adminClient
          .from('payroll_runs')
          .select('id, status')
          .eq('month', month)
          .eq('year', year)
          .maybeSingle()
        return NextResponse.json(
          {
            success: false,
            error: `Payroll for ${month}/${year} already exists with status: ${existing?.status || 'unknown'}`
          },
          { status: 409 }
        )
      }
      throw createError
    }

    if (!payrollRun) {
      return NextResponse.json(
        { success: false, error: 'Failed to create payroll run record' },
        { status: 500 }
      )
    }

    payrollRunId = payrollRun.id

    // Get all active employees with salary
    const { data: employees, error: empError } = await adminClient
      .from('employee_salary')
      .select(`
        *,
        employee_profile:user_id (
          user_id,
          first_name,
          last_name,
          employee_id,
          email,
          status
        )
      `)
      .eq('is_active', true)

    if (empError) {
      throw empError
    }

    if (!employees || employees.length === 0) {
      // Clean up the orphaned payroll run created before this check
      await adminClient.from('payroll_runs').delete().eq('id', payrollRun.id)
      return NextResponse.json(
        { success: false, error: 'No active employees found with salary configuration' },
        { status: 400 }
      )
    }

    // Get attendance data for this period
    const { data: attendanceData, error: attError } = await adminClient
      .from('attendance')
      .select('user_id, date, status, total_hours')
      .gte('date', periodStartDate)
      .lte('date', periodEndDate)

    if (attError) {
      apiLogger.error('Error fetching attendance', attError)
    }

    // Update status to 'processing' before computing payroll
    await adminClient
      .from('payroll_runs')
      .update({ status: 'processing' })
      .eq('id', payrollRun.id)

    // Fetch mandatory holidays for the payroll month
    const { data: holidaysData, error: holError } = await adminClient
      .from('holidays')
      .select('date')
      .gte('date', periodStartDate)
      .lte('date', periodEndDate)
      .eq('is_mandatory', true)

    if (holError) {
      apiLogger.error('Error fetching holidays', holError)
    }

    const holidayDates = (holidaysData || []).map(h => h.date)

    // Calculate total days and working days in month
    const totalDays = new Date(year, month, 0).getDate()
    const workingDays = calculateWorkingDays(year, month, holidayDates)

    // Pre-index attendance data by user_id for O(1) lookup instead of O(n) filter per employee
    const attendanceMap = new Map<string, typeof attendanceData>()
    if (attendanceData) {
      for (const a of attendanceData) {
        const existing = attendanceMap.get(a.user_id)
        if (existing) {
          existing.push(a)
        } else {
          attendanceMap.set(a.user_id, [a])
        }
      }
    }

    // Create payroll details for each employee
    const payrollDetails = []

    for (const emp of employees) {
      // Calculate attendance statistics
      const empAttendance = attendanceMap.get(emp.user_id) || []
      const presentDays = empAttendance.filter(a => a.status === 'present').length
      const absentDays = empAttendance.filter(a => a.status === 'absent').length
      const leaveDays = empAttendance.filter(a => a.status === 'leave').length

      // Calculate LOP (Loss of Pay) days
      const lopDays = Math.max(0, workingDays - presentDays - leaveDays)
      // Clamp LOP days so it never exceeds working days (H8 fix)
      const clampedLopDays = Math.min(lopDays, workingDays)

      // Calculate pro-rated salary based on attendance (guard against division by zero)
      const safeWorkingDays = workingDays > 0 ? workingDays : 1
      const attendanceRatio = Math.min(1, Math.max(0, clampedLopDays > 0 ? (safeWorkingDays - clampedLopDays) / safeWorkingDays : 1))
      // Calculate gross from salary components since emp.gross_salary may not exist (H3 fix)
      const empGrossSalary = (emp.basic_salary || 0) + (emp.hra || 0) + (emp.da || 0) +
        (emp.special_allowance || 0) + (emp.medical_allowance || 0) + (emp.conveyance_allowance || 0) +
        (emp.education_allowance || 0) + (emp.performance_bonus || 0) + (emp.other_allowances || 0)
      const lopAmount = empGrossSalary * (clampedLopDays / safeWorkingDays)

      // Calculate adjusted earnings
      const adjustedBasic = (emp.basic_salary || 0) * attendanceRatio
      const adjustedHRA = (emp.hra || 0) * attendanceRatio
      const adjustedDA = (emp.da || 0) * attendanceRatio
      const adjustedSpecial = (emp.special_allowance || 0) * attendanceRatio
      const adjustedMedical = (emp.medical_allowance || 0) * attendanceRatio
      const adjustedConveyance = (emp.conveyance_allowance || 0) * attendanceRatio
      const adjustedEducation = (emp.education_allowance || 0) * attendanceRatio
      const adjustedBonus = (emp.performance_bonus || 0) * attendanceRatio
      const adjustedOther = (emp.other_allowances || 0) * attendanceRatio

      const grossSalary = adjustedBasic + adjustedHRA + adjustedDA + adjustedSpecial +
                         adjustedMedical + adjustedConveyance + adjustedEducation +
                         adjustedBonus + adjustedOther

      // Calculate deductions (use DB values if explicitly set, fallback to statutory rates)
      // Use ?? instead of || so that explicitly set 0 values (opt-out) are preserved
      const pfBase = Math.min(adjustedBasic, PAYROLL_CONSTANTS.PF_WAGE_CEILING)
      const pfEmployee = (emp.pf_employee ?? (pfBase * PAYROLL_CONSTANTS.PF_EMPLOYEE_RATE)) * attendanceRatio
      const esiEmployee = (emp.esi_employee ?? (grossSalary <= PAYROLL_CONSTANTS.ESI_WAGE_CEILING ? grossSalary * PAYROLL_CONSTANTS.ESI_EMPLOYEE_RATE : 0)) * attendanceRatio
      // Professional tax: use DB value if explicitly set, else apply Indian PT slabs (H4 fix)
      const ptFallback = empGrossSalary <= 10000 ? 0 : empGrossSalary <= 15000 ? 150 : 200
      const pt = emp.professional_tax ?? ptFallback
      const tds = emp.tds || 0
      const loanDed = emp.loan_deduction || 0
      const advanceDed = emp.advance_deduction || 0
      const otherDed = emp.other_deductions || 0

      const totalDeductions = pfEmployee + esiEmployee + pt + tds + loanDed + advanceDed + otherDed
      const netSalary = grossSalary - totalDeductions
      const finalNetSalary = Math.max(0, netSalary)

      if (netSalary < 0) {
        apiLogger.warn(`Negative net salary detected for user ${emp.user_id}: ${netSalary}. Clamped to 0.`)
      }

      payrollDetails.push({
        payroll_run_id: payrollRun.id,
        user_id: emp.user_id,
        employee_salary_id: emp.id,
        total_days: totalDays,
        working_days: workingDays,
        present_days: presentDays,
        absent_days: absentDays,
        paid_leaves: leaveDays,
        unpaid_leaves: 0,
        lop_days: lopDays,
        overtime_hours: 0,
        basic_salary: adjustedBasic,
        hra: adjustedHRA,
        da: adjustedDA,
        special_allowance: adjustedSpecial,
        medical_allowance: adjustedMedical,
        conveyance_allowance: adjustedConveyance,
        education_allowance: adjustedEducation,
        performance_bonus: adjustedBonus,
        overtime_amount: 0,
        other_allowances: adjustedOther,
        gross_salary: grossSalary,
        pf_employee: pfEmployee,
        pf_employer: (emp.pf_employer ?? (pfBase * PAYROLL_CONSTANTS.PF_EMPLOYER_RATE)) * attendanceRatio,
        esi_employee: esiEmployee,
        esi_employer: (emp.esi_employer ?? (grossSalary <= PAYROLL_CONSTANTS.ESI_WAGE_CEILING ? grossSalary * PAYROLL_CONSTANTS.ESI_EMPLOYER_RATE : 0)) * attendanceRatio,
        professional_tax: pt,
        tds: tds,
        loan_deduction: loanDed,
        advance_deduction: advanceDed,
        lop_amount: lopAmount,
        other_deductions: otherDed,
        total_deductions: totalDeductions,
        net_salary: finalNetSalary,
        payment_status: 'pending',
        bank_account_number: emp.bank_account_number,
        bank_name: emp.bank_name,
        bank_ifsc: emp.bank_ifsc
      })
    }

    // Insert all payroll details
    const { error: detailsError } = await adminClient
      .from('payroll_details')
      .insert(payrollDetails)

    if (detailsError) {
      throw detailsError
    }

    // Calculate totals
    const totalGross = payrollDetails.reduce((sum, d) => sum + (d.gross_salary || 0), 0)
    const totalDed = payrollDetails.reduce((sum, d) => sum + (d.total_deductions || 0), 0)
    const totalNet = payrollDetails.reduce((sum, d) => sum + (d.net_salary || 0), 0)
    const totalEmpContrib = payrollDetails.reduce((sum, d) => sum + ((d.pf_employer || 0) + (d.esi_employer || 0)), 0)

    // Update payroll run with statistics
    await adminClient
      .from('payroll_runs')
      .update({
        total_employees: employees.length,
        total_gross_salary: totalGross,
        total_deductions: totalDed,
        total_net_salary: totalNet,
        total_employer_contribution: totalEmpContrib,
        total_ctc: totalGross + totalEmpContrib,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', payrollRun.id)

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'payroll_run',
        entity_id: payrollRun.id,
        description: `Generated payroll for ${month}/${year} - ${employees.length} employees`,
        details: { month, year, total_employees: employees.length, total_gross: totalGross, total_net: totalNet }
      })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for payroll run generation', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      data: {
        payroll_run: payrollRun,
        employees_processed: employees.length,
        total_gross_salary: totalGross,
        total_net_salary: totalNet
      },
      message: `Payroll generated successfully for ${month}/${year}`
    })

  } catch (error) {
    apiLogger.error('Generate payroll error', error)
    logApiError(error as Error, request, { action: 'create' })

    // Attempt to revert payroll run status back to 'draft' if it was created
    if (payrollRunId) {
      try {
        const revertSupabase = createSupabaseAdmin()
        await revertSupabase
          .from('payroll_runs')
          .update({ status: 'draft' })
          .eq('id', payrollRunId)
          .eq('status', 'processing')
      } catch (revertError) {
        apiLogger.error('Failed to revert payroll run status', revertError)
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate payroll' },
      { status: 500 }
    )
  }
}

// Helper function to calculate working days (excluding Saturdays, Sundays, and holidays)
// For the current month, only counts working days up to today to avoid counting
// future days as LOP. For past months, uses the full month.
function calculateWorkingDays(year: number, month: number, holidays: string[] = []): number {
  const totalDaysInMonth = new Date(year, month, 0).getDate()

  // Determine the last day to count: for the current month, cap at today;
  // for past months, use the full month end
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const lastDay = isCurrentMonth
    ? Math.min(today.getDate(), totalDaysInMonth)
    : totalDaysInMonth

  let workingDays = 0

  // Build a Set of holiday date strings for O(1) lookup
  const holidaySet = new Set(holidays)

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    // Exclude Saturdays (day 6) and Sundays (day 0)
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue
    }
    // Exclude mandatory holidays (format as YYYY-MM-DD to match DB date format)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (holidaySet.has(dateStr)) {
      continue
    }
    workingDays++
  }

  return workingDays
}
