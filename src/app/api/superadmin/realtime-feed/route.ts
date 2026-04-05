/**
 * Real-Time Activity Feed API
 * Main endpoint for fetching activity logs with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { ActivityFilters, RealtimeActivity } from '@/lib/realtime-feed/types'
import { apiLogger } from '@/lib/utils/logger'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX C7: Add authentication check
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const page = Math.floor(offset / limit) + 1

    // Parse filters
    const filters: ActivityFilters = {
      categories: searchParams.get('categories')?.split(',').filter(Boolean) as any,
      event_types: searchParams.get('event_types')?.split(',').filter(Boolean),
      severity_levels: searchParams.get('severity_levels')?.split(',').filter(Boolean) as any,
      actor_types: searchParams.get('actor_types')?.split(',').filter(Boolean) as any,
      modules: searchParams.get('modules')?.split(',').filter(Boolean),
      sources: searchParams.get('sources')?.split(',').filter(Boolean) as any,
      status: searchParams.get('status')?.split(',').filter(Boolean) as any,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      search: searchParams.get('search') || undefined,
      security_only: searchParams.get('security_only') === 'true',
      suspicious_only: searchParams.get('suspicious_only') === 'true',
      ip_address: searchParams.get('ip_address') || undefined,
      actor_id: searchParams.get('actor_id') || undefined
    }

    // Build query
    let query = supabase
      .from('realtime_activities')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.categories?.length) {
      query = query.in('event_category', filters.categories)
    }

    if (filters.event_types?.length) {
      query = query.in('event_type', filters.event_types)
    }

    if (filters.severity_levels?.length) {
      query = query.in('severity_level', filters.severity_levels)
    }

    if (filters.actor_types?.length) {
      query = query.in('actor_type', filters.actor_types)
    }

    if (filters.modules?.length) {
      query = query.in('module', filters.modules)
    }

    if (filters.sources?.length) {
      query = query.in('source', filters.sources)
    }

    if (filters.status?.length) {
      query = query.in('status', filters.status)
    }

    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date)
    }

    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date)
    }

    if (filters.security_only) {
      query = query.eq('is_security_event', true)
    }

    if (filters.suspicious_only) {
      query = query.eq('is_suspicious', true)
    }

    if (filters.ip_address) {
      query = query.eq('ip_address', filters.ip_address)
    }

    if (filters.actor_id) {
      query = query.eq('actor_id', filters.actor_id)
    }

    if (filters.search) {
      const sanitizedSearch = filters.search.replace(/[%_'";\\\[\]{}()]/g, '')
      if (sanitizedSearch.length > 0) {
        query = query.or(
          `title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,actor_name.ilike.%${sanitizedSearch}%,actor_email.ilike.%${sanitizedSearch}%,entity_name.ilike.%${sanitizedSearch}%`
        )
      }
    }

    // Apply sorting and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: activities, error, count } = await query

    if (error) {
      apiLogger.error('[RealtimeFeed API] Query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }

    const total = count || 0

    return NextResponse.json({
      success: true,
      activities: activities || [],
      total,
      page,
      limit,
      has_more: offset + limit < total,
      filters_applied: Object.keys(filters).filter(k => filters[k as keyof ActivityFilters])
    })
  } catch (error) {
    apiLogger.error('[RealtimeFeed API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Acknowledge or resolve an activity
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY FIX C7: Add authentication check
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()
    const body = await request.json()

    // SECURITY FIX: Use authenticated user_id instead of trusting request body
    const { activity_id, action, notes } = body
    const user_id = auth.userId

    if (!activity_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['acknowledge', 'resolve', 'archive'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
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

    const { data, error } = await supabase
      .from('realtime_activities')
      .update(updateData)
      .eq('id', activity_id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[RealtimeFeed API] Update error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activity: data,
      message: `Activity ${action}d successfully`
    })
  } catch (error) {
    apiLogger.error('[RealtimeFeed API] PATCH Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
