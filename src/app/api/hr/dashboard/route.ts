
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccessByUserId } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface EmployeeRecord {
  id: string
  employee_status?: string
  status?: string
  sub_role?: string
  role?: string
  department?: string
  date_of_joining?: string
  created_at?: string
  gender?: string
  resignation_date?: string
  updated_at?: string
}

interface BirthdayEmployee {
  id: string
  full_name: string
  date_of_birth: string
  department: string | null
  avatar_url: string | null
}

interface TrainingEnrollment {
  employee_id: string
  status: string
}

interface RiskScore {
  risk_level: string
}

/**
 * GET /api/hr/dashboard
 * Get HR dashboard statistics and overview data
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR (use admin client directly — avoids redundant auth.getUser call)
    const isHR = await checkHRAccessByUserId(adminClient, user.id)
    if (!isHR) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      )
    }

    // Use single timestamp throughout to avoid inconsistencies
    const now = new Date()
    // Use IST timezone for date comparisons (India-based HRIS)
    const todayISO = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // YYYY-MM-DD
    const currentMonth = todayISO.slice(0, 7) // YYYY-MM
    const currentYear = parseInt(todayISO.slice(0, 4), 10)

    // Get employee counts by status — select `department` (not department_id)
    // No .range() is intentional: dashboard needs all employees for aggregate calculations
    // (department distribution, gender stats, attrition rate, etc.). Safety cap of 5000
    // prevents runaway responses in edge cases.
    const { data: employees, error: empError } = await adminClient
      .from('employees')
      .select('id, employee_status, sub_role, department, date_of_joining, gender, resignation_date, updated_at, created_at')
      .is('deleted_at', null)
      .limit(5000)

    const warnings: string[] = []
    let employeeData: EmployeeRecord[] = []

    if (empError) {
      warnings.push(`Employee data fetch warning: ${empError.message || 'Unknown error'}. Using fallback data.`)
      apiLogger.warn('Failed to fetch employees table, attempting fallback', empError)
      // H12: Try fallback to employee_profile
      const { data: profiles, error: profileError } = await adminClient
        .from('employee_profile')
        .select('id, status, role, department, created_at, gender')
      if (profileError) {
        apiLogger.error('Both employees and employee_profile queries failed', { empError, profileError })
        return NextResponse.json(
          { success: false, error: 'Service temporarily unavailable: unable to fetch employee data' },
          { status: 503 }
        )
      }
      employeeData = (profiles || []).map((p: EmployeeRecord) => ({ ...p, employee_status: p.status }))
    } else {
      employeeData = employees || []
      // Try employee_profile if employees table returned empty
      if (employeeData.length === 0) {
        const { data: profiles } = await adminClient
          .from('employee_profile')
          .select('id, status, role, department, created_at, gender')
        employeeData = (profiles || []).map((p: EmployeeRecord) => ({ ...p, employee_status: p.status }))
      }
    }

    const getStatus = (e: EmployeeRecord) => (e.employee_status || e.status || '').toUpperCase()

    const activeEmployees = employeeData.filter((e: EmployeeRecord) =>
      getStatus(e) === 'ACTIVE'
    )
    const onLeave = employeeData.filter((e: EmployeeRecord) =>
      getStatus(e) === 'ON_LEAVE'
    )
    const onNotice = employeeData.filter((e: EmployeeRecord) =>
      getStatus(e) === 'ON_NOTICE' || getStatus(e) === 'RESIGNED'
    )
    const pendingOnboardingEmployees = employeeData.filter((e: EmployeeRecord) =>
      getStatus(e) === 'PENDING_ONBOARDING'
    )
    const pendingProfileReviewEmployees = employeeData.filter((e: EmployeeRecord) =>
      getStatus(e) === 'PENDING_PROFILE_REVIEW'
    )
    const needsCorrectionEmployees = employeeData.filter((e: EmployeeRecord) =>
      getStatus(e) === 'NEEDS_PROFILE_CORRECTION'
    )
    // Use IST-adjusted month/year for newThisMonth boundary comparison
    const istMonth = parseInt(todayISO.slice(5, 7), 10) - 1 // 0-indexed month
    const istYear = parseInt(todayISO.slice(0, 4), 10)
    const newThisMonth = employeeData.filter((e: EmployeeRecord) => {
      const raw = e.date_of_joining || e.created_at
      if (!raw) return false
      const joinDate = new Date(raw)
      if (isNaN(joinDate.getTime())) return false
      // Convert join date to IST for comparison
      const joinIST = joinDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const joinMonth = parseInt(joinIST.slice(5, 7), 10) - 1
      const joinYear = parseInt(joinIST.slice(0, 4), 10)
      return joinMonth === istMonth && joinYear === istYear
    })

    // Parallelize independent count queries
    const [
      { count: pendingReviews },
      { count: pendingLeaves },
      { count: activePips },
      { count: pendingOnboarding },
      { count: pendingResignations },
      { count: pendingSettlements },
      attendanceResult,
      leavesTodayResult,
      payrollResult,
    ] = await Promise.all([
      // Get pending reviews count
      adminClient
        .from('performance_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      // Get pending leave requests
      adminClient
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // Get active PIPs
      adminClient
        .from('performance_improvement_plans')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
      // Get pending onboarding sessions
      adminClient
        .from('onboarding_sessions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['NOT_STARTED', 'IN_PROGRESS']),
      // Get resignations pending approval
      adminClient
        .from('resignation_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      // Get pending final settlements
      adminClient
        .from('final_settlements')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'PROCESSING']),
      // Get present today from attendance_records
      adminClient
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('date', todayISO)
        .in('status', ['present', 'half_day']),
      // Get approved leaves for today (for absentToday calculation)
      adminClient
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .lte('start_date', todayISO)
        .gte('end_date', todayISO),
      // H2: Get current month's payroll from payroll_runs (not all active salaries)
      adminClient
        .from('payroll_runs')
        .select('total_net_salary')
        .eq('payroll_month', currentMonth + '-01')
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    // H2: Get payroll total from the current month's payroll run
    let totalPayrollThisMonth: number | null = null
    if (!payrollResult.error && payrollResult.data && payrollResult.data.length > 0) {
      totalPayrollThisMonth = (payrollResult.data[0] as { total_net_salary: number | null }).total_net_salary
    } else {
      // Fallback: sum active salaries if no payroll_run exists for this month
      const { data: salaryData, error: salaryError } = await adminClient
        .from('employee_salary')
        .select('net_salary')
        .eq('is_active', true)
      if (!salaryError && salaryData) {
        totalPayrollThisMonth = salaryData.reduce((sum: number, s: { net_salary: number | null }) => sum + (s.net_salary || 0), 0)
      }
    }

    // presentToday: actual attendance count, fallback to 0 if query fails
    const presentToday = attendanceResult.error ? 0 : (attendanceResult.count || 0)
    // onLeaveToday: approved leaves covering today
    const onLeaveToday = leavesTodayResult.error ? 0 : (leavesTodayResult.count || 0)
    // absentToday: active employees minus present minus on leave
    const absentToday = Math.max(0, activeEmployees.length - presentToday - onLeaveToday)

    // Get department distribution
    const deptMap = new Map<string, number>()
    activeEmployees.forEach((e: EmployeeRecord) => {
      const dept = e.department || 'Unassigned'
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
    })
    const departmentDistribution = Array.from(deptMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Get role distribution
    const roleMap = new Map<string, number>()
    activeEmployees.forEach((e: EmployeeRecord) => {
      const role = e.sub_role || e.role || 'Unassigned'
      roleMap.set(role, (roleMap.get(role) || 0) + 1)
    })
    const roleDistribution = Array.from(roleMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Get gender distribution
    const genderMap = new Map<string, number>()
    activeEmployees.forEach((e: EmployeeRecord) => {
      const gender = e.gender || 'Not Specified'
      genderMap.set(gender, (genderMap.get(gender) || 0) + 1)
    })
    const genderDistribution = Array.from(genderMap.entries())
      .map(([name, count]) => ({ name, count }))

    // H1: Calculate attrition rate using standard annualized formula
    // Formula: (leftThisYear / average headcount) * 100
    // Average headcount = (employees at start of year + current employees) / 2
    // Since we don't have start-of-year snapshot, approximate: start = active + left (those who were here at start)
    const leftThisYear = employeeData.filter((e: EmployeeRecord) => {
      const status = getStatus(e)
      if (status !== 'RESIGNED' && status !== 'TERMINATED') return false
      const raw = e.resignation_date || e.updated_at || e.created_at
      if (!raw) return false
      const leftDate = new Date(raw)
      if (isNaN(leftDate.getTime())) return false
      return leftDate.getFullYear() === currentYear
    }).length
    const employeesAtStart = activeEmployees.length + leftThisYear
    const avgHeadcount = (employeesAtStart + activeEmployees.length) / 2
    const attritionRate = avgHeadcount > 0
      ? Math.round((leftThisYear / avgHeadcount) * 100 * 10) / 10
      : 0

    // --- Intelligence Metrics & Content Queries (parallelized) ---

    // Run all intelligence + content queries in parallel
    const [
      bgvResult,
      openPosResult,
      trainingResult,
      riskResult,
      complianceResults,
      { data: recentActivities },
      { data: allBirthdayEmployees },
      { data: announcements },
    ] = await Promise.all([
      // BGV pending count
      adminClient
        .from("bgv_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "in_progress"])
        .then(r => r).catch(() => ({ count: 0, data: null, error: null })),
      // Open positions
      adminClient
        .from("job_requisitions")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .then(r => r).catch(() => ({ count: 0, data: null, error: null })),
      // Training compliance (mandatory programs)
      adminClient
        .from("training_enrollments")
        .select("employee_id, status")
        .eq("is_mandatory", true)
        .then(r => r).catch(() => ({ data: null, error: null })),
      // Attrition risk summary
      adminClient
        .from("attrition_risk_scores")
        .select("risk_level")
        .then(r => r).catch(() => ({ data: null, error: null })),
      // Compliance status (PF/ESI/PT)
      Promise.all([
        adminClient.from("epf_monthly_contributions").select("id, challan_status").eq("contribution_month", currentMonth + "-01").limit(1),
        adminClient.from("esi_monthly_contributions").select("id, challan_status").eq("contribution_month", currentMonth + "-01").limit(1),
        adminClient.from("pt_monthly_deductions").select("id, payment_status").eq("deduction_month", currentMonth + "-01").limit(1),
      ]).catch(() => [{ data: null }, { data: null }, { data: null }]),
      // M29: Recent activities — exclude user_id to prevent data leakage
      adminClient
        .from('audit_logs')
        .select('id, action, entity_type, description, created_at, status')
        .in('entity_type', ['employee', 'leave_application', 'performance_review', 'onboarding'])
        .order('created_at', { ascending: false })
        .limit(10),
      // Birthday employees
      adminClient
        .from('employees')
        .select('id, full_name, date_of_birth, department, avatar_url')
        .not('date_of_birth', 'is', null)
        .is('deleted_at', null),
      // Announcements
      adminClient
        .from('announcements')
        .select('id, title, content, created_at, priority')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    // Process BGV
    const bgvPendingCount = bgvResult?.count || 0

    // Process open positions
    const openPositionsCount = openPosResult?.count || 0

    // Process training compliance
    let trainingCompliancePct = 0
    const mandatoryEnrollments = trainingResult?.data as TrainingEnrollment[] | null
    if (mandatoryEnrollments && mandatoryEnrollments.length > 0) {
      const completed = mandatoryEnrollments.filter((e) => e.status === "completed").length
      trainingCompliancePct = Math.round((completed / mandatoryEnrollments.length) * 100)
    }

    // Process attrition risk
    let attritionRisk = { critical: 0, high: 0, medium: 0, low: 0 }
    const riskData = riskResult?.data as RiskScore[] | null
    if (riskData && riskData.length > 0) {
      attritionRisk = {
        critical: riskData.filter((r) => r.risk_level === "CRITICAL").length,
        high: riskData.filter((r) => r.risk_level === "HIGH").length,
        medium: riskData.filter((r) => r.risk_level === "MEDIUM").length,
        low: riskData.filter((r) => r.risk_level === "LOW").length,
      }
    }

    // Process compliance status
    let complianceStatus = { pf_paid: false, esi_paid: false, pt_paid: false }
    try {
      const [pfResult, esiResult, ptResult] = complianceResults as { data: Record<string, string>[] | null }[]
      const pfData = pfResult?.data
      const esiData = esiResult?.data
      const ptData = ptResult?.data
      complianceStatus = {
        pf_paid: !!(pfData && pfData.length > 0 && pfData[0].challan_status === "FILED"),
        esi_paid: !!(esiData && esiData.length > 0 && esiData[0].challan_status === "FILED"),
        pt_paid: !!(ptData && ptData.length > 0 && ptData[0].payment_status === "paid"),
      }
    } catch { complianceStatus = { pf_paid: false, esi_paid: false, pt_paid: false } }

    // M1: Filter and sort by upcoming birthday within next 30 days (IST timezone)
    const todayISTDate = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00+05:30')
    const currentYearIST = todayISTDate.getFullYear()
    const upcomingBirthdays = ((allBirthdayEmployees || []) as BirthdayEmployee[])
      .map((emp) => {
        const dobStr = new Date(emp.date_of_birth).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        const [, dobMonth, dobDay] = dobStr.split('-').map(Number)
        let nextBirthday = new Date(currentYearIST, dobMonth - 1, dobDay)
        if (nextBirthday < todayISTDate) {
          nextBirthday = new Date(currentYearIST + 1, dobMonth - 1, dobDay)
        }
        const daysUntil = Math.ceil((nextBirthday.getTime() - todayISTDate.getTime()) / (1000 * 60 * 60 * 24))
        return { ...emp, days_until_birthday: daysUntil }
      })
      .filter((emp) => emp.days_until_birthday >= 0 && emp.days_until_birthday <= 30)
      .sort((a, b) => a.days_until_birthday - b.days_until_birthday)
      .slice(0, 5)

    // Build response
    const dashboardData = {
      stats: {
        total_employees: employeeData.length,
        active_employees: activeEmployees.length,
        on_leave: onLeave.length,
        on_notice: onNotice.length,
        new_this_month: newThisMonth.length,
        attrition_rate: attritionRate,
        pending_reviews: pendingReviews || 0,
        pending_leaves: pendingLeaves || 0,
        active_pips: activePips || 0,
        pending_onboarding: pendingOnboarding || 0,
        pending_profile_onboarding: pendingOnboardingEmployees.length,
        pending_profile_reviews: pendingProfileReviewEmployees.length,
        needs_profile_correction: needsCorrectionEmployees.length,
        pending_resignations: pendingResignations || 0,
        pending_settlements: pendingSettlements || 0,
        total_payroll_this_month: totalPayrollThisMonth,
        present_today: presentToday,
        absent_today: absentToday,
        on_leave_today: onLeaveToday
      },
      intelligence: {
        bgv_pending: bgvPendingCount,
        open_positions: openPositionsCount,
        training_compliance_pct: trainingCompliancePct,
        attrition_risk: attritionRisk,
        compliance_status: complianceStatus,
      },
      charts: {
        department_distribution: departmentDistribution,
        role_distribution: roleDistribution,
        gender_distribution: genderDistribution
      },
      recent_activities: recentActivities || [],
      upcoming_birthdays: upcomingBirthdays || [],
      announcements: announcements || [],
      quick_actions: [
        { label: 'Add Employee', href: '/employees/hr/employees', count: null },
        { label: 'Profile Reviews', href: '/employees/hr/profile-reviews', count: pendingProfileReviewEmployees.length },
        { label: 'Pending Reviews', href: '/employees/hr/reviews', count: pendingReviews || 0 },
        { label: 'Leave Requests', href: '/employees/hr/employee-attendance', count: pendingLeaves || 0 },
        { label: 'Active PIPs', href: '/employees/hr/pip', count: activePips || 0 },
        { label: 'Onboarding', href: '/employees/hr/onboarding-management', count: pendingOnboarding || 0 },
        { label: 'Resignations', href: '/employees/hr/resignations', count: pendingResignations || 0 }
      ]
    }

    return NextResponse.json({
      success: true,
      data: dashboardData,
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Dashboard GET Error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
