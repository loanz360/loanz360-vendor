import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// POST /api/crm/handoff - Create lead handoff/conversion request
export async function POST(request: NextRequest) {
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.lead_id || !body.to_role) {
      return NextResponse.json({ success: false, error: 'Missing required fields: lead_id, to_role'
      }, { status: 400 })
    }

    // Verify lead exists and user has access
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', body.lead_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Check permissions: CRO can only handoff their assigned leads
    if (profile.subrole === 'cro' && lead.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only handoff your assigned leads' }, { status: 403 })
    }

    // Verify checklist completion (if required)
    if (body.require_checklist && lead.conversion_checklist) {
      const checklist = lead.conversion_checklist as any
      const allCompleted = Object.values(checklist).every(item => (item as any).completed === true)

      if (!allCompleted) {
        return NextResponse.json({ success: false, error: 'Conversion checklist is not fully completed',
          checklist: lead.conversion_checklist
        }, { status: 400 })
      }
    }

    // Prepare handoff data with full lead snapshot
    const handoffData: any = {
      lead_id: body.lead_id,
      from_role: profile.subrole || profile.role,
      to_role: body.to_role,
      status: 'Pending',
      handoff_data: {
        lead_details: lead,
        handoff_reason: body.handoff_reason || null,
        special_instructions: body.special_instructions || null,
        requested_at: new Date().toISOString()
      },
      checklist_completed: lead.conversion_checklist || null,
      webhook_url: body.webhook_url || null,
      created_by: user.id
    }

    // Create handoff record
    const { data: newHandoff, error: createError } = await supabase
      .from('crm_lead_handoffs')
      .insert(handoffData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating handoff', createError)
      return NextResponse.json({ success: false, error: 'Failed to create handoff' }, { status: 500 })
    }

    // Update lead status to indicate handoff
    await supabase
      .from('crm_leads')
      .update({
        status: 'follow_up',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.lead_id)

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: body.lead_id,
      action: 'handoff_initiated',
      performed_by: user.id,
      changes: { new: newHandoff }
    })

    // Send webhook if URL provided
    if (body.webhook_url) {
      try {
        const webhookPayload = {
          event: 'lead.handoff.created',
          handoff_id: newHandoff.id,
          lead_id: body.lead_id,
          lead_data: lead,
          from_role: handoffData.from_role,
          to_role: body.to_role,
          timestamp: new Date().toISOString()
        }

        const webhookResponse = await fetch(body.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'lead.handoff.created'
          },
          body: JSON.stringify(webhookPayload)
        })

        const webhookResult = {
          status: webhookResponse.status,
          body: await webhookResponse.text()
        }

        // Update handoff with webhook response
        await supabase
          .from('crm_lead_handoffs')
          .update({
            webhook_sent_at: new Date().toISOString(),
            webhook_response: webhookResult
          })
          .eq('id', newHandoff.id)

      } catch (webhookError) {
        apiLogger.error('Webhook error', webhookError)
    logApiError(error as Error, request, { action: 'get' })
        // Don't fail the handoff if webhook fails, just log it
        await supabase
          .from('crm_lead_handoffs')
          .update({
            webhook_sent_at: new Date().toISOString(),
            webhook_response: {
              error: String(webhookError)
            }
          })
          .eq('id', newHandoff.id)
      }
    }

    // Create notification for receiving team (if configured)
    // This would need a mapping table for role -> user_ids
    // For now, we'll skip this part

    return NextResponse.json({
      success: true,
      data: newHandoff
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/handoff', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/crm/handoff - List handoff requests
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const leadId = searchParams.get('lead_id') || ''
    const direction = searchParams.get('direction') || '' // 'incoming' or 'outgoing'

    const offset = (page - 1) * limit

    // Build base query
    let query = supabase
      .from('crm_lead_handoffs')
      .select(`
        *,
        lead:crm_leads(id, customer_name, phone, status)
      `, { count: 'exact' })

    // Apply direction filter based on user's role
    const userRole = profile.subrole || profile.role
    if (direction === 'incoming') {
      query = query.eq('to_role', userRole)
    } else if (direction === 'outgoing') {
      query = query.eq('from_role', userRole)
    } else {
      // Show both incoming and outgoing
      query = query.or(`from_role.eq.${userRole},to_role.eq.${userRole}`)
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status)
    }

    // Apply lead filter
    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: handoffs, error: handoffsError, count } = await query

    if (handoffsError) {
      apiLogger.error('Error fetching handoffs', handoffsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch handoffs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: handoffs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/handoff', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/crm/handoff - Accept/Reject handoff request
export async function PUT(request: NextRequest) {
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const handoffId = body.id
    const action = body.action // 'accept' or 'reject'

    if (!handoffId || !action) {
      return NextResponse.json({ success: false, error: 'Handoff ID and action are required' }, { status: 400 })
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Action must be "accept" or "reject"' }, { status: 400 })
    }

    // Fetch existing handoff
    const { data: existingHandoff, error: fetchError } = await supabase
      .from('crm_lead_handoffs')
      .select('*')
      .eq('id', handoffId)
      .maybeSingle()

    if (fetchError || !existingHandoff) {
      return NextResponse.json({ success: false, error: 'Handoff not found' }, { status: 404 })
    }

    // Verify user has permission to accept/reject (must be receiving role)
    const userRole = profile.subrole || profile.role
    if (existingHandoff.to_role !== userRole && profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'You cannot accept/reject this handoff' }, { status: 403 })
    }

    // Verify handoff is still pending
    if (existingHandoff.status !== 'Pending') {
      return NextResponse.json({ success: false, error: 'Handoff has already been processed' }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = {
      status: action === 'accept' ? 'Accepted' : 'Rejected',
      accepted_by: action === 'accept' ? user.id : null,
      accepted_at: action === 'accept' ? new Date().toISOString() : null,
      rejection_reason: action === 'reject' ? body.rejection_reason : null,
      updated_at: new Date().toISOString()
    }

    // Update handoff
    const { data: updatedHandoff, error: updateError } = await supabase
      .from('crm_lead_handoffs')
      .update(updateData)
      .eq('id', handoffId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating handoff', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update handoff' }, { status: 500 })
    }

    // Update lead status
    const leadUpdateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'accept') {
      leadUpdateData.status = 'converted'
      leadUpdateData.converted_at = new Date().toISOString()
    } else {
      // If rejected, revert to previous status
      leadUpdateData.status = 'active'
    }

    await supabase
      .from('crm_leads')
      .update(leadUpdateData)
      .eq('id', existingHandoff.lead_id)

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: existingHandoff.lead_id,
      action: `handoff_${action}ed`,
      performed_by: user.id,
      changes: {
        old: existingHandoff,
        new: updatedHandoff
      }
    })

    // Send webhook if URL provided
    if (existingHandoff.webhook_url) {
      try {
        const webhookPayload = {
          event: `lead.handoff.${action}ed`,
          handoff_id: updatedHandoff.id,
          lead_id: existingHandoff.lead_id,
          action,
          timestamp: new Date().toISOString()
        }

        await fetch(existingHandoff.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': `lead.handoff.${action}ed`
          },
          body: JSON.stringify(webhookPayload)
        })
      } catch (webhookError) {
        apiLogger.error('Webhook error', webhookError)
    logApiError(error as Error, request, { action: 'get' })
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedHandoff
    })

  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/crm/handoff', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
