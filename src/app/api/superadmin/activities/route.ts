export const dynamic = 'force-dynamic'

/**
 * System Activities API Endpoint
 *
 * Provides real-time activity feed with filtering capabilities for Super Admin monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is Super Admin or Admin with activity_monitoring permission
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let hasPermission = !!superAdmin

    if (!hasPermission) {
      // Check if user is admin with activity_monitoring permission
      const { data: admin } = await supabase
        .from('admins')
        .select(`
          id,
          is_deleted,
          status,
          admin_module_permissions!inner(module_key, is_enabled)
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('status', 'enabled')
        .eq('admin_module_permissions.module_key', 'activity_monitoring')
        .eq('admin_module_permissions.is_enabled', true)
        .maybeSingle()

      hasPermission = !!admin
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view activity logs' },
        { status: 403 }
      )
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const userType = searchParams.get('user_type') || undefined
    const severityLevel = searchParams.get('severity_level') || undefined
    const activityType = searchParams.get('activity_type') || undefined
    const status = searchParams.get('status') || 'active'
    const search = searchParams.get('search') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query using the database function
    let query = supabase.rpc('get_recent_activities', {
      p_user_type: userType,
      p_severity_level: severityLevel,
      p_activity_type: activityType,
      p_status: status === 'all' ? null : status,
      p_limit: limit,
      p_offset: offset
    })

    const { data: activities, error: activitiesError } = await query

    if (activitiesError) {
      apiLogger.error('[Activities API] Error fetching activities', activitiesError)
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }

    // If search query provided, filter results client-side (can be optimized with full-text search)
    let filteredActivities = activities || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredActivities = filteredActivities.filter((activity: any) =>
        activity.description?.toLowerCase().includes(searchLower) ||
        activity.user_full_name?.toLowerCase().includes(searchLower) ||
        activity.user_email?.toLowerCase().includes(searchLower) ||
        activity.entity_name?.toLowerCase().includes(searchLower) ||
        activity.action_performed?.toLowerCase().includes(searchLower)
      )
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('system_activities')
      .select('id', { count: 'exact', head: true })

    if (userType) countQuery = countQuery.eq('user_type', userType)
    if (severityLevel) countQuery = countQuery.eq('severity_level', severityLevel)
    if (activityType) countQuery = countQuery.eq('activity_type', activityType)
    if (status && status !== 'all') countQuery = countQuery.eq('status', status)

    const { count, error: countError } = await countQuery

    if (countError) {
      apiLogger.error('[Activities API] Error counting activities', countError)
    }

    // Get statistics by user type
    const { data: stats, error: statsError } = await supabase
      .rpc('get_activity_stats_by_user_type')

    if (statsError) {
      apiLogger.error('[Activities API] Error fetching stats', statsError)
    }

    return NextResponse.json({
      success: true,
      data: filteredActivities,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      statistics: stats || []
    })

  } catch (error) {
    apiLogger.error('[Activities API] Unexpected error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Update activity status (for acknowledging or resolving critical events)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is Super Admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admins can update activity status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { activityId, status } = body

    if (!activityId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: activityId and status' },
        { status: 400 }
      )
    }

    if (!['active', 'acknowledged', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, acknowledged, or resolved' },
        { status: 400 }
      )
    }

    // Update activity status
    const { data: updatedActivity, error: updateError } = await supabase
      .from('system_activities')
      .update({ status })
      .eq('id', activityId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('[Activities API] Error updating activity', updateError)
      return NextResponse.json(
        { error: 'Failed to update activity status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedActivity
    })

  } catch (error) {
    apiLogger.error('[Activities API] Unexpected error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get activity statistics
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is Super Admin or Admin with permission
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let hasPermission = !!superAdmin

    if (!hasPermission) {
      const { data: admin } = await supabase
        .from('admins')
        .select(`
          id,
          is_deleted,
          status,
          admin_module_permissions!inner(module_key, is_enabled)
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('status', 'enabled')
        .eq('admin_module_permissions.module_key', 'activity_monitoring')
        .eq('admin_module_permissions.is_enabled', true)
        .maybeSingle()

      hasPermission = !!admin
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { startDate, endDate } = body

    // Get statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_activity_stats_by_user_type', {
        start_date: startDate || undefined,
        end_date: endDate || undefined
      })

    if (statsError) {
      apiLogger.error('[Activities API] Error fetching statistics', statsError)
      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: stats || []
    })

  } catch (error) {
    apiLogger.error('[Activities API] Unexpected error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
