export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface Condition {
  id: string
  field: string
  operator: string
  value: string | number | string[]
  valueEnd?: string | number
}

interface ConditionGroup {
  id: string
  operator: 'AND' | 'OR'
  conditions: Condition[]
}

interface Segment {
  id?: string
  name: string
  description?: string
  groups: ConditionGroup[]
  group_operator: 'AND' | 'OR'
  is_active: boolean
  is_public: boolean
  created_by: string
  estimated_count?: number
  created_at?: string
  updated_at?: string
}

/**
 * GET /api/notifications/segments
 * List all saved segments
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false
    let superAdminId: string | null = null

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
        superAdminId = session.super_admin_id
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includePublic = searchParams.get('include_public') === 'true'
    const activeOnly = searchParams.get('active_only') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const supabaseAdmin = createSupabaseAdmin()

    let query = supabaseAdmin
      .from('notification_segments')
      .select('*', { count: 'exact' })

    // Filter conditions
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    // Show user's own segments + public segments
    const userId = isSuperAdmin ? superAdminId : user?.id
    if (includePublic) {
      query = query.or(`created_by.eq.${userId},is_public.eq.true`)
    } else if (!isSuperAdmin) {
      // Non-admins can only see their own segments
      query = query.eq('created_by', userId)
    }
    // Super admins can see all segments

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: segments, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      segments: segments || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching segments', error)
    return NextResponse.json(
      { error: 'Failed to fetch segments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/segments
 * Create a new segment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false
    let superAdminId: string | null = null

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
        superAdminId = session.super_admin_id
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Partial<Segment>

    // Validate required fields
    if (!body.name || !body.groups || body.groups.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, groups' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Check for duplicate name for this user
    const userId = isSuperAdmin ? superAdminId : user?.id
    const { data: existing } = await supabaseAdmin
      .from('notification_segments')
      .select('id')
      .eq('name', body.name)
      .eq('created_by', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'A segment with this name already exists' },
        { status: 409 }
      )
    }

    // Prepare segment data
    const segmentData = {
      name: body.name,
      description: body.description || null,
      groups: body.groups,
      group_operator: body.group_operator || 'AND',
      is_active: body.is_active !== false, // Default to true
      is_public: body.is_public || false,
      created_by: userId,
      estimated_count: body.estimated_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: segment, error } = await supabaseAdmin
      .from('notification_segments')
      .insert(segmentData)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      segment,
      message: 'Segment created successfully'
    })
  } catch (error) {
    apiLogger.error('Error creating segment', error)
    return NextResponse.json(
      { error: 'Failed to create segment' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/segments
 * Update an existing segment
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false
    let superAdminId: string | null = null

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
        superAdminId = session.super_admin_id
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Segment ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Check if segment exists and user has permission
    const { data: existingSegment, error: fetchError } = await supabaseAdmin
      .from('notification_segments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existingSegment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      )
    }

    // Only creator or super admin can update
    const userId = isSuperAdmin ? superAdminId : user?.id
    if (!isSuperAdmin && existingSegment.created_by !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to update this segment' },
        { status: 403 }
      )
    }

    // Update segment
    const { data: segment, error } = await supabaseAdmin
      .from('notification_segments')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      segment,
      message: 'Segment updated successfully'
    })
  } catch (error) {
    apiLogger.error('Error updating segment', error)
    return NextResponse.json(
      { error: 'Failed to update segment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/segments
 * Delete a segment
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false
    let superAdminId: string | null = null

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
        superAdminId = session.super_admin_id
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Segment ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Check if segment exists and user has permission
    const { data: existingSegment, error: fetchError } = await supabaseAdmin
      .from('notification_segments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existingSegment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      )
    }

    // Only creator or super admin can delete
    const userId = isSuperAdmin ? superAdminId : user?.id
    if (!isSuperAdmin && existingSegment.created_by !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this segment' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('notification_segments')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Segment deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error deleting segment', error)
    return NextResponse.json(
      { error: 'Failed to delete segment' },
      { status: 500 }
    )
  }
}
