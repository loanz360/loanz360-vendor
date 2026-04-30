import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/schedule/dsm-team
 * Retrieves all schedules of Direct Sales Executives reporting to the logged-in Direct Sales Manager
 * Only accessible to Direct Sales Managers
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

    // Verify user is a Direct Sales Manager
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    let isAuthorized = false
    let isDSM = false

    if (profile) {
      const userSubRole = profile.subrole?.toUpperCase().replace(/[\s-]/g, '_') || ''
      const userStatus = profile.status?.toUpperCase() || ''

      isDSM = userSubRole === 'DIRECT_SALES_MANAGER' || userSubRole === 'DSM'
      isAuthorized = isDSM && userStatus === 'ACTIVE'
    } else {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (userProfile) {
        const userRole = userProfile.role?.toUpperCase()
        const userSubRole = userProfile.sub_role?.toUpperCase().replace(/[\s-]/g, '_') || ''

        isDSM = userSubRole === 'DIRECT_SALES_MANAGER' || userSubRole === 'DSM'
        isAuthorized = userRole === 'EMPLOYEE' && isDSM
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Direct Sales Managers.' },
        { status: 403 }
      )
    }

    if (!isDSM) {
      return NextResponse.json(
        { error: 'Only Direct Sales Managers can access team schedules.' },
        { status: 403 }
      )
    }

    // Get the DSM's employee record to find their employee ID
    const { data: dsmEmployee, error: dsmError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (dsmError || !dsmEmployee) {
      apiLogger.error('Error fetching DSM employee record', dsmError)
      return NextResponse.json(
        { error: 'Could not find your employee record.' },
        { status: 404 }
      )
    }

    // Find all Direct Sales Executives who report to this DSM
    const { data: reportingEmployees, error: reportingError } = await supabase
      .from('employees')
      .select('id, employee_id, user_id, full_name, mobile_number, work_email, sub_role, designation, status')
      .eq('reporting_manager_id', dsmEmployee.id)
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
          expired: [],
          total: 0
        },
        summary: {
          total_team_members: 0,
          total_schedules: 0,
          today_count: 0,
          this_week_count: 0,
          this_month_count: 0,
          expired_count: 0,
          completed_count: 0,
          cancelled_count: 0,
          no_show_count: 0,
          completion_rate: 0,
          attendance_rate: 0,
          employee_stats: []
        }
      })
    }

    // Get user IDs of all reporting employees
    const teamMemberUserIds = reportingEmployees
      .map(emp => emp.user_id)
      .filter(id => id !== null)

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active', 'history', 'expired', or 'all'
    const limit = parseInt(searchParams.get('limit') || '200')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch all schedules for team members
    let query = supabase
      .from('meetings')
      .select('*')
      .in('sales_executive_id', teamMemberUserIds)
      .eq('is_deleted', false)
      .order('scheduled_date', { ascending: false })

    // Filter by status if provided
    const now = new Date().toISOString()

    if (status === 'active') {
      query = query
        .in('status', ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'])
        .gte('scheduled_date', now)
    } else if (status === 'history') {
      query = query.in('status', ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'])
    } else if (status === 'expired') {
      query = query
        .in('status', ['SCHEDULED', 'CONFIRMED'])
        .lt('scheduled_date', now)
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
          sub_role: employee.sub_role,
          status: employee.status
        } : null
      }
    })

    // Group schedules by time period
    const nowDate = new Date()
    const tomorrow = new Date(nowDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const endOfToday = new Date(nowDate)
    endOfToday.setHours(23, 59, 59, 999)

    const endOfWeek = new Date(nowDate)
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
    endOfWeek.setHours(23, 59, 59, 999)

    const nextWeekStart = new Date(endOfWeek)
    nextWeekStart.setDate(nextWeekStart.getDate() + 1)
    nextWeekStart.setHours(0, 0, 0, 0)

    const nextWeekEnd = new Date(nextWeekStart)
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)
    nextWeekEnd.setHours(23, 59, 59, 999)

    const grouped = {
      today: enhancedSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= nowDate && scheduleDate <= endOfToday &&
               ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
      }),
      tomorrow: enhancedSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= tomorrow && scheduleDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) &&
               ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
      }),
      this_week: enhancedSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        const tomorrowEnd = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        return scheduleDate >= tomorrowEnd && scheduleDate <= endOfWeek &&
               ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
      }),
      next_week: enhancedSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate >= nextWeekStart && scheduleDate <= nextWeekEnd &&
               ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
      }),
      later: enhancedSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate > nextWeekEnd &&
               ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
      }),
      expired: enhancedSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate < nowDate && ['SCHEDULED', 'CONFIRMED'].includes(s.status)
      }),
      total: enhancedSchedules.length
    }

    // Calculate summary statistics
    const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
    const monthSchedules = enhancedSchedules.filter((s: any) => {
      const scheduleDate = new Date(s.scheduled_date)
      return scheduleDate >= startOfMonth
    })

    // Calculate performance metrics
    const completedSchedules = enhancedSchedules.filter((s: any) => s.status === 'COMPLETED')
    const cancelledSchedules = enhancedSchedules.filter((s: any) => s.status === 'CANCELLED')
    const noShowSchedules = enhancedSchedules.filter((s: any) => s.status === 'NO_SHOW')
    const expiredSchedules = grouped.expired
    const totalPastSchedules = completedSchedules.length + cancelledSchedules.length + noShowSchedules.length

    const completionRate = totalPastSchedules > 0
      ? (completedSchedules.length / totalPastSchedules) * 100
      : 0

    const attendanceRate = totalPastSchedules > 0
      ? ((completedSchedules.length) / totalPastSchedules) * 100
      : 0

    // Per-employee statistics
    const employeeStats = reportingEmployees.map(emp => {
      const empSchedules = enhancedSchedules.filter((s: any) => s.sales_executive_id === emp.user_id)
      const empCompleted = empSchedules.filter((s: any) => s.status === 'COMPLETED')
      const empExpired = empSchedules.filter((s: any) => {
        const scheduleDate = new Date(s.scheduled_date)
        return scheduleDate < nowDate && ['SCHEDULED', 'CONFIRMED'].includes(s.status)
      })
      const empTotal = empSchedules.length

      return {
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        user_id: emp.user_id,
        employee_status: emp.status,
        total_schedules: empTotal,
        completed: empCompleted.length,
        active: empSchedules.filter((s: any) =>
          ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(s.status)
        ).length,
        expired: empExpired.length,
        completion_rate: empTotal > 0 ? (empCompleted.length / empTotal) * 100 : 0
      }
    })

    const summary = {
      total_team_members: reportingEmployees.length,
      total_schedules: enhancedSchedules.length,
      today_count: grouped.today.length,
      this_week_count: grouped.today.length + grouped.tomorrow.length + grouped.this_week.length,
      this_month_count: monthSchedules.length,
      expired_count: expiredSchedules.length,

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
    apiLogger.error('Error in GET /api/schedule/dsm-team', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/schedule/dsm-team
 * Creates a new schedule for a team member (Direct Sales Executive)
 * Only accessible to Direct Sales Managers
 */
export async function POST(request: NextRequest) {
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

    // Verify user is a Direct Sales Manager
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    let isAuthorized = false

    if (profile) {
      const userSubRole = profile.subrole?.toUpperCase().replace(/[\s-]/g, '_') || ''
      const userStatus = profile.status?.toUpperCase() || ''

      const isDSM = userSubRole === 'DIRECT_SALES_MANAGER' || userSubRole === 'DSM'
      isAuthorized = isDSM && userStatus === 'ACTIVE'
    } else {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (userProfile) {
        const userRole = userProfile.role?.toUpperCase()
        const userSubRole = userProfile.sub_role?.toUpperCase().replace(/[\s-]/g, '_') || ''

        const isDSM = userSubRole === 'DIRECT_SALES_MANAGER' || userSubRole === 'DSM'
        isAuthorized = userRole === 'EMPLOYEE' && isDSM
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Direct Sales Managers.' },
        { status: 403 }
      )
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      sales_executive_id,
      title,
      description,
      meeting_type,
      scheduled_date,
      duration_minutes,
      location,
      is_virtual,
      meeting_link,
      customer_id,
      participant_name
    } = body

    // Validate required fields
    if (!sales_executive_id || !title || !scheduled_date) {
      return NextResponse.json(
        { error: 'Missing required fields: sales_executive_id, title, scheduled_date' },
        { status: 400 }
      )
    }

    // Verify the sales executive reports to this DSM
    const { data: dsmEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!dsmEmployee) {
      return NextResponse.json(
        { error: 'Could not find your employee record.' },
        { status: 404 }
      )
    }

    const { data: executive } = await supabase
      .from('employees')
      .select('id, user_id')
      .eq('user_id', sales_executive_id)
      .eq('reporting_manager_id', dsmEmployee.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!executive) {
      return NextResponse.json(
        { error: 'This employee does not report to you or is not active.' },
        { status: 403 }
      )
    }

    // Create the meeting/schedule
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        sales_executive_id,
        customer_id: customer_id || null,
        title,
        description: description || null,
        meeting_type: meeting_type || 'FOLLOW_UP',
        status: 'SCHEDULED',
        scheduled_date,
        duration_minutes: duration_minutes || 60,
        location: location || null,
        is_virtual: is_virtual || false,
        meeting_link: meeting_link || null,
        participant_name: participant_name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (meetingError) {
      apiLogger.error('Error creating meeting', meetingError)
      return NextResponse.json(
        { error: 'Failed to create schedule.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      meeting
    }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/schedule/dsm-team', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
