import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/bdm/team-management/activity-feed
 * Fetch real-time activity stream of all BDEs reporting to the BDM
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filters
    const bdeId = searchParams.get('bdeId') // Optional: filter by specific BDE
    const activityType = searchParams.get('activityType') // Optional: filter by activity type
    const dateFrom = searchParams.get('dateFrom') // Optional: filter by date range
    const dateTo = searchParams.get('dateTo')

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a Business Development Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied. BDM role required.' }, { status: 403 })
    }

    // Get team members (BDEs reporting to this BDM)
    const { data: teamMembers, error: teamError } = await supabase
      .from('users')
      .select('id, full_name, email, employee_id, avatar_url')
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('manager_id', user.id)

    if (teamError) {
      apiLogger.error('Error fetching team members', teamError)
      return NextResponse.json({ success: false, error: 'Failed to fetch team members' }, { status: 500 })
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        activities: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        statistics: {
          totalActivitiesToday: 0,
          mostActiveBDE: null,
          activityBreakdown: {},
        },
      })
    }

    let teamMemberIds = teamMembers.map((m) => m.id)

    // Filter by specific BDE if provided
    if (bdeId) {
      teamMemberIds = teamMemberIds.filter((id) => id === bdeId)
    }

    // Build activity logs query
    let activityQuery = supabase
      .from('bde_activity_logs')
      .select('*, users!bde_activity_logs_user_id_fkey(full_name, email, employee_id, avatar_url)', { count: 'exact' })
      .in('user_id', teamMemberIds)
      .order('created_at', { ascending: false })

    // Apply filters
    if (activityType) {
      activityQuery = activityQuery.eq('activity_type', activityType)
    }

    if (dateFrom) {
      activityQuery = activityQuery.gte('created_at', dateFrom)
    }

    if (dateTo) {
      activityQuery = activityQuery.lte('created_at', dateTo)
    }

    // Apply pagination
    activityQuery = activityQuery.range(offset, offset + limit - 1)

    const { data: activities, error: activitiesError, count: totalCount } = await activityQuery

    if (activitiesError) {
      apiLogger.error('Error fetching activities', activitiesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch activity feed' }, { status: 500 })
    }

    // Map activities to formatted response
    const formattedActivities = (activities || []).map((activity: unknown) => ({
      id: activity.id,
      bdeId: activity.user_id,
      bdeName: activity.users?.full_name || 'Unknown',
      bdeEmail: activity.users?.email,
      bdeEmployeeId: activity.users?.employee_id,
      bdeAvatarUrl: activity.users?.avatar_url,
      activityType: activity.activity_type,
      activityDescription: activity.activity_description,
      entityType: activity.entity_type,
      entityId: activity.entity_id,
      metadata: activity.metadata,
      timestamp: activity.created_at,
      relativeTime: getRelativeTime(activity.created_at),
    }))

    // Calculate statistics
    const today = new Date().toISOString().split('T')[0]
    const todayActivities = activities?.filter((a) => a.created_at?.split('T')[0] === today) || []

    // Activity breakdown by type
    const activityBreakdown: Record<string, number> = {}
    activities?.forEach((activity) => {
      const type = activity.activity_type
      activityBreakdown[type] = (activityBreakdown[type] || 0) + 1
    })

    // Most active BDE
    const bdeActivityCounts: Record<string, { count: number; name: string }> = {}
    activities?.forEach((activity) => {
      const bdeId = activity.user_id
      if (!bdeActivityCounts[bdeId]) {
        bdeActivityCounts[bdeId] = { count: 0, name: activity.users?.full_name || 'Unknown' }
      }
      bdeActivityCounts[bdeId].count++
    })

    const mostActiveBDE = Object.entries(bdeActivityCounts).sort((a, b) => b[1].count - a[1].count)[0]

    return NextResponse.json({
      activities: formattedActivities,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      statistics: {
        totalActivitiesToday: todayActivities.length,
        mostActiveBDE: mostActiveBDE ? {
          bdeId: mostActiveBDE[0],
          bdeName: mostActiveBDE[1].name,
          activityCount: mostActiveBDE[1].count,
        } : null,
        activityBreakdown,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error in activity-feed API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to calculate relative time
function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const activityTime = new Date(timestamp)
  const diffMs = now.getTime() - activityTime.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return activityTime.toLocaleDateString()
}

