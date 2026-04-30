import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { LEAD_FIELD_MAPPING } from '@/lib/constants/sales-pipeline'


// GET /api/crm/leads/[id] - Get single lead by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const { id: leadId } = await params

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

    // Fetch lead with related data
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Check permissions: CRO can only view their assigned leads
    if (profile.subrole === 'cro' && lead.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only view your assigned leads' }, { status: 403 })
    }

    // Fetch related data in parallel (avoids N+1)
    const [
      { data: followups },
      { data: notes },
      { data: handoffs },
      { data: auditLogs },
    ] = await Promise.all([
      supabase.from('crm_followups').select('*').eq('lead_id', leadId).order('scheduled_at', { ascending: true }),
      supabase.from('crm_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from('crm_lead_handoffs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from('crm_audit_logs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...lead,
        followups: followups || [],
        notes: notes || [],
        handoffs: handoffs || [],
        auditLogs: auditLogs || []
      }
    })

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/leads/[id]', error)
    logApiError(error as Error, request, { action: 'get_lead' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/crm/leads/[id] - Partial update of lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  const { id: leadId } = await params

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

    // Fetch existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Check permissions: CRO can only update their assigned leads
    if (profile.subrole === 'cro' && existingLead.cro_id !== user.id) {
      return NextResponse.json({ success: false, error: 'You can only update your assigned leads' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()

    // Prepare update data using shared field mapping
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Use shared LEAD_FIELD_MAPPING plus extra legacy field mappings
    const extendedFieldMapping: Record<string, string> = {
      ...LEAD_FIELD_MAPPING,
      'customer_email': 'email',
      'customer_city': 'location',
      'loan_amount_required': 'loan_amount',
      'company_name': 'business_name',
      'lead_status': 'status',
      'next_followup_at': 'next_follow_up_date',
      'next_follow_up_date': 'next_follow_up_date',
      'follow_up_notes': 'follow_up_notes',
      'alternate_phone': 'alternate_phone',
      'location': 'location',
      'business_type': 'business_type',
      'source': 'source',
    }

    // CROs cannot reassign leads (remove cro_id/assigned_to from allowed fields)
    const disallowedForCRO = ['cro_id', 'assigned_to']

    for (const [inputField, dbColumn] of Object.entries(extendedFieldMapping)) {
      if (body[inputField] !== undefined) {
        if (profile.subrole === 'cro' && disallowedForCRO.includes(inputField)) continue
        updateData[dbColumn] = body[inputField]
      }
    }

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('crm_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating lead', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update lead' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: updatedLead.id,
      action: 'update',
      performed_by: user.id,
      changes: {
        old: existingLead,
        new: updatedLead
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedLead
    })

  } catch (error) {
    apiLogger.error('Unexpected error in PATCH /api/crm/leads/[id]', error)
    logApiError(error as Error, request, { action: 'patch_lead' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/crm/leads/[id] - Soft delete lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  const { id: leadId } = await params

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

    // Fetch existing lead
    const { data: existingLead, error: fetchError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingLead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // Only Super Admin can delete leads
    if (profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can delete leads' }, { status: 403 })
    }

    // Soft delete lead
    const { data: deletedLead, error: deleteError } = await supabase
      .from('crm_leads')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', leadId)
      .select()
      .maybeSingle()

    if (deleteError) {
      apiLogger.error('Error deleting lead', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
    }

    // Create audit log
    await supabase.from('crm_audit_logs').insert({
      lead_id: deletedLead.id,
      action: 'delete',
      performed_by: user.id,
      changes: { deleted: existingLead }
    })

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/crm/leads/[id]', error)
    logApiError(error as Error, request, { action: 'delete_lead' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
