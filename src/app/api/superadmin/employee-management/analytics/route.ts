import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, getAccessibleDepartments } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/superadmin/employee-management/analytics
 * Get comprehensive analytics for Employee Management Dashboard
 * Tab 1: Analytics Dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_ANALYTICS')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const departmentFilter = searchParams.get('department')
    const timeFilter = searchParams.get('time_filter') || 'monthly' // monthly, quarterly, yearly

    const supabase = createSupabaseAdmin()

    // Base query builder
    let employeeQuery = supabase
      .from('employees')
      .select('*')
      .is('deleted_at', null)

    // Only filter by department for HR role (Super Admin sees all)
    if (auth.role === 'HR') {
      const accessibleDepartments = await getAccessibleDepartments(auth.userId!, auth.role!)
      if (accessibleDepartments.length > 0) {
        employeeQuery = employeeQuery.in('department_id', accessibleDepartments)
      }
    }

    if (departmentFilter) {
      employeeQuery = employeeQuery.eq('department_id', departmentFilter)
    }

    const { data: employees } = await employeeQuery

    // Calculate date ranges based on time filter
    const now = new Date()
    let startDate: Date
    let previousPeriodStart: Date
    let previousPeriodEnd: Date

    switch (timeFilter) {
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1)
        previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1)
        previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31)
        break
      case 'quarterly':
        const currentQuarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
        previousPeriodStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1)
        previousPeriodEnd = new Date(now.getFullYear(), currentQuarter * 3, 0)
        break
      default: // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    }

    // 1. TOTAL EMPLOYEES
    const totalEmployees = employees?.length || 0
    const activeEmployees = employees?.filter(e => e.is_active).length || 0
    const inactiveEmployees = totalEmployees - activeEmployees

    // Employees added in current period
    const newEmployeesThisPeriod = employees?.filter(e => {
      const joinDate = new Date(e.joining_date)
      return joinDate >= startDate && joinDate <= now
    }).length || 0

    // Employees added in previous period
    const newEmployeesPreviousPeriod = employees?.filter(e => {
      const joinDate = new Date(e.joining_date)
      return joinDate >= previousPeriodStart && joinDate <= previousPeriodEnd
    }).length || 0

    // Calculate growth percentage
    const growthPercentage = previousPeriodEnd
      ? ((newEmployeesThisPeriod - newEmployeesPreviousPeriod) / (newEmployeesPreviousPeriod || 1)) * 100
      : 0

    // 2. DEPARTMENT-WISE BREAKDOWN
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, code, department_type, employee_count')
      .eq('is_active', true)
      .order('employee_count', { ascending: false })

    const departmentStats = departments?.map(dept => {
      const deptEmployees = employees?.filter(e => e.department_id === dept.id) || []
      return {
        department_id: dept.id,
        department_name: dept.name,
        department_code: dept.code,
        department_type: dept.department_type,
        total_employees: deptEmployees.length,
        active_employees: deptEmployees.filter(e => e.is_active).length,
        inactive_employees: deptEmployees.filter(e => !e.is_active).length,
        new_joiners_this_period: deptEmployees.filter(e => {
          const joinDate = new Date(e.joining_date)
          return joinDate >= startDate && joinDate <= now
        }).length
      }
    }) || []

    // 3. SUB-ROLE WISE BREAKDOWN
    const subRoleCounts = employees?.reduce((acc: any, emp) => {
      const role = emp.sub_role
      if (!acc[role]) {
        acc[role] = {
          sub_role: role,
          total: 0,
          active: 0,
          inactive: 0
        }
      }
      acc[role].total++
      if (emp.is_active) {
        acc[role].active++
      } else {
        acc[role].inactive++
      }
      return acc
    }, {})

    const subRoleStats = Object.values(subRoleCounts || {})

    // 4. STATUS BREAKDOWN
    const statusBreakdown = employees?.reduce((acc: any, emp) => {
      const status = emp.employee_status
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // 5. MONTHLY TREND DATA (Last 12 months)
    const monthlyTrend = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

      const joinedInMonth = employees?.filter(e => {
        const joinDate = new Date(e.joining_date)
        return joinDate >= monthStart && joinDate <= monthEnd
      }).length || 0

      // Note: date_of_leaving column doesn't exist in schema yet
      const leftInMonth = 0

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        joined: joinedInMonth,
        left: leftInMonth,
        net_change: joinedInMonth - leftInMonth
      })
    }

    // 6. ADDITIONAL INSIGHTS
    // Note: date_of_birth column doesn't exist in schema yet
    const avgEmployeeAge = 0

    const avgTenure = employees?.reduce((sum, emp) => {
      const joinDate = new Date(emp.joining_date)
      const tenure = (now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
      return sum + tenure
    }, 0) / (employees?.length || 1) || 0

    // Gender distribution
    // Note: gender column doesn't exist in schema yet
    const genderDistribution = {}

    // 7. PROBATION STATUS
    const onProbation = employees?.filter(e => {
      if (!e.probation_end_date) return false
      return new Date(e.probation_end_date) > now
    }).length || 0

    const probationEnding = employees?.filter(e => {
      if (!e.probation_end_date) return false
      const endDate = new Date(e.probation_end_date)
      const daysLeft = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return daysLeft > 0 && daysLeft <= 30
    }).length || 0

    // 8. COMPLIANCE METRICS
    // Note: profile_completed column doesn't exist in schema yet
    const profileIncomplete = 0
    const pendingOnboarding = employees?.filter(e => e.employee_status === 'PENDING_ONBOARDING').length || 0
    const missingReportingManager = employees?.filter(e => !e.reporting_manager_id).length || 0

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_employees: totalEmployees,
          active_employees: activeEmployees,
          inactive_employees: inactiveEmployees,
          new_joiners_this_period: newEmployeesThisPeriod,
          growth_percentage: Math.round(growthPercentage * 100) / 100,
          on_probation: onProbation,
          probation_ending_soon: probationEnding
        },
        department_stats: departmentStats,
        sub_role_stats: subRoleStats,
        status_breakdown: statusBreakdown,
        monthly_trend: monthlyTrend,
        insights: {
          average_age: Math.round(avgEmployeeAge * 10) / 10,
          average_tenure_years: Math.round(avgTenure * 10) / 10,
          gender_distribution: genderDistribution
        },
        compliance: {
          profile_incomplete: profileIncomplete,
          pending_onboarding: pendingOnboarding,
          missing_reporting_manager: missingReportingManager
        },
        filters: {
          time_filter: timeFilter,
          department: departmentFilter,
          period_start: startDate.toISOString(),
          period_end: now.toISOString()
        }
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
