import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, getAccessibleDepartments } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

// Role-specific KPI definitions
const ROLE_KPI_DEFINITIONS: Record<string, string[]> = {
  CRO: ['calls_made', 'positive_contacts', 'follow_ups', 'logins', 'sanctions', 'rejections'],
  BUSINESS_DEVELOPMENT_EXECUTIVE: ['meetings', 'prospects', 'proposals_sent', 'deals_closed', 'approvals'],
  BUSINESS_DEVELOPMENT_MANAGER: ['team_performance', 'meetings', 'deals_closed', 'revenue_generated', 'approvals'],
  OPERATIONS_EXECUTIVE: ['cases_processed', 'approvals', 'tat_hours', 'accuracy_score', 'pending_cases'],
  OPERATIONS_MANAGER: ['team_cases', 'team_tat', 'quality_score', 'escalations_resolved'],
  FINANCE_EXECUTIVE: ['invoices_processed', 'payment_accuracy', 'reconciliations', 'reports_generated'],
  ACCOUNTS_EXECUTIVE: ['entries_processed', 'accuracy_rate', 'reconciliations', 'reports'],
  ACCOUNTS_MANAGER: ['team_accuracy', 'monthly_closures', 'audit_compliance', 'reports'],
  HR_EXECUTIVE: ['interviews_conducted', 'offers_released', 'onboarding_completed', 'queries_resolved'],
  HR_MANAGER: ['hiring_count', 'offer_to_join_ratio', 'employee_satisfaction', 'attrition_rate'],
  CUSTOMER_SUPPORT_EXECUTIVE: ['tickets_resolved', 'response_time', 'satisfaction_score', 'escalations'],
  CUSTOMER_SUPPORT_MANAGER: ['team_performance', 'resolution_rate', 'satisfaction_avg', 'sla_compliance']
}

