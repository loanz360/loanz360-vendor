import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/schedule/team
 * Retrieves all schedules of team members (CPEs) reporting to the logged-in CPM
 * Only accessible to Channel Partner Managers
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Channel Partner Manager
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    let isAuthorized = false
    let isCPM = false

    if (profile) {
      const userSubRole = profile.subrole?.toUpperCase() || ''
      const userStatus = profile.status?.toUpperCase() || ''

      isCPM = userSubRole === 'CHANNEL_PARTNER_MANAGER'
      isAuthorized = isCPM && userStatus === 'ACTIVE'
    } else {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (userProfile) {
        const userRole = userProfile.role?.toUpperCase()
        const userSubRole = userProfile.sub_role?.toUpperCase() || ''

        isCPM = userSubRole === 'CHANNEL_PARTNER_MANAGER'
        isAuthorized = userRole === 'EMPLOYEE' && isCPM
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Channel Partner Managers.' },
        { status: 403 }
      )
    }

    if (!isCPM) {
      return NextResponse.json(
        { error: 'Only Channel Partner Managers can access team schedules.' },
        { status: 403 }
      )
    }

    // Get the CPM's employee record to find their employee ID
    const { data: cpmEmployee, error: cpmError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (cpmError || !cpmEmployee) {
      apiLogger.error('Error fetching CPM employee record', cpmError)
      return NextResponse.json(
        { error: 'Could not find your employee record.' },
        { status: 404 }
      )
    }

    // Find all CPEs who report to this CPM
    const { data: reportingEmployees, error: reportingError } = await supabase
      .from('employees')
      .select('id, employee_id, user_id, full_name, mobile_number, work_email, sub_role, designation')
      .eq('reporting_manager_id', cpmEmployee.id)
      .eq('is_active', true)
      .order('full_name')

    if (reportingError) {
      apiLogger.error('Error fetching reporting employees', reportingError)
      return NextResponse.json(
        { error: 'Failed to fetch team members.' },
        { status: 500 }
      )
    }

    // If no team members, return empty result
    if (!reportingEmployees || reportingEmployees.length === 0) {
      return NextResponse.json({
        team_members: [],
        schedules: [],
        grouped: {
          today: [],
          tomorrow: [],
          this_week: [],
          next_week: [],
          later: [],
          total: 0
        },
        summary: {
          total_team_members: 0,
          total_schedules: 0,
          today_count: 0,
          this_week_count: 0,
          this_month_count: 0
        }
      })
    }

    // Get user IDs of all reporting employees
    const teamMemberUserIds = reportingEmployees
      .map(emp => emp.user_id)
      .filter(id => id !== null)

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active' or 'history'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch all schedules for team members
    let query = supabase
      .from('meetings')
      .select('*')
      .in('sales_executive_id', teamMemberUserIds)
      .eq('is_deleted', false)
      .order('scheduled_date', { ascending: true })

    // Filter by status if provided
    if (status === 'active') {
      query = query.in('status', ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'])
        .gte('scheduled_date', new Date().toISOString())
    } else if (status === 'history') {
      query = query.in('status', ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'])
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: schedules, error: schedulesError } = await query

    if (schedulesError) {
      apiLogger.error('Error fetching team schedules', schedulesError)
      return NextResponse.json(
        { error: 'Failed to fetch team schedules.' },
        { status: 500 }
      )
    }

    // Enhance schedules with employee information
    const enhancedSchedules = schedules.map(schedule => {
      const employee = reportingEmployees.find(emp => emp.user_id === schedule.sales_executive_id)
      return {
        ...schedule,
        employee_info: employee ? {
          employee_id: employee.employee_id,
          full_name: employee.full_name,
          designation: employee.designation,
          sub_role: employee.sub_role
        } : null
      }
    })

    // Group schedules by time period for active schedules
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    const endOfWeek = new Date(now)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
    endOfWeek.setHours(23, 59, 59, 999)

    const nextWeekStart = new Date(endOfWeek)
    nextWeekStart.setDate(nextWeekStart.getDate() + 1)
    nextWeekStart.setHours(0, 0, 0, 0)

    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)
    nextWeekEnd.setHours(23, 59, 59, 999)

    const grouped = {
      today: enhancedSchedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= now && scheduleDate <= endOfToday
      }),
      tomorrow: enhancedSchedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= tomorrow && scheduleDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
      }),
      this_week: enhancedSchedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        const tomorrowEnd = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        return scheduleDate >= tomorrowEnd && scheduleDate <= endOfWeek
      }),
      next_week: enhancedSchedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= nextWeekStart && scheduleDate <= nextWeekEnd
      }),
      later: enhancedSchedules.filter((s: unknown) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate > nextWeekEnd
      }),
      total: enhancedSchedules.length
    }

    // Calculate summary statistics
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthSchedules = enhancedSchedules.filter((s: unknown) => {
      const scheduleDate = new Date(s.scheduled_date)
      return scheduleDate >= startOfMonth
    })

    // Calculate performance metrics
    const completedSchedules = enhancedSchedules.filter((s: unknown) => s.status === 'COMPLETED')
    const cancelledSchedules = enhancedSchedules.filter((s: unknown) => s.status === 'CANCELLED')
    const noShowSchedules = enhancedSchedules.filter((s: unknown) => s.status === 'NO_SHOW')
    const totalPastSchedules = completedSchedules.length + cancelledSchedules.length + noShowSchedules.length

    const completionRate = totalPastSchedules > 0
      ? (completedSchedules.length / totalPastSchedules) * 100
      : 0

    const attendanceRate = totalPastSchedules > 0
      ? ((completedSchedules.length) / totalPastSchedules) * 100
      : 0

    // Per-employee statistics
    const employeeStats = reportingEmployees.map(emp => {
      const empSchedules = enhancedSchedules.filter((s: unknown) => s.sales_executive_id === emp.user_id)
      const empCompleted = empSchedules.filter((s: unknown) => s.status === 'COMPLETED')
      const empTotal = empSchedules.length

      return {
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        user_id: emp.user_id,
        total_schedules: empTotal,
        completed: empCompleted.length,
        active: empSchedules.filter((s: unknown) =>
          ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
        ).length,
        completion_rate: empTotal > 0 ? (empCompleted.length / empTotal) * 100 : 0
      }
    })

    const summary = {
      total_team_members: reportingEmployees.length,
      total_schedules: enhancedSchedules.length,
      today_count: grouped.today.length,
      this_week_count: grouped.today.length + grouped.tomorrow.length + grouped.this_week.length,
      this_month_count: monthSchedules.length,

      // Performance metrics
      completed_count: completedSchedules.length,
      cancelled_count: cancelledSchedules.length,
      no_show_count: noShowSchedules.length,
      completion_rate: Math.round(completionRate * 10) / 10,
      attendance_rate: Math.round(attendanceRate * 10) / 10,

      // Employee statistics
      employee_stats: employeeStats
    }

    return NextResponse.json({
      team_members: reportingEmployees,
      schedules: enhancedSchedules,
      grouped,
      summary
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/team', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
