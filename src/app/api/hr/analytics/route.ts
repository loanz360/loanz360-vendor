
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccessByUserId } from '@/lib/auth/hr-access'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin using shared pattern
    const isHR = await checkHRAccessByUserId(adminClient, user.id)
    if (!isHR) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can view analytics' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const yearRaw = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const year = isNaN(yearRaw) ? new Date().getFullYear() : yearRaw

    // Calculate date range based on period
    const getDateRange = () => {
      const now = new Date()
      let startDate: Date
      let endDate = now

      switch (period) {
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
          break
        case 'year':
          startDate = new Date(year, 0, 1)
          endDate = new Date(year, 11, 31)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    }

    const dateRange = getDateRange()

    // Calculate previous period range matching the selected period
    const getPreviousPeriodRange = () => {
      const startMs = new Date(dateRange.start).getTime()
      const endMs = new Date(dateRange.end).getTime()
      let periodDays: number

      switch (period) {
        case 'week':
          periodDays = 7
          break
        case 'quarter':
          periodDays = 90
          break
        case 'year':
          periodDays = 365
          break
        case 'month':
        default:
          periodDays = 30
          break
      }

      return {
        start: new Date(startMs - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: dateRange.start
      }
    }

    const previousPeriodRange = getPreviousPeriodRange()
    const today = new Date().toISOString().split('T')[0]

    // Parallelize independent queries
    const [
      { data: attendanceData },
      { data: todayAttendance },
      { count: totalEmployees },
      { data: previousAttendance },
      { data: leaveData },
      { data: todayOnLeave, count: onLeaveCount },
      departmentStatsResult,
    ] = await Promise.all([
      // Attendance for period (limit to 5000 records)
      adminClient
        .from('attendance_records')
        .select('status, is_late, date, user_id')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .limit(5000),
      // Today's attendance
      adminClient
        .from('attendance_records')
        .select('status, is_late, user_id')
        .eq('date', today)
        .limit(2000),
      // Total active employees
      adminClient
        .from('employee_profile')
        .select('*', { count: 'only', head: true })
        .eq('status', 'active'),
      // Previous period attendance
      adminClient
        .from('attendance_records')
        .select('status, is_late, user_id')
        .gte('date', previousPeriodRange.start)
        .lt('date', previousPeriodRange.end)
        .limit(5000),
      // Leave applications for date range
      adminClient
        .from('leave_applications')
        .select('id, status, total_days, leave_type, created_at')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .limit(5000),
      // Approved leaves covering today (for absent calculation)
      adminClient
        .from('leave_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today),
      // Department-wise statistics
      adminClient.rpc('get_department_analytics', {
        p_start_date: dateRange.start,
        p_end_date: dateRange.end
      }),
    ])

    // Calculate attendance stats
    const presentToday = todayAttendance?.filter(a => a.status === 'present' || a.status === 'half_day').length || 0
    const onLeaveToday = onLeaveCount || 0
    const absentToday = Math.max(0, (totalEmployees || 0) - presentToday - onLeaveToday)
    const lateToday = todayAttendance?.filter(a => a.is_late).length || 0

    // Calculate avg attendance rate using totalEmployees as base
    const totalWorkingDays = (() => {
      const start = new Date(dateRange.start)
      const end = new Date(dateRange.end)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      return days
    })()
    const expectedRecords = (totalEmployees || 0) * totalWorkingDays
    const presentRecords = attendanceData?.filter(a => a.status === 'present' || a.status === 'half_day').length || 0
    const avgAttendanceRate = expectedRecords > 0
      ? Math.round((presentRecords / expectedRecords) * 100 * 10) / 10
      : 0

    // Calculate trend (compare with previous period)
    const previousPresentRecords = previousAttendance?.filter(a => a.status === 'present' || a.status === 'half_day').length || 0
    const previousTotal = previousAttendance?.length || 0
    const previousAvgRate = previousTotal > 0
      ? (previousPresentRecords / previousTotal) * 100
      : avgAttendanceRate

    const trend = avgAttendanceRate > previousAvgRate + 2 ? 'up' :
                  avgAttendanceRate < previousAvgRate - 2 ? 'down' : 'stable'

    // Leave statistics
    const totalLeaveRequests = leaveData?.length || 0
    const approvedLeaves = leaveData?.filter(l => l.status === 'approved').length || 0
    const pendingLeaves = leaveData?.filter(l => l.status === 'pending').length || 0
    const rejectedLeaves = leaveData?.filter(l => l.status === 'rejected').length || 0

    const avgLeaveDays = leaveData && leaveData.length > 0
      ? leaveData.reduce((sum, l) => sum + (l.total_days || 0), 0) / leaveData.length
      : 0

    // Find most common leave type
    const leaveTypeCounts: { [key: string]: number } = {}
    leaveData?.forEach(l => {
      const type = l.leave_type || 'Unknown'
      leaveTypeCounts[type] = (leaveTypeCounts[type] || 0) + 1
    })
    const topLeaveType = Object.entries(leaveTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    // Handle department stats error
    const departmentStats = departmentStatsResult.error
      ? []
      : (departmentStatsResult.data || [])

    if (departmentStatsResult.error) {
      apiLogger.error('get_department_analytics RPC failed', departmentStatsResult.error)
    }

    // Monthly trends (last 6 months) - parallelized with Promise.all
    const monthlyTrends = await Promise.all(
      Array.from({ length: 6 }, (_, idx) => {
        const i = 5 - idx
        const monthDate = new Date()
        monthDate.setMonth(monthDate.getMonth() - i)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0]
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0]

        return Promise.all([
          adminClient.from('attendance_records').select('status, is_late').gte('date', monthStart).lte('date', monthEnd).limit(5000),
          adminClient.from('leave_applications').select('total_days').eq('status', 'approved').gte('start_date', monthStart).lte('end_date', monthEnd).limit(2000),
        ]).then(([{ data: monthAttendance }, { data: monthLeaves }]) => {
          const monthPresent = monthAttendance?.filter(a => a.status === 'present' || a.status === 'half_day').length || 0
          const monthTotal = monthAttendance?.length || 0
          const monthLate = monthAttendance?.filter(a => a.is_late).length || 0
          const monthLeaveDays = monthLeaves?.reduce((sum, l) => sum + (l.total_days || 0), 0) || 0

          return {
            month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            attendance_rate: monthTotal > 0 ? (monthPresent / monthTotal) * 100 : 0,
            leave_days: monthLeaveDays,
            late_count: monthLate
          }
        })
      })
    )

    // Predictions (simple linear regression based on last 3 months)
    const last3Months = monthlyTrends.slice(-3)
    const avgRecentAttendance = last3Months.reduce((sum, m) => sum + m.attendance_rate, 0) / 3
    const avgRecentLeaves = last3Months.reduce((sum, m) => sum + m.leave_days, 0) / 3

    // Simple prediction: use average with slight adjustment for trend
    const nextMonthAttendance = trend === 'up' ? avgRecentAttendance + 1 :
                                 trend === 'down' ? avgRecentAttendance - 1 :
                                 avgRecentAttendance

    const expectedLeaves = Math.round(avgRecentLeaves)

    // Identify at-risk employees (low attendance or high absences in last 30 days)
    const last30Days = new Date()
    last30Days.setDate(last30Days.getDate() - 30)

    const { data: employeeAttendance } = await adminClient
      .from('attendance_records')
      .select('user_id, status')
      .gte('date', last30Days.toISOString().split('T')[0])
      .limit(10000)

    const userAttendanceMap: { [key: string]: { present: number; total: number } } = {}
    employeeAttendance?.forEach(a => {
      if (!userAttendanceMap[a.user_id]) {
        userAttendanceMap[a.user_id] = { present: 0, total: 0 }
      }
      userAttendanceMap[a.user_id].total++
      if (a.status === 'present' || a.status === 'half_day') {
        userAttendanceMap[a.user_id].present++
      }
    })

    const riskEmployees = Object.values(userAttendanceMap).filter(u => {
      const rate = u.total > 0 ? (u.present / u.total) * 100 : 100
      return rate < 75 // Less than 75% attendance
    }).length

    return NextResponse.json({
      success: true,
      data: {
        attendanceStats: {
          totalEmployees: totalEmployees || 0,
          presentToday,
          absentToday,
          lateToday,
          avgAttendanceRate,
          trend
        },
        leaveStats: {
          totalLeaveRequests,
          approvedLeaves,
          pendingLeaves,
          rejectedLeaves,
          avgLeaveDays,
          topLeaveType
        },
        departmentStats,
        monthlyTrends,
        predictions: {
          nextMonthAttendance,
          expectedLeaves,
          riskEmployees
        }
      }
    })

  } catch (error) {
    apiLogger.error('Fetch analytics error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
