import { parseBody } from '@/lib/utils/parse-body'
/**
 * Activity Incidents API
 * Manage security incidents and operational issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


// Get all incidents
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('activity_incidents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data: incidents, error, count } = await query

    if (error) {
      apiLogger.error('[Incidents API] Query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch incidents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      incidents: incidents || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      limit,
      has_more: (count || 0) > offset + limit
    })
  } catch (error) {
    apiLogger.error('[Incidents API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Create new incident
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const {
      title,
      description,
      severity,
      incident_type,
      affected_module,
      related_activity_ids,
      root_cause_activity_id,
      assigned_to,
      assigned_team,
      created_by
    } = body

    if (!title || !severity) {
      return NextResponse.json(
        { success: false, error: 'Title and severity are required' },
        { status: 400 }
      )
    }

    const { data: incident, error } = await supabase
      .from('activity_incidents')
      .insert({
        title,
        description,
        severity,
        status: 'open',
        incident_type,
        affected_module,
        related_activity_ids,
        root_cause_activity_id,
        assigned_to,
        assigned_team,
        created_by
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Incidents API] Create error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create incident' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      incident,
      message: 'Incident created successfully'
    })
  } catch (error) {
    apiLogger.error('[Incidents API] POST Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update incident (status changes, assignments, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { id, action, user_id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Incident ID is required' },
        { status: 400 }
      )
    }

    // Get current incident
    const { data: currentIncident, error: fetchError } = await supabase
      .from('activity_incidents')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !currentIncident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      )
    }

    // Prepare update based on action
    const updates: Record<string, any> = {
      ...updateData,
      updated_at: new Date().toISOString()
    }

    if (action === 'acknowledge') {
      updates.acknowledged_at = new Date().toISOString()
    } else if (action === 'start_investigation') {
      updates.status = 'investigating'
      updates.investigation_started_at = new Date().toISOString()
    } else if (action === 'mitigate') {
      updates.status = 'mitigating'
      updates.mitigated_at = new Date().toISOString()
    } else if (action === 'resolve') {
      updates.status = 'resolved'
      updates.resolved_at = new Date().toISOString()
    } else if (action === 'close') {
      updates.status = 'closed'
      updates.closed_at = new Date().toISOString()
    } else if (action === 'assign') {
      updates.assigned_to = updateData.assigned_to
      updates.assigned_team = updateData.assigned_team
    }

    // Update incident
    const { data: incident, error: updateError } = await supabase
      .from('activity_incidents')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('[Incidents API] Update error', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update incident' },
        { status: 500 }
      )
    }

    // Add comment for status changes
    if (action && user_id) {
      const oldStatus = currentIncident.status
      const newStatus = updates.status || oldStatus

      await supabase
        .from('incident_comments')
        .insert({
          incident_id: id,
          comment_type: 'status_change',
          content: `Status changed from ${oldStatus} to ${newStatus}`,
          old_status: oldStatus,
          new_status: newStatus,
          author_id: user_id
        })
    }

    return NextResponse.json({
      success: true,
      incident,
      message: action ? `Incident ${action} successful` : 'Incident updated successfully'
    })
  } catch (error) {
    apiLogger.error('[Incidents API] PATCH Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
