import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Direct Sales Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'DIRECT_SALES_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get team members
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('reporting_manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    const teamMemberIds = teamMembers?.map((m) => m.id) || []

    // Fetch attendance/activity records for the specified date if there are team members
    let attendanceRecords: any[] = []
    if (teamMemberIds.length > 0) {
      const { data, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .in('user_id', teamMemberIds)
        .gte('check_in_time', `${date}T00:00:00`)
        .lte('check_in_time', `${date}T23:59:59`)

      if (!attendanceError && data) {
        attendanceRecords = data
      }
    }

    const activities = (teamMembers || []).map((member) => {
      const attendanceRecord = attendanceRecords?.find((a: any) => a.user_id === member.id)

      const hasCheckedIn = !!attendanceRecord?.check_in_time
      const hasCheckedOut = !!attendanceRecord?.check_out_time
      let workingHours = 0
      if (hasCheckedIn && hasCheckedOut) {
        workingHours = parseFloat(((new Date(attendanceRecord.check_out_time).getTime() - new Date(attendanceRecord.check_in_time).getTime()) / 3600000).toFixed(1))
      }

      return {
        id: `activity-${member.id}-${date}`,
        employeeId: member.id,
        employeeName: member.full_name || 'Unknown',
        date,
        totalKilometers: 0,
        totalMeetings: 0,
        checkInTime: hasCheckedIn ? new Date(attendanceRecord.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        checkOutTime: hasCheckedOut ? new Date(attendanceRecord.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        workingHours,
        locations: [],
        status: !hasCheckedIn ? 'on_leave' : !hasCheckedOut ? 'active' : 'completed',
      }
    })

    // Calculate summary - handle case when no team members or all on leave
    const activeActivities = activities.filter(a => a.status !== 'on_leave')
    const activeCount = activeActivities.length || 1 // Prevent division by zero

    const summary = {
      totalExecutives: teamMembers?.length || 0,
      activeToday: activities.filter((a) => a.status === 'active' || a.status === 'completed').length,
      totalKmToday: activities.reduce((sum, a) => sum + a.totalKilometers, 0),
      avgKmPerExecutive: activities.length > 0
        ? activities.reduce((sum, a) => sum + a.totalKilometers, 0) / activeCount
        : 0,
      totalMeetings: activities.reduce((sum, a) => sum + a.totalMeetings, 0),
      avgMeetingsPerExecutive: activities.length > 0
        ? activities.reduce((sum, a) => sum + a.totalMeetings, 0) / activeCount
        : 0,
    }

    // Chart data placeholder - requires historical attendance queries
    const chartData: { date: string; activeExecutives: number; totalKm: string; totalMeetings: number }[] = []

    return NextResponse.json({
      activities,
      summary,
      chartData,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in activity API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
