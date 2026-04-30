import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * DELETE /api/partners/cp/security/ip-whitelist/[id]
 * Remove an IP address from whitelist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, ip_whitelist_enabled')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Verify entry exists and belongs to this partner
    const { data: entry, error: fetchError } = await supabase
      .from('cp_ip_whitelist')
      .select('id, ip_address, ip_range_start, ip_range_end')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (fetchError || !entry) {
      return NextResponse.json(
        { success: false, error: 'IP whitelist entry not found' },
        { status: 404 }
      )
    }

    // If whitelist is enabled, check this isn't the last entry
    if (partner.ip_whitelist_enabled) {
      const { count } = await supabase
        .from('cp_ip_whitelist')
        .select('id', { count: 'exact' })
        .eq('partner_id', partner.id)
        .eq('is_active', true)

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove the last IP entry while whitelist is enabled. Disable whitelist first.' },
          { status: 400 }
        )
      }

      // Check if this is the current IP
      const currentIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
      if (entry.ip_address === currentIP) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove your current IP address while whitelist is enabled' },
          { status: 400 }
        )
      }
    }

    // Delete entry (include partner_id filter to prevent IDOR)
    const { error: deleteError } = await supabase
      .from('cp_ip_whitelist')
      .delete()
      .eq('id', id)
      .eq('partner_id', partner.id)

    if (deleteError) {
      apiLogger.error('Error deleting IP whitelist entry', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to remove IP whitelist entry' },
        { status: 500 }
      )
    }

    // Get current IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Log audit entry
    const removedIP = entry.ip_address || `${entry.ip_range_start}-${entry.ip_range_end}`
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'IP_WHITELIST_REMOVE',
      action_description: `Removed IP ${removedIP} from whitelist`,
      section: 'security',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'IP address removed from whitelist'
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/partners/cp/security/ip-whitelist/[id]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/cp/security/ip-whitelist/[id]
 * Update an IP whitelist entry (toggle active status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Verify entry exists and belongs to this partner
    const { data: entry, error: fetchError } = await supabase
      .from('cp_ip_whitelist')
      .select('id, ip_address, is_active')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (fetchError || !entry) {
      return NextResponse.json(
        { success: false, error: 'IP whitelist entry not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const bodySchema = z.object({

      is_active: z.boolean().optional(),

      description: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { is_active, description } = body

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (typeof is_active === 'boolean') {
      updatePayload.is_active = is_active
    }

    if (description !== undefined) {
      updatePayload.description = description?.trim() || null
    }

    // Update entry (include partner_id filter to prevent IDOR)
    const { data: updatedEntry, error: updateError } = await supabase
      .from('cp_ip_whitelist')
      .update(updatePayload)
      .eq('id', id)
      .eq('partner_id', partner.id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating IP whitelist entry', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update IP whitelist entry' },
        { status: 500 }
      )
    }

    // Get current IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'UPDATE',
      action_description: `Updated IP whitelist entry for ${entry.ip_address}: ${typeof is_active === 'boolean' ? (is_active ? 'activated' : 'deactivated') : 'description updated'}`,
      section: 'security',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'IP whitelist entry updated',
      data: {
        id: updatedEntry.id,
        ip_address: updatedEntry.ip_address,
        is_active: updatedEntry.is_active
      }
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/partners/cp/security/ip-whitelist/[id]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
