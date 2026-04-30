import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { getTodayStartIST } from '@/lib/constants/sales-pipeline'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// GET /api/crm/followups - List follow-ups with filters
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const userId = user.id

    // Stats-only mode: return counts in a single call
    if (searchParams.get('stats_only') === 'true') {
      const now = new Date()
      const todayStartISO = getTodayStartIST()
      const todayStart = new Date(todayStartISO)
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      let totalQ = supabase.from('crm_followups').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      let todayQ = supabase.from('crm_followups').select('id', { count: 'exact', head: true }).is('deleted_at', null)
        .gte('scheduled_at', todayStart.toISOString()).lt('scheduled_at', todayEnd.toISOString())
      let overdueQ = supabase.from('crm_followups').select('id', { count: 'exact', head: true }).is('deleted_at', null)
        .lt('scheduled_at', now.toISOString()).eq('status', 'Pending')
      let completedQ = supabase.from('crm_followups').select('id', { count: 'exact', head: true }).is('deleted_at', null)
        .eq('status', 'Completed')

      if (profile.subrole?.toUpperCase() === 'CRO') {
        totalQ = totalQ.eq('owner_id', userId)
        todayQ = todayQ.eq('owner_id', userId)
        overdueQ = overdueQ.eq('owner_id', userId)
        completedQ = completedQ.eq('owner_id', userId)
      }

      const [totalRes, todayRes, overdueRes, completedRes] = await Promise.all([
        totalQ, todayQ, overdueQ, completedQ,
      ])

      return NextResponse.json({
        success: true,
        data: {
          total: totalRes.count ?? 0,
          today: todayRes.count ?? 0,
          overdue: overdueRes.count ?? 0,
          completed: completedRes.count ?? 0,
        },
      })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const leadId = searchParams.get('lead_id') || ''
    const status = searchParams.get('status') || ''
    const fromDate = searchParams.get('from_date') || ''
    const toDate = searchParams.get('to_date') || ''
    const overdue = searchParams.get('overdue') === 'true'
    const today = searchParams.get('today') === 'true'
    const upcoming = searchParams.get('upcoming') === 'true'

    const offset = (page - 1) * limit

    // Build base query
    let query = supabase
      .from('crm_followups')
      .select(`
        *,
        lead:crm_leads(id, customer_name, phone, status, cro_id)
      `, { count: 'exact' })

    // Role-based filtering: CROs see only their own follow-ups
    if (profile.subrole?.toUpperCase() === 'CRO') {
      query = query.eq('owner_id', userId)
    }

    // Exclude soft-deleted follow-ups
    query = query.is('deleted_at', null)

    // Apply lead filter
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status)
    }

    // Apply date range filters
    if (fromDate) {
      query = query.gte('scheduled_at', fromDate)
    }
    if (toDate) {
      query = query.lte('scheduled_at', toDate)
    }

    // Apply special date filters
    const now = new Date()
    if (overdue) {
      query = query.lt('scheduled_at', now.toISOString())
        .eq('status', 'Pending')
    }

    if (today) {
      const todayStartISO = getTodayStartIST()
      const todayEndISO = new Date(new Date(todayStartISO).getTime() + 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('scheduled_at', todayStartISO)
        .lt('scheduled_at', todayEndISO)
    }

    if (upcoming) {
      const upcomingEnd = new Date(now)
      upcomingEnd.setDate(upcomingEnd.getDate() + 7) // Next 7 days
      query = query.gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', upcomingEnd.toISOString())
        .eq('status', 'Pending')
    }

    // Apply sorting
    query = query.order('scheduled_at', { ascending: true })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: followups, error: followupsError, count } = await query

    if (followupsError) {
      apiLogger.error('Error fetching follow-ups', followupsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch follow-ups' }, { status: 500 })
    }

    // Add purpose field (reverse mapping from title) so client gets the right field
    const mappedFollowups = (followups || []).map(f => ({
      ...f,
      purpose: f.title || f.purpose,
    }))

    return NextResponse.json({
      success: true,
      data: mappedFollowups,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/followups', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/crm/followups - Create new follow-up
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()

    // Validate required fields
    if (!body.lead_id || !body.scheduled_at) {
      return NextResponse.json({ success: false, error: 'Missing required fields: lead_id, scheduled_at'
      }, { status: 400 })
    }

    // Validate scheduled_at is in the future
    const scheduledDate = new Date(body.scheduled_at)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid scheduled_at date format' }, { status: 400 })
    }
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ success: false, error: 'scheduled_at must be in the future' }, { status: 400 })
    }

    // Verify lead exists and user has access
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('id, cro_id')
      .eq('id', body.lead_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Check permissions: CRO can only create follow-ups for their assigned leads
    if (profile.subrole === 'cro' && lead.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only create follow-ups for your assigned leads' }, { status: 403 })
    }

    // Prepare follow-up data
    const followupData: any = {
      lead_id: body.lead_id,
      scheduled_at: body.scheduled_at,
      owner_id: user.id,
      created_by: user.id,
      title: body.purpose || body.title || 'Follow-up',
      notes: body.notes || null,
      reminder_enabled: body.reminder_enabled !== false, // Default true
      reminder_minutes_before: body.reminder_minutes_before || 30,
      status: 'Pending',
      is_recurring: body.is_recurring || false,
      recurrence_pattern: body.recurrence_pattern || null,
      recurrence_ends_at: body.recurrence_end_date || body.recurrence_ends_at || null
    }

    // Create follow-up
    const { data: newFollowup, error: createError } = await supabase
      .from('crm_followups')
      .insert(followupData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating follow-up', createError)
      return NextResponse.json({ success: false, error: 'Failed to create follow-up' }, { status: 500 })
    }

    // Update lead's next_follow_up_date only if this is the earliest pending follow-up
    const { data: earlierFollowup } = await supabase
      .from('crm_followups')
      .select('scheduled_at')
      .eq('lead_id', body.lead_id)
      .eq('status', 'Pending')
      .is('deleted_at', null)
      .neq('id', newFollowup?.id || '')
      .lt('scheduled_at', body.scheduled_at)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!earlierFollowup) {
      await supabase
        .from('crm_leads')
        .update({ next_follow_up_date: body.scheduled_at })
        .eq('id', body.lead_id)
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: body.lead_id,
      action: 'followup_created',
      performed_by: user.id,
      changes: { new: newFollowup }
    })

    return NextResponse.json({
      success: true,
      data: newFollowup
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/followups', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/crm/followups - Update follow-up (requires followup_id in body)
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const followupId = body.id

    if (!followupId) {
      return NextResponse.json({ success: false, error: 'Follow-up ID is required' }, { status: 400 })
    }

    // Fetch existing follow-up with lead info
    const { data: existingFollowup, error: fetchError } = await supabase
      .from('crm_followups')
      .select('*, lead:crm_leads(id, cro_id)')
      .eq('id', followupId)
      .maybeSingle()

    if (fetchError || !existingFollowup) {
      return NextResponse.json({ success: false, error: 'Follow-up not found' }, { status: 404 })
    }

    // Check permissions: CRO can only update follow-ups for their assigned leads
    if (profile.subrole === 'cro' && existingFollowup.lead?.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only update follow-ups for your assigned leads' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // List of updatable fields
    const updatableFields = [
      'scheduled_at', 'title', 'notes', 'reminder_enabled',
      'reminder_minutes_before', 'status', 'completed_at',
      'is_recurring', 'recurrence_pattern', 'recurrence_ends_at'
    ]

    updatableFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // If marking as completed, set completed_at
    if (body.status === 'Completed' && !updateData.completed_at) {
      updateData.completed_at = new Date().toISOString()
    }

    // Update follow-up
    const { data: updatedFollowup, error: updateError } = await supabase
      .from('crm_followups')
      .update(updateData)
      .eq('id', followupId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating follow-up', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update follow-up' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: existingFollowup.lead_id,
      action: 'followup_updated',
      performed_by: user.id,
      changes: {
        old: existingFollowup,
        new: updatedFollowup
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedFollowup
    })

  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/crm/followups', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/crm/followups - Soft-delete follow-up
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // HR users cannot access individual leads
    if (profile.role === 'hr') {
      return NextResponse.json({ success: false, error: 'HR users cannot access individual leads. Use /api/crm/hr/statistics endpoint instead.'
      }, { status: 403 })
    }

    // Parse query parameters
    const followupId = request.nextUrl.searchParams.get('id')

    if (!followupId) {
      return NextResponse.json({ success: false, error: 'Follow-up ID is required' }, { status: 400 })
    }

    // Fetch existing follow-up with lead info
    const { data: existingFollowup, error: fetchError } = await supabase
      .from('crm_followups')
      .select('*, lead:crm_leads(id, cro_id)')
      .eq('id', followupId)
      .maybeSingle()

    if (fetchError || !existingFollowup) {
      return NextResponse.json({ success: false, error: 'Follow-up not found' }, { status: 404 })
    }

    // Check permissions
    if (profile.subrole === 'cro' && existingFollowup.lead?.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only delete follow-ups for your assigned leads' }, { status: 403 })
    }

    // Soft-delete follow-up (set deleted_at and cancel)
    const { error: deleteError } = await supabase
      .from('crm_followups')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'Cancelled',
      })
      .eq('id', followupId)

    if (deleteError) {
      apiLogger.error('Error deleting follow-up', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete follow-up' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: existingFollowup.lead_id,
      action: 'followup_deleted',
      performed_by: user.id,
      changes: { deleted: existingFollowup }
    })

    return NextResponse.json({
      success: true,
      message: 'Follow-up deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/crm/followups', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
