import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/schedule/dashboard
 * Retrieves dashboard summary for schedules
 * Accessible to all active employees
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an active employee
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('subrole, status')
      .eq('user_id', user.id)
      .maybeSingle()

    let isAuthorized = false

    if (profile) {
      const userStatus = profile.status?.toUpperCase() || ''
      isAuthorized = userStatus === 'ACTIVE'
    } else {
      // Fallback to users table
      const { data: userProfile } = await supabase
        .from('users')
        .select('role, sub_role')
        .eq('id', user.id)
        .maybeSingle()

      if (userProfile) {
        const userRole = userProfile.role?.toUpperCase()
        isAuthorized = userRole === 'EMPLOYEE'
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for active employees.' },
        { status: 403 }
      )
    }

    // Call the database function to get dashboard summary
    const { data: dashboardData, error: queryError } = await supabase.rpc(
      'get_schedule_dashboard',
      {
        p_user_id: user.id
      }
    )

    if (queryError) {
      apiLogger.error('Error fetching dashboard', queryError)
      
      // Check if the error is because the function doesn't exist
      if (queryError.message?.includes('function') && queryError.message?.includes('does not exist')) {
        // Return empty dashboard data as fallback
        return NextResponse.json({
          today: { total: 0, completed: 0, upcoming: 0 },
          this_week: { total: 0, completed: 0, upcoming: 0, partner_meetings: 0, customer_meetings: 0 },
          this_month: { total: 0, completed: 0, cancelled: 0, attendance_rate: 0, avg_duration_minutes: 0 },
          upcoming_today: [],
          next_7_days: [],
          pending_reminders: []
        })
      }

      return NextResponse.json(
        { error: 'Failed to fetch dashboard summary' },
        { status: 500 }
      )
    }

    return NextResponse.json(dashboardData || {
      today: { total: 0, completed: 0, upcoming: 0 },
      this_week: { total: 0, completed: 0, upcoming: 0, partner_meetings: 0, customer_meetings: 0 },
      this_month: { total: 0, completed: 0, cancelled: 0, attendance_rate: 0, avg_duration_minutes: 0 },
      upcoming_today: [],
      next_7_days: [],
      pending_reminders: []
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule/dashboard', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
