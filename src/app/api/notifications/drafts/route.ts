import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface DraftNotification {
  id?: string
  title: string
  message: string
  message_html?: string
  notification_type: string
  priority: string
  target_type: string
  target_category?: string
  target_subrole?: string
  target_geography?: {
    state?: string
    city?: string
    branch?: string
  }
  channels: {
    in_app: boolean
    email: boolean
    sms: boolean
    push: boolean
    whatsapp: boolean
  }
  settings: {
    is_pinned: boolean
    scheduled_for?: string
    expires_at?: string
    action_url?: string
    action_label?: string
    image_url?: string
    requires_acknowledgment: boolean
    allow_replies: boolean
  }
  localized_content?: Record<string, { title: string; message: string }>
  selected_languages?: string[]
  segment_id?: string
  template_id?: string
  approval_status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  approval_chain?: Array<{
    role: string
    user_id?: string
    status: 'pending' | 'approved' | 'rejected'
    timestamp?: string
    comments?: string
  }>
  created_by: string
  created_at?: string
  updated_at?: string
}

/**
 * GET /api/notifications/drafts
 * List all draft notifications for the current user or for approval
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
    const status = searchParams.get('status') // draft, pending_approval, approved, rejected
    const forApproval = searchParams.get('for_approval') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabaseAdmin = createSupabaseAdmin()

    let query = supabaseAdmin
      .from('notification_drafts')
      .select('*', { count: 'exact' })

    // Filter by status if provided
    if (status) {
      query = query.eq('approval_status', status)
    }

    // If for_approval, show only pending items that need current user's approval
    if (forApproval && isSuperAdmin) {
      query = query.eq('approval_status', 'pending_approval')
    } else if (!isSuperAdmin && user) {
      // Regular users can only see their own drafts
      query = query.eq('created_by', user.id)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: drafts, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      drafts: drafts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching drafts', error)
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/drafts
 * Create a new draft notification
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr as Partial<DraftNotification>

    // Validate required fields
    if (!body.title || !body.message || !body.notification_type || !body.target_type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, message, notification_type, target_type' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Prepare draft data
    const draftData = {
      title: body.title,
      message: body.message,
      message_html: body.message_html || body.message,
      notification_type: body.notification_type,
      priority: body.priority || 'normal',
      target_type: body.target_type,
      target_category: body.target_category,
      target_subrole: body.target_subrole,
      target_geography: body.target_geography || {},
      channels: body.channels || {
        in_app: true,
        email: false,
        sms: false,
        push: false,
        whatsapp: false
      },
      settings: body.settings || {
        is_pinned: false,
        requires_acknowledgment: false,
        allow_replies: false
      },
      localized_content: body.localized_content || {},
      selected_languages: body.selected_languages || ['en'],
      segment_id: body.segment_id,
      template_id: body.template_id,
      approval_status: body.approval_status || 'draft',
      approval_chain: body.approval_chain || [],
      created_by: isSuperAdmin ? superAdminId : user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: draft, error } = await supabaseAdmin
      .from('notification_drafts')
      .insert(draftData)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      draft,
      message: 'Draft created successfully'
    })
  } catch (error) {
    apiLogger.error('Error creating draft', error)
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/drafts
 * Update an existing draft notification
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Check if draft exists and user has permission
    const { data: existingDraft, error: fetchError } = await supabaseAdmin
      .from('notification_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existingDraft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Only creator or super admin can update
    if (!isSuperAdmin && existingDraft.created_by !== user?.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this draft' },
        { status: 403 }
      )
    }

    // Update draft
    const { data: draft, error } = await supabaseAdmin
      .from('notification_drafts')
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
      draft,
      message: 'Draft updated successfully'
    })
  } catch (error) {
    apiLogger.error('Error updating draft', error)
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/drafts
 * Delete a draft notification
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Check if draft exists and user has permission
    const { data: existingDraft, error: fetchError } = await supabaseAdmin
      .from('notification_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existingDraft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Only creator or super admin can delete
    if (!isSuperAdmin && existingDraft.created_by !== user?.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this draft' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('notification_drafts')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error deleting draft', error)
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    )
  }
}
