
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
    const userId = searchParams.get('user_id') || user.id

    // Check authorization - users can only view their own calendar unless they're HR/superadmin
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    if (userId !== user.id && !isHROrAdmin) {
      return NextResponse.json(
        { success: false, error: 'You can only view your own calendar' },
        { status: 403 }
      )
    }

    // Calculate date range for the month
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

    // Fetch attendance records
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (attError) throw attError

    // Fetch approved leave requests
    const { data: leaves, error: leaveError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        leave_types (name)
      `)
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('from_date', startDate)
      .lte('to_date', endDate)

    if (leaveError) throw leaveError

    // Fetch holidays
    const { data: holidays, error: holidayError } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    if (holidayError) throw holidayError

    // Build calendar data
    interface CalendarDay {
      date: string
      status: string
      check_in?: string
      check_out?: string
      is_late?: boolean
      leave_type?: string
      holiday_name?: string
    }
    const calendarData: CalendarDay[] = []

    // Add attendance records
    attendance?.forEach(record => {
      calendarData.push({
        date: record.date,
        status: record.status === 'present' ? 'present' :
                record.status === 'half_day' ? 'half_day' : 'absent',
        check_in: record.check_in,
        check_out: record.check_out,
        is_late: record.is_late || false
      })
    })

    // Add leave days
    leaves?.forEach(leave => {
      const fromDate = new Date(leave.from_date)
      const toDate = new Date(leave.to_date)

      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        if (dateStr >= startDate && dateStr <= endDate) {
          // Check if there's already an attendance record for this date
          const existingIndex = calendarData.findIndex(item => item.date === dateStr)

          if (existingIndex >= 0) {
            // Update existing record
            calendarData[existingIndex].status = 'leave'
            calendarData[existingIndex].leave_type = leave.leave_types?.name
          } else {
            // Add new leave record
            calendarData.push({
              date: dateStr,
              status: 'leave',
              leave_type: leave.leave_types?.name
            })
          }
        }
      }
    })

    // Add holidays
    holidays?.forEach(holiday => {
      const existingIndex = calendarData.findIndex(item => item.date === holiday.date)

      if (existingIndex >= 0) {
        // Update existing record
        calendarData[existingIndex].status = 'holiday'
        calendarData[existingIndex].holiday_name = holiday.name
      } else {
        // Add new holiday record
        calendarData.push({
          date: holiday.date,
          status: 'holiday',
          holiday_name: holiday.name
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: calendarData
    })

  } catch (error) {
    apiLogger.error('Fetch calendar data error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar data' },
      { status: 500 }
    )
  }
}
