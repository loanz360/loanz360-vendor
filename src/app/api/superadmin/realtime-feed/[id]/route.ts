/**
 * Single Activity Detail API
 * Get, update, or bookmark individual activities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


// Get single activity with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseAdmin()

    const { data: activity, error } = await supabase
      .from('realtime_activities')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !activity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      )
    }

    // Get related activities (same entity or correlation)
    let relatedActivities: any[] = []

    if (activity.entity_id || activity.correlation_id) {
      const { data: related } = await supabase
        .from('realtime_activities')
        .select('id, event_type, severity_level, title, created_at')
        .or(
          activity.correlation_id
            ? `correlation_id.eq.${activity.correlation_id},entity_id.eq.${activity.entity_id}`
            : `entity_id.eq.${activity.entity_id}`
        )
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(10)

      relatedActivities = related || []
    }

    return NextResponse.json({
      success: true,
      activity,
      related_activities: relatedActivities
    })
  } catch (error) {
    apiLogger.error('[Activity Detail API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update activity (acknowledge, resolve, add notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const { action, user_id, notes, tags } = body

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (action === 'acknowledge') {
      updateData.status = 'acknowledged'
      updateData.acknowledged_at = new Date().toISOString()
      updateData.acknowledged_by = user_id
    } else if (action === 'resolve') {
      updateData.status = 'resolved'
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = user_id
      if (notes) updateData.resolution_notes = notes
    } else if (action === 'archive') {
      updateData.status = 'archived'
    }

    if (notes && action !== 'resolve') {
      updateData.resolution_notes = notes
    }

    if (tags) {
      updateData.tags = tags
    }

    const { data, error } = await supabase
      .from('realtime_activities')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Activity Detail API] Update error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activity: data,
      message: action ? `Activity ${action}d successfully` : 'Activity updated'
    })
  } catch (error) {
    apiLogger.error('[Activity Detail API] PATCH Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
