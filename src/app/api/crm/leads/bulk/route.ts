import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// POST /api/crm/leads/bulk - Bulk update leads (status, priority, tags, etc.)
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { lead_ids, updates } = body

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'lead_ids array is required' }, { status: 400 })
    }

    // Prevent DoS: limit bulk operations to 1000 leads at a time
    if (lead_ids.length > 1000) {
      return NextResponse.json({ success: false, error: 'Cannot update more than 1000 leads at once' }, { status: 400 })
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, error: 'updates object is required' }, { status: 400 })
    }

    // Fetch existing leads to verify access
    let query = supabase
      .from('crm_leads')
      .select('id, cro_id, status')
      .in('id', lead_ids)
      .is('deleted_at', null)

    // CROs can only update their assigned leads
    if (profile.subrole === 'cro') {
      query = query.eq('cro_id', user.id)
    }

    const { data: existingLeads, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    if (!existingLeads || existingLeads.length === 0) {
      return NextResponse.json({ success: false, error: 'No accessible leads found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // List of bulk updatable fields
    const bulkUpdatableFields = [
      'status', 'stage', 'loan_type'
    ]

    // Only include allowed fields
    bulkUpdatableFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    })

    // Handle special tag operations (add, remove, replace)
    if (updates.tag_operation) {
      switch (updates.tag_operation) {
        case 'add':
          // Add tags to existing tags (will be handled by SQL)
          if (updates.tags && Array.isArray(updates.tags)) {
            // This needs a custom SQL update, not standard update
            // For now, we'll use replace operation
            updateData.tags = updates.tags
          }
          break
        case 'remove':
          // Remove tags from existing tags (requires custom SQL)
          // For now, we'll skip this and just document it
          delete updateData.tags
          break
        case 'replace':
          // Replace all tags
          updateData.tags = updates.tags || []
          break
      }
    }

    // Update leads
    const { data: updatedLeads, error: updateError } = await supabase
      .from('crm_leads')
      .update(updateData)
      .in('id', existingLeads.map(l => l.id))
      .select()

    if (updateError) {
      apiLogger.error('Error bulk updating leads', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update leads' }, { status: 500 })
    }

    // Create audit logs for each lead
    const auditLogPromises = existingLeads.map(lead =>
      supabase.from('crm_audit_logs').insert({
        lead_id: lead.id,
        action: 'bulk_update',
        performed_by: user.id,
        changes: {
          old: lead,
          new: updateData
        }
      })
    )

    await Promise.all(auditLogPromises)

    return NextResponse.json({
      success: true,
      message: `${updatedLeads?.length || 0} leads updated successfully`,
      data: updatedLeads
    })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/leads/bulk', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/crm/leads/bulk - Bulk soft delete leads
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
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

    // Only Super Admin can bulk delete leads
    if (profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can bulk delete leads' }, { status: 403 })
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { lead_ids } = body

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'lead_ids array is required' }, { status: 400 })
    }

    // Prevent DoS: limit bulk operations to 1000 leads at a time
    if (lead_ids.length > 1000) {
      return NextResponse.json({ success: false, error: 'Cannot delete more than 1000 leads at once' }, { status: 400 })
    }

    // Fetch existing leads
    const { data: existingLeads, error: fetchError } = await supabase
      .from('crm_leads')
      .select('id')
      .in('id', lead_ids)
      .is('deleted_at', null)

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    if (!existingLeads || existingLeads.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid leads found' }, { status: 404 })
    }

    // Soft delete leads
    const { data: deletedLeads, error: deleteError } = await supabase
      .from('crm_leads')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .in('id', existingLeads.map(l => l.id))
      .select()

    if (deleteError) {
      apiLogger.error('Error bulk deleting leads', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete leads' }, { status: 500 })
    }

    // Create audit logs for each lead
    const auditLogPromises = existingLeads.map(lead =>
      supabase.from('crm_audit_logs').insert({
        lead_id: lead.id,
        action: 'bulk_delete',
        performed_by: user.id,
        changes: { deleted: true }
      })
    )

    await Promise.all(auditLogPromises)

    return NextResponse.json({
      success: true,
      message: `${deletedLeads?.length || 0} leads deleted successfully`
    })

  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/crm/leads/bulk', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
