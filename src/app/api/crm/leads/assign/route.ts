import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// POST /api/crm/leads/assign - Bulk assign leads to CRO
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

    // Only Super Admin can assign leads
    if (profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can assign leads' }, { status: 403 })
    }

    // Parse request body
    const bodySchema = z.object({

      lead_ids: z.array(z.unknown()).optional(),

      assigned_to: z.string(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { lead_ids, assigned_to } = body

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'lead_ids array is required' }, { status: 400 })
    }

    // Prevent DoS: limit bulk operations to 1000 leads at a time
    if (lead_ids.length > 1000) {
      return NextResponse.json({ success: false, error: 'Cannot assign more than 1000 leads at once' }, { status: 400 })
    }

    if (!assigned_to) {
      return NextResponse.json({ success: false, error: 'assigned_to user ID is required' }, { status: 400 })
    }

    // Verify the target user exists and is a CRO
    const { data: targetUser, error: userError } = await supabase
      .from('employee_profile')
      .select('user_id, sub_role')
      .eq('user_id', assigned_to)
      .maybeSingle()

    if (userError || !targetUser) {
      return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 })
    }

    if (targetUser.sub_role !== 'cro') {
      return NextResponse.json({ success: false, error: 'Leads can only be assigned to CRO users' }, { status: 400 })
    }

    // Fetch existing leads
    const { data: existingLeads, error: fetchError } = await supabase
      .from('crm_leads')
      .select('id, cro_id')
      .in('id', lead_ids)
      .is('deleted_at', null)

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    if (!existingLeads || existingLeads.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid leads found' }, { status: 404 })
    }

    // Update leads assignment
    const { data: updatedLeads, error: updateError } = await supabase
      .from('crm_leads')
      .update({
        cro_id: assigned_to,
        updated_at: new Date().toISOString()
      })
      .in('id', lead_ids)
      .select()

    if (updateError) {
      apiLogger.error('Error assigning leads', updateError)
      return NextResponse.json({ success: false, error: 'Failed to assign leads' }, { status: 500 })
    }

    // Create audit logs for each lead
    const auditLogPromises = existingLeads.map(lead =>
      supabase.from('crm_audit_logs').insert({
        lead_id: lead.id,
        action: 'reassign',
        performed_by: user.id,
        changes: {
          old: { cro_id: lead.cro_id },
          new: { cro_id: assigned_to }
        }
      })
    )

    await Promise.all(auditLogPromises)

    // Create notification for the assigned CRO
    await supabase.from('crm_notifications').insert({
      user_id: assigned_to,
      type: 'lead_assigned',
      title: `${existingLeads.length} lead(s) assigned to you`,
      message: `You have been assigned ${existingLeads.length} new lead(s)`,
      metadata: { lead_ids, assigned_by: user.id }
    })

    return NextResponse.json({
      success: true,
      message: `${updatedLeads?.length || 0} leads assigned successfully`,
      data: updatedLeads
    })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/leads/assign', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
