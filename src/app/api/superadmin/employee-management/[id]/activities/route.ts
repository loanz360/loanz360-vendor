
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/superadmin/employee-management/[id]/activities
 * Fetch activity logs for a specific employee
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id
    const supabase = createSupabaseAdmin()

    // Fetch activity logs with performer details
    const { data: activities, error } = await supabase
      .from('employee_activity_logs')
      .select(`
        id,
        action,
        action_details,
        performed_at,
        performed_by,
        users:performed_by (
          full_name
        )
      `)
      .eq('employee_id', employeeId)
      .order('performed_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch activity logs'
      }, { status: 500 })
    }

    // Format activities with performer name
    const formattedActivities = (activities || []).map((activity: any) => ({
      id: activity.id,
      action: activity.action,
      action_details: activity.action_details || {},
      performed_at: activity.performed_at,
      performed_by_name: activity.users?.full_name || 'System'
    }))

    return NextResponse.json({
      success: true,
      data: {
        activities: formattedActivities
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET activity logs', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
