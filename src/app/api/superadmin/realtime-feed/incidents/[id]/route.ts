import { parseBody } from '@/lib/utils/parse-body'
/**
 * Single Incident API
 * Get incident details and manage comments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


// Get single incident with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseAdmin()

    // Get incident
    const { data: incident, error: incidentError } = await supabase
      .from('activity_incidents')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (incidentError || !incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      )
    }

    // Get comments
    const { data: comments } = await supabase
      .from('incident_comments')
      .select('*')
      .eq('incident_id', id)
      .order('created_at', { ascending: false })

    // Get related activities
    let relatedActivities: any[] = []
    if (incident.related_activity_ids?.length) {
      const { data: activities } = await supabase
        .from('realtime_activities')
        .select('id, event_type, severity_level, title, created_at')
        .in('id', incident.related_activity_ids)
        .order('created_at', { ascending: false })

      relatedActivities = activities || []
    }

    return NextResponse.json({
      success: true,
      incident,
      comments: comments || [],
      related_activities: relatedActivities
    })
  } catch (error) {
    apiLogger.error('[Incident Detail API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Add comment to incident
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { content, author_id, author_name } = body

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      )
    }

    const { data: comment, error } = await supabase
      .from('incident_comments')
      .insert({
        incident_id: id,
        comment_type: 'comment',
        content,
        author_id,
        author_name
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Incident Detail API] Comment error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to add comment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      comment,
      message: 'Comment added successfully'
    })
  } catch (error) {
    apiLogger.error('[Incident Detail API] POST Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
