
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { checkHRAccessByUserId } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

interface EmployeeRecord {
  id: string
  employee_status?: string
  status?: string
  department?: string
  department_id?: string
  date_of_joining?: string
  created_at?: string
}

interface BirthdayEmployee {
  id: string
  full_name: string
  date_of_birth: string
  department: string | null
  avatar_url: string | null
}

interface AuditLogRecord {
  id: string
  action: string
  entity_type: string
  created_at: string
  user_id: string
  status: string
}

/**
 * GET /api/hr/dashboard/batch
 *
 * Batch endpoint that combines core dashboard data into a single response.
 * Replaces multiple individual API calls with one parallelised query.
 *
 * Returns: stats, birthdays, recentActivities, departmentStats
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Authorise (use admin client to bypass RLS)
    const isHR = await checkHRAccessByUserId(adminClient, user.id)
    if (!isHR) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      )
    }
    const today = new Date()
    // Use IST timezone for date comparisons (India-based HRIS)
    const todayISO = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

    // Execute all queries in parallel
    const [
      employeesResult,
      attendanceResult,
      pendingLeavesResult,
      leavesTodayResult,
      birthdayEmployeesResult,
      recentActivitiesResult,
    ] = await Promise.all([
      // All active employees (for total count + department breakdown)
      adminClient
        .from('employees')
        .select('id, employee_status, department, date_of_joining, created_at')
        .is('deleted_at', null),

      // Today's attendance (present + half-day)
      adminClient
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('date', todayISO)
        .in('status', ['present', 'half_day']),

      // Pending leave requests
      adminClient
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Approved leaves covering today
      adminClient
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .lte('start_date', todayISO)
        .gte('end_date', todayISO),

      // Employees with date_of_birth for birthday calculation
      adminClient
        .from('employees')
        .select('id, full_name, date_of_birth, department, avatar_url')
        .not('date_of_birth', 'is', null)
        .is('deleted_at', null),

      // Recent audit log activities
      adminClient
        .from('audit_logs')
        .select('id, action, entity_type, created_at, user_id, status')
        .in('entity_type', ['employee', 'leave_application', 'performance_review', 'onboarding'])
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // --- Compute stats ---
    const allEmployees = (employeesResult.data || []) as EmployeeRecord[]
    const getStatus = (e: EmployeeRecord) =>
      (e.employee_status || e.status || '').toUpperCase()

    const activeEmployees = allEmployees.filter(e => getStatus(e) === 'ACTIVE')
    const activeCount = activeEmployees.length
    const presentToday = attendanceResult.error ? 0 : (attendanceResult.count || 0)
    const pendingLeaves = pendingLeavesResult.error ? 0 : (pendingLeavesResult.count || 0)
    const onLeaveToday = leavesTodayResult.error ? 0 : (leavesTodayResult.count || 0)
    const absentToday = Math.max(0, activeCount - presentToday - onLeaveToday)

    // --- Build department breakdown ---
    const deptMap: Record<string, number> = {}
    for (const emp of activeEmployees) {
      const dept = emp.department || 'Unassigned'
      deptMap[dept] = (deptMap[dept] || 0) + 1
    }
    const departmentStats = Object.entries(deptMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // --- Upcoming birthdays (next 7 days, computed in JS using IST) ---
    // Create a Date anchored to the start of today in IST for accurate day calculations
    const todayParts = todayISO.split('-').map(Number)
    const todayIST = new Date(todayParts[0], todayParts[1] - 1, todayParts[2])
    const upcomingBirthdays = ((birthdayEmployeesResult.data || []) as BirthdayEmployee[])
      .map(emp => {
        const dob = new Date(emp.date_of_birth)
        let nextBirthday = new Date(todayIST.getFullYear(), dob.getMonth(), dob.getDate())
        if (nextBirthday < todayIST) {
          nextBirthday = new Date(todayIST.getFullYear() + 1, dob.getMonth(), dob.getDate())
        }
        const daysUntil = Math.ceil(
          (nextBirthday.getTime() - todayIST.getTime()) / (1000 * 60 * 60 * 24)
        )
        return {
          id: emp.id,
          full_name: emp.full_name,
          department: emp.department,
          avatar_url: emp.avatar_url,
          days_until_birthday: daysUntil,
        }
      })
      .filter(emp => emp.days_until_birthday >= 0 && emp.days_until_birthday <= 7)
      .sort((a, b) => a.days_until_birthday - b.days_until_birthday)
      .slice(0, 10)

    // --- Recent activities ---
    const recentActivities = ((recentActivitiesResult.data || []) as AuditLogRecord[]).map(a => ({
      id: a.id,
      action: a.action,
      entity_type: a.entity_type,
      created_at: a.created_at,
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalEmployees: allEmployees.length,
          activeEmployees: activeCount,
          presentToday,
          absentToday,
          pendingLeaves,
          onLeaveToday,
        },
        birthdays: upcomingBirthdays,
        recentActivities,
        departmentStats,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Dashboard batch API error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