/**
 * GET /api/superadmin/employee-management/performance
 * Get performance dashboard data with role-specific KPIs
 * Tab 2: Performance Dashboard
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

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_PERFORMANCE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('department')
    const subRole = searchParams.get('sub_role')
    const employeeId = searchParams.get('employee_id')
    const periodType = searchParams.get('period') || 'MONTHLY'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    // Get accessible departments
    const accessibleDepartments = await getAccessibleDepartments(auth.userId!, auth.role!)

    // Build employee query
    let employeeQuery = supabase
      .from('employees')
      .select(`
        id,
        employee_id,
        full_name,
        sub_role,
        department_id,
        work_email,
        profile_photo_url,
        date_of_joining,
        departments:department_id (
          id,
          name,
          code
        )
      `)
      .is('deleted_at', null)
      .eq('is_active', true)

    // Apply department filters
    // For SUPER_ADMIN: If no departments exist, don't filter by department (show all employees)
    // For HR: Only show employees from their department
    if (auth.role === 'HR' && accessibleDepartments.length > 0) {
      employeeQuery = employeeQuery.in('department_id', accessibleDepartments)
    } else if ((auth.role === 'SUPER_ADMIN' || auth.role === 'ADMIN') && departmentId) {
      // For SUPER_ADMIN/ADMIN: If specific department requested, filter by it
      employeeQuery = employeeQuery.eq('department_id', departmentId)
    }
    // Skip the accessibleDepartments filter for SUPER_ADMIN/ADMIN
    // to allow seeing employees even if no departments are set up yet

    if (subRole) {
      employeeQuery = employeeQuery.eq('sub_role', subRole)
    }

    if (employeeId) {
      employeeQuery = employeeQuery.eq('id', employeeId)
    }

    // Get total count
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_active', true)

    // Pagination
    employeeQuery = employeeQuery
      .range(offset, offset + limit - 1)
      .order('full_name', { ascending: true })

    const { data: employees, error: employeeError } = await employeeQuery

    if (employeeError) {
      logger.error('Error fetching employees for performance:', employeeError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    // Build performance query
    let performanceQuery = supabase
      .from('employee_performance_logs')
      .select('*')
      .eq('period_type', periodType)
      .order('period_end', { ascending: false })

    if (startDate) {
      performanceQuery = performanceQuery.gte('period_start', startDate)
    }

    if (endDate) {
      performanceQuery = performanceQuery.lte('period_end', endDate)
    }

    if (employeeId) {
      performanceQuery = performanceQuery.eq('employee_id', employeeId)
    } else if (employees) {
      const employeeIds = employees.map(e => e.id)
      performanceQuery = performanceQuery.in('employee_id', employeeIds)
    }

    const { data: performanceLogs } = await performanceQuery

    // Build employee performance data
    const employeePerformance = await Promise.all(
      (employees || []).map(async (employee) => {
        // Get performance logs for this employee
        const empLogs = performanceLogs?.filter(log => log.employee_id === employee.id) || []

        // Get latest performance log
        const latestLog = empLogs[0]

        // Get active targets
        const { data: activeTargets } = await supabase
          .from('employee_targets')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString().split('T')[0])
          .order('end_date', { ascending: false })

        // Calculate summary metrics
        const avgProductivityScore =
          empLogs.reduce((sum, log) => sum + (log.productivity_score || 0), 0) /
          (empLogs.length || 1)

        const avgAchievementPercentage =
          activeTargets?.reduce((sum, target) => sum + (target.achievement_percentage || 0), 0) /
          (activeTargets?.length || 1) || 0

        // Get role-specific KPIs
        const roleKPIs = ROLE_KPI_DEFINITIONS[employee.sub_role] || []

        // Extract latest KPI values from performance metrics
        const latestKPIs: Record<string, any> = {}
        if (latestLog?.performance_metrics) {
          roleKPIs.forEach(kpi => {
            latestKPIs[kpi] = latestLog.performance_metrics[kpi] || 0
          })
        }

        // Get target vs achieved for active targets
        const targetVsAchieved = activeTargets?.map(target => ({
          target_id: target.id,
          target_name: target.target_name,
          period: target.target_period,
          target_metrics: target.target_metrics,
          achieved_metrics: target.achieved_metrics,
          achievement_percentage: target.achievement_percentage,
          is_achieved: target.is_achieved,
          start_date: target.start_date,
          end_date: target.end_date
        })) || []

        return {
          employee: {
            id: employee.id,
            employee_id: employee.employee_id,
            full_name: employee.full_name,
            sub_role: employee.sub_role,
            work_email: employee.work_email,
            profile_photo_url: employee.profile_photo_url,
            date_of_joining: employee.date_of_joining,
            department: employee.departments
          },
          performance_summary: {
            latest_rating: latestLog?.performance_rating || null,
            productivity_score: Math.round(avgProductivityScore * 100) / 100,
            achievement_percentage: Math.round(avgAchievementPercentage * 100) / 100,
            rank_in_team: latestLog?.rank_in_team || null,
            rank_in_department: latestLog?.rank_in_department || null
          },
          kpis: {
            role: employee.sub_role,
            available_kpis: roleKPIs,
            latest_values: latestKPIs
          },
          targets: {
            active_count: activeTargets?.length || 0,
            achieved_count: activeTargets?.filter(t => t.is_achieved).length || 0,
            target_vs_achieved: targetVsAchieved
          },
          recent_performance: empLogs.slice(0, 6).map(log => ({
            id: log.id,
            period_start: log.period_start,
            period_end: log.period_end,
            period_type: log.period_type,
            productivity_score: log.productivity_score,
            performance_rating: log.performance_rating,
            metrics: log.performance_metrics,
            achievements: log.achievements,
            areas_of_improvement: log.areas_of_improvement
          }))
        }
      })
    )

    // Calculate department-level aggregates
    const departmentAggregates: Record<string, any> = {}
    if (employees) {
      for (const emp of employees) {
        const deptId = emp.department_id
        if (deptId && !departmentAggregates[deptId]) {
          departmentAggregates[deptId] = {
            department: emp.departments,
            employee_count: 0,
            avg_productivity: 0,
            avg_achievement: 0,
            top_performers: []
          }
        }
        if (deptId) {
          departmentAggregates[deptId].employee_count++
        }
      }

      // Calculate averages
      for (const perfData of employeePerformance) {
        const deptId = perfData.employee.department?.id
        if (deptId && departmentAggregates[deptId]) {
          departmentAggregates[deptId].avg_productivity +=
            perfData.performance_summary.productivity_score
          departmentAggregates[deptId].avg_achievement +=
            perfData.performance_summary.achievement_percentage
        }
      }

      Object.values(departmentAggregates).forEach((dept: any) => {
        dept.avg_productivity =
          Math.round((dept.avg_productivity / dept.employee_count) * 100) / 100
        dept.avg_achievement =
          Math.round((dept.avg_achievement / dept.employee_count) * 100) / 100
      })
    }

    // Get top performers (top 10 by productivity score)
    const topPerformers = [...employeePerformance]
      .sort((a, b) => b.performance_summary.productivity_score - a.performance_summary.productivity_score)
      .slice(0, 10)
      .map((perf, index) => ({
        rank: index + 1,
        employee_id: perf.employee.employee_id,
        employee_name: perf.employee.full_name,
        sub_role: perf.employee.sub_role,
        productivity_score: perf.performance_summary.productivity_score,
        achievement_percentage: perf.performance_summary.achievement_percentage,
        rating: perf.performance_summary.latest_rating
      }))

    return NextResponse.json({
      success: true,
      data: {
        employees: employeePerformance,
        department_aggregates: Object.values(departmentAggregates),
        top_performers: topPerformers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        filters: {
          department: departmentId,
          sub_role: subRole,
          period: periodType,
          start_date: startDate,
          end_date: endDate
        }
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/performance:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
