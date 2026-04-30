import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { SubUserRole, SubUserStatus } from '@/types/cp-profile'

/**
 * GET /api/partners/cp/sub-users/[id]
 * Get details of a specific sub-user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Fetch sub-user
    const { data: subUser, error } = await supabase
      .from('cp_sub_users')
      .select('*')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (error || !subUser) {
      return NextResponse.json(
        { success: false, error: 'Sub-user not found' },
        { status: 404 }
      )
    }

    // Parse JSON arrays
    const parseJsonArray = (field: unknown): unknown[] => {
      if (!field) return []
      if (Array.isArray(field)) return field
      if (typeof field !== 'string') return []
      try {
        return JSON.parse(field)
      } catch {
        return []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: subUser.id,
        full_name: subUser.full_name,
        email: subUser.email,
        mobile: subUser.mobile,
        role: subUser.role as SubUserRole,
        permissions: parseJsonArray(subUser.permissions),
        status: subUser.status as SubUserStatus,
        invited_at: subUser.invited_at,
        accepted_at: subUser.accepted_at,
        last_login_at: subUser.last_login_at,
        created_at: subUser.created_at
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/sub-users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/cp/sub-users/[id]
 * Update a sub-user's role or status
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

    // Verify sub-user exists and belongs to this partner
    const { data: existingSubUser, error: fetchError } = await supabase
      .from('cp_sub_users')
      .select('id, email, role, status')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (fetchError || !existingSubUser) {
      return NextResponse.json(
        { success: false, error: 'Sub-user not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const bodySchema = z.object({

      role: z.string().optional(),

      status: z.string().optional(),

      permissions: z.array(z.unknown()),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { role, status, permissions } = body

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (role && ['FINANCE', 'COMPLIANCE', 'OPERATIONS', 'VIEWER'].includes(role)) {
      updatePayload.role = role
      // Update permissions to match new role if not explicitly provided
      if (!permissions) {
        updatePayload.permissions = JSON.stringify(getRolePermissions(role as SubUserRole))
      }
    }

    if (status && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      updatePayload.status = status
    }

    if (permissions && Array.isArray(permissions)) {
      updatePayload.permissions = JSON.stringify(permissions)
    }

    // Update sub-user (include partner_id filter to prevent IDOR)
    const { data: updatedSubUser, error: updateError } = await supabase
      .from('cp_sub_users')
      .update(updatePayload)
      .eq('id', id)
      .eq('partner_id', partner.id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating sub-user:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update sub-user' },
        { status: 500 }
      )
    }

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Log audit entry
    const changes = []
    if (role && role !== existingSubUser.role) changes.push(`role: ${existingSubUser.role} → ${role}`)
    if (status && status !== existingSubUser.status) changes.push(`status: ${existingSubUser.status} → ${status}`)

    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'UPDATE',
      action_description: `Updated sub-user ${existingSubUser.email}: ${changes.join(', ')}`,
      section: 'access-control',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Sub-user updated successfully',
      data: {
        id: updatedSubUser.id,
        email: updatedSubUser.email,
        role: updatedSubUser.role,
        status: updatedSubUser.status
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in PUT /api/partners/cp/sub-users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/cp/sub-users/[id]
 * Remove a sub-user
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

    // Verify sub-user exists and belongs to this partner
    const { data: existingSubUser, error: fetchError } = await supabase
      .from('cp_sub_users')
      .select('id, email, role')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (fetchError || !existingSubUser) {
      return NextResponse.json(
        { success: false, error: 'Sub-user not found' },
        { status: 404 }
      )
    }

    // Delete sub-user (include partner_id filter to prevent IDOR)
    const { error: deleteError } = await supabase
      .from('cp_sub_users')
      .delete()
      .eq('id', id)
      .eq('partner_id', partner.id)

    if (deleteError) {
      apiLogger.error('Error deleting sub-user:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to remove sub-user' },
        { status: 500 }
      )
    }

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'SUBUSER_REMOVE',
      action_description: `Removed sub-user ${existingSubUser.email} (${existingSubUser.role})`,
      section: 'access-control',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Sub-user removed successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/partners/cp/sub-users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get default permissions for a role
 */
function getRolePermissions(role: SubUserRole): string[] {
  const permissionMap: Record<SubUserRole, string[]> = {
    FINANCE: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.lender.view_payout',
      'cp.disbursement.view',
      'cp.payout.view',
      'cp.payout.view_detailed',
      'cp.payout.raise_dispute',
      'cp.document.view',
      'cp.audit.view',
      'cp.audit.export'
    ],
    COMPLIANCE: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.disbursement.view',
      'cp.document.view',
      'cp.document.upload',
      'cp.audit.view',
      'cp.audit.export',
      'cp.compliance.report'
    ],
    OPERATIONS: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.disbursement.view',
      'cp.disbursement.submit',
      'cp.disbursement.bulk_upload',
      'cp.document.view',
      'cp.audit.view'
    ],
    VIEWER: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.disbursement.view',
      'cp.document.view',
      'cp.audit.view'
    ]
  }

  return permissionMap[role] || []
}
